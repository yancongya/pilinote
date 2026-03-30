#!/usr/bin/env python3
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import httpx

async def test_parse_video():
    """测试视频解析API"""
    print("测试视频解析API...")
    
    url = "https://www.bilibili.com/video/BV1TDQoBTEZX"
    
    # 模拟解析API的调用
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": f"https://www.bilibili.com/video/BV1TDQoBTEZX"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                "https://api.bilibili.com/x/web-interface/view",
                params={"bvid": "BV1TDQoBTEZX"},
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("code") == 0:
                    print(f"✅ 成功！视频标题: {data['data']['title']}")
                    print(f"   统计信息: {data['data']['stat']}")
                else:
                    print(f"❌ API返回错误: {data.get('message')}")
            else:
                print(f"❌ HTTP错误: {response.status_code}")
    except Exception as e:
        print(f"❌ 请求失败: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_parse_video())