package db

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
	"time"

	"GoNavi-Wails/internal/connection"
	"GoNavi-Wails/internal/logger"
	"GoNavi-Wails/internal/ssh"
	"GoNavi-Wails/internal/utils"

	"github.com/lib/pq"
)

type PostgresDB struct {
	conn        *sql.DB
	pingTimeout time.Duration
	forwarder   *ssh.LocalForwarder // Store SSH tunnel forwarder
}

type postgresSessionExecer struct {
	*sqlConnStatementExecer
}

var _ QueryMessageExecer = (*PostgresDB)(nil)
var _ StatementQueryMessageExecer = (*postgresSessionExecer)(nil)

func resolvePostgresConnectDatabases(config connection.ConnectionConfig) []string {
	explicit := strings.TrimSpace(config.Database)
	if explicit != "" {
		return []string{explicit}
	}

	candidates := []string{"postgres", "template1", strings.TrimSpace(config.User)}
	seen := make(map[string]struct{}, len(candidates))
	result := make([]string, 0, len(candidates))
	for _, name := range candidates {
		trimmed := strings.TrimSpace(name)
		if trimmed == "" {
			continue
		}
		normalized := strings.ToLower(trimmed)
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func (p *PostgresDB) getDSN(config connection.ConnectionConfig) string {
	// postgres://user:password@host:port/dbname?sslmode=disable
	dbname := config.Database
	if dbname == "" {
		dbname = "postgres" // Default DB
	}

	u := &url.URL{
		Scheme: "postgres",
		Host:   net.JoinHostPort(config.Host, strconv.Itoa(config.Port)),
		Path:   "/" + dbname,
	}
	u.User = url.UserPassword(config.User, config.Password)
	q := url.Values{}
	q.Set("sslmode", resolvePostgresSSLMode(config))
	applyPostgresSSLPathParams(q, config)
	q.Set("connect_timeout", strconv.Itoa(getConnectTimeoutSeconds(config)))
	mergeConnectionParamsFromConfigWithAllowlist(q, config, postgresConnectionParamNames, "postgres", "postgresql", "opengauss")
	u.RawQuery = q.Encode()

	return u.String()
}

func (p *PostgresDB) Connect(config connection.ConnectionConfig) error {
	if supported, reason := DriverRuntimeSupportStatus("postgres"); !supported {
		if strings.TrimSpace(reason) == "" {
			reason = localizedDriverRuntimeText("driver_manager.backend.status.optional_disabled", map[string]any{"name": "PostgreSQL"})
		}
		return fmt.Errorf("%s", reason)
	}

	runConfig := config
	p.pingTimeout = getConnectTimeout(config)

	cleanupOnFailure := true
	defer func() {
		if !cleanupOnFailure {
			return
		}
		if p.conn != nil {
			_ = p.conn.Close()
			p.conn = nil
		}
		if p.forwarder != nil {
			_ = p.forwarder.Close()
			p.forwarder = nil
		}
	}()

	if config.UseSSH {
		// Create SSH tunnel with local port forwarding
		logger.Infof("PostgreSQL 使用 SSH 连接：地址=%s:%d 用户=%s", config.Host, config.Port, config.User)

		forwarder, err := ssh.GetOrCreateLocalForwarder(config.SSH, config.Host, config.Port)
		if err != nil {
			return fmt.Errorf("创建 SSH 隧道失败：%w", err)
		}
		p.forwarder = forwarder

		// Parse local address
		host, portStr, err := net.SplitHostPort(forwarder.LocalAddr)
		if err != nil {
			return fmt.Errorf("解析本地转发地址失败：%w", err)
		}

		port, err := strconv.Atoi(portStr)
		if err != nil {
			return fmt.Errorf("解析本地端口失败：%w", err)
		}

		// Create a modified config pointing to local forwarder
		localConfig := config
		localConfig.Host = host
		localConfig.Port = port
		localConfig.UseSSH = false // Disable SSH flag for DSN generation

		runConfig = localConfig
		logger.Infof("PostgreSQL 通过本地端口转发连接：%s -> %s:%d", forwarder.LocalAddr, config.Host, config.Port)
	}

	sslAttempts := []connection.ConnectionConfig{runConfig}
	if shouldTrySSLPreferredFallback(runConfig) {
		sslAttempts = append(sslAttempts, withSSLDisabled(runConfig))
	}

	var failures []string
	for sslIndex, sslConfig := range sslAttempts {
		sslLabel := "SSL"
		if sslIndex > 0 {
			sslLabel = "明文回退"
		}

		attemptDBs := resolvePostgresConnectDatabases(sslConfig)
		for _, dbName := range attemptDBs {
			attemptConfig := sslConfig
			attemptConfig.Database = dbName
			dsn := p.getDSN(attemptConfig)

			dbConn, err := sql.Open("postgres", dsn)
			if err != nil {
				failures = append(failures, fmt.Sprintf("%s 数据库=%s 打开连接失败: %v", sslLabel, dbName, err))
				continue
			}
			configureSQLConnectionPool(dbConn, "postgres")
			p.conn = dbConn

			// Force verification
			if err := p.Ping(); err != nil {
				failures = append(failures, fmt.Sprintf("%s 数据库=%s 验证失败: %v", sslLabel, dbName, err))
				_ = dbConn.Close()
				p.conn = nil
				continue
			}

			if sslIndex > 0 {
				logger.Warnf("PostgreSQL SSL 优先连接失败，已回退至明文连接")
			}
			if strings.TrimSpace(config.Database) == "" && !strings.EqualFold(dbName, "postgres") {
				logger.Infof("PostgreSQL 自动选择连接数据库：%s", dbName)
			}

			// 设置 search_path，使所有用户 schema 下的表可以不带 schema 前缀访问
			p.ensureSearchPath(dsn)

			cleanupOnFailure = false
			return nil
		}
	}

	if len(failures) == 0 {
		return fmt.Errorf("连接建立后验证失败：未找到可用的连接数据库")
	}
	return fmt.Errorf("连接建立后验证失败：%s", strings.Join(failures, "；"))
}

func (p *PostgresDB) Close() error {
	// Close SSH forwarder first if exists
	if p.forwarder != nil {
		if err := p.forwarder.Close(); err != nil {
			logger.Warnf("关闭 PostgreSQL SSH 端口转发失败：%v", err)
		}
		p.forwarder = nil
	}

	// Then close database connection
	if p.conn != nil {
		return p.conn.Close()
	}
	return nil
}

func (p *PostgresDB) Ping() error {
	if p.conn == nil {
		return fmt.Errorf("连接未打开")
	}
	timeout := p.pingTimeout
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	ctx, cancel := utils.ContextWithTimeout(timeout)
	defer cancel()
	return p.conn.PingContext(ctx)
}

func (p *PostgresDB) QueryContext(ctx context.Context, query string) ([]map[string]interface{}, []string, error) {
	if p.conn == nil {
		return nil, nil, fmt.Errorf("连接未打开")
	}

	rows, err := p.conn.QueryContext(ctx, query)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	return scanRows(rows)
}

func (p *PostgresDB) QueryContextWithMessages(ctx context.Context, query string) ([]map[string]interface{}, []string, []string, error) {
	if p.conn == nil {
		return nil, nil, nil, fmt.Errorf("连接未打开")
	}

	conn, err := p.conn.Conn(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	defer conn.Close()

	return queryPostgresConnWithMessages(ctx, conn, query)
}

func (p *PostgresDB) Query(query string) ([]map[string]interface{}, []string, error) {
	if p.conn == nil {
		return nil, nil, fmt.Errorf("连接未打开")
	}

	rows, err := p.conn.Query(query)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	return scanRows(rows)
}

func (p *PostgresDB) QueryWithMessages(query string) ([]map[string]interface{}, []string, []string, error) {
	return p.QueryContextWithMessages(context.Background(), query)
}

func (p *PostgresDB) ExecBatchContext(ctx context.Context, query string) (int64, error) {
	if p.conn == nil {
		return 0, fmt.Errorf("连接未打开")
	}
	res, err := p.conn.ExecContext(ctx, query)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func (p *PostgresDB) OpenSessionExecer(ctx context.Context) (StatementExecer, error) {
	if p.conn == nil {
		return nil, fmt.Errorf("连接未打开")
	}
	conn, err := p.conn.Conn(ctx)
	if err != nil {
		return nil, err
	}
	return &postgresSessionExecer{sqlConnStatementExecer: &sqlConnStatementExecer{conn: conn}}, nil
}

func (p *PostgresDB) ExecContext(ctx context.Context, query string) (int64, error) {
	if p.conn == nil {
		return 0, fmt.Errorf("连接未打开")
	}
	res, err := p.conn.ExecContext(ctx, query)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func (p *PostgresDB) Exec(query string) (int64, error) {
	if p.conn == nil {
		return 0, fmt.Errorf("连接未打开")
	}
	res, err := p.conn.Exec(query)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func (e *postgresSessionExecer) QueryWithMessages(query string) ([]map[string]interface{}, []string, []string, error) {
	return e.QueryContextWithMessages(context.Background(), query)
}

func (e *postgresSessionExecer) QueryContextWithMessages(ctx context.Context, query string) ([]map[string]interface{}, []string, []string, error) {
	if e == nil || e.conn == nil {
		return nil, nil, nil, fmt.Errorf("连接未打开")
	}
	return queryPostgresConnWithMessages(ctx, e.conn, query)
}

func queryPostgresConnWithMessages(ctx context.Context, conn *sql.Conn, query string) ([]map[string]interface{}, []string, []string, error) {
	return querySQLConnWithTextNotices(ctx, conn, query, func(driverConn driver.Conn, addNotice func(string)) {
		if addNotice == nil {
			pq.SetNoticeHandler(driverConn, nil)
			return
		}
		pq.SetNoticeHandler(driverConn, func(notice *pq.Error) {
			if notice != nil {
				addNotice(notice.Message)
			}
		})
	})
}

func (p *PostgresDB) GetDatabases() ([]string, error) {
	data, _, err := p.Query("SELECT datname FROM pg_database WHERE datistemplate = false")
	if err != nil {
		return nil, err
	}
	var dbs []string
	for _, row := range data {
		if val, ok := row["datname"]; ok {
			dbs = append(dbs, fmt.Sprintf("%v", val))
		}
	}
	return dbs, nil
}

func (p *PostgresDB) GetTables(dbName string) ([]string, error) {
	query := buildPostgresTablesQuery()
	data, _, err := p.Query(query)
	if err != nil {
		data, _, err = p.Query(buildPostgresLegacyTablesQuery())
		if err != nil {
			return nil, err
		}
	}

	tables := parsePostgresTableNames(data)
	return resolveShardingSphereLogicalTables(tables, p.Query), nil
}

func buildPostgresTablesQuery() string {
	return `
SELECT DISTINCT
	n.nspname AS schemaname,
	c.relname AS tablename
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname != 'information_schema'
  AND n.nspname NOT LIKE 'pg|_%' ESCAPE '|'
ORDER BY n.nspname, c.relname`
}

func buildPostgresLegacyTablesQuery() string {
	return "SELECT schemaname, tablename FROM pg_catalog.pg_tables WHERE schemaname != 'information_schema' AND schemaname NOT LIKE 'pg|_%' ESCAPE '|' ORDER BY schemaname, tablename"
}

func parsePostgresTableNames(data []map[string]interface{}) []string {
	tables := make([]string, 0, len(data))
	seen := make(map[string]struct{}, len(data))
	for _, row := range data {
		schema := getCaseInsensitiveRowString(row, "schemaname", "schema_name", "schema", "nspname")
		name := getCaseInsensitiveRowString(row, "tablename", "table_name", "relname", "name")
		if name == "" {
			continue
		}
		table := name
		if schema != "" {
			table = fmt.Sprintf("%s.%s", schema, name)
		}
		key := strings.ToLower(table)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		tables = append(tables, table)
	}
	return tables
}

func (p *PostgresDB) GetCreateStatement(dbName, tableName string) (string, error) {
	return fmt.Sprintf("-- SHOW CREATE TABLE not fully supported for PostgreSQL in this MVP.\n-- Table: %s", tableName), nil
}

func (p *PostgresDB) GetColumns(dbName, tableName string) ([]connection.ColumnDefinition, error) {
	schema, table := normalizePGLikeMetadataTable(dbName, tableName)
	if table == "" {
		return nil, localizedDatabaseRuntimeError("db.backend.error.table_name_required", nil)
	}

	data, _, err := p.Query(buildPGLikeColumnsMetadataQuery(schema, table))
	if err != nil {
		return nil, err
	}

	return buildPGLikeColumnDefinitions(data), nil
}

func (p *PostgresDB) GetIndexes(dbName, tableName string) ([]connection.IndexDefinition, error) {
	schema, table := normalizePGLikeMetadataTable(dbName, tableName)
	if table == "" {
		return nil, localizedDatabaseRuntimeError("db.backend.error.table_name_required", nil)
	}

	data, _, err := p.Query(buildPGLikeIndexesMetadataQuery(schema, table))
	if err != nil {
		return nil, err
	}

	return buildPGLikeIndexDefinitions(data), nil
}

func (p *PostgresDB) GetForeignKeys(dbName, tableName string) ([]connection.ForeignKeyDefinition, error) {
	schema := strings.TrimSpace(dbName)
	if schema == "" {
		schema = "public"
	}
	table := strings.TrimSpace(tableName)
	if table == "" {
		return nil, localizedDatabaseRuntimeError("db.backend.error.table_name_required", nil)
	}

	esc := func(s string) string { return strings.ReplaceAll(s, "'", "''") }

	query := fmt.Sprintf(`
SELECT
	tc.constraint_name AS constraint_name,
	kcu.column_name AS column_name,
	ccu.table_schema AS foreign_table_schema,
	ccu.table_name AS foreign_table_name,
	ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = '%s'
  AND tc.table_schema = '%s'
ORDER BY tc.constraint_name, kcu.ordinal_position`, esc(table), esc(schema))

	data, _, err := p.Query(query)
	if err != nil {
		return nil, err
	}

	var fks []connection.ForeignKeyDefinition
	for _, row := range data {
		refSchema := ""
		if v, ok := row["foreign_table_schema"]; ok && v != nil {
			refSchema = fmt.Sprintf("%v", v)
		}
		refTable := fmt.Sprintf("%v", row["foreign_table_name"])
		refTableName := refTable
		if strings.TrimSpace(refSchema) != "" {
			refTableName = fmt.Sprintf("%s.%s", refSchema, refTable)
		}

		fk := connection.ForeignKeyDefinition{
			Name:           fmt.Sprintf("%v", row["constraint_name"]),
			ColumnName:     fmt.Sprintf("%v", row["column_name"]),
			RefTableName:   refTableName,
			RefColumnName:  fmt.Sprintf("%v", row["foreign_column_name"]),
			ConstraintName: fmt.Sprintf("%v", row["constraint_name"]),
		}
		fks = append(fks, fk)
	}
	return fks, nil
}

func (p *PostgresDB) GetTriggers(dbName, tableName string) ([]connection.TriggerDefinition, error) {
	schema := strings.TrimSpace(dbName)
	if schema == "" {
		schema = "public"
	}
	table := strings.TrimSpace(tableName)
	if table == "" {
		return nil, localizedDatabaseRuntimeError("db.backend.error.table_name_required", nil)
	}

	esc := func(s string) string { return strings.ReplaceAll(s, "'", "''") }

	query := fmt.Sprintf(`
SELECT trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = '%s'
  AND event_object_schema = '%s'
ORDER BY trigger_name, event_manipulation`, esc(table), esc(schema))

	data, _, err := p.Query(query)
	if err != nil {
		return nil, err
	}

	var triggers []connection.TriggerDefinition
	for _, row := range data {
		trig := connection.TriggerDefinition{
			Name:      fmt.Sprintf("%v", row["trigger_name"]),
			Timing:    fmt.Sprintf("%v", row["action_timing"]),
			Event:     fmt.Sprintf("%v", row["event_manipulation"]),
			Statement: fmt.Sprintf("%v", row["action_statement"]),
		}
		triggers = append(triggers, trig)
	}
	return triggers, nil
}

func (p *PostgresDB) GetAllColumns(dbName string) ([]connection.ColumnDefinitionWithTable, error) {
	query := `
SELECT
	c.table_schema,
	c.table_name,
	c.column_name,
	c.data_type,
	col_description(cls.oid, a.attnum) AS comment
FROM information_schema.columns c
LEFT JOIN pg_namespace n ON n.nspname = c.table_schema
LEFT JOIN pg_class cls ON cls.relnamespace = n.oid AND cls.relname = c.table_name
LEFT JOIN pg_attribute a ON a.attrelid = cls.oid AND a.attname = c.column_name
WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
  AND c.table_schema NOT LIKE 'pg|_%' ESCAPE '|'
ORDER BY c.table_schema, c.table_name, c.ordinal_position`

	data, _, err := p.Query(query)
	if err != nil {
		return nil, err
	}

	var cols []connection.ColumnDefinitionWithTable
	for _, row := range data {
		schema := fmt.Sprintf("%v", row["table_schema"])
		table := fmt.Sprintf("%v", row["table_name"])
		tableName := table
		if strings.TrimSpace(schema) != "" {
			tableName = fmt.Sprintf("%s.%s", schema, table)
		}

		col := connection.ColumnDefinitionWithTable{
			TableName: tableName,
			Name:      fmt.Sprintf("%v", row["column_name"]),
			Type:      fmt.Sprintf("%v", row["data_type"]),
			Comment:   fmt.Sprintf("%v", row["comment"]),
		}
		cols = append(cols, col)
	}
	return cols, nil
}

// ensureSearchPath 查询当前数据库中所有用户 schema，通过重建连接池将 search_path 写入 DSN。
// 仅使用 SET search_path 只对连接池中的单个连接生效，后续查询可能拿到未设置的连接。
// 将 search_path 写入 DSN (lib/pq 支持任意 PostgreSQL runtime parameter)，
// 使连接池中每个连接建立时自动携带 search_path，与金仓行为一致。
func (p *PostgresDB) ensureSearchPath(baseDSN string) {
	if p.conn == nil {
		return
	}

	rawSchemas := p.queryUserSchemas()
	if len(rawSchemas) == 0 {
		return
	}

	// 构建 search_path SQL 片段（带双引号转义），用于 SET 兜底
	searchPathSQL, normalizedSchemas := buildKingbaseSearchPathCommon(rawSchemas)
	if strings.TrimSpace(searchPathSQL) == "" {
		return
	}

	// 策略 1：将 search_path 写入 DSN，重建连接池
	// lib/pq 支持在 URL 查参数中设置任意 PostgreSQL runtime parameter，
	// 如 ?search_path=ce,public，每个新连接建立时会自动 SET search_path。
	searchPathDSNVal := strings.Join(normalizedSchemas, ",")
	u, parseErr := url.Parse(baseDSN)
	if parseErr == nil {
		q := u.Query()
		q.Set("search_path", searchPathDSNVal)
		u.RawQuery = q.Encode()
		newDSN := u.String()

		newDB, err := sql.Open("postgres", newDSN)
		if err == nil {
			configureSQLConnectionPool(newDB, "postgres")
			newDB.SetConnMaxLifetime(5 * time.Minute)
			oldConn := p.conn
			p.conn = newDB
			if err := p.Ping(); err == nil {
				_ = oldConn.Close()
				logger.Infof("PostgreSQL 已通过 DSN 配置 search_path：%s", searchPathDSNVal)
				return
			}
			// DSN 方式失败，回滚
			_ = newDB.Close()
			p.conn = oldConn
			logger.Warnf("PostgreSQL DSN search_path 验证失败，回退至 SET 方式")
		}
	}

	// 策略 2 兜底：通过 SET search_path 设置（仅影响单个连接，但聊胜于无）
	timeout := p.pingTimeout
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	ctx, cancel := utils.ContextWithTimeout(timeout)
	defer cancel()

	if _, err := p.conn.ExecContext(ctx, fmt.Sprintf("SET search_path TO %s", searchPathSQL)); err != nil {
		logger.Warnf("PostgreSQL 设置 search_path 失败：%v", err)
		return
	}
	logger.Infof("PostgreSQL 已通过 SET 设置 search_path：%s", searchPathSQL)
}

// queryUserSchemas 查询当前数据库中所有用户 schema。
func (p *PostgresDB) queryUserSchemas() []string {
	if p.conn == nil {
		return nil
	}

	query := `SELECT nspname FROM pg_namespace
		WHERE nspname NOT IN ('pg_catalog', 'information_schema')
		  AND nspname NOT LIKE 'pg|_%' ESCAPE '|'
		ORDER BY nspname`

	rows, err := p.conn.Query(query)
	if err != nil {
		logger.Warnf("PostgreSQL 查询用户 schema 失败：%v", err)
		return nil
	}
	defer rows.Close()

	var schemas []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			continue
		}
		name = strings.TrimSpace(name)
		if name != "" {
			schemas = append(schemas, name)
		}
	}
	return schemas
}

func (p *PostgresDB) ApplyChanges(tableName string, changes connection.ChangeSet) error {
	result, err := p.ApplyChangesDetailed(tableName, changes)
	if err != nil {
		return err
	}
	if result != nil && result.Rollback {
		return fmt.Errorf("%s", firstApplyChangesErrorMessage(result))
	}
	return nil
}

func (p *PostgresDB) ApplyChangesDetailed(tableName string, changes connection.ChangeSet) (*connection.ApplyChangesResult, error) {
	if p.conn == nil {
		return nil, fmt.Errorf("连接未打开")
	}

	columnTypeMap := p.loadColumnTypeMap(tableName)
	fallbackEnabled := changes.FallbackLocateEnabled
	maxLen := postgresFallbackFieldMaxLen(changes)
	summary := &connection.ApplyChangesResult{}
	qualifiedTable := qualifyPostgresTable(tableName)

	tx, err := p.conn.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	appendDetail := func(detail connection.ApplyChangesDetail) {
		summary.Details = append(summary.Details, detail)
	}
	appendLogs := func(logs []string) {
		summary.SQLLogs = append(summary.SQLLogs, logs...)
	}

	resolveWhere := func(
		action string,
		index int,
		keys map[string]interface{},
		original map[string]interface{},
		changed map[string]struct{},
		argStart int,
	) (where *postgresWhereClause, usedLocator string, countBefore *int64, hardFail bool, zeroHit bool) {
		rowHint := mysqlRowHint(action, index, original)
		if len(keys) > 0 {
			wheres := make([]string, 0, len(keys))
			args := make([]interface{}, 0, len(keys))
			cols := make([]string, 0, len(keys))
			idx := argStart
			for k, v := range keys {
				idx++
				wheres = append(wheres, fmt.Sprintf("%s = $%d", quotePostgresIdent(k), idx))
				args = append(args, v)
				cols = append(cols, k)
			}
			return &postgresWhereClause{SQL: strings.Join(wheres, " AND "), Args: args, Columns: cols},
				changes.LocatorStrategy, nil, false, false
		}
		if !fallbackEnabled {
			if action == "delete" && len(keys) == 0 {
				return nil, "", nil, false, true
			}
			appendDetail(connection.ApplyChangesDetail{
				RowHint:    rowHint,
				Action:     action,
				ReasonType: "unknown",
				Message:    "更新/删除操作需要主键条件或启用 COUNT 二次定位",
			})
			return nil, "", nil, true, false
		}
		locate := p.resolveUniqueWhereByCount(tx, qualifiedTable, original, changed, columnTypeMap, maxLen, rowHint)
		appendLogs(locate.SQLLogs)
		if locate.Where != nil {
			// COUNT 阶段占位从 $1 起；若前面已有 SET 参数，需按 argStart 重建 WHERE
			where = buildPostgresWhereFromOriginal(locate.Where.Columns, original, argStart)
			if where == nil {
				appendDetail(connection.ApplyChangesDetail{
					RowHint:    rowHint,
					Action:     action,
					ReasonType: "not_found",
					Message:    "COUNT 定位条件重建失败，已跳过",
				})
				summary.ZeroHitCount++
				return nil, "count-where", int64Ptr(locate.Count), false, true
			}
			c := locate.Count
			return where, "count-where", &c, false, false
		}
		if locate.ReasonType == "not_found" {
			appendDetail(connection.ApplyChangesDetail{
				RowHint:        rowHint,
				Action:         action,
				UsedLocator:    "count-where",
				WhereColumns:   locate.CandidateTried,
				CountBeforeDml: int64Ptr(locate.Count),
				ReasonType:     "not_found",
				Message:        fmt.Sprintf("定位未命中（COUNT=%d），已跳过", locate.Count),
			})
			summary.ZeroHitCount++
			return nil, "count-where", int64Ptr(locate.Count), false, true
		}
		msg := fmt.Sprintf("定位条件命中多行（COUNT=%d），为避免误更新已回滚", locate.Count)
		if locate.ReasonType == "unknown" {
			msg = "COUNT 二次定位失败，已回滚"
		}
		appendDetail(connection.ApplyChangesDetail{
			RowHint:        rowHint,
			Action:         action,
			UsedLocator:    "count-where",
			WhereColumns:   locate.CandidateTried,
			CountBeforeDml: int64Ptr(locate.Count),
			ReasonType:     "non_unique",
			Message:        msg,
		})
		summary.Rollback = true
		return nil, "count-where", int64Ptr(locate.Count), true, false
	}

	handleAffected := func(
		action string,
		index int,
		snapshot map[string]interface{},
		usedLocator string,
		whereCols []string,
		countBefore *int64,
		res sql.Result,
		query string,
		args []interface{},
	) error {
		rowHint := mysqlRowHint(action, index, snapshot)
		affected, err := res.RowsAffected()
		logLine := fmt.Sprintf("/* %s %s */ %s /* args=%v => affected=%d */", action, rowHint, query, args, affected)
		if err != nil {
			appendLogs([]string{logLine + " /* rowsAffected error: " + err.Error() + " */"})
			return err
		}
		appendLogs([]string{logLine})
		if usedLocator == "count-where" {
			if affected > 1 {
				summary.Rollback = true
				appendDetail(connection.ApplyChangesDetail{
					RowHint:        rowHint,
					Action:         action,
					UsedLocator:    usedLocator,
					WhereColumns:   whereCols,
					CountBeforeDml: countBefore,
					AffectedRows:   int64Ptr(affected),
					ReasonType:     "non_unique",
					Message:        fmt.Sprintf("提交失败，已整批回滚。定位条件命中多行（affected_rows=%d），为避免误更新已回滚。", affected),
				})
				return fmt.Errorf("%s", summary.Details[len(summary.Details)-1].Message)
			}
			if affected == 0 {
				summary.ZeroHitCount++
				appendDetail(connection.ApplyChangesDetail{
					RowHint:        rowHint,
					Action:         action,
					UsedLocator:    usedLocator,
					WhereColumns:   whereCols,
					CountBeforeDml: countBefore,
					AffectedRows:   int64Ptr(affected),
					ReasonType:     "concurrency",
					Message:        "未命中（affected_rows=0），已跳过",
				})
				return nil
			}
			summary.SuccessCount++
			appendDetail(connection.ApplyChangesDetail{
				RowHint:        rowHint,
				Action:         action,
				UsedLocator:    usedLocator,
				WhereColumns:   whereCols,
				CountBeforeDml: countBefore,
				AffectedRows:   int64Ptr(affected),
				Message:        "success",
			})
			return nil
		}
		if err := requireSingleRowAffected(res, rowMutationAction(action)); err != nil {
			return err
		}
		summary.SuccessCount++
		appendDetail(connection.ApplyChangesDetail{
			RowHint:      rowHint,
			Action:       action,
			UsedLocator:  usedLocator,
			WhereColumns: whereCols,
			AffectedRows: int64Ptr(affected),
			Message:      "success",
		})
		return nil
	}

	// 1. Deletes
	for i, pk := range changes.Deletes {
		original := pk
		keys := pk
		if fallbackEnabled && (changes.LocatorStrategy == "none" || len(keys) == 0) {
			keys = nil
		}
		where, usedLocator, countBefore, hardFail, zeroHit := resolveWhere("delete", i, keys, original, nil, 0)
		if hardFail {
			return summary, fmt.Errorf("%s", firstApplyChangesErrorMessage(summary))
		}
		if zeroHit || where == nil {
			continue
		}
		query := fmt.Sprintf("DELETE FROM %s WHERE %s", qualifiedTable, where.SQL)
		res, err := tx.Exec(query, where.Args...)
		if err != nil {
			return summary, fmt.Errorf("删除失败：%v", err)
		}
		if err := handleAffected("delete", i, original, usedLocator, where.Columns, countBefore, res, query, where.Args); err != nil {
			return summary, err
		}
		if summary.Rollback {
			return summary, fmt.Errorf("%s", firstApplyChangesErrorMessage(summary))
		}
	}

	// 2. Updates
	for i, update := range changes.Updates {
		var sets []string
		var setArgs []interface{}
		idx := 0
		for k, v := range update.Values {
			idx++
			sets = append(sets, fmt.Sprintf("%s = $%d", quotePostgresIdent(k), idx))
			setArgs = append(setArgs, v)
		}
		if len(sets) == 0 {
			continue
		}

		original := update.Original
		if original == nil {
			original = update.Keys
		}
		keys := update.Keys
		if fallbackEnabled && (changes.LocatorStrategy == "none" || len(keys) == 0) {
			keys = nil
		}
		where, usedLocator, countBefore, hardFail, zeroHit := resolveWhere(
			"update", i, keys, original, mysqlChangedColumnSet(update.Values), idx,
		)
		if hardFail {
			return summary, fmt.Errorf("%s", firstApplyChangesErrorMessage(summary))
		}
		if zeroHit || where == nil {
			continue
		}

		args := append(append([]interface{}{}, setArgs...), where.Args...)
		query := fmt.Sprintf("UPDATE %s SET %s WHERE %s", qualifiedTable, strings.Join(sets, ", "), where.SQL)
		res, err := tx.Exec(query, args...)
		if err != nil {
			return summary, fmt.Errorf("更新失败：%v", err)
		}
		if err := handleAffected("update", i, original, usedLocator, where.Columns, countBefore, res, query, args); err != nil {
			return summary, err
		}
		if summary.Rollback {
			return summary, fmt.Errorf("%s", firstApplyChangesErrorMessage(summary))
		}
	}

	insertCountBefore := summary.SuccessCount
	if err := execParameterizedInsertBatches(parameterizedInsertConfig{
		Table:       qualifiedTable,
		Rows:        changes.Inserts,
		QuoteColumn: quotePostgresIdent,
		Placeholder: func(i int) string {
			return fmt.Sprintf("$%d", i)
		},
		Exec: func(query string, args ...interface{}) (sql.Result, error) {
			return tx.Exec(query, args...)
		},
	}); err != nil {
		return summary, err
	}
	summary.SuccessCount = insertCountBefore + len(changes.Inserts)
	for i := range changes.Inserts {
		appendDetail(connection.ApplyChangesDetail{
			RowHint:     fmt.Sprintf("insert#%d", i+1),
			Action:      "insert",
			UsedLocator: "insert",
			Message:     "success",
		})
	}

	if err := tx.Commit(); err != nil {
		return summary, err
	}
	return summary, nil
}
