#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Loads .env.nas through the shared helper.
# shellcheck source=scripts/nas-env.sh
source "$SCRIPT_DIR/nas-env.sh"
nas_load_env

echo "Preparing NAS directories on $NAS_TARGET..."
ssh -p "$NAS_SSH_PORT" "$NAS_TARGET" "$(nas_remote_dirs_command)"

echo "Syncing project files to $NAS_TARGET:$NAS_PROJECT_DIR ..."
rsync -az --delete \
  --exclude-from="$REPO_ROOT/.nas-syncignore" \
  -e "ssh -p $NAS_SSH_PORT" \
  "$REPO_ROOT/" \
  "$NAS_TARGET:$NAS_PROJECT_DIR/"

echo "NAS sync complete."
