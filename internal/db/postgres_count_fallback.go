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

const defaultPostgresFallbackFieldMaxLen = 255

var postgresTextLengthRe = regexp.MustCompile(`(?i)^(var)?char(?:acter)?(?:\s+varying)?\((\d+)\)$`)

type postgresWhereClause struct {
	SQL     string
	Args    []interface{}
	Columns []string
}

type postgresCountLocateResult struct {
	Where          *postgresWhereClause
	Count          int64
	ReasonType     string
	SQLLogs        []string
	CandidateTried []string
}

func postgresFallbackFieldMaxLen(changes connection.ChangeSet) int {
	if changes.FallbackFieldMaxLen > 0 {
		return changes.FallbackFieldMaxLen
	}
	return defaultPostgresFallbackFieldMaxLen
}

func quotePostgresIdent(name string) string {
	n := strings.TrimSpace(name)
	n = strings.Trim(n, "\"")
	n = strings.ReplaceAll(n, "\"", "\"\"")
	if n == "" {
		return "\"\""
	}
	return `"` + n + `"`
}

func qualifyPostgresTable(tableName string) string {
	schema := ""
	table := strings.TrimSpace(tableName)
	if parts := strings.SplitN(table, ".", 2); len(parts) == 2 {
		schema = strings.TrimSpace(parts[0])
		table = strings.TrimSpace(parts[1])
	}
	if schema != "" {
		return fmt.Sprintf("%s.%s", quotePostgresIdent(schema), quotePostgresIdent(table))
	}
	return quotePostgresIdent(table)
}

func isPostgresCountFallbackCandidateType(columnType string, maxLen int) bool {
	raw := strings.ToLower(strings.TrimSpace(columnType))
	if raw == "" {
		return true
	}
	base := raw
	if idx := strings.Index(base, "("); idx >= 0 {
		base = strings.TrimSpace(base[:idx])
	}
	switch base {
	case "bytea",
		"json", "jsonb",
		"float", "float4", "float8", "double", "double precision", "real":
		return false
	case "text", "xml":
		return false
	}
	if strings.Contains(raw, "bytea") {
		return false
	}
	if matches := postgresTextLengthRe.FindStringSubmatch(raw); len(matches) > 0 {
		if n, err := strconv.Atoi(matches[2]); err == nil && n > maxLen {
			return false
		}
	}
	// character varying without length ≈ text
	if base == "character varying" || base == "varchar" {
		if !strings.Contains(raw, "(") {
			return false
		}
	}
	return true
}

func postgresCountFallbackCandidateColumns(
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
		if !isPostgresCountFallbackCandidateType(colType, maxLen) {
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

func buildPostgresWhereFromOriginal(
	columns []string,
	original map[string]interface{},
	argStart int,
) *postgresWhereClause {
	if len(columns) == 0 {
		return nil
	}
	wheres := make([]string, 0, len(columns))
	args := make([]interface{}, 0, len(columns))
	used := make([]string, 0, len(columns))
	idx := argStart
	for _, col := range columns {
		val, ok := original[col]
		if !ok {
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
		ident := quotePostgresIdent(col)
		if val == nil {
			wheres = append(wheres, ident+" IS NULL")
		} else {
			idx++
			wheres = append(wheres, fmt.Sprintf("%s = $%d", ident, idx))
			args = append(args, val)
		}
		used = append(used, col)
	}
	if len(wheres) == 0 {
		return nil
	}
	return &postgresWhereClause{
		SQL:     strings.Join(wheres, " AND "),
		Args:    args,
		Columns: used,
	}
}

func (p *PostgresDB) loadColumnTypeMap(tableName string) map[string]string {
	result := map[string]string{}
	table := strings.TrimSpace(tableName)
	if table == "" {
		return result
	}
	dbName := ""
	if parts := strings.SplitN(table, ".", 2); len(parts) == 2 {
		dbName = strings.TrimSpace(parts[0])
		table = strings.TrimSpace(parts[1])
	}
	columns, err := p.GetColumns(dbName, table)
	if err != nil {
		return result
	}
	for _, col := range columns {
		name := strings.ToLower(strings.TrimSpace(col.Name))
		if name == "" {
			continue
		}
		result[name] = strings.TrimSpace(col.Type)
	}
	return result
}

func (p *PostgresDB) resolveUniqueWhereByCount(
	tx *sql.Tx,
	qualifiedTable string,
	original map[string]interface{},
	changedColumns map[string]struct{},
	columnTypeMap map[string]string,
	maxLen int,
	rowHint string,
) postgresCountLocateResult {
	result := postgresCountLocateResult{}
	candidates := postgresCountFallbackCandidateColumns(original, changedColumns, columnTypeMap, maxLen)
	if len(candidates) == 0 {
		result.ReasonType = "not_found"
		result.SQLLogs = append(result.SQLLogs, fmt.Sprintf(
			"/* COUNT locate %s */ no candidate columns", rowHint,
		))
		return result
	}

	for n := 1; n <= len(candidates); n++ {
		subset := candidates[:n]
		where := buildPostgresWhereFromOriginal(subset, original, 0)
		if where == nil {
			continue
		}
		query := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s", qualifiedTable, where.SQL)
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
	}

	result.ReasonType = "non_unique"
	return result
}
