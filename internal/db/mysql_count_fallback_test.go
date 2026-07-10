package db

import (
	"database/sql/driver"
	"strings"
	"testing"

	"GoNavi-Wails/internal/connection"
)

func TestIsMySQLCountFallbackCandidateType(t *testing.T) {
	t.Parallel()

	cases := []struct {
		colType string
		maxLen  int
		want    bool
	}{
		{"varchar(64)", 255, true},
		{"varchar(512)", 255, false},
		{"char(10)", 255, true},
		{"text", 255, false},
		{"tinytext", 255, true},
		{"json", 255, false},
		{"blob", 255, false},
		{"varbinary(16)", 255, false},
		{"float", 255, false},
		{"double", 255, false},
		{"int", 255, true},
		{"decimal(10,2)", 255, true},
		{"", 255, true},
	}
	for _, tc := range cases {
		got := isMySQLCountFallbackCandidateType(tc.colType, tc.maxLen)
		if got != tc.want {
			t.Fatalf("type=%q maxLen=%d got=%v want=%v", tc.colType, tc.maxLen, got, tc.want)
		}
	}
}

func TestMysqlCountFallbackCandidateColumnsExcludesChangedAndUnsafe(t *testing.T) {
	t.Parallel()

	original := map[string]interface{}{
		"id":      1,
		"name":    "a",
		"bio":     "long",
		"payload": `{"a":1}`,
		"score":   1.5,
		"note":    nil,
	}
	changed := map[string]struct{}{"name": {}}
	types := map[string]string{
		"id":      "int",
		"name":    "varchar(64)",
		"bio":     "text",
		"payload": "json",
		"score":   "float",
		"note":    "varchar(32)",
	}
	got := mysqlCountFallbackCandidateColumns(original, changed, types, 255)
	want := []string{"id", "note"} // non-null first, then null; name/bio/payload/score excluded
	if len(got) != len(want) {
		t.Fatalf("candidates=%v want=%v", got, want)
	}
	for i := range want {
		if !strings.EqualFold(got[i], want[i]) {
			t.Fatalf("candidates=%v want=%v", got, want)
		}
	}
}

func TestBuildMySQLWhereFromOriginalUsesIsNull(t *testing.T) {
	t.Parallel()

	where := buildMySQLWhereFromOriginal(
		[]string{"name", "note"},
		map[string]interface{}{"name": "a", "note": nil},
		map[string]string{"name": "varchar(32)", "note": "varchar(32)"},
	)
	if where == nil {
		t.Fatal("expected where clause")
	}
	if !strings.Contains(where.SQL, "`name` = ?") {
		t.Fatalf("expected equality for name, got %s", where.SQL)
	}
	if !strings.Contains(where.SQL, "`note` IS NULL") {
		t.Fatalf("expected IS NULL for note, got %s", where.SQL)
	}
	if len(where.Args) != 1 || where.Args[0] != "a" {
		t.Fatalf("unexpected args: %#v", where.Args)
	}
}

func TestMySQLApplyChangesCountFallbackUpdateSucceeds(t *testing.T) {
	t.Parallel()

	dbConn, state := openOracleRecordingDB(t)
	state.rowsAffected = 1
	state.queryResults["SELECT COUNT(*) FROM `users` WHERE `code` = ?"] = oracleRecordingQueryResult{
		columns: []string{"COUNT(*)"},
		rows:    [][]driver.Value{{int64(1)}},
	}
	mysqlDB := &MySQLDB{conn: dbConn}

	result, err := mysqlDB.ApplyChangesDetailed("users", connection.ChangeSet{
		LocatorStrategy:       "none",
		FallbackLocateEnabled: true,
		FallbackFieldMaxLen:   255,
		Updates: []connection.UpdateRow{{
			Keys:     map[string]interface{}{},
			Values:   map[string]interface{}{"name": "new"},
			Original: map[string]interface{}{"code": "u1", "name": "old"},
		}},
	})
	if err != nil {
		t.Fatalf("ApplyChangesDetailed unexpected error: %v", err)
	}
	if result == nil || result.Rollback || result.SuccessCount < 1 {
		t.Fatalf("unexpected result: %#v", result)
	}
	execs := state.snapshotExecQueries()
	foundUpdate := false
	for _, q := range execs {
		if strings.Contains(q, "UPDATE") && strings.Contains(q, "`code` = ?") {
			foundUpdate = true
		}
	}
	if !foundUpdate {
		t.Fatalf("expected UPDATE with count-where, execs=%v queries=%v", execs, state.snapshotQueries())
	}
}

func TestMySQLApplyChangesCountFallbackMultiHitRollsBack(t *testing.T) {
	t.Parallel()

	dbConn, state := openOracleRecordingDB(t)
	state.rowsAffected = 1
	state.queryResults["SELECT COUNT(*) FROM `users` WHERE `code` = ?"] = oracleRecordingQueryResult{
		columns: []string{"COUNT(*)"},
		rows:    [][]driver.Value{{int64(2)}},
	}
	mysqlDB := &MySQLDB{conn: dbConn}

	_, err := mysqlDB.ApplyChangesDetailed("users", connection.ChangeSet{
		LocatorStrategy:       "none",
		FallbackLocateEnabled: true,
		Updates: []connection.UpdateRow{{
			Values:   map[string]interface{}{"name": "new"},
			Original: map[string]interface{}{"code": "dup", "name": "old"},
		}},
	})
	if err == nil {
		t.Fatal("expected multi-hit rollback error")
	}
	if !strings.Contains(err.Error(), "多行") && !strings.Contains(strings.ToLower(err.Error()), "count") {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, q := range state.snapshotExecQueries() {
		if strings.Contains(strings.ToUpper(q), "UPDATE") {
			t.Fatalf("multi-hit should not execute UPDATE, got %v", state.snapshotExecQueries())
		}
	}
}

func TestMySQLApplyChangesCountFallbackZeroHitContinues(t *testing.T) {
	t.Parallel()

	dbConn, state := openOracleRecordingDB(t)
	state.rowsAffected = 1
	state.queryResults["SELECT COUNT(*) FROM `users` WHERE `code` = ?"] = oracleRecordingQueryResult{
		columns: []string{"COUNT(*)"},
		rows:    [][]driver.Value{{int64(0)}},
	}
	mysqlDB := &MySQLDB{conn: dbConn}

	result, err := mysqlDB.ApplyChangesDetailed("users", connection.ChangeSet{
		LocatorStrategy:       "none",
		FallbackLocateEnabled: true,
		Updates: []connection.UpdateRow{{
			Values:   map[string]interface{}{"name": "new"},
			Original: map[string]interface{}{"code": "gone", "name": "old"},
		}},
		Inserts: []map[string]interface{}{{"code": "n1", "name": "x"}},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ZeroHitCount != 1 {
		t.Fatalf("expected zeroHit=1, got %#v", result)
	}
	if result.Rollback {
		t.Fatal("zero-hit should not rollback")
	}
}
