#!/usr/bin/env python3
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import httpx

async def test_alternative_endpoints():
    """测试B站的不同API端点"""
    print("测试B站的不同API端点...")
    
    bvid = "BV1PS4y1m79X"
    
    # 测试不同的API端点
    endpoints = [
        # 标准的web-interface接口
        ("https://api.bilibili.com/x/web-interface/view", "标准接口"),
        # 可能的其他接口
        ("https://api.bilibili.com/x/player/pagelist", "分页列表接口"),
        # 尝试通过aid获取
        ("https://api.bilibili.com/x/web-interface/archive/stat", "统计信息接口"),
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": f"https://www.bilibili.com/video/{bvid}"
    }
    
    for endpoint, desc in endpoints:
        print(f"\n测试 {desc}: {endpoint}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                params = {"bvid": bvid}
                
                response = await client.get(endpoint, params=params, headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("code") == 0:
                        print(f"✅ 成功！")
                        print(f"   返回数据键: {list(data.get('data', {}).keys())}")
                    else:
                        print(f"❌ API返回错误: {data.get('message')}")
                else:
                    print(f"❌ HTTP错误: {response.status_code}")
        except Exception as e:
            print(f"❌ 请求失败: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_alternative_endpoints())