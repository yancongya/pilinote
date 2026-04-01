#!/bin/bash

# PiliNote 前端功能测试脚本

echo "=========================================="
echo "  PiliNote 前端功能测试"
echo "=========================================="

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查服务状态
check_service() {
    local service_name=$1
    local url=$2

    echo -n "检查 $service_name ... "
    if curl -s "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 运行中${NC}"
        return 0
    else
        echo -e "${RED}✗ 未运行${NC}"
        return 1
    fi
}

# 测试API端点
test_api_endpoint() {
    local endpoint=$1
    local description=$2

    echo -n "测试 $description ... "
    response=$(curl -s "http://localhost:8000$endpoint")
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 成功${NC}"
        echo "  响应: $(echo $response | head -c 100)..."
        return 0
    else
        echo -e "${RED}✗ 失败${NC}"
        return 1
    fi
}

# 测试流程
run_tests() {
    echo ""
    echo "=========================================="
    echo "  第1部分：服务状态检查"
    echo "=========================================="
    echo ""

    api_running=false
    frontend_running=false

    check_service "API服务" "http://localhost:8000/health" && api_running=true
    check_service "前端服务" "http://localhost:5173" && frontend_running=true

    if [ "$api_running" = false ]; then
        echo ""
        echo -e "${YELLOW}⚠ API服务未运行，请先启动API服务：${NC}"
        echo "  cd apps/api && python3 main.py"
        echo ""
        exit 1
    fi

    if [ "$frontend_running" = false ]; then
        echo ""
        echo -e "${YELLOW}⚠ 前端服务未运行，请先启动前端服务：${NC}"
        echo "  cd apps/web && npm run dev"
        echo ""
        exit 1
    fi

    echo ""
    echo "=========================================="
    echo "  第2部分：API接口测试"
    echo "=========================================="
    echo ""

    test_api_endpoint "/health" "健康检查"
    test_api_endpoint "/api/cache/stats" "缓存统计"
    test_api_endpoint "/api/queue/" "队列查询"
    test_api_endpoint "/api/media/video/BV1xx411c7mD" "视频信息"

    echo ""
    echo "=========================================="
    echo "  第3部分：提交测试任务"
    echo "=========================================="
    echo ""

    echo "创建测试任务..."
    task_response=$(curl -s -X POST http://localhost:8000/api/queue/tasks \
        -H "Content-Type: application/json" \
        -d '{
            "media_type": "video",
            "media_id": "BV1xx411c7mD",
            "title": "前端测试视频"
        }')

    if echo "$task_response" | grep -q '"id"'; then
        echo -e "${GREEN}✓ 任务创建成功${NC}"
        task_id=$(echo "$task_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
        echo "  任务ID: $task_id"
    else
        echo -e "${RED}✗ 任务创建失败${NC}"
        echo "  响应: $task_response"
    fi

    echo ""
    echo "=========================================="
    echo "  第4部分：前端页面测试（手动）"
    echo "=========================================="
    echo ""

    echo -e "${YELLOW}请在浏览器中执行以下测试：${NC}"
    echo ""
    echo "1. 打开浏览器访问: ${GREEN}http://localhost:5173${NC}"
    echo ""
    echo "2. 测试登录功能"
    echo "   - 点击登录按钮"
    echo "   - 选择SESSDATA登录"
    echo "   - 输入SESSDATA"
    echo "   - 验证登录成功"
    echo ""
    echo "3. 测试稍后再看页面"
    echo "   - 点击导航栏的\"稍后再看\""
    echo "   - 验证视频列表正常显示"
    echo "   - 验证视频卡片显示正确（封面、标题、UP主、统计信息）"
    echo "   - 验证时间格式正确（不是NaN-NaN-NaN）"
    echo "   - 验证滚动加载正常"
    echo ""
    echo "4. 测试收藏夹页面"
    echo "   - 点击导航栏的\"收藏夹\""
    echo "   - 验证收藏夹列表正常显示"
    echo "   - 验证视频列表正常显示"
    echo "   - 验证时间格式正确"
    echo ""
    echo "5. 测试视频详情页"
    echo "   - 点击任意视频卡片"
    echo "   - 验证视频详情页正常打开"
    echo "   - 验证视频封面显示"
    echo "   - 验证UP主信息显示（头像、名字）"
    echo "   - 验证视频标题可点击（悬停变粉色）"
    echo "   - 验证统计信息显示（两行）"
    echo "   - 验证时间显示正确"
    echo "   - 验证添加到列表按钮正常"
    echo ""
    echo "6. 测试响应式布局"
    echo "   - 调整浏览器窗口大小"
    echo "   - 验证移动端布局（<768px）"
    echo "   - 验证平板端布局（≥768px）"
    echo "   - 验证桌面端布局（≥1024px）"
    echo "   - 验证内容最大宽度800px且居中"
    echo ""
    echo "7. 测试新API接口"
    echo "   - 打开浏览器控制台（F12）"
    echo "   - 执行以下命令测试缓存："
    echo "     fetch('/api/cache/stats').then(r => r.json()).then(console.log)"
    echo "   - 执行以下命令测试队列："
    echo "     fetch('/api/queue/').then(r => r.json()).then(console.log)"
    echo "   - 执行以下命令测试媒体信息："
    echo "     fetch('/api/media/video/BV1xx411c7mD').then(r => r.json()).then(console.log)"
    echo ""
    echo "8. 测试下载功能"
    echo "   - 在稍后再看或收藏夹页面"
    echo "   - 点击视频卡片的下载按钮"
    echo "   - 验证添加到下载列表成功"
    echo "   - 验证下载列表页面正常显示"
    echo ""
    echo "9. 测试视频标题点击"
    echo "   - 在视频详情页"
    echo "   - 将鼠标悬停在视频标题上"
    echo "   - 验证标题变为粉色并添加下划线"
    echo "   - 点击标题"
    echo "   - 验证在新标签页打开B站视频页面"
    echo ""
    echo "10. 测试批量下载功能"
    echo "    - 在稍后再看或收藏夹页面"
    echo "    - 点击\"批量下载\"按钮"
    echo "    - 验证批量选择模式激活"
    echo "    - 选择多个视频"
    echo "    - 点击\"全部添加到列表\""
    echo "    - 验证批量添加成功"
    echo ""
    echo "=========================================="
    echo "  第5部分：性能测试"
    echo "=========================================="
    echo ""

    echo "测试缓存命中率..."
    echo "  1. 访问稍后再看页面（第一次）"
    echo "  2. 刷新页面（第二次，应该命中缓存）"
    echo "  3. 检查缓存统计："
    echo "     fetch('/api/cache/stats').then(r => r.json()).then(console.log)"
    echo "  4. 验证 total_count > 0（说明缓存生效）"
    echo ""
    echo "测试页面加载速度..."
    echo "  1. 打开浏览器控制台（F12）"
    echo "  2. 切换到 Network 标签"
    echo "  3. 刷新页面"
    echo "  4. 检查各个资源的加载时间"
    echo "  5. 验证API响应时间 < 1秒"
    echo ""
    echo "=========================================="
    echo "  第6部分：错误处理测试"
    echo "=========================================="
    echo ""

    echo "测试错误处理..."
    echo "  1. 测试未登录状态"
    echo "     - 清除SESSDATA"
    echo "     - 访问稍后再看"
    echo "     - 验证显示登录提示"
    echo ""
    echo "  2. 测试无效的视频ID"
    echo "     - 直接访问 http://localhost:5173/video/BV1invalid"
    echo "     - 验证显示错误信息"
    echo ""
    echo "  3. 测试网络错误"
    echo "     - 关闭API服务"
    echo "     - 刷新页面"
    echo "     - 验证显示网络错误提示"
    echo ""

    echo "=========================================="
    echo "  测试完成"
    echo "=========================================="
    echo ""
    echo -e "${GREEN}✓ 自动化测试完成${NC}"
    echo -e "${YELLOW}⚠ 请按照第4部分手动测试前端功能${NC}"
    echo ""
    echo "测试完成后，可以运行以下命令查看日志："
    echo "  - API日志: cd apps/api && tail -f logs/api.log"
    echo "  - 前端日志: 查看浏览器控制台"
    echo ""
}

# 运行测试
run_tests

# 提供快速测试命令
echo ""
echo "=========================================="
echo "  快速测试命令"
echo "=========================================="
echo ""
echo "1. 查看缓存统计:"
echo "   curl http://localhost:8000/api/cache/stats"
echo ""
echo "2. 查看队列状态:"
echo "   curl http://localhost:8000/api/queue/"
echo ""
echo "3. 查看任务列表:"
echo "   curl http://localhost:8000/api/queue/tasks"
echo ""
echo "4. 查看调度器列表:"
echo "   curl http://localhost:8000/api/queue/schedulers"
echo ""
echo "5. 清理过期缓存:"
echo "   curl -X POST http://localhost:8000/api/cache/cleanup"
echo ""
echo "6. 清空所有缓存:"
echo "   curl -X POST http://localhost:8000/api/cache/clear"
echo ""
echo "7. 测试视频信息API:"
echo "   curl http://localhost:8000/api/media/video/BV1xx411c7mD"
echo ""
echo "8. 测试稍后再看API:"
echo "   curl 'http://localhost:8000/api/media/watchlater'"
echo ""
echo "9. 提交测试任务:"
echo "   curl -X POST http://localhost:8000/api/queue/tasks \\\n"
echo "     -H 'Content-Type: application/json' \\\n"
echo "     -d '{\"media_type\":\"video\",\"media_id\":\"BV1xx411c7mD\",\"title\":\"测试\"}'"
echo ""
echo "10. 创建测试调度器:"
echo "    curl -X POST http://localhost:8000/api/queue/schedulers \\\n"
echo "      -H 'Content-Type: application/json' \\\n"
echo "      -d '{\"title\":\"测试\",\"folder\":\"/tmp/test\"}'"
echo ""
