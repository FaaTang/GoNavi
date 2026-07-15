package app

import (
	"GoNavi-Wails/internal/connection"
	"GoNavi-Wails/internal/db"
	"sort"
	"strconv"
	"strings"
)

type ddlGroupedIndex struct {
	Name      string
	Columns   []string
	Unique    bool
	IndexType string
	SubPart   int
}

func enrichCreateStatementWithIndexes(
	dbInst db.Database,
	dbType string,
	metadataSchemaName string,
	metadataTableName string,
	ddlSchemaName string,
	ddlTableName string,
	ddl string,
) string {
	trimmed := strings.TrimSpace(ddl)
	if trimmed == "" || isViewDDLText(trimmed) {
		return ddl
	}

	indexes, err := dbInst.GetIndexes(metadataSchemaName, metadataTableName)
	if err != nil || len(indexes) == 0 {
		return ddl
	}

	statements := buildDDLIndexStatements(dbType, ddlSchemaName, ddlTableName, trimmed, indexes)
	if len(statements) == 0 {
		return ddl
	}

	var builder strings.Builder
	builder.WriteString(strings.TrimRight(trimmed, "\n"))
	for _, statement := range statements {
		builder.WriteString("\n\n")
		builder.WriteString(statement)
	}
	return builder.String()
}

func isViewDDLText(ddl string) bool {
	for _, line := range strings.Split(ddl, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "--") || strings.HasPrefix(line, "/*") || strings.HasPrefix(line, "*") {
			continue
		}
		lower := strings.ToLower(line)
		return strings.HasPrefix(lower, "create view") || strings.HasPrefix(lower, "create or replace view")
	}
	return false
}

func buildDDLIndexStatements(
	dbType string,
	schemaName string,
	tableName string,
	ddl string,
	indexes []connection.IndexDefinition,
) []string {
	grouped := groupDDLIndexDefinitions(indexes)
	if len(grouped) == 0 {
		return nil
	}

	qualifiedTable := quoteTableIdentByType(dbType, schemaName, tableName)
	statements := make([]string, 0, len(grouped))
	for _, idx := range grouped {
		if shouldSkipDDLIndex(dbType, ddl, idx) {
			continue
		}
		quotedColumns := make([]string, 0, len(idx.Columns))
		for _, column := range idx.Columns {
			quotedColumns = append(quotedColumns, formatDDLIndexColumn(dbType, column, idx.SubPart))
		}
		prefix := "CREATE INDEX"
		if idx.Unique {
			prefix = "CREATE UNIQUE INDEX"
		}
		statements = append(statements, strings.Join([]string{
			prefix,
			quoteIdentByType(dbType, idx.Name),
			"ON",
			qualifiedTable,
			"(" + strings.Join(quotedColumns, ", ") + ");",
		}, " "))
	}
	return statements
}

func groupDDLIndexDefinitions(indexes []connection.IndexDefinition) []ddlGroupedIndex {
	if len(indexes) == 0 {
		return nil
	}

	groupMap := make(map[string][]connection.IndexDefinition)
	order := make([]string, 0)
	for _, idx := range indexes {
		name := strings.TrimSpace(idx.Name)
		if name == "" {
			continue
		}
		if _, ok := groupMap[name]; !ok {
			order = append(order, name)
		}
		groupMap[name] = append(groupMap[name], idx)
	}

	grouped := make([]ddlGroupedIndex, 0, len(groupMap))
	for _, name := range order {
		rows := groupMap[name]
		sort.SliceStable(rows, func(i, j int) bool {
			return rows[i].SeqInIndex < rows[j].SeqInIndex
		})

		item := ddlGroupedIndex{Name: name, Unique: true, IndexType: "BTREE"}
		for _, row := range rows {
			if row.NonUnique != 0 {
				item.Unique = false
			}
			if strings.TrimSpace(row.IndexType) != "" {
				item.IndexType = row.IndexType
			}
			if row.SubPart > 0 && item.SubPart == 0 {
				item.SubPart = row.SubPart
			}
			column := strings.TrimSpace(row.ColumnName)
			if column != "" {
				item.Columns = append(item.Columns, column)
			}
		}
		grouped = append(grouped, item)
	}
	return grouped
}

func shouldSkipDDLIndex(dbType string, ddl string, idx ddlGroupedIndex) bool {
	name := strings.TrimSpace(idx.Name)
	if name == "" || len(idx.Columns) == 0 {
		return true
	}

	lowerName := strings.ToLower(name)
	if strings.EqualFold(name, "PRIMARY") || strings.EqualFold(name, "PRIMARY KEY") {
		return true
	}
	if strings.HasPrefix(lowerName, "sqlite_autoindex_") {
		return true
	}
	if strings.HasSuffix(lowerName, "_pkey") {
		return true
	}
	if strings.HasPrefix(lowerName, "pk_") || strings.HasPrefix(lowerName, "pk__") {
		return true
	}
	if dbType == "sqlserver" && idx.Unique && strings.Contains(strings.ToUpper(idx.IndexType), "CLUSTERED") {
		return true
	}
	return ddlContainsIndexName(ddl, name)
}

func ddlContainsIndexName(ddl string, indexName string) bool {
	name := strings.TrimSpace(indexName)
	if name == "" {
		return false
	}

	lowerDDL := strings.ToLower(ddl)
	lowerName := strings.ToLower(name)
	patterns := []string{
		"create index " + lowerName,
		"create unique index " + lowerName,
		"index " + lowerName + " ",
		"index `" + lowerName + "`",
		"index \"" + lowerName + "\"",
		"index [" + lowerName + "]",
		"key " + lowerName + " ",
		"key `" + lowerName + "`",
		"key \"" + lowerName + "\"",
		"key [" + lowerName + "]",
		"constraint " + lowerName + " primary key",
		"constraint \"" + lowerName + "\" primary key",
		"constraint `" + lowerName + "` primary key",
	}
	for _, pattern := range patterns {
		if strings.Contains(lowerDDL, pattern) {
			return true
		}
	}
	return false
}

func formatDDLIndexColumn(dbType string, column string, subPart int) string {
	quoted := quoteIdentByType(dbType, column)
	if subPart > 0 && isMySQLLikeDDLType(dbType) {
		return quoted + "(" + strconv.Itoa(subPart) + ")"
	}
	return quoted
}

func isMySQLLikeDDLType(dbType string) bool {
	switch dbType {
	case "mysql", "mariadb", "oceanbase", "diros", "starrocks", "sphinx", "tdengine", "goldendb":
		return true
	default:
		return false
	}
}
