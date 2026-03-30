#!/usr/bin/env python3
"""
测试统一媒体处理器功能
验证7项统计信息的完整性
"""
import asyncio
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(__file__))

from src.services.media_processor import media_processor
from src.utils.bilibili_utils import MediaType


async def test_video_stats():
    """测试视频统计信息"""
    print("=== 测试视频统计信息 ===")
    
    # 使用一个知名的B站视频ID进行测试
    video_id = "BV1xx411c7mD"  # 这是一个知名的测试视频
    
    try:
        print(f"正在获取视频信息: {video_id}")
        result = await media_processor.get_media_info(
            media_id=video_id,
            media_type=MediaType.VIDEO,
            sessdata=None
        )
        
        print(f"API返回结果: {result}")
        
        if result["success"]:
            media_info = result["data"]
            print(f"媒体信息类型: {type(media_info)}")
            
            # 获取标题
            title = media_info.nfo.showtitle or (media_info.list[0].title if media_info.list else 'N/A')
            print(f"视频标题: {title}")
            
            # 获取作者
            author = media_info.nfo.upper.name if media_info.nfo.upper else 'N/A'
            print(f"视频作者: {author}")
            
            # 检查统计信息
            stat = media_info.nfo.stat
            print("\n统计信息:")
            print(f"  播放量: {stat.play}")
            print(f"  弹幕数: {stat.danmaku}")
            print(f"  评论数: {stat.reply}")
            print(f"  点赞数: {stat.like}")
            print(f"  投币数: {stat.coin}")
            print(f"  收藏数: {stat.favorite}")
            print(f"  转发数: {stat.share}")
            
            # 验证所有7项统计信息都存在
            stats_fields = ["play", "danmaku", "reply", "like", "coin", "favorite", "share"]
            missing_fields = []
            for field in stats_fields:
                value = getattr(stat, field)
                if value is None:
                    missing_fields.append(field)
            
            if missing_fields:
                print(f"\n⚠️  警告: 缺少以下统计字段: {missing_fields}")
                return False
            else:
                print("\n✅ 所有7项统计信息都完整!")
                return True
        else:
            print(f"❌ 获取视频信息失败: {result.get('message', '未知错误')}")
            return False
            
    except Exception as e:
        print(f"❌ 测试过程中发生错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


async def test_bangumi_stats():
    """测试番剧统计信息"""
    print("\n=== 测试番剧统计信息 ===")
    
    # 使用一个知名的番剧ID进行测试
    bangumi_id = "1714"  # ss1714
    
    try:
        result = await media_processor.get_media_info(
            media_id=bangumi_id,
            media_type=MediaType.BANGUMI,
            sessdata=None
        )
        
        if result["success"]:
            media_info = result["data"]
            print(f"番剧标题: {media_info.nfo.showtitle or media_info.list[0].title if media_info.list else 'N/A'}")
            
            # 检查统计信息
            stat = media_info.nfo.stat
            print("\n统计信息:")
            print(f"  播放量: {stat.play}")
            print(f"  弹幕数: {stat.danmaku}")
            print(f"  评论数: {stat.reply}")
            print(f"  点赞数: {stat.like}")
            print(f"  投币数: {stat.coin}")
            print(f"  收藏数: {stat.favorite}")
            print(f"  转发数: {stat.share}")
            
            # 验证所有7项统计信息都存在
            stats_fields = ["play", "danmaku", "reply", "like", "coin", "favorite", "share"]
            missing_fields = []
            for field in stats_fields:
                value = getattr(stat, field)
                if value is None:
                    missing_fields.append(field)
            
            if missing_fields:
                print(f"\n⚠️  警告: 缺少以下统计字段: {missing_fields}")
                return False
            else:
                print("\n✅ 所有7项统计信息都完整!")
                return True
        else:
            print(f"❌ 获取番剧信息失败: {result.get('message', '未知错误')}")
            return False
            
    except Exception as e:
        print(f"❌ 测试过程中发生错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """主测试函数"""
    print("开始测试统一媒体处理器...")
    print("=" * 50)
    
    # 测试视频统计
    video_success = await test_video_stats()
    
    # 测试番剧统计
    bangumi_success = await test_bangumi_stats()
    
    print("\n" + "=" * 50)
    print("测试总结:")
    print(f"  视频统计: {'✅ 通过' if video_success else '❌ 失败'}")
    print(f"  番剧统计: {'✅ 通过' if bangumi_success else '❌ 失败'}")
    
    if video_success and bangumi_success:
        print("\n🎉 所有测试通过! 统一媒体处理器工作正常。")
        return 0
    else:
        print("\n⚠️  部分测试失败，请检查错误信息。")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)