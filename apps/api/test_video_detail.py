#!/usr/bin/env python3
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from src.services.media_processor import media_processor
from src.utils.bilibili_utils import MediaType
import json

async def test_video_detail():
    """测试视频详情获取"""
    print("测试视频详情获取...")
    result = await media_processor.get_media_info('BV1PS4y1m79X', MediaType.VIDEO, None)
    print(f"Success: {result['success']}")
    if not result['success']:
        print(f"Error: {result.get('message')}")
    else:
        print(f"Video title: {result['data'].nfo.showtitle}")
        print(f"Video stat: {json.dumps(result['data'].nfo.stat.dict(), ensure_ascii=False, indent=2)}")

if __name__ == "__main__":
    asyncio.run(test_video_detail())