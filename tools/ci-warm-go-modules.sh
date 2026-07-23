#!/usr/bin/env bash
# CI 预热 Go 模块：下载 go.sum 全量模块，并按目标平台/标签解析依赖，避免 wails build 阶段大量 go: downloading。
set -euo pipefail

platform="${1:-}"
tags="${2:-}"

echo "📦 预热 Go 模块（go mod download all）..."
go mod download all

if [[ -z "$platform" ]]; then
  echo "✅ 模块预热完成（未指定目标平台）"
  exit 0
fi

IFS='/' read -r goos goarch <<< "$platform"
if [[ -z "$goos" || -z "$goarch" ]]; then
  echo "⚠️ 无效 platform: ${platform}，跳过按平台解析依赖" >&2
  exit 0
fi

# assets_prod.go 使用 //go:embed all:frontend/dist；go list 会加载该文件。
# 预热阶段通常尚未解压真实前端产物，先放占位文件避免 "no matching files found"。
if [[ ! -e frontend/dist/index.html ]]; then
  mkdir -p frontend/dist
  printf '<!doctype html><title>ci-warm-placeholder</title>\n' > frontend/dist/index.html
fi

echo "📦 按目标平台解析依赖：GOOS=${goos} GOARCH=${goarch} tags=${tags:-<none>}"
if [[ -n "$tags" ]]; then
  GOOS="$goos" GOARCH="$goarch" go list -deps -tags "$tags" ./... >/dev/null
else
  GOOS="$goos" GOARCH="$goarch" go list -deps ./... >/dev/null
fi

echo "✅ 模块预热完成：${platform}"
