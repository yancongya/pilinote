#!/usr/bin/env python3
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from src.utils.bilibili_utils import link_parser

async def test_parse():
    """测试链接解析"""
    print("测试链接解析...")
    
    test_urls = [
        "https://www.bilibili.com/video/BV1TDQoBTEZX",
        "https://www.bilibili.com/video/BV1PS4y1m79X"
    ]
    
    for url in test_urls:
        print(f"\n解析链接: {url}")
        try:
            parsed = link_parser.parse_id(url)
            print(f"解析结果: {parsed}")
        except Exception as e:
            print(f"解析失败: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_parse())