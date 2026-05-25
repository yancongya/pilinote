#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$ROOT_DIR/apps/docs"
PORT="${PORT:-5174}"
HOST="${HOST:-0.0.0.0}"

echo "[docs] starting vitepress dev..."
echo "[docs] dir: $DOCS_DIR"
echo "[docs] url: http://127.0.0.1:$PORT"

exec pnpm --dir "$DOCS_DIR" exec vitepress dev --host "$HOST" --port "$PORT"
