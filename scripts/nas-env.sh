#!/usr/bin/env bash

nas_repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

nas_load_env() {
  REPO_ROOT="$(nas_repo_root)"
  ENV_FILE="${NAS_ENV_FILE:-$REPO_ROOT/.env.nas}"

  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing NAS config: $ENV_FILE" >&2
    echo "Create it from .env.nas.example first." >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  NAS_SSH_PORT="${NAS_SSH_PORT:-22}"
  NAS_TARGET="${NAS_USER:-}@${NAS_HOST:-}"

  if [[ -z "${NAS_HOST:-}" || -z "${NAS_USER:-}" || -z "${NAS_PROJECT_DIR:-}" || -z "${NAS_RUNTIME_DIR:-}" ]]; then
    echo "NAS_HOST, NAS_USER, NAS_PROJECT_DIR, and NAS_RUNTIME_DIR are required in $ENV_FILE." >&2
    exit 1
  fi

  NAS_API_BASE_URL="${NAS_API_BASE_URL:-http://$NAS_HOST:8000}"
  NAS_WEB_ORIGIN="${NAS_WEB_ORIGIN:-http://$NAS_HOST:5173}"
  if [[ -z "${NAS_WS_BASE_URL:-}" ]]; then
    NAS_WS_BASE_URL="${NAS_API_BASE_URL/http:\/\//ws://}"
    NAS_WS_BASE_URL="${NAS_WS_BASE_URL/https:\/\//wss://}"
  fi
}

nas_quote() {
  printf "%q" "$1"
}

nas_remote_dirs_command() {
  printf "mkdir -p %s %s %s %s %s" \
    "$(nas_quote "$NAS_PROJECT_DIR")" \
    "$(nas_quote "$NAS_RUNTIME_DIR/data")" \
    "$(nas_quote "$NAS_RUNTIME_DIR/downloads")" \
    "$(nas_quote "$NAS_RUNTIME_DIR/logs")" \
    "$(nas_quote "$NAS_RUNTIME_DIR/temp")"
}

nas_compose_env_command() {
  printf "NAS_RUNTIME_DIR=%s NAS_API_BASE_URL=%s NAS_WS_BASE_URL=%s NAS_WEB_ORIGIN=%s" \
    "$(nas_quote "$NAS_RUNTIME_DIR")" \
    "$(nas_quote "$NAS_API_BASE_URL")" \
    "$(nas_quote "$NAS_WS_BASE_URL")" \
    "$(nas_quote "$NAS_WEB_ORIGIN")"
}
