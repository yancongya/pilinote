#!/usr/bin/env python3
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import httpx

async def test_alternative_approach():
    """测试不同的方法来绕过B站反爬虫"""
    print("测试不同的反爬虫绕过方法...")
    
    bvid = "BV1PS4y1m79X"
    
    # 方法1: 先访问视频页面获取cookie
    print("\n方法1: 先访问视频页面获取cookie")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # 先访问视频页面
            page_response = await client.get(
                f"https://www.bilibili.com/video/{bvid}",
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            )
            
            if page_response.status_code == 200:
                print(f"✅ 成功访问视频页面")
                cookies = {cookie.name: cookie.value for cookie in page_response.cookies}
                print(f"获取到的cookies: {list(cookies.keys())}")
                
                # 使用获取的cookie调用API
                api_headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": f"https://www.bilibili.com/video/{bvid}"
                }
                
                api_response = await client.get(
                    "https://api.bilibili.com/x/web-interface/view",
                    params={"bvid": bvid},
                    headers=api_headers,
                    cookies=cookies
                )
                
                if api_response.status_code == 200:
                    data = api_response.json()
                    if data.get("code") == 0:
                        print(f"✅ 成功！视频标题: {data['data']['title']}")
                        return
                    else:
                        print(f"❌ API返回错误: {data.get('message')}")
                else:
                    print(f"❌ HTTP错误: {api_response.status_code}")
    except Exception as e:
        print(f"❌ 方法1失败: {str(e)}")
    
    # 方法2: 使用不同的User-Agent
    print("\n方法2: 使用不同的User-Agent")
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/109.0"
    ]
    
    for ua in user_agents:
        print(f"  尝试User-Agent: {ua[:50]}...")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    "https://api.bilibili.com/x/web-interface/view",
                    params={"bvid": bvid},
                    headers={
                        "User-Agent": ua,
                        "Referer": f"https://www.bilibili.com/video/{bvid}"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("code") == 0:
                        print(f"✅ 成功！视频标题: {data['data']['title']}")
                        return
                    else:
                        print(f"  API返回错误: {data.get('message')}")
        except Exception as e:
            print(f"  请求失败: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_alternative_approach())