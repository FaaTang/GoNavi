#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

extract_revision() {
  local file="$1"
  local driver="$2"
  sed -n "s/.*\"${driver}\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" "$file" | head -n 1
}

copy_repo_to_tmp() {
  local target="$1"
  git ls-files -z | tar --null -T - -cf - | (cd "$target" && tar -xf -)
}

tmpdir_platform="$(mktemp -d "${TMPDIR:-/tmp}/gonavi-generate-driver-revisions-platform.XXXXXX")"
tmpdir_connection="$(mktemp -d "${TMPDIR:-/tmp}/gonavi-generate-driver-revisions-connection.XXXXXX")"
darwin_file="$(mktemp "${TMPDIR:-/tmp}/gonavi-darwin-revisions.XXXXXX")"
windows_file="$(mktemp "${TMPDIR:-/tmp}/gonavi-windows-revisions.XXXXXX")"
cleanup() {
  rm -rf "$tmpdir_platform" "$tmpdir_connection"
  rm -f "$darwin_file" "$windows_file"
}
trap cleanup EXIT

copy_repo_to_tmp "$tmpdir_platform"

(
  cd "$tmpdir_platform"
  GONAVI_DRIVER_REVISION_JOBS=1 bash ./tools/generate-driver-agent-revisions.sh --platform darwin/arm64 --drivers duckdb >/dev/null
  cp internal/db/driver_agent_revisions_gen.go "$darwin_file"
  GONAVI_DRIVER_REVISION_JOBS=1 bash ./tools/generate-driver-agent-revisions.sh --platform windows/amd64 --drivers duckdb >/dev/null
  cp internal/db/driver_agent_revisions_gen.go "$windows_file"
)

darwin_duckdb="$(extract_revision "$darwin_file" duckdb)"
windows_duckdb="$(extract_revision "$windows_file" duckdb)"
if [[ -z "$darwin_duckdb" || -z "$windows_duckdb" ]]; then
  echo "expected duckdb revision to be generated for both platforms" >&2
  exit 1
fi
if [[ "$darwin_duckdb" == "$windows_duckdb" ]]; then
  echo "expected duckdb revision to differ between darwin/arm64 and windows/amd64, got identical value: $darwin_duckdb" >&2
  exit 1
fi

copy_repo_to_tmp "$tmpdir_connection"

(
  cd "$tmpdir_connection"
  GONAVI_DRIVER_REVISION_JOBS=1 bash ./tools/generate-driver-agent-revisions.sh --platform windows/amd64 --drivers sqlserver >/dev/null
  before_file="$(mktemp "${TMPDIR:-/tmp}/gonavi-sqlserver-revision-before.XXXXXX")"
  after_file="$(mktemp "${TMPDIR:-/tmp}/gonavi-sqlserver-revision-after.XXXXXX")"
  cleanup_sqlserver_revision_files() {
    rm -f "$before_file" "$after_file"
  }
  trap cleanup_sqlserver_revision_files EXIT

  cp internal/db/driver_agent_revisions_gen.go "$before_file"
  perl -0pi -e 's/RedisSentinelMaster   string/RedisSentinelLabel    string           `json:"redisSentinelLabel,omitempty"`\n\tRedisSentinelMaster   string/' internal/connection/types.go
  GONAVI_DRIVER_REVISION_JOBS=1 bash ./tools/generate-driver-agent-revisions.sh --platform windows/amd64 --drivers sqlserver >/dev/null
  cp internal/db/driver_agent_revisions_gen.go "$after_file"

  before_sqlserver="$(extract_revision "$before_file" sqlserver)"
  after_sqlserver="$(extract_revision "$after_file" sqlserver)"
  if [[ -z "$before_sqlserver" || -z "$after_sqlserver" ]]; then
    echo "expected sqlserver revision to be generated before and after connection-only change" >&2
    exit 1
  fi
  if [[ "$before_sqlserver" != "$after_sqlserver" ]]; then
    echo "expected Redis-only connection field change to keep sqlserver revision stable, before=$before_sqlserver after=$after_sqlserver" >&2
    exit 1
  fi
)

echo "generate-driver-agent-revisions platform test passed"

tmpdir_skip="$(mktemp -d "${TMPDIR:-/tmp}/gonavi-generate-driver-revisions-skip.XXXXXX")"
cleanup_skip() {
  rm -rf "$tmpdir_skip"
}
trap 'cleanup; cleanup_skip' EXIT

copy_repo_to_tmp "$tmpdir_skip"
(
  cd "$tmpdir_skip"
  git init -q
  git config user.email "ci@example.com"
  git config user.name "ci"
  # 避免 Windows/沙箱下换行或文件模式噪音干扰「未变更」判断。
  git config core.autocrlf false
  git config core.filemode false
  git add -A
  git commit -q -m "base"

  before_hash="$(git hash-object internal/db/driver_agent_revisions_gen.go)"
  skip_output="$(GONAVI_DRIVER_REVISION_JOBS=1 bash ./tools/generate-driver-agent-revisions.sh --platform windows/amd64 --skip-if-unchanged-since HEAD)"
  after_hash="$(git hash-object internal/db/driver_agent_revisions_gen.go)"

  if [[ "$skip_output" != *"跳过"* ]]; then
    echo "expected --skip-if-unchanged-since HEAD to skip when inputs are unchanged, got: $skip_output" >&2
    exit 1
  fi
  if [[ "$before_hash" != "$after_hash" ]]; then
    echo "expected skipped generation to leave revision file untouched" >&2
    exit 1
  fi

  # 仅弄脏工作区、未提交时，不应误判为需要重算。
  printf '\n' >>internal/db/sqlite_impl.go
  dirty_skip_output="$(GONAVI_DRIVER_REVISION_JOBS=1 bash ./tools/generate-driver-agent-revisions.sh --platform windows/amd64 --skip-if-unchanged-since HEAD)"
  if [[ "$dirty_skip_output" != *"跳过"* ]]; then
    echo "expected dirty working tree alone not to force regeneration, got: $dirty_skip_output" >&2
    exit 1
  fi

  base_before_change="$(git rev-parse HEAD)"
  git add internal/db/sqlite_impl.go
  git commit -q -m "touch sqlite driver source"
  if GONAVI_DRIVER_REVISION_JOBS=1 bash ./tools/generate-driver-agent-revisions.sh \
      --platform windows/amd64 \
      --skip-if-unchanged-since "$base_before_change" \
      --decide-skip-only >/tmp/gonavi-rev-decide.log 2>&1; then
    echo "expected committed driver source change to require regeneration" >&2
    cat /tmp/gonavi-rev-decide.log >&2
    exit 1
  fi
  if ! grep -q "需要重算" /tmp/gonavi-rev-decide.log; then
    echo "expected regeneration decision after committed driver source change" >&2
    cat /tmp/gonavi-rev-decide.log >&2
    exit 1
  fi
  if ! grep -q "internal/db/sqlite_impl.go" /tmp/gonavi-rev-decide.log; then
    echo "expected changed file list in regeneration decision log" >&2
    cat /tmp/gonavi-rev-decide.log >&2
    exit 1
  fi
)

echo "generate-driver-agent-revisions skip-unchanged test passed"
