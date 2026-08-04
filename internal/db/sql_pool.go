package db

import (
	"database/sql"
	"strings"
	"time"
)

const (
	defaultSQLMaxOpenConns    = 4
	defaultSQLConnMaxLifetime = 30 * time.Minute
	defaultSQLConnMaxIdleTime = 30 * time.Second
)

func configureSQLConnectionPool(db *sql.DB, dbType string) {
	if db == nil {
		return
	}
	switch strings.ToLower(strings.TrimSpace(dbType)) {
	case "sqlite", "duckdb":
		return
	}
	db.SetMaxOpenConns(defaultSQLMaxOpenConns)
	// 保留空闲连接，避免侧栏并行元数据查询反复 TCP/认证握手（尤其 SSH）。
	db.SetMaxIdleConns(defaultSQLMaxOpenConns)
	db.SetConnMaxIdleTime(defaultSQLConnMaxIdleTime)
	db.SetConnMaxLifetime(defaultSQLConnMaxLifetime)
}
