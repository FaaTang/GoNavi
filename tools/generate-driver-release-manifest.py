#!/usr/bin/env python3

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets-dir", required=True, help="driver release staging dir that contains standalone driver assets")
    parser.add_argument("--output", required=True, help="manifest json output path")
    return parser.parse_args()


def infer_driver_and_platform(file_name: str):
    suffixes = [
        ("-driver-agent-v1-darwin-amd64", "darwin/amd64"),
        ("-driver-agent-v1-darwin-arm64", "darwin/arm64"),
        ("-driver-agent-v1-linux-amd64", "linux/amd64"),
        ("-driver-agent-v1-windows-amd64.exe", "windows/amd64"),
        ("-driver-agent-v1-windows-arm64.exe", "windows/arm64"),
        ("-driver-agent-v2-darwin-amd64", "darwin/amd64"),
        ("-driver-agent-v2-darwin-arm64", "darwin/arm64"),
        ("-driver-agent-v2-linux-amd64", "linux/amd64"),
        ("-driver-agent-v2-windows-amd64.exe", "windows/amd64"),
        ("-driver-agent-v2-windows-arm64.exe", "windows/arm64"),
        ("-driver-agent-darwin-amd64", "darwin/amd64"),
        ("-driver-agent-darwin-arm64", "darwin/arm64"),
        ("-driver-agent-linux-amd64", "linux/amd64"),
        ("-driver-agent-windows-amd64.exe", "windows/amd64"),
        ("-driver-agent-windows-arm64.exe", "windows/arm64"),
    ]
    for suffix, platform in suffixes:
        if file_name.endswith(suffix):
            driver = file_name[: -len(suffix)]
            return driver, platform
    return None, None


def repo_root():
    return Path(__file__).resolve().parent.parent


def resolve_head_commit(root: Path):
    proc = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=root,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=True,
    )
    return proc.stdout.strip()


def main():
    args = parse_args()
    assets_dir = Path(args.assets_dir).resolve()
    output_path = Path(args.output).resolve()
    root = repo_root()

    asset_entries = []
    for child in sorted(assets_dir.rglob("*")):
        if not child.is_file():
            continue
        driver, platform = infer_driver_and_platform(child.name)
        if not driver or not platform:
            continue
        if child.stat().st_size == 0:
            raise RuntimeError(f"{child.name}: asset is empty")
        asset_entries.append((child, driver, platform))

    manifest = {
        "schemaVersion": 1,
        "generatedFrom": os.environ.get("GITHUB_SHA", "").strip() or resolve_head_commit(root),
        "assets": {},
    }

    for child, driver, platform in asset_entries:
        # 指纹 revision 已废弃：Manifest 只保留资产元数据（size/sha256），不再重算 src-*。
        manifest["assets"][child.name] = {
            "driver": driver,
            "driverType": driver,
            "platform": platform,
            "revision": "",
            "size": child.stat().st_size,
            "sha256": hashlib.sha256(child.read_bytes()).hexdigest(),
        }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote manifest: {output_path}")
    print(f"asset count: {len(manifest['assets'])}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
