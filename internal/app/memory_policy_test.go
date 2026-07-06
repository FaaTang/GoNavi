package app

import "testing"

func TestRuntimeMemoryPolicyApply(t *testing.T) {
	policy := newRuntimeMemoryPolicy()
	policy.Apply(MemoryPolicyPayload{
		LowMemoryMode: true,
		GoGCPercent:   45,
	})
	if !policy.EffectiveLowMemoryMode() {
		t.Fatalf("expected low memory mode to be enabled")
	}
	if got := policy.GoGCPercent(); got != 45 {
		t.Fatalf("GoGCPercent() = %d, want 45", got)
	}
	if !policy.ShouldUseStreamingExportGuard() {
		t.Fatalf("expected streaming export guard in low memory mode")
	}
}

func TestRuntimeMemoryPolicyNormalMode(t *testing.T) {
	policy := newRuntimeMemoryPolicy()
	policy.Apply(MemoryPolicyPayload{
		LowMemoryMode: false,
		GoGCPercent:   40,
	})
	if policy.EffectiveLowMemoryMode() {
		t.Fatalf("expected low memory mode to be disabled")
	}
	if got := policy.GoGCPercent(); got != normalGoGCPercent {
		t.Fatalf("GoGCPercent() = %d, want %d", got, normalGoGCPercent)
	}
}

func TestRuntimeMemoryPolicyEnvOverride(t *testing.T) {
	t.Setenv("GONAVI_LOW_MEMORY_MODE", "1")
	policy := newRuntimeMemoryPolicy()
	policy.Apply(MemoryPolicyPayload{
		LowMemoryMode: false,
		GoGCPercent:   50,
	})
	if !policy.EffectiveLowMemoryMode() {
		t.Fatalf("expected env override to force low memory mode")
	}
}

func TestClampGoGCPercent(t *testing.T) {
	if got := clampGoGCPercent(10); got != 40 {
		t.Fatalf("clampGoGCPercent(10) = %d, want 40", got)
	}
	if got := clampGoGCPercent(120); got != 100 {
		t.Fatalf("clampGoGCPercent(120) = %d, want 100", got)
	}
}

func TestExportDataWithOptionsBlocksClientSideExportInLowMemoryMode(t *testing.T) {
	app := NewAppWithSecretStore(newFakeAppSecretStore())
	app.memoryPolicy.Apply(MemoryPolicyPayload{
		LowMemoryMode: true,
		GoGCPercent:   40,
	})

	result := app.ExportDataWithOptions(
		[]map[string]interface{}{{"id": 1}},
		[]string{"id"},
		"export",
		ExportFileOptions{Format: "csv"},
	)
	if result.Success {
		t.Fatal("expected client-side export to be blocked in low memory mode")
	}
	want := app.appText("file.backend.error.export_streaming_guard_required", nil)
	if result.Message != want {
		t.Fatalf("ExportDataWithOptions message = %q, want %q", result.Message, want)
	}
}
