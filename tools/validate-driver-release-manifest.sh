#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

usage() {
  cat <<'EOF'
用法：
  ./tools/validate-driver-release-manifest.sh --commit <ref> --manifest <path>

说明：
  指纹 revision 对比已废弃。本脚本仅校验 Manifest 结构/资产元数据是否可读，
  不再对源码重算 src-* 指纹。
EOF
}

source_commit=""
manifest_path=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --commit)
      source_commit="${2:-}"
      shift 2
      ;;
    --manifest)
      manifest_path="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数：$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$source_commit" || -z "$manifest_path" ]]; then
  usage >&2
  exit 1
fi

if [[ ! -f "$manifest_path" ]]; then
  echo "manifest 不存在：$manifest_path" >&2
  exit 1
fi

python3 - "$manifest_path" <<'PY'
import json
import sys
from pathlib import Path

manifest_path = Path(sys.argv[1])
data = json.loads(manifest_path.read_text(encoding="utf-8"))
assets = data.get("assets") or {}
if not isinstance(assets, dict) or not assets:
    raise SystemExit("manifest assets 为空或格式错误")
for name, meta in assets.items():
    if not isinstance(meta, dict):
        raise SystemExit(f"{name}: asset meta 不是对象")
    if int(meta.get("size") or 0) <= 0:
        raise SystemExit(f"{name}: size 无效")
    sha = str(meta.get("sha256") or "").strip()
    if len(sha) != 64:
        raise SystemExit(f"{name}: sha256 无效")
print(f"manifest structure ok: assets={len(assets)} (revision fingerprint validation disabled)")
PY
