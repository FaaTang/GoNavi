//go:build windows

package app

import (
	"encoding/binary"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseWindowsShortcutTargetReadsLocalBasePath(t *testing.T) {
	targetPath := `C:\Program Files\PinkHunkDB\PinkHunkDB.exe`
	lnkPath := filepath.Join(t.TempDir(), "GoNavi.lnk")
	if err := os.WriteFile(lnkPath, buildWindowsShortcutFixture(targetPath), 0o644); err != nil {
		t.Fatalf("write shortcut fixture failed: %v", err)
	}

	got, err := parseWindowsShortcutTarget(lnkPath)
	if err != nil {
		t.Fatalf("parseWindowsShortcutTarget failed: %v", err)
	}
	if !strings.EqualFold(got, targetPath) {
		t.Fatalf("unexpected shortcut target: got %q want %q", got, targetPath)
	}
}

func TestResolveWindowsUpdateTargetSupportsExeAndShortcutCandidates(t *testing.T) {
	exePath, err := os.Executable()
	if err != nil {
		t.Fatalf("os.Executable failed: %v", err)
	}

	if resolved, ok := normalizeWindowsUpdateTargetCandidate(exePath); !ok || !strings.EqualFold(resolved, exePath) {
		t.Fatalf("expected direct exe candidate to resolve, got %q ok=%v", resolved, ok)
	}

	lnkPath := filepath.Join(t.TempDir(), "GoNavi.lnk")
	if err := os.WriteFile(lnkPath, buildWindowsShortcutFixture(exePath), 0o644); err != nil {
		t.Fatalf("write shortcut fixture failed: %v", err)
	}

	resolved, err := resolveWindowsShortcutTarget(lnkPath)
	if err != nil {
		t.Fatalf("resolveWindowsShortcutTarget failed: %v", err)
	}
	if !strings.EqualFold(strings.TrimSpace(resolved), strings.TrimSpace(exePath)) {
		t.Fatalf("unexpected shortcut target: got %q want %q", resolved, exePath)
	}

	if resolved, ok := normalizeWindowsUpdateTargetCandidate(lnkPath); !ok || !strings.EqualFold(resolved, exePath) {
		t.Fatalf("expected shortcut candidate to resolve to exe, got %q ok=%v", resolved, ok)
	}
}

func buildWindowsShortcutFixture(targetPath string) []byte {
	targetBytes := append([]byte(targetPath), 0)
	linkInfoHeaderSize := uint32(0x1C)
	localBasePathOffset := linkInfoHeaderSize
	linkInfoSize := localBasePathOffset + uint32(len(targetBytes))

	linkInfo := make([]byte, linkInfoSize)
	binary.LittleEndian.PutUint32(linkInfo[0:4], linkInfoSize)
	binary.LittleEndian.PutUint32(linkInfo[4:8], linkInfoHeaderSize)
	binary.LittleEndian.PutUint32(linkInfo[16:20], localBasePathOffset)
	copy(linkInfo[localBasePathOffset:], targetBytes)

	header := make([]byte, windowsLnkHeaderSize)
	binary.LittleEndian.PutUint32(header[0:4], windowsLnkHeaderSize)
	binary.LittleEndian.PutUint32(header[0x14:0x18], windowsLnkFlagHasLinkInfo)

	out := make([]byte, 0, len(header)+len(linkInfo))
	out = append(out, header...)
	out = append(out, linkInfo...)
	return out
}
