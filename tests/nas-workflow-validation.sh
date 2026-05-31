#!/usr/bin/env bash
set -euo pipefail

required_files=(
  "docker-compose.nas.yml"
  ".nas-syncignore"
  ".env.nas.example"
  "scripts/nas-sync-once.sh"
  "scripts/nas-watch-sync.sh"
  "scripts/nas-up.sh"
  "scripts/nas-logs.sh"
)

for file in "${required_files[@]}"; do
  test -f "$file"
done

grep -q "NAS_RUNTIME_DIR" docker-compose.nas.yml
grep -q "node:22-slim" docker-compose.nas.yml
grep -q "python:3.11-slim" docker-compose.nas.yml
grep -q "ffmpeg aria2" docker-compose.nas.yml
grep -q "pnpm@10" docker-compose.nas.yml

grep -q "^/pilinote-docs/" .nas-syncignore
grep -q "^/reference/" .nas-syncignore
grep -q "^node_modules/" .nas-syncignore

for script in scripts/nas-sync-once.sh scripts/nas-watch-sync.sh scripts/nas-up.sh scripts/nas-logs.sh; do
  bash -n "$script"
  test -x "$script"
  grep -q ".env.nas" "$script"
done
