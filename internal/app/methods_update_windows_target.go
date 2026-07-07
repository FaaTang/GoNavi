//go:build windows

package app

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

var (
	modKernel32            = syscall.NewLazyDLL("kernel32.dll")
	procGetModuleFileNameW = modKernel32.NewProc("GetModuleFileNameW")
	procGetLongPathNameW   = modKernel32.NewProc("GetLongPathNameW")
)

func resolveWindowsUpdateTarget() (string, error) {
	candidates := make([]string, 0, 4)
	if path, err := getWindowsModuleFileName(); err == nil {
		candidates = append(candidates, path)
	}
	if path, err := os.Executable(); err == nil {
		candidates = append(candidates, path)
	}
	if len(os.Args) > 0 {
		candidates = append(candidates, os.Args[0])
	}
	if path, err := queryWindowsProcessImagePath(os.Getpid()); err == nil {
		candidates = append(candidates, path)
	}

	seen := make(map[string]struct{}, len(candidates))
	for _, raw := range candidates {
		key := strings.ToLower(strings.TrimSpace(raw))
		if key == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}

		if resolved, ok := normalizeWindowsUpdateTargetCandidate(raw); ok {
			return resolved, nil
		}
	}
	return "", fmt.Errorf("unable to resolve running executable path for update")
}

func normalizeWindowsUpdateTargetCandidate(raw string) (string, bool) {
	path := strings.TrimSpace(raw)
	if path == "" {
		return "", false
	}
	if strings.EqualFold(filepath.Ext(path), ".lnk") {
		target, err := resolveWindowsShortcutTarget(path)
		if err != nil {
			return "", false
		}
		path = target
	}
	path, err := filepath.EvalSymlinks(path)
	if err != nil {
		path = strings.TrimSpace(raw)
	}
	path = getWindowsLongPath(path)
	path = filepath.Clean(path)
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return "", false
	}
	if !strings.EqualFold(filepath.Ext(path), ".exe") {
		return "", false
	}
	return path, true
}

func getWindowsModuleFileName() (string, error) {
	buf := make([]uint16, syscall.MAX_PATH)
	for {
		r, _, err := procGetModuleFileNameW.Call(0, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
		if r == 0 {
			return "", err
		}
		if r < uintptr(len(buf)) {
			return syscall.UTF16ToString(buf[:r]), nil
		}
		buf = make([]uint16, len(buf)*2)
	}
}

func getWindowsLongPath(path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return path
	}
	pathUTF16, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return path
	}
	buf := make([]uint16, syscall.MAX_PATH)
	for {
		n, _, _ := procGetLongPathNameW.Call(
			uintptr(unsafe.Pointer(pathUTF16)),
			uintptr(unsafe.Pointer(&buf[0])),
			uintptr(len(buf)),
		)
		if n == 0 {
			return path
		}
		if n < uintptr(len(buf)) {
			return syscall.UTF16ToString(buf[:n])
		}
		buf = make([]uint16, len(buf)*2)
	}
}

func resolveWindowsShortcutTarget(lnkPath string) (string, error) {
	lnkPath = strings.TrimSpace(lnkPath)
	if lnkPath == "" {
		return "", fmt.Errorf("shortcut path is empty")
	}
	escaped := strings.ReplaceAll(lnkPath, "'", "''")
	script := fmt.Sprintf(
		"$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%s'); if ($s.TargetPath) { [Console]::Out.Write($s.TargetPath) }",
		escaped,
	)
	out, err := exec.Command(
		"powershell.exe",
		"-NoProfile",
		"-NonInteractive",
		"-ExecutionPolicy", "Bypass",
		"-Command", script,
	).Output()
	if err != nil {
		return "", err
	}
	target := strings.TrimSpace(string(out))
	if target == "" {
		return "", fmt.Errorf("shortcut target is empty: %s", lnkPath)
	}
	return target, nil
}

func queryWindowsProcessImagePath(pid int) (string, error) {
	if pid <= 0 {
		return "", fmt.Errorf("invalid pid: %d", pid)
	}
	script := fmt.Sprintf(
		"(Get-CimInstance Win32_Process -Filter 'ProcessId=%d' -ErrorAction Stop).ExecutablePath",
		pid,
	)
	out, err := exec.Command(
		"powershell.exe",
		"-NoProfile",
		"-NonInteractive",
		"-ExecutionPolicy", "Bypass",
		"-Command", script,
	).Output()
	if err != nil {
		return "", err
	}
	path := strings.TrimSpace(string(bytes.TrimSpace(out)))
	if path == "" {
		return "", fmt.Errorf("process image path is empty for pid %d", pid)
	}
	return path, nil
}
