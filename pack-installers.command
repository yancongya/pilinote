#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$ROOT_DIR/apps/desktop"

echo "[pack] building docs binary (mac/win/linux)..."
bash "$ROOT_DIR/build-docs-binary.command" mac
bash "$ROOT_DIR/build-docs-binary.command" win
bash "$ROOT_DIR/build-docs-binary.command" linux

echo "[pack] building desktop installers (mac/win/linux)..."
pnpm --dir "$DESKTOP_DIR" pack:mac
pnpm --dir "$DESKTOP_DIR" pack:win
pnpm --dir "$DESKTOP_DIR" pack:linux

echo "[pack] done. outputs at: $DESKTOP_DIR/dist"
