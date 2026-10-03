#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"
API_DIR="$ROOT_DIR/apps/api"
BUILD_PRODUCTION=0

for argument in "$@"; do
  case "$argument" in
    --build) BUILD_PRODUCTION=1 ;;
    -h|--help)
      printf '用法: bash scripts/smoke-refactor.sh [--build]\n'
      exit 0
      ;;
    *) printf '未知参数: %s\n' "$argument" >&2; exit 2 ;;
  esac
done

command -v git >/dev/null || { printf '冒烟预检失败：暂存区快照需要本地 Git。\n' >&2; exit 1; }
command -v shasum >/dev/null || { printf '冒烟预检失败：需要 shasum 计算安全状态哈希。\n' >&2; exit 1; }
[[ -x "$WEB_DIR/node_modules/.bin/vitest" ]] || { printf '冒烟预检失败：找不到本地 Vitest；不会安装依赖。\n' >&2; exit 1; }
[[ -x "$WEB_DIR/node_modules/.bin/tsc" ]] || { printf '冒烟预检失败：找不到本地 TypeScript 编译器。\n' >&2; exit 1; }
[[ -f "$API_DIR/venv/bin/activate" && -x "$API_DIR/venv/bin/python" ]] || { printf '冒烟预检失败：找不到现有 API 虚拟环境。\n' >&2; exit 1; }

STATE_NAMES=("ASR registry" "AI runtime state" "生产数据库")
STATE_PATHS=(
  "$API_DIR/data/local_asr_models.json"
  "$API_DIR/data/ai_runtime_state.json"
  "$API_DIR/data/pilinote.db"
)
STATE_BEFORE=()

hash_file() {
  if [[ -f "$1" ]]; then
    shasum -a 256 < "$1" | awk '{print $1}'
  else
    printf 'MISSING'
  fi
}

staged_snapshot() {
  git -C "$ROOT_DIR" ls-files --stage -z | shasum -a 256 | awk '{print $1}'
}

TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/pilinote-refactor-smoke.XXXXXX")"
trap 'rm -rf "$TEMP_ROOT"' EXIT

for state_path in "${STATE_PATHS[@]}"; do
  STATE_BEFORE+=("$(hash_file "$state_path")")
done
STAGED_BEFORE="$(staged_snapshot)"

finish() {
  local original_status=$?
  local safety_failure=0
  trap - EXIT
  set +e
  printf '\n安全状态复核：\n'
  for index in "${!STATE_PATHS[@]}"; do
    local current_hash
    current_hash="$(hash_file "${STATE_PATHS[$index]}")"
    if [[ "$current_hash" == "${STATE_BEFORE[$index]}" ]]; then
      printf '未变化：%s (%s)\n' "${STATE_NAMES[$index]}" "${current_hash:0:16}"
    else
      printf '发生变化：%s (%s -> %s)\n' "${STATE_NAMES[$index]}" "${STATE_BEFORE[$index]}" "$current_hash" >&2
      safety_failure=1
    fi
  done
  local staged_after
  staged_after="$(staged_snapshot)"
  if [[ "$staged_after" == "$STAGED_BEFORE" ]]; then
    printf '暂存区快照未变化（含已有暂存二进制对象）\n'
  else
    printf '暂存区快照发生变化：%s -> %s\n' "$STAGED_BEFORE" "$staged_after" >&2
    safety_failure=1
  fi
  rm -rf "$TEMP_ROOT"
  if (( safety_failure != 0 )); then
    exit 1
  fi
  exit "$original_status"
}
trap finish EXIT

fail() {
  printf '冒烟预检失败：%s\n' "$1" >&2
  exit 1
}

WEB_TESTS=(
  src/pages/components/VideoDetailPresenters.test.tsx
  src/pages/videoDetailDownloadPayloads.test.ts
  src/pages/__tests__/VideoDetailPage.requests.test.tsx
  src/__tests__/apiConfig.test.ts
  src/__tests__/videoDetailCache.test.ts
  src/__tests__/videoDetailPlayback.test.ts
  src/pages/videoDetailKeypoints.test.ts
  src/__tests__/useVideoDownload.test.ts
  src/hooks/__tests__/useLocalVideoPlayback.test.tsx
)
API_TESTS=(
  tests/test_note_pipeline.py
  tests/test_subtitle_utils.py
  tests/test_note_context.py
  tests/test_note_service_boundaries.py
  tests/test_note_outputs.py
  tests/test_refactor_boundaries.py
  tests/unit/services/test_queue_manager_execution.py
)
for test_path in "${WEB_TESTS[@]}"; do
  [[ -f "$WEB_DIR/$test_path" ]] || fail "缺少前端定向测试：$test_path"
done
for test_path in "${API_TESTS[@]}"; do
  [[ -f "$API_DIR/$test_path" ]] || fail "缺少 API 定向测试：$test_path"
done

mkdir -p "$TEMP_ROOT/runtime"
printf '临时测试目录：%s\n' "$TEMP_ROOT"

printf '\n[1/5] 前端定向 Vitest\n'
(
  cd "$WEB_DIR"
  ./node_modules/.bin/vitest run "${WEB_TESTS[@]}"
)

printf '\n[2/5] TypeScript project build\n'
(
  cd "$WEB_DIR"
  ./node_modules/.bin/tsc -b
)

printf '\n[3/5] 静态纯模块边界检查\n'
(
  source "$API_DIR/venv/bin/activate"
  cd "$ROOT_DIR"
  "$API_DIR/venv/bin/python" scripts/check_refactor_boundaries.py
)

printf '\n[4/5] API 安全定向 pytest\n'
(
  source "$API_DIR/venv/bin/activate"
  cd "$API_DIR"
  export PYTHONDONTWRITEBYTECODE=1
  export PILINOTE_RUNTIME_DIR="$TEMP_ROOT/runtime"
  export PILINOTE_LOG_DIR="$TEMP_ROOT/runtime/logs"
  export PILINOTE_DOWNLOAD_PATH="$TEMP_ROOT/runtime/downloads"
  export PILINOTE_TEMP_PATH="$TEMP_ROOT/runtime/temp"
  export DATABASE_URL='sqlite:///:memory:'
  export TESTING=true
  "$API_DIR/venv/bin/python" -m pytest \
    -p no:postgresql \
    -p no:cacheprovider \
    -o addopts= \
    --timeout=30 \
    -W error::RuntimeWarning \
    -k 'not test_scheduler_writes_series_nfo' \
    "${API_TESTS[@]}"
)

if (( BUILD_PRODUCTION != 0 )); then
  printf '\n[5/5] 显式请求的前端生产构建\n'
  (
    cd "$WEB_DIR"
    ./node_modules/.bin/vite build
  )
else
  printf '\n[5/5] 未请求生产构建（使用 --build 才会执行）\n'
fi

printf '\n本地代码冒烟全部通过。隔离浏览器流程不属于本脚本。\n'
