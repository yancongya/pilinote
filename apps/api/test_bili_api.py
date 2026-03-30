#!/usr/bin/env python3
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import httpx

async def test_direct_api_call():
    """直接测试B站API调用"""
    url = "https://api.bilibili.com/x/web-interface/view?bvid=BV1PS4y1m79X"
    
    # 尝试多种不同的请求头组合
    headers_variants = [
        # 基础请求头
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com/video/BV1PS4y1m79X"
        },
        # 完整请求头
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com/video/BV1PS4y1m79X",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "Origin": "https://www.bilibili.com"
        },
        # 添加cookie
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com/video/BV1PS4y1m79X",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "Origin": "https://www.bilibili.com",
            "Cookie": "buvid3=B4F1A8F7-6F1B-4B1E-8C9A-123456789012; buvid4=B4F1A8F7-6F1B-4B1E-8C9A-123456789012-1700000000; _uuid=B4F1A8F7-6F1B-4B1E-8C9A-123456789012"
        }
    ]
    
    for i, headers in enumerate(headers_variants):
        print(f"\n测试方案 {i+1}:")
        print(f"Headers: {headers}")
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("code") == 0:
                        print(f"✅ 成功！视频标题: {data['data']['title']}")
                        return
                    else:
                        print(f"❌ API返回错误: {data.get('message')}")
                else:
                    print(f"❌ HTTP错误: {response.status_code}")
        except Exception as e:
            print(f"❌ 请求失败: {str(e)}")
    
    print("\n所有方案都失败了")

if __name__ == "__main__":
    asyncio.run(test_direct_api_call())
