//go:build gonavi_full_drivers || gonavi_oracle_driver || gonavi_oceanbase_driver

package db

import (
	"database/sql"
	"testing"
)

func TestOracleDBQueryUsesCustomScanDialect(t *testing.T) {
	t.Parallel()

	registerScanRowsDuplicateDriverOnce.Do(func() {
		sql.Register(scanRowsDuplicateDriverName, scanRowsDuplicateDriver{})
	})

	dbConn, err := sql.Open(scanRowsDuplicateDriverName, "")
	if err != nil {
		t.Fatalf("open date scan rows db failed: %v", err)
	}
	defer dbConn.Close()

	oracleDB := &OracleDB{conn: dbConn, scanDialect: oceanBaseOracleScanDialect}
	data, _, err := oracleDB.Query("SELECT date_columns")
	if err != nil {
		t.Fatalf("OracleDB.Query returned error: %v", err)
	}
	if len(data) != 1 {
		t.Fatalf("expected one row, got=%d", len(data))
	}
	if data[0]["ship_date"] != "2025-10-01" {
		t.Fatalf("OracleDB 自定义扫描方言未生效，实际=%v(%T)", data[0]["ship_date"], data[0]["ship_date"])
	}
}
