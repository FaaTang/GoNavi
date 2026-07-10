package db

import (
	"database/sql/driver"
	"strings"
	"testing"

	"GoNavi-Wails/internal/connection"
)

func TestIsPostgresCountFallbackCandidateType(t *testing.T) {
	t.Parallel()

	cases := []struct {
		colType string
		maxLen  int
		want    bool
	}{
		{"varchar(64)", 255, true},
		{"character varying(512)", 255, false},
		{"character varying", 255, false},
		{"text", 255, false},
		{"jsonb", 255, false},
		{"bytea", 255, false},
		{"real", 255, false},
		{"double precision", 255, false},
		{"integer", 255, true},
		{"numeric(10,2)", 255, true},
		{"", 255, true},
	}
	for _, tc := range cases {
		got := isPostgresCountFallbackCandidateType(tc.colType, tc.maxLen)
		if got != tc.want {
			t.Fatalf("type=%q maxLen=%d got=%v want=%v", tc.colType, tc.maxLen, got, tc.want)
		}
	}
}

func TestBuildPostgresWhereFromOriginalUsesIsNullAndPlaceholders(t *testing.T) {
	t.Parallel()

	where := buildPostgresWhereFromOriginal(
		[]string{"name", "note"},
		map[string]interface{}{"name": "a", "note": nil},
		2,
	)
	if where == nil {
		t.Fatal("expected where clause")
	}
	if !strings.Contains(where.SQL, `"name" = $3`) {
		t.Fatalf("expected $3 placeholder after argStart=2, got %s", where.SQL)
	}
	if !strings.Contains(where.SQL, `"note" IS NULL`) {
		t.Fatalf("expected IS NULL for note, got %s", where.SQL)
	}
	if len(where.Args) != 1 || where.Args[0] != "a" {
		t.Fatalf("unexpected args: %#v", where.Args)
	}
}

func TestPostgresApplyChangesCountFallbackUpdateSucceeds(t *testing.T) {
	t.Parallel()

	dbConn, state := openOracleRecordingDB(t)
	state.rowsAffected = 1
	state.queryResults[`SELECT COUNT(*) FROM "users" WHERE "code" = $1`] = oracleRecordingQueryResult{
		columns: []string{"count"},
		rows:    [][]driver.Value{{int64(1)}},
	}
	pgDB := &PostgresDB{conn: dbConn}

	result, err := pgDB.ApplyChangesDetailed("users", connection.ChangeSet{
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
	foundUpdate := false
	for _, q := range state.snapshotExecQueries() {
		if strings.Contains(q, "UPDATE") && strings.Contains(q, `"code" = $`) {
			foundUpdate = true
		}
	}
	if !foundUpdate {
		t.Fatalf("expected UPDATE with count-where, execs=%v queries=%v", state.snapshotExecQueries(), state.snapshotQueries())
	}
}

func TestPostgresApplyChangesCountFallbackMultiHitRollsBack(t *testing.T) {
	t.Parallel()

	dbConn, state := openOracleRecordingDB(t)
	state.rowsAffected = 1
	state.queryResults[`SELECT COUNT(*) FROM "users" WHERE "code" = $1`] = oracleRecordingQueryResult{
		columns: []string{"count"},
		rows:    [][]driver.Value{{int64(2)}},
	}
	pgDB := &PostgresDB{conn: dbConn}

	_, err := pgDB.ApplyChangesDetailed("users", connection.ChangeSet{
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
	for _, q := range state.snapshotExecQueries() {
		if strings.Contains(strings.ToUpper(q), "UPDATE") {
			t.Fatalf("multi-hit should not execute UPDATE, got %v", state.snapshotExecQueries())
		}
	}
}
