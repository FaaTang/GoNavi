package db

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"io"
	"strings"
	"sync"
	"testing"
)


const oracleRecordingDriverName = "gonavi_oracle_recording"

var (
	registerOracleRecordingDriverOnce sync.Once
	oracleRecordingDriverMu           sync.Mutex
	oracleRecordingDriverSeq          int
	oracleRecordingDriverStates       = map[string]*oracleRecordingState{}
)

type oracleRecordingState struct {
	mu                       sync.Mutex
	execQueries              []string
	execArgs                 [][]driver.NamedValue
	queries                  []string
	beginCalls               int
	rowsAffected             int64
	queryResults             map[string]oracleRecordingQueryResult
	queryError               error
	disableDefaultTabColumns bool
}

type oracleRecordingQueryResult struct {
	columns     []string
	columnTypes []string
	nullable    []bool
	rows        [][]driver.Value
}

func (s *oracleRecordingState) snapshotExecQueries() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.execQueries...)
}

func (s *oracleRecordingState) snapshotExecArgs() [][]driver.NamedValue {
	s.mu.Lock()
	defer s.mu.Unlock()

	result := make([][]driver.NamedValue, len(s.execArgs))
	for i, args := range s.execArgs {
		result[i] = append([]driver.NamedValue(nil), args...)
	}
	return result
}

func (s *oracleRecordingState) snapshotQueries() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.queries...)
}

func (s *oracleRecordingState) snapshotBeginCalls() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.beginCalls
}

type oracleRecordingDriver struct{}

func (oracleRecordingDriver) Open(name string) (driver.Conn, error) {
	oracleRecordingDriverMu.Lock()
	state := oracleRecordingDriverStates[name]
	oracleRecordingDriverMu.Unlock()
	if state == nil {
		return nil, fmt.Errorf("recording state not found: %s", name)
	}
	return &oracleRecordingConn{state: state}, nil
}

type oracleRecordingConn struct {
	state *oracleRecordingState
}

func (c *oracleRecordingConn) Prepare(query string) (driver.Stmt, error) {
	return nil, fmt.Errorf("prepare not supported in oracle recording driver: %s", query)
}

func (c *oracleRecordingConn) Close() error { return nil }

func (c *oracleRecordingConn) Begin() (driver.Tx, error) {
	c.state.mu.Lock()
	c.state.beginCalls++
	c.state.mu.Unlock()
	return oracleRecordingTx{}, nil
}

func (c *oracleRecordingConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	c.state.mu.Lock()
	defer c.state.mu.Unlock()
	c.state.execQueries = append(c.state.execQueries, query)
	c.state.execArgs = append(c.state.execArgs, append([]driver.NamedValue(nil), args...))
	return driver.RowsAffected(c.state.rowsAffected), nil
}

func (c *oracleRecordingConn) QueryContext(_ context.Context, query string, _ []driver.NamedValue) (driver.Rows, error) {
	c.state.mu.Lock()
	c.state.queries = append(c.state.queries, query)
	disableDefaultTabColumns := c.state.disableDefaultTabColumns
	if err := c.state.queryError; err != nil {
		c.state.mu.Unlock()
		return nil, err
	}
	if result, ok := c.state.queryResults[query]; ok {
		c.state.mu.Unlock()
		return &oracleRecordingRows{
			columns:     append([]string(nil), result.columns...),
			columnTypes: append([]string(nil), result.columnTypes...),
			nullable:    append([]bool(nil), result.nullable...),
			rows:        cloneOracleRecordingRows(result.rows),
		}, nil
	}
	c.state.mu.Unlock()

	if strings.Contains(strings.ToLower(query), "tab_columns") && !disableDefaultTabColumns {
		return &oracleRecordingRows{
			columns: []string{"COLUMN_NAME", "DATA_TYPE", "NULLABLE", "DATA_DEFAULT", "COLUMN_KEY", "COMMENT"},
			rows: [][]driver.Value{
				{"UPDATED_AT", "TIMESTAMP", "YES", nil, "", "更新时间"},
				{"CREATED_AT", "DATE", "NO", nil, "", nil},
			},
		}, nil
	}
	return &oracleRecordingRows{}, nil
}

func cloneOracleRecordingRows(src [][]driver.Value) [][]driver.Value {
	dst := make([][]driver.Value, len(src))
	for i, row := range src {
		dst[i] = append([]driver.Value(nil), row...)
	}
	return dst
}

var _ driver.ExecerContext = (*oracleRecordingConn)(nil)
var _ driver.QueryerContext = (*oracleRecordingConn)(nil)

type oracleRecordingTx struct{}

func (oracleRecordingTx) Commit() error   { return nil }
func (oracleRecordingTx) Rollback() error { return nil }

type oracleRecordingRows struct {
	columns     []string
	columnTypes []string
	nullable    []bool
	rows        [][]driver.Value
	index       int
}

func (r *oracleRecordingRows) Columns() []string {
	return append([]string(nil), r.columns...)
}

func (r *oracleRecordingRows) Close() error { return nil }

func (r *oracleRecordingRows) ColumnTypeDatabaseTypeName(index int) string {
	if index < 0 || index >= len(r.columnTypes) {
		return ""
	}
	return r.columnTypes[index]
}

func (r *oracleRecordingRows) ColumnTypeNullable(index int) (nullable, ok bool) {
	if index < 0 || index >= len(r.nullable) {
		return false, false
	}
	return r.nullable[index], true
}

func (r *oracleRecordingRows) Next(dest []driver.Value) error {
	if r.index >= len(r.rows) {
		return io.EOF
	}
	row := r.rows[r.index]
	for idx := range dest {
		if idx < len(row) {
			dest[idx] = row[idx]
		}
	}
	r.index++
	return nil
}

func openOracleRecordingDB(t *testing.T) (*sql.DB, *oracleRecordingState) {
	t.Helper()
	registerOracleRecordingDriverOnce.Do(func() {
		sql.Register(oracleRecordingDriverName, oracleRecordingDriver{})
	})

	oracleRecordingDriverMu.Lock()
	oracleRecordingDriverSeq++
	dsn := fmt.Sprintf("oracle-recording-%d", oracleRecordingDriverSeq)
	state := &oracleRecordingState{rowsAffected: 1, queryResults: map[string]oracleRecordingQueryResult{}}
	oracleRecordingDriverStates[dsn] = state
	oracleRecordingDriverMu.Unlock()

	dbConn, err := sql.Open(oracleRecordingDriverName, dsn)
	if err != nil {
		t.Fatalf("打开 recording db 失败: %v", err)
	}

	t.Cleanup(func() {
		_ = dbConn.Close()
		oracleRecordingDriverMu.Lock()
		delete(oracleRecordingDriverStates, dsn)
		oracleRecordingDriverMu.Unlock()
	})

	return dbConn, state
}
