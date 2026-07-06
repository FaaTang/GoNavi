package app

import (
	"runtime/debug"

	"GoNavi-Wails/internal/connection"
	"GoNavi-Wails/internal/ssh"
)

// SyncMemoryPolicy applies frontend memory settings to the Go runtime.
func (a *App) SyncMemoryPolicy(payload MemoryPolicyPayload) connection.QueryResult {
	if a == nil {
		return connection.QueryResult{Success: false, Message: "app unavailable"}
	}
	if a.memoryPolicy == nil {
		a.memoryPolicy = newRuntimeMemoryPolicy()
	}
	a.memoryPolicy.Apply(payload)
	debug.SetGCPercent(a.memoryPolicy.GoGCPercent())
	ssh.SetLowMemoryIdleSweepEnabled(a.memoryPolicy.EffectiveLowMemoryMode())
	return connection.QueryResult{Success: true, Message: "OK"}
}

// EffectiveLowMemoryMode reports whether low-memory behavior should be active.
func (a *App) EffectiveLowMemoryMode() bool {
	if a == nil || a.memoryPolicy == nil {
		return isLowMemoryModeFromEnv()
	}
	return a.memoryPolicy.EffectiveLowMemoryMode()
}

// GoGCPercent returns the active Go GC target percentage.
func (a *App) GoGCPercent() int {
	if a == nil || a.memoryPolicy == nil {
		if isLowMemoryModeFromEnv() {
			return 40
		}
		return normalGoGCPercent
	}
	return a.memoryPolicy.GoGCPercent()
}

// ShouldUseStreamingExportGuard reports whether export paths should prefer streaming guards.
func (a *App) ShouldUseStreamingExportGuard() bool {
	if a == nil || a.memoryPolicy == nil {
		return isLowMemoryModeFromEnv()
	}
	return a.memoryPolicy.ShouldUseStreamingExportGuard()
}
