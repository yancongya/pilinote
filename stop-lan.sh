#!/bin/bash

echo "正在停止 PiliNote 局域网服务..."

# 停止后端服务（通过端口）
if lsof -ti:8000 > /dev/null; then
    lsof -ti:8000 | xargs kill -9
    echo "✓ 后端服务已停止"
else
    echo "后端服务未运行"
fi

# 停止前端服务（通过端口）
if lsof -ti:5173 > /dev/null; then
    lsof -ti:5173 | xargs kill -9
    echo "✓ 前端服务已停止"
else
    echo "前端服务未运行"
fi

# 额外清理：停止可能的残留进程
if pgrep -x "uvicorn" > /dev/null; then
    pkill -9 -x "uvicorn"
    echo "✓ 清理残留的 uvicorn 进程"
fi

if pgrep -f "vite" > /dev/null; then
    pkill -9 -f "vite"
    echo "✓ 清理残留的 Vite 进程"
fi

echo ""
echo "所有服务已停止"
