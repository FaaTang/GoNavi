package app

import (
	"errors"
	"strings"
	"testing"

	"GoNavi-Wails/internal/connection"
	"GoNavi-Wails/internal/db"
	"GoNavi-Wails/shared/i18n"
)

func TestOptionalDriverAgentRevisionStatusNoLongerFlagsUpdates(t *testing.T) {
	needsUpdate, reason, expected := optionalDriverAgentRevisionStatus("clickhouse", installedDriverPackage{
		AgentRevision: "src-stale",
	}, true)
	if needsUpdate || reason != "" || expected != "" {
		t.Fatalf("expected fingerprint revision comparison to be disabled, needsUpdate=%v reason=%q expected=%q", needsUpdate, reason, expected)
	}
}

func TestOptionalDriverPackageUpdateStatusDetectsMongoV2WhenLegacyDefault(t *testing.T) {
	app := NewApp()
	app.SetLanguage(string(i18n.LanguageZhCN))

	definition, ok := resolveDriverDefinition("mongodb")
	if !ok {
		t.Fatal("expected mongodb driver definition")
	}
	meta := installedDriverPackage{
		Version:       "2.5.0",
		AgentRevision: db.OptionalDriverAgentRevision("mongodb"),
	}

	needsUpdate, reason, _ := optionalDriverPackageUpdateStatus(definition, meta, true)
	if !needsUpdate {
		t.Fatal("expected installed MongoDB v2 driver to require reinstall when v1 is the compatibility default")
	}
	if !strings.Contains(reason, "MongoDB 4.0") || !strings.Contains(reason, "wire version 7") {
		t.Fatalf("expected reason to explain MongoDB 4.0 compatibility, got %q", reason)
	}
}

func TestOptionalDriverPackageUpdateStatusAcceptsMongoV1WithoutRevision(t *testing.T) {
	app := NewApp()
	app.SetLanguage(string(i18n.LanguageZhCN))
	restore := swapResolvePublishedDriverPackFn(func() (publishedDriverPackInfo, error) {
		return publishedDriverPackInfo{}, errors.New("network unavailable")
	})
	t.Cleanup(restore)

	definition, ok := resolveDriverDefinition("mongodb")
	if !ok {
		t.Fatal("expected mongodb driver definition")
	}
	meta := installedDriverPackage{
		Version:       "1.17.9",
		AgentRevision: "",
	}

	needsUpdate, reason, _ := optionalDriverPackageUpdateStatus(definition, meta, true)
	if needsUpdate {
		t.Fatalf("expected MongoDB v1 driver to skip revision mismatch prompts, reason=%q", reason)
	}
}

func TestOptionalDriverPackageUpdateStatusByReleaseTag(t *testing.T) {
	app := NewApp()
	app.SetLanguage(string(i18n.LanguageZhCN))

	definition, ok := resolveDriverDefinition("clickhouse")
	if !ok {
		t.Fatal("expected clickhouse driver definition")
	}
	assetNames := optionalDriverReleaseAssetNamesForVersion(definition.Type, "")
	if len(assetNames) == 0 {
		t.Fatal("expected clickhouse release asset names")
	}
	published := map[string]bool{}
	for _, name := range assetNames {
		published[name] = true
	}

	restore := swapResolvePublishedDriverPackFn(func() (publishedDriverPackInfo, error) {
		return publishedDriverPackInfo{
			Tag:       "v1.3.2",
			Published: published,
		}, nil
	})
	t.Cleanup(restore)

	needsUpdate, reason, expected := optionalDriverPackageUpdateStatus(definition, installedDriverPackage{
		Version:          "2.5.0",
		SourceReleaseTag: "v1.2.0",
	}, true)
	if !needsUpdate {
		t.Fatal("expected older source release tag to require update")
	}
	if expected != "v1.3.2" {
		t.Fatalf("expected latest tag in ExpectedRevision field, got %q", expected)
	}
	if !strings.Contains(reason, "v1.2.0") || !strings.Contains(reason, "v1.3.2") {
		t.Fatalf("expected reason to mention current/latest tags, got %q", reason)
	}

	needsUpdate, _, _ = optionalDriverPackageUpdateStatus(definition, installedDriverPackage{
		Version:          "2.5.0",
		SourceReleaseTag: "v1.3.2",
	}, true)
	if needsUpdate {
		t.Fatal("expected matching source release tag to skip update")
	}
}

func TestOptionalDriverPackageUpdateStatusIgnoresReleaseFetchFailure(t *testing.T) {
	definition, ok := resolveDriverDefinition("clickhouse")
	if !ok {
		t.Fatal("expected clickhouse driver definition")
	}
	restore := swapResolvePublishedDriverPackFn(func() (publishedDriverPackInfo, error) {
		return publishedDriverPackInfo{}, errors.New("release fetch failed")
	})
	t.Cleanup(restore)

	needsUpdate, reason, expected := optionalDriverPackageUpdateStatus(definition, installedDriverPackage{
		Version:          "2.5.0",
		SourceReleaseTag: "v1.2.0",
	}, true)
	if needsUpdate || reason != "" || expected != "" {
		t.Fatalf("expected no update prompt when release fetch fails, needsUpdate=%v reason=%q expected=%q", needsUpdate, reason, expected)
	}
}

func TestOptionalDriverPackageUpdateStatusFallsBackToSHA256(t *testing.T) {
	app := NewApp()
	app.SetLanguage(string(i18n.LanguageZhCN))

	definition, ok := resolveDriverDefinition("clickhouse")
	if !ok {
		t.Fatal("expected clickhouse driver definition")
	}
	assetNames := optionalDriverReleaseAssetNamesForVersion(definition.Type, "")
	if len(assetNames) == 0 {
		t.Fatal("expected clickhouse release asset names")
	}
	assetName := assetNames[0]
	published := map[string]bool{assetName: true}
	shaByAsset := map[string]string{assetName: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}

	restore := swapResolvePublishedDriverPackFn(func() (publishedDriverPackInfo, error) {
		return publishedDriverPackInfo{
			Tag:           "v1.3.2",
			Published:     published,
			SHA256ByAsset: shaByAsset,
		}, nil
	})
	t.Cleanup(restore)

	needsUpdate, reason, expected := optionalDriverPackageUpdateStatus(definition, installedDriverPackage{
		Version: "2.5.0",
		SHA256:  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
	}, true)
	if !needsUpdate {
		t.Fatal("expected sha mismatch without source tag to require update")
	}
	if expected != "v1.3.2" {
		t.Fatalf("expected latest tag, got %q", expected)
	}
	if !strings.Contains(reason, "v1.3.2") {
		t.Fatalf("expected reason to mention latest tag, got %q", reason)
	}

	needsUpdate, _, _ = optionalDriverPackageUpdateStatus(definition, installedDriverPackage{
		Version: "2.5.0",
		SHA256:  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
	}, true)
	if needsUpdate {
		t.Fatal("expected matching sha to skip update")
	}
}

func TestParseReleaseTagFromDownloadURL(t *testing.T) {
	got := parseReleaseTagFromDownloadURL("https://github.com/FaaTang/PinkHunkDB/releases/download/v1.3.2/clickhouse-driver-agent-windows-amd64.exe")
	if got != "v1.3.2" {
		t.Fatalf("expected v1.3.2, got %q", got)
	}
	if got := parseReleaseTagFromDownloadURL("https://github.com/FaaTang/PinkHunkDB/releases/latest/download/clickhouse-driver-agent-windows-amd64.exe"); got != "" {
		t.Fatalf("expected empty tag for latest download URL, got %q", got)
	}
}

func TestVerifyInstalledOptionalDriverAgentRevisionNoLongerHardFails(t *testing.T) {
	originalProbe := optionalDriverAgentMetadataProbe
	t.Cleanup(func() {
		optionalDriverAgentMetadataProbe = originalProbe
	})
	optionalDriverAgentMetadataProbe = func(driverType string, executablePath string) (db.OptionalDriverAgentMetadata, error) {
		return db.OptionalDriverAgentMetadata{}, errOptionalDriverAgentMetadataUnavailable
	}

	if _, err := verifyInstalledOptionalDriverAgentRevision("sqlserver", "fake-driver-agent"); err != nil {
		t.Fatalf("expected install verification to skip fingerprint checks, got %v", err)
	}
}

func TestVerifyRuntimeOptionalDriverAgentRevisionIsNoop(t *testing.T) {
	if err := verifyRuntimeOptionalDriverAgentRevision(connection.ConnectionConfig{Type: "sqlserver"}); err != nil {
		t.Fatalf("expected runtime revision check to be disabled, got %v", err)
	}
}

func TestSavedConnectionDriverUsageCountsIncludesOptionalAndCustomDrivers(t *testing.T) {
	app := &App{configDir: t.TempDir()}
	repo := app.savedConnectionRepository()
	if err := repo.saveAll([]connection.SavedConnectionView{
		{
			ID:   "conn-clickhouse",
			Name: "ClickHouse",
			Config: connection.ConnectionConfig{
				Type: "clickhouse",
			},
		},
		{
			ID:   "conn-custom-clickhouse",
			Name: "Custom ClickHouse",
			Config: connection.ConnectionConfig{
				Type:   "custom",
				Driver: "clickhouse",
			},
		},
		{
			ID:   "conn-mysql",
			Name: "MySQL",
			Config: connection.ConnectionConfig{
				Type: "mysql",
			},
		},
	}); err != nil {
		t.Fatalf("save connections failed: %v", err)
	}

	counts := app.savedConnectionDriverUsageCounts()
	if got := counts["clickhouse"]; got != 2 {
		t.Fatalf("expected two ClickHouse usages, got %d", got)
	}
	if got := counts["mysql"]; got != 0 {
		t.Fatalf("expected built-in MySQL to be ignored, got %d", got)
	}
}
