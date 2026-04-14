#!/bin/bash

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 检查并关闭占用8000端口的进程
echo "检查端口 8000 是否被占用..."

PORT_PID=$(lsof -ti:8000)
if [ -n "$PORT_PID" ]; then
    echo "发现进程占用端口 8000: $PORT_PID"
    echo "正在关闭进程..."
    kill -9 $PORT_PID
    echo "进程已关闭"
    # 等待一下确保端口完全释放
    sleep 1
else
    echo "端口 8000 未被占用"
fi

# 切换到后端目录
cd "$SCRIPT_DIR/apps/api"

# 激活虚拟环境
source venv/bin/activate

# 启动后端服务
echo "正在启动后端服务..."
uvicorn main:app --reload --host 0.0.0.0 --port 8000