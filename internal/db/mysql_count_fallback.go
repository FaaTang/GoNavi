package db

import (
	"database/sql"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"GoNavi-Wails/internal/connection"
)

const defaultMySQLFallbackFieldMaxLen = 255

var mysqlTextLengthRe = regexp.MustCompile(`(?i)^(var)?char\((\d+)\)$`)

type mysqlWhereClause struct {
	SQL     string
	Args    []interface{}
	Columns []string
}

type mysqlCountLocateResult struct {
	Where          *mysqlWhereClause
	Count          int64
	ReasonType     string // "" | not_found | non_unique
	SQLLogs        []string
	CandidateTried []string
}

func mysqlFallbackFieldMaxLen(changes connection.ChangeSet) int {
	if changes.FallbackFieldMaxLen > 0 {
		return changes.FallbackFieldMaxLen
	}
	return defaultMySQLFallbackFieldMaxLen
}

func isMySQLCountFallbackCandidateType(columnType string, maxLen int) bool {
	raw := strings.ToLower(strings.TrimSpace(columnType))
	if raw == "" {
		return true
	}
	base := raw
	if idx := strings.Index(base, "("); idx >= 0 {
		base = strings.TrimSpace(base[:idx])
	}
	switch base {
	case "blob", "tinyblob", "mediumblob", "longblob",
		"binary", "varbinary",
		"json",
		"float", "double", "real":
		return false
	case "text", "mediumtext", "longtext":
		return false
	case "tinytext":
		return true
	}
	if strings.Contains(raw, "blob") {
		return false
	}
	if matches := mysqlTextLengthRe.FindStringSubmatch(raw); len(matches) > 0 {
		if n, err := strconv.Atoi(matches[2]); err == nil && n > maxLen {
			return false
		}
	}
	return true
}

func mysqlCountFallbackCandidateColumns(
	original map[string]interface{},
	changedColumns map[string]struct{},
	columnTypeMap map[string]string,
	maxLen int,
) []string {
	type candidate struct {
		name   string
		isNull bool
		rank   int
	}
	var list []candidate
	for name, value := range original {
		col := strings.TrimSpace(name)
		if col == "" {
			continue
		}
		lower := strings.ToLower(col)
		if _, changed := changedColumns[lower]; changed {
			continue
		}
		colType := columnTypeMap[lower]
		if !isMySQLCountFallbackCandidateType(colType, maxLen) {
			continue
		}
		isNull := value == nil
		rank := 1
		if isNull {
			rank = 2
		}
		list = append(list, candidate{name: col, isNull: isNull, rank: rank})
	}
	sort.SliceStable(list, func(i, j int) bool {
		if list[i].rank != list[j].rank {
			return list[i].rank < list[j].rank
		}
		return strings.ToLower(list[i].name) < strings.ToLower(list[j].name)
	})
	out := make([]string, 0, len(list))
	for _, item := range list {
		out = append(out, item.name)
	}
	return out
}

func buildMySQLWhereFromOriginal(
	columns []string,
	original map[string]interface{},
	columnTypeMap map[string]string,
) *mysqlWhereClause {
	if len(columns) == 0 {
		return nil
	}
	wheres := make([]string, 0, len(columns))
	args := make([]interface{}, 0, len(columns))
	used := make([]string, 0, len(columns))
	for _, col := range columns {
		val, ok := original[col]
		if !ok {
			// 尝试大小写不敏感匹配
			lower := strings.ToLower(col)
			for k, v := range original {
				if strings.ToLower(k) == lower {
					val = v
					ok = true
					col = k
					break
				}
			}
		}
		if !ok {
			continue
		}
		ident := fmt.Sprintf("`%s`", escapeMySQLBacktickIdent(col))
		if val == nil {
			wheres = append(wheres, ident+" IS NULL")
		} else {
			wheres = append(wheres, ident+" = ?")
			args = append(args, normalizeMySQLValueForWrite(col, val, columnTypeMap))
		}
		used = append(used, col)
	}
	if len(wheres) == 0 {
		return nil
	}
	return &mysqlWhereClause{
		SQL:     strings.Join(wheres, " AND "),
		Args:    args,
		Columns: used,
	}
}

func (m *MySQLDB) resolveUniqueWhereByCount(
	tx *sql.Tx,
	tableName string,
	original map[string]interface{},
	changedColumns map[string]struct{},
	columnTypeMap map[string]string,
	maxLen int,
	rowHint string,
) mysqlCountLocateResult {
	result := mysqlCountLocateResult{}
	candidates := mysqlCountFallbackCandidateColumns(original, changedColumns, columnTypeMap, maxLen)
	if len(candidates) == 0 {
		result.ReasonType = "not_found"
		result.SQLLogs = append(result.SQLLogs, fmt.Sprintf(
			"/* COUNT locate %s */ no candidate columns", rowHint,
		))
		return result
	}

	tableIdent := fmt.Sprintf("`%s`", escapeMySQLBacktickIdent(tableName))
	for n := 1; n <= len(candidates); n++ {
		subset := candidates[:n]
		where := buildMySQLWhereFromOriginal(subset, original, columnTypeMap)
		if where == nil {
			continue
		}
		query := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s", tableIdent, where.SQL)
		var count int64
		err := tx.QueryRow(query, where.Args...).Scan(&count)
		logLine := fmt.Sprintf(
			"/* COUNT locate %s */ %s /* args=%v => %d */",
			rowHint, query, where.Args, count,
		)
		if err != nil {
			result.SQLLogs = append(result.SQLLogs, logLine+" /* error: "+err.Error()+" */")
			result.ReasonType = "unknown"
			return result
		}
		result.SQLLogs = append(result.SQLLogs, logLine)
		result.Count = count
		result.CandidateTried = append([]string{}, where.Columns...)
		if count == 1 {
			result.Where = where
			return result
		}
		if count == 0 {
			result.ReasonType = "not_found"
			return result
		}
		// count > 1：继续扩展字段
	}

	result.ReasonType = "non_unique"
	return result
}

func mysqlChangedColumnSet(values map[string]interface{}) map[string]struct{} {
	out := map[string]struct{}{}
	for k := range values {
		out[strings.ToLower(strings.TrimSpace(k))] = struct{}{}
	}
	return out
}

func mysqlRowHint(action string, index int, snapshot map[string]interface{}) string {
	parts := make([]string, 0, 3)
	keys := make([]string, 0, len(snapshot))
	for k := range snapshot {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		if len(parts) >= 3 {
			break
		}
		v := snapshot[k]
		if v == nil {
			parts = append(parts, fmt.Sprintf("%s=NULL", k))
			continue
		}
		text := fmt.Sprintf("%v", v)
		if len(text) > 40 {
			text = text[:40] + "…"
		}
		parts = append(parts, fmt.Sprintf("%s=%s", k, text))
	}
	summary := strings.Join(parts, ", ")
	if summary == "" {
		summary = "-"
	}
	return fmt.Sprintf("%s#%d(%s)", action, index+1, summary)
}

func int64Ptr(v int64) *int64 { return &v }
