#!/bin/bash

echo "正在启动 PiliNote 局域网服务..."

# 获取本机 IP
IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)

if [ -z "$IP" ]; then
    echo "错误：无法获取本机 IP 地址"
    exit 1
fi

echo "========================================"
echo "本机 IP: $IP"
echo "前端访问地址: http://$IP:5173"
echo "后端 API 地址: http://$IP:8000"
echo "========================================"
echo ""

# 保存脚本目录
SCRIPT_DIR="$(dirname "$0")"

# 检查服务是否已运行
if pgrep -x "uvicorn" > /dev/null; then
    echo "后端服务已在运行"
else
    # 启动后端
    (cd "$SCRIPT_DIR/apps/api" && source venv/bin/activate && nohup uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/pilinote-api.log 2>&1 &) &
    echo "后端服务已启动"
fi

if pgrep -x "pnpm" > /dev/null; then
    echo "前端服务已在运行"
else
    # 启动前端
    (cd "$SCRIPT_DIR/apps/web" && nohup pnpm dev > /tmp/pilinote-web.log 2>&1 &) &
    echo "前端服务已启动"
fi

echo ""
echo "========================================"
echo "服务已启动！"
echo "========================================"
echo ""
echo "查看日志："
echo "  后端: tail -f /tmp/pilinote-api.log"
echo "  前端: tail -f /tmp/pilinote-web.log"
echo ""
echo "停止服务："
echo "  ./stop-lan.sh"
echo ""
echo "等待服务启动..."
sleep 3

# 检查服务是否成功启动
if curl -s http://localhost:8000 > /dev/null; then
    echo "✓ 后端服务运行正常"
else
    echo "✗ 后端服务启动失败，请检查日志"
fi

if curl -s http://localhost:5173 > /dev/null; then
    echo "✓ 前端服务运行正常"
else
    echo "✗ 前端服务启动失败，请检查日志"
fi
