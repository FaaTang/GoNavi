package app

import (
	"os"
	"strings"
	"sync"
	"sync/atomic"
)

const normalGoGCPercent = 50

// MemoryPolicyPayload is synced from the frontend memory settings panel.
type MemoryPolicyPayload struct {
	LowMemoryMode bool `json:"lowMemoryMode"`
	GoGCPercent   int  `json:"goGCPercent"`
}

type runtimeMemoryPolicy struct {
	mu            sync.RWMutex
	lowMemoryMode bool
	goGCPercent   int
}

var runtimeLowMemoryModeEnabled atomic.Bool

func syncRuntimeLowMemoryModeFlag(lowMemoryMode bool) {
	runtimeLowMemoryModeEnabled.Store(isLowMemoryModeFromEnv() || lowMemoryMode)
}

func isRuntimeLowMemoryModeActive() bool {
	if isLowMemoryModeFromEnv() {
		return true
	}
	return runtimeLowMemoryModeEnabled.Load()
}

func newRuntimeMemoryPolicy() *runtimeMemoryPolicy {
	lowMemory := isLowMemoryModeFromEnv()
	syncRuntimeLowMemoryModeFlag(lowMemory)
	return &runtimeMemoryPolicy{
		lowMemoryMode: lowMemory,
		goGCPercent:   resolveStoredGoGCPercent(lowMemory, normalGoGCPercent),
	}
}

func isLowMemoryModeFromEnv() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("GONAVI_LOW_MEMORY_MODE"))) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func clampGoGCPercent(value int) int {
	if value < 40 {
		return 40
	}
	if value > 100 {
		return 100
	}
	return value
}

func resolveStoredGoGCPercent(lowMemoryMode bool, goGCPercent int) int {
	if !lowMemoryMode {
		return normalGoGCPercent
	}
	if goGCPercent <= 0 {
		return 40
	}
	return clampGoGCPercent(goGCPercent)
}

func (p *runtimeMemoryPolicy) Apply(payload MemoryPolicyPayload) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if isLowMemoryModeFromEnv() {
		p.lowMemoryMode = true
	} else {
		p.lowMemoryMode = payload.LowMemoryMode
	}
	p.goGCPercent = resolveStoredGoGCPercent(p.lowMemoryMode, payload.GoGCPercent)
	syncRuntimeLowMemoryModeFlag(p.lowMemoryMode)
}

func (p *runtimeMemoryPolicy) EffectiveLowMemoryMode() bool {
	if isLowMemoryModeFromEnv() {
		return true
	}
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.lowMemoryMode
}

func (p *runtimeMemoryPolicy) GoGCPercent() int {
	if isLowMemoryModeFromEnv() {
		p.mu.RLock()
		defer p.mu.RUnlock()
		return resolveStoredGoGCPercent(true, p.goGCPercent)
	}
	p.mu.RLock()
	defer p.mu.RUnlock()
	return resolveStoredGoGCPercent(p.lowMemoryMode, p.goGCPercent)
}

func (p *runtimeMemoryPolicy) ShouldUseStreamingExportGuard() bool {
	return p.EffectiveLowMemoryMode()
}
