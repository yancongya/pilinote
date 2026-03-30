#!/usr/bin/env python3
"""
测试HTML解析方法，用于替换被限制的API调用
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import httpx
import re
import json

async def test_html_extraction():
    """测试HTML解析方法获取视频信息"""
    print("测试HTML解析方法...")
    
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
                
                # 提取__INITIAL_STATE__数据
                patterns = [
                    r'__INITIAL_STATE__\s*=\s*({.*?});',
                    r'window\.__INITIAL_STATE__\s*=\s*({.*?});',
                    r'<script>__INITIAL_STATE__\s*=\s*({.*?});</script>'
                ]
                
                data = None
                for pattern in patterns:
                    match = re.search(pattern, html)
                    if match:
                        try:
                            data = json.loads(match.group(1))
                            break
                        except json.JSONDecodeError:
                            continue
                
                if data and 'videoData' in data:
                    video_data = data['videoData']
                    stat = video_data.get('stat', {})
                    
                    print(f"✅ 成功获取视频信息！")
                    print(f"视频标题: {video_data.get('title')}")
                    print(f"视频作者: {video_data.get('owner', {}).get('name')}")
                    print(f"统计信息:")
                    print(f"  播放量: {stat.get('view')}")
                    print(f"  弹幕数: {stat.get('danmaku')}")
                    print(f"  评论数: {stat.get('reply')}")
                    print(f"  点赞数: {stat.get('like')}")
                    print(f"  投币数: {stat.get('coin')}")
                    print(f"  收藏数: {stat.get('favorite')}")
                    print(f"  转发数: {stat.get('share')}")
                    return True
                    
        return False
    except Exception as e:
        print(f"❌ 错误: {str(e)}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_html_extraction())
    sys.exit(0 if success else 1)