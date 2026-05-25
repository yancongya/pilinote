#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$ROOT_DIR/apps/docs"
DOCS_DIST_DIR="$DOCS_DIR/.vitepress/dist"
DOCS_ENTRY="$DOCS_DIR/scripts/docs_server.py"

TARGET="${1:-mac}" # mac | win | linux
case "$TARGET" in
  mac) BIN_NAME="pilinote-docs-macos" ;;
  win) BIN_NAME="pilinote-docs.exe" ;;
  linux) BIN_NAME="pilinote-docs" ;;
  *)
    echo "[docs-binary] invalid target: $TARGET"
    echo "usage: ./build-docs-binary.command [mac|win|linux]"
    exit 1
    ;;
esac

DIST_ROOT="$ROOT_DIR/apps/desktop/resources/docs/$TARGET"
TMP_ROOT="$DOCS_DIR/.pyinstaller-docs"
TMP_DIST="$TMP_ROOT/dist"
TMP_BUILD="$TMP_ROOT/build"

PYTHON_EXEC="$ROOT_DIR/apps/api/venv/bin/python"
if [ ! -x "$PYTHON_EXEC" ]; then
  PYTHON_EXEC="python3"
fi

echo "[docs-binary] target: $TARGET"
pnpm --dir "$DOCS_DIR" build

if [ ! -d "$DOCS_DIST_DIR" ]; then
  echo "[docs-binary] docs dist not found: $DOCS_DIST_DIR"
  exit 1
fi

rm -rf "$TMP_ROOT"
mkdir -p "$TMP_ROOT" "$DIST_ROOT"

"$PYTHON_EXEC" -m PyInstaller \
  --clean \
  --noconfirm \
  --onedir \
  --name "${BIN_NAME%.exe}" \
  --distpath "$TMP_DIST" \
  --workpath "$TMP_BUILD" \
  --specpath "$TMP_BUILD" \
  --add-data "$DOCS_DIST_DIR:docs-dist" \
  "$DOCS_ENTRY"

BUILT_DIR="$TMP_DIST/${BIN_NAME%.exe}"
if [ ! -d "$BUILT_DIR" ]; then
  echo "[docs-binary] pyinstaller output not found: $BUILT_DIR"
  exit 1
fi

find "$DIST_ROOT" -mindepth 1 -exec rm -rf {} +
cp -R "$BUILT_DIR"/. "$DIST_ROOT"/

echo "[docs-binary] output: $DIST_ROOT"
