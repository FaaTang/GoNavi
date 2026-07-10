//go:build windows

package app

import (
	"os"
	"strings"
	"testing"
)

func TestBuildWindowsHiddenPowerShellCommandHidesConsoleWindow(t *testing.T) {
	cmd := buildWindowsHiddenPowerShellCommand("-Command", "exit 0")

	if cmd.SysProcAttr == nil || !cmd.SysProcAttr.HideWindow {
		t.Fatalf("expected hidden PowerShell command to set HideWindow")
	}
	if cmd.SysProcAttr.CreationFlags&windowsCreateNoWindow == 0 {
		t.Fatalf("expected hidden PowerShell command to set CREATE_NO_WINDOW")
	}
	if !strings.Contains(strings.Join(cmd.Args, " "), "-WindowStyle") {
		t.Fatalf("expected hidden PowerShell command to include -WindowStyle Hidden, args=%v", cmd.Args)
	}
}

func TestQueryWindowsProcessImagePathUsesCurrentProcess(t *testing.T) {
	exePath, err := os.Executable()
	if err != nil {
		t.Fatalf("os.Executable failed: %v", err)
	}

	path, err := queryWindowsProcessImagePath(os.Getpid())
	if err != nil {
		t.Fatalf("queryWindowsProcessImagePath failed: %v", err)
	}
	if strings.TrimSpace(path) == "" {
		t.Fatalf("expected non-empty process image path")
	}
	if !strings.EqualFold(strings.TrimSpace(path), strings.TrimSpace(exePath)) {
		t.Fatalf("unexpected process image path: got %q want %q", path, exePath)
	}
}
