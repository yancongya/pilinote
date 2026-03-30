#!/usr/bin/env python3
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import httpx
import re
import json

async def test_page_extraction():
    """测试通过HTML页面提取视频信息"""
    print("测试通过HTML页面提取视频信息...")
    
    bvid = "BV1PS4y1m79X"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(
                f"https://www.bilibili.com/video/{bvid}",
                headers=headers
            )
            
            if response.status_code == 200:
                html = response.text
                print(f"✅ 成功获取HTML页面")
                
                # 尝试从HTML中提取视频信息
                # 查找<script>标签中的数据 - 尝试多种模式
                patterns = [
                    r'<script>__INITIAL_STATE__\s*=\s*({.*?});</script>',
                    r'<script>\s*window\.__INITIAL_STATE__\s*=\s*({.*?});\s*</script>',
                    r'__INITIAL_STATE__\s*=\s*({.*?});',
                    r'window\.__INITIAL_STATE__\s*=\s*({.*?});'
                ]
                
                for pattern in patterns:
                    match = re.search(pattern, html)
                    if match:
                        print(f"✅ 找到INITIAL_STATE数据 (模式: {pattern[:30]}...)")
                        try:
                            data = json.loads(match.group(1))
                            print(f"数据结构键: {list(data.keys())}")
                            
                            # 尝试获取视频信息
                            if 'videoData' in data:
                                video_data = data['videoData']
                                print(f"视频标题: {video_data.get('title')}")
                                print(f"视频作者: {video_data.get('owner', {}).get('name')}")
                                print(f"统计信息: {video_data.get('stat')}")
                                return
                            else:
                                print(f"数据键: {list(data.keys())}")
                                
                        except json.JSONDecodeError as e:
                            print(f"❌ JSON解析失败: {str(e)}")
                        break
                else:
                    print(f"❌ 未找到INITIAL_STATE数据")
                    # 尝试其他方法
                    print(f"页面长度: {len(html)}")
                    
            else:
                print(f"❌ HTTP错误: {response.status_code}")
    except Exception as e:
        print(f"❌ 请求失败: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_page_extraction())