#!/bin/bash
# 测试所有链接类型的解析

API_BASE="http://localhost:8000"

echo "=== 链接解析测试报告 ==="
echo ""

# 测试各种类型的链接
test_urls=(
  # 视频类型
  "BV1xx411c7mD"
  "av170001"
  "https://www.bilibili.com/video/BV1xx411c7mD"
  
  # 番剧类型
  "ep123456"
  "ss123456"
  "md123456"
  
  # 课程类型（已修复）
  "https://www.bilibili.com/cheese/play/ss292774372"
  "https://www.bilibili.com/cheese/play/ss292774372?csource=test"
  "ss292774372?csource=test"
  
  # 音乐类型
  "au123456"
  "am123456"
  
  # 图文类型
  "cv123456"
  "https://www.bilibili.com/opus/123456"
  
  # 边界情况
  ""
  "invalid-url"
)

for url in "${test_urls[@]}"; do
  echo "测试: $url"
  response=$(curl -s -X POST "$API_BASE/api/download/parse" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$url\"}")
  
  # 检查是否是JSON响应
  if echo "$response" | jq -e . > /dev/null 2>&1; then
    success=$(echo "$response" | jq -r '.success // "null"')
    message=$(echo "$response" | jq -r '.message // "N/A"')
    type=$(echo "$response" | jq -r '.data.parsed_id.type // "N/A"' 2>/dev/null)
    
    echo "  结果: success=$success, type=$type, message=$message"
  else
    echo "  结果: 非JSON响应 - $response"
  fi
  echo ""
done

echo "=== 测试完成 ==="