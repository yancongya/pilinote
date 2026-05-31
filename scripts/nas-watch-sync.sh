#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Loads .env.nas through the shared helper.
# shellcheck source=scripts/nas-env.sh
source "$SCRIPT_DIR/nas-env.sh"
nas_load_env

if ! command -v fswatch >/dev/null 2>&1; then
  echo "fswatch is required. Install it with: brew install fswatch" >&2
  exit 1
fi

watch_paths=()
for path in \
  "$REPO_ROOT/apps/api" \
  "$REPO_ROOT/apps/web" \
  "$REPO_ROOT/packages" \
  "$REPO_ROOT/term-bases" \
  "$REPO_ROOT/docker-compose.nas.yml" \
  "$REPO_ROOT/.nas-syncignore"; do
  [[ -e "$path" ]] && watch_paths+=("$path")
done

if [[ "${#watch_paths[@]}" -eq 0 ]]; then
  echo "No watch paths found." >&2
  exit 1
fi

"$SCRIPT_DIR/nas-sync-once.sh"

echo "Watching local files for NAS sync. Press Ctrl+C to stop."
fswatch -0 "${watch_paths[@]}" | while IFS= read -r -d '' _event; do
  echo "Change detected. Syncing..."
  "$SCRIPT_DIR/nas-sync-once.sh"
done
