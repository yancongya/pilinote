#!/usr/bin/env python3
"""最终测试脚本 - 验证所有功能"""

import asyncio
import json
from src.services.media_processor import media_processor
from src.utils.bilibili_utils import MediaType

async def test_video_parsing():
    """测试视频解析"""
    print("=== 测试视频解析 ===")
    result = await media_processor.get_media_info('BV1PS4y1m79X', MediaType.VIDEO, None)
    if result['success']:
        media_info = result['data']
        print(f"✅ 视频标题: {media_info.nfo.showtitle}")
        print(f"✅ 视频作者: {media_info.nfo.upper.name}")
        stat = media_info.nfo.stat
        print(f"✅ 统计信息:")
        print(f"   播放量: {stat.play}")
        print(f"   弹幕数: {stat.danmaku}")
        print(f"   评论数: {stat.reply}")
        print(f"   点赞数: {stat.like}")
        print(f"   投币数: {stat.coin}")
        print(f"   收藏数: {stat.favorite}")
        print(f"   转发数: {stat.share}")
        print(f"✅ 分P数量: {len(media_info.list)}")
        return True
    else:
        print(f"❌ 解析失败: {result.get('message')}")
        return False

async def test_bangumi_parsing():
    """测试番剧解析"""
    print("\n=== 测试番剧解析 ===")
    result = await media_processor.get_media_info('ss1714', MediaType.BANGUMI, None)
    if result['success']:
        media_info = result['data']
        print(f"✅ 番剧标题: {media_info.nfo.showtitle}")
        stat = media_info.nfo.stat
        print(f"✅ 播放量: {stat.play}")
        print(f"✅ 剧集数量: {len(media_info.list)}")
        return True
    else:
        print(f"❌ 番剧解析失败: {result.get('message')}")
        return False

async def main():
    """主测试函数"""
    print("开始最终测试...\n")
    
    video_ok = await test_video_parsing()
    bangumi_ok = await test_bangumi_parsing()
    
    print("\n=== 测试结果 ===")
    if video_ok and bangumi_ok:
        print("✅ 所有测试通过！")
        print("✅ 视频解析功能已恢复")
        print("✅ 统计信息显示正常")
    else:
        print("❌ 部分测试失败")
        if not video_ok:
            print("❌ 视频解析失败")
        if not bangumi_ok:
            print("❌ 番剧解析失败")

if __name__ == '__main__':
    asyncio.run(main())