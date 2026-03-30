#!/usr/bin/env python3
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from src.services.media_processor import media_processor
from src.utils.bilibili_utils import MediaType
import json

async def test_watchlater():
    """测试稍后再看API"""
    print("测试稍后再看API（无sessdata）...")
    result = await media_processor.get_media_info('watchlater', MediaType.WATCH_LATER, None)
    print(f"Success: {result['success']}")
    if not result['success']:
        print(f"Error: {result.get('message')}")
    else:
        print(f"Total videos: {len(result['data'].list)}")
        if result['data'].list:
            first_item = result['data'].list[0]
            print(f"First video: {first_item.title}")
            print(f"First video stat: {json.dumps(first_item.stat.dict(), ensure_ascii=False, indent=2)}")

if __name__ == "__main__":
    asyncio.run(test_watchlater())