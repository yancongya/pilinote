#!/usr/bin/env python3
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import httpx
import json

async def test_pagelist_endpoint():
    """测试pagelist接口并分析返回数据"""
    print("测试pagelist接口...")
    
    bvid = "BV1PS4y1m79X"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": f"https://www.bilibili.com/video/{bvid}"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                "https://api.bilibili.com/x/player/pagelist",
                params={"bvid": bvid},
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 成功！")
                print(f"返回数据结构: {json.dumps(data, ensure_ascii=False, indent=2)}")
            else:
                print(f"❌ HTTP错误: {response.status_code}")
    except Exception as e:
        print(f"❌ 请求失败: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_pagelist_endpoint())