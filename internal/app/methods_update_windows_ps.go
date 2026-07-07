//go:build windows

package app

import (
	"strconv"
	"strings"
)

func buildWindowsPowerShellUpdateScript(pid int) string {
	script := `$ErrorActionPreference = 'Continue'
$Source = $env:GONAVI_UPDATE_SOURCE
$Target = $env:GONAVI_UPDATE_TARGET
$Staged = $env:GONAVI_UPDATE_STAGED
$LogFile = $env:GONAVI_UPDATE_LOG
$HostPid = [int]$env:GONAVI_UPDATE_PID

function Write-UpdateLog([string]$Message) {
  $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -LiteralPath $LogFile -Value $line
}

function Wait-ForHostExit {
  $deadline = (Get-Date).AddSeconds(90)
  while ((Get-Process -Id $HostPid -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 1
  }
  if (Get-Process -Id $HostPid -ErrorAction SilentlyContinue) {
    Write-UpdateLog "host process still running after 90 seconds, aborting update"
    exit 1
  }
}

function Resolve-SourceExecutable([string]$SourcePath, [string]$TargetPath, [string]$StagedDir) {
  $targetName = [System.IO.Path]::GetFileName($TargetPath)
  $sourceExt = [System.IO.Path]::GetExtension($SourcePath)
  if ($sourceExt -ieq '.zip') {
    $extractDir = Join-Path $StagedDir '_extract'
    if (Test-Path -LiteralPath $extractDir) {
      Remove-Item -LiteralPath $extractDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
    Expand-Archive -LiteralPath $SourcePath -DestinationPath $extractDir -Force
    $candidate = Join-Path $extractDir $targetName
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
    $found = Get-ChildItem -LiteralPath $extractDir -Filter '*.exe' -Recurse -File |
      Select-Object -First 1 -ExpandProperty FullName
    if ($found) {
      return $found
    }
    throw "no executable found in portable zip: $SourcePath"
  }
  return $SourcePath
}

function Replace-TargetExecutable([string]$SourceExe, [string]$TargetExe) {
  $targetOld = "$TargetExe.old"
  for ($retry = 0; $retry -lt 15; $retry++) {
    Write-UpdateLog "attempt ${retry}: trying rename-then-copy strategy"
    try {
      if (Test-Path -LiteralPath $TargetExe) {
        if (Test-Path -LiteralPath $targetOld) {
          Remove-Item -LiteralPath $targetOld -Force
        }
        Move-Item -LiteralPath $TargetExe -Destination $targetOld -Force
      }
      Copy-Item -LiteralPath $SourceExe -Destination $TargetExe -Force
      if (Test-Path -LiteralPath $targetOld) {
        Remove-Item -LiteralPath $targetOld -Force
      }
      return
    } catch {
      Write-UpdateLog "rename strategy failed: $($_.Exception.Message)"
      if (Test-Path -LiteralPath $targetOld) {
        try {
          if (Test-Path -LiteralPath $TargetExe) {
            Remove-Item -LiteralPath $TargetExe -Force
          }
          Move-Item -LiteralPath $targetOld -Destination $TargetExe -Force
        } catch {
          Write-UpdateLog "restore old executable failed: $($_.Exception.Message)"
        }
      }
    }

    Write-UpdateLog 'rename strategy failed, trying direct move'
    try {
      Move-Item -LiteralPath $SourceExe -Destination $TargetExe -Force
      return
    } catch {
      Write-UpdateLog "direct move failed: $($_.Exception.Message)"
    }
    try {
      Copy-Item -LiteralPath $SourceExe -Destination $TargetExe -Force
      return
    } catch {
      Write-UpdateLog "direct copy failed: $($_.Exception.Message)"
    }

    $wait = 1
    if ($retry -ge 3) { $wait = 2 }
    if ($retry -ge 6) { $wait = 3 }
    if ($retry -ge 9) { $wait = 5 }
    Write-UpdateLog "waiting $wait seconds before retry"
    Start-Sleep -Seconds $wait
  }
  throw 'replace failed after retries (portable mode, no elevation): check directory write permission or file lock'
}

function Start-UpdatedApplication([string]$TargetExe) {
  $targetDir = [System.IO.Path]::GetDirectoryName($TargetExe)
  Start-Process -LiteralPath $TargetExe -WorkingDirectory $targetDir
}

Write-UpdateLog 'updater started'
Write-UpdateLog "source=$Source"
Write-UpdateLog "target=$Target"

if (-not (Test-Path -LiteralPath $Source)) {
  Write-UpdateLog "source file not found: $Source"
  exit 1
}
if (-not (Test-Path -LiteralPath $Target)) {
  Write-UpdateLog "target executable not found: $Target"
  exit 1
}

$sourceExe = Resolve-SourceExecutable -SourcePath $Source -TargetPath $Target -StagedDir $Staged
Write-UpdateLog "resolved source executable: $sourceExe"

Wait-ForHostExit
Write-UpdateLog 'host process exited'
Start-Sleep -Seconds 3
Write-UpdateLog 'cooldown finished, starting file replace'

Replace-TargetExecutable -SourceExe $sourceExe -TargetExe $Target
Start-UpdatedApplication -TargetExe $Target
if (Test-Path -LiteralPath $Staged) {
  Remove-Item -LiteralPath $Staged -Recurse -Force
}
Write-UpdateLog 'update finished'
exit 0
`
	_ = pid
	return strings.ReplaceAll(script, "\n", "\r\n")
}

func windowsUpdateScriptEnv(source, target, stagedDir, logPath string, pid int) []string {
	return []string{
		"GONAVI_UPDATE_SOURCE=" + source,
		"GONAVI_UPDATE_TARGET=" + target,
		"GONAVI_UPDATE_STAGED=" + stagedDir,
		"GONAVI_UPDATE_LOG=" + logPath,
		"GONAVI_UPDATE_PID=" + strconv.Itoa(pid),
	}
}
