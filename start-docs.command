#!/bin/bash

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 尝试加载用户 shell 环境，兼容双击 .command 时 PATH 不完整的情况
[ -f "$HOME/.zprofile" ] && source "$HOME/.zprofile" 2>/dev/null
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# 切换到 docs 目录
cd "$SCRIPT_DIR/apps/docs" || exit 1

echo "[docs] starting vitepress dev..."
echo "[docs] dir: $SCRIPT_DIR/apps/docs"
echo "[docs] url: http://127.0.0.1:5174"

# 直接使用 package.json 的 dev 脚本，避免重复传参导致端口参数冲突
if command -v pnpm >/dev/null 2>&1; then
  pnpm dev
elif command -v corepack >/dev/null 2>&1; then
  corepack pnpm dev
else
  echo "[docs] error: pnpm/corepack not found in PATH"
  exit 1
fi
