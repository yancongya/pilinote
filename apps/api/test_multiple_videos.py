#!/usr/bin/env python3
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import httpx

async def test_different_videos():
    """测试不同视频的解析"""
    print("测试不同视频的解析...")
    
    test_videos = [
        ("BV1PS4y1m79X", "之前成功的视频"),
        ("BV1TDQoBTEZX", "报错的视频"),
        ("BV1xx411c7mD", "测试视频")
    ]
    
    for bvid, desc in test_videos:
        print(f"\n测试 {desc}: {bvid}")
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": f"https://www.bilibili.com/video/{bvid}"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    "https://api.bilibili.com/x/web-interface/view",
                    params={"bvid": bvid},
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("code") == 0:
                        print(f"✅ 成功！视频标题: {data['data']['title']}")
                    else:
                        print(f"❌ API返回错误: {data.get('message')}")
                else:
                    print(f"❌ HTTP错误: {response.status_code}")
        except Exception as e:
            print(f"❌ 请求失败: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_different_videos())