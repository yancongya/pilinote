#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Loads .env.nas through the shared helper.
# shellcheck source=scripts/nas-env.sh
source "$SCRIPT_DIR/nas-env.sh"
nas_load_env

remote_project="$(nas_quote "$NAS_PROJECT_DIR")"
remote_env="$(nas_compose_env_command)"

echo "Starting PiliNote on NAS $NAS_TARGET..."
ssh -p "$NAS_SSH_PORT" "$NAS_TARGET" "\
  $(nas_remote_dirs_command) && \
  cd $remote_project && \
  $remote_env docker compose -f docker-compose.nas.yml up -d"

echo "NAS Docker services requested."
