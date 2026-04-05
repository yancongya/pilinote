#!/bin/bash

echo "正在停止 PiliNote 局域网服务..."

# 停止后端服务
if pgrep -x "uvicorn" > /dev/null; then
    pkill -x "uvicorn"
    echo "✓ 后端服务已停止"
else
    echo "后端服务未运行"
fi

# 停止前端服务
if pgrep -x "pnpm" > /dev/null; then
    pkill -x "pnpm"
    echo "✓ 前端服务已停止"
else
    echo "前端服务未运行"
fi

# 停止可能的 node 进程
if pgrep -f "vite" > /dev/null; then
    pkill -f "vite"
    echo "✓ Vite 进程已停止"
fi

echo ""
echo "所有服务已停止"
