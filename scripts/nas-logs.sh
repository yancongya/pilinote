#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Loads .env.nas through the shared helper.
# shellcheck source=scripts/nas-env.sh
source "$SCRIPT_DIR/nas-env.sh"
nas_load_env

remote_project="$(nas_quote "$NAS_PROJECT_DIR")"
remote_env="$(nas_compose_env_command)"
remote_args=""
for arg in "$@"; do
  remote_args+=" $(nas_quote "$arg")"
done

ssh -p "$NAS_SSH_PORT" "$NAS_TARGET" "\
  cd $remote_project && \
  $remote_env docker compose -f docker-compose.nas.yml logs -f$remote_args"
