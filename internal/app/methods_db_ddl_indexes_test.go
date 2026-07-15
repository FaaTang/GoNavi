package app

import (
	"strings"
	"testing"

	"GoNavi-Wails/internal/connection"
)

func TestEnrichCreateStatementWithIndexes_AppendsMissingIndexes(t *testing.T) {
	t.Parallel()

	dbInst := &fakeCreateStatementDB{
		createSQL: `CREATE TABLE "public"."orders" (
  "id" bigint NOT NULL,
  PRIMARY KEY ("id")
);`,
		indexes: []connection.IndexDefinition{
			{Name: "orders_pkey", ColumnName: "id", NonUnique: 0, SeqInIndex: 1, IndexType: "BTREE"},
			{Name: "idx_orders_created_at", ColumnName: "created_at", NonUnique: 1, SeqInIndex: 1, IndexType: "BTREE"},
			{Name: "idx_orders_user_created", ColumnName: "user_id", NonUnique: 1, SeqInIndex: 1, IndexType: "BTREE"},
			{Name: "idx_orders_user_created", ColumnName: "created_at", NonUnique: 1, SeqInIndex: 2, IndexType: "BTREE"},
		},
	}

	ddl, err := resolveCreateStatementWithFallback(dbInst, connection.ConnectionConfig{Type: "postgres"}, "", "orders")
	if err != nil {
		t.Fatalf("resolveCreateStatementWithFallback() unexpected error: %v", err)
	}
	if !strings.Contains(ddl, `CREATE INDEX "idx_orders_created_at" ON "public"."orders" ("created_at");`) {
		t.Fatalf("expected secondary index DDL to be appended, got: %s", ddl)
	}
	if !strings.Contains(ddl, `CREATE INDEX "idx_orders_user_created" ON "public"."orders" ("user_id", "created_at");`) {
		t.Fatalf("expected composite index DDL to be appended, got: %s", ddl)
	}
	if strings.Contains(ddl, `CREATE INDEX "orders_pkey"`) || strings.Contains(ddl, `CREATE UNIQUE INDEX "orders_pkey"`) {
		t.Fatalf("primary key index should not be duplicated, got: %s", ddl)
	}
}

func TestEnrichCreateStatementWithIndexes_SkipsInlineMySQLIndexes(t *testing.T) {
	t.Parallel()

	inlineDDL := "CREATE TABLE `orders` (\n  `id` bigint NOT NULL,\n  KEY `idx_orders_created_at` (`created_at`),\n  PRIMARY KEY (`id`)\n)"
	dbInst := &fakeCreateStatementDB{
		createSQL: inlineDDL,
		indexes: []connection.IndexDefinition{
			{Name: "PRIMARY", ColumnName: "id", NonUnique: 0, SeqInIndex: 1, IndexType: "BTREE"},
			{Name: "idx_orders_created_at", ColumnName: "created_at", NonUnique: 1, SeqInIndex: 1, IndexType: "BTREE"},
		},
	}

	ddl, err := resolveCreateStatementWithFallback(dbInst, connection.ConnectionConfig{Type: "mysql"}, "demo", "orders")
	if err != nil {
		t.Fatalf("resolveCreateStatementWithFallback() unexpected error: %v", err)
	}
	if ddl != inlineDDL {
		t.Fatalf("expected inline mysql DDL to stay unchanged, got: %s", ddl)
	}
}

func TestEnrichCreateStatementWithIndexes_AppendsSQLiteIndexes(t *testing.T) {
	t.Parallel()

	baseDDL := `CREATE TABLE "users" (
  "id" INTEGER PRIMARY KEY,
  "email" TEXT NOT NULL
);`
	enriched := enrichCreateStatementWithIndexes(
		&fakeCreateStatementDB{
			indexes: []connection.IndexDefinition{
				{Name: "sqlite_autoindex_users_1", ColumnName: "email", NonUnique: 0, SeqInIndex: 1},
				{Name: "idx_users_email", ColumnName: "email", NonUnique: 1, SeqInIndex: 1},
			},
		},
		"sqlite",
		"",
		"users",
		"",
		"users",
		baseDDL,
	)
	if strings.Contains(enriched, "sqlite_autoindex_users_1") {
		t.Fatalf("sqlite auto index should be skipped, got: %s", enriched)
	}
	if !strings.Contains(enriched, `CREATE INDEX "idx_users_email" ON "users" ("email");`) {
		t.Fatalf("expected sqlite secondary index to be appended, got: %s", enriched)
	}
}

func TestShouldSkipDDLIndex_SQLServerClusteredPrimary(t *testing.T) {
	t.Parallel()

	if !shouldSkipDDLIndex("sqlserver", `CREATE TABLE [dbo].[Users] (
  [id] int NOT NULL,
  PRIMARY KEY ([id])
);`, ddlGroupedIndex{
		Name:      "PK__Users__3214EC27",
		Columns:   []string{"id"},
		Unique:    true,
		IndexType: "CLUSTERED",
	}) {
		t.Fatalf("expected clustered primary index to be skipped")
	}
}

func TestDDLContainsIndexName_DetectsExistingStatements(t *testing.T) {
	t.Parallel()

	ddl := `CREATE TABLE demo (
  id int,
  KEY idx_demo_created (created_at)
);

CREATE INDEX idx_demo_status ON demo (status);`

	if !ddlContainsIndexName(ddl, "idx_demo_created") {
		t.Fatalf("expected inline mysql key to be detected")
	}
	if !ddlContainsIndexName(ddl, "idx_demo_status") {
		t.Fatalf("expected existing create index statement to be detected")
	}
}
