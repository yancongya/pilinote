#!/usr/bin/env python3
"""
测试B站评论API
"""

import asyncio
import sys
import os
import json
import httpx

# 添加项目路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.services.bilibili import BilibiliService

async def test_comments_api():
    """测试评论API"""
    
    # 创建BilibiliService实例
    bilibili_service = BilibiliService()
    
    # 测试我们之前用过的视频BV号：BV1EyygBuEpn
    test_bvid = "BV1EyygBuEpn"
    
    print(f"开始测试评论API和NFO更新，视频BV号: {test_bvid}")
    
    try:
        # 步骤1: 通过BV号获取视频信息
        print("步骤1: 获取视频信息...")
        video_result = await bilibili_service.get_video_info(test_bvid, "")
        
        if not video_result.get("success"):
            print(f"❌ 获取视频信息失败: {video_result.get('message', '未知错误')}")
            return
        
        video_data = video_result.get("data", {})
        print(f"✅ 视频信息获取成功！")
        print(f"   标题: {video_data.get('title', '')}")
        print(f"   AID: {video_data.get('aid', '无')}")
        
        # 步骤2: 获取评论数据
        print("\n步骤2: 获取评论数据...")
        if video_data.get("aid"):
            comments_result = await bilibili_service.get_video_comments(
                video_data["aid"], 
                ""
            )
            
            if comments_result.get("success"):
                comments_data = comments_result.get("data", {})
                comments = comments_data.get("comments", [])
                
                print(f"✅ 评论API调用成功！")
                print(f"   总评论数: {comments_data.get('total', 0)}")
                print(f"   置顶评论: {'有' if comments_data.get('top_comment') else '无'}")
                print(f"   热门评论数: {len(comments_data.get('hot_comments', []))}")
                
                # 显示原始API数据结构（用于调试）
                if comments_data.get('hot_comments'):
                    print(f"\n🔍 原始热门评论数据结构（第一条）:")
                    import json
                    first_hot_comment = comments_data['hot_comments'][0]
                    print(json.dumps(first_hot_comment.get('member', {}), ensure_ascii=False, indent=2))
                
                # 显示评论详情
                print(f"\n📝 评论详情:")
                for i, comment in enumerate(comments[:5]):  # 最多显示5条
                    comment_type = comment.get('type', 'unknown')
                    author = comment.get('author', 'Unknown')
                    content = comment.get('content', '')
                    like_count = comment.get('like', 0)
                    reply_count = comment.get('reply', 0)
                    
                    print(f"\n   {i+1}. [{comment_type}] {author}")
                    print(f"      点赞: {like_count} | 回复: {reply_count}")
                    print(f"      内容: {content[:80]}...")
            else:
                print(f"❌ 评论API调用失败: {comments_result.get('message', '未知错误')}")
        
        # 步骤3: 测试NFO更新
        print("\n步骤3: 测试NFO更新...")
        from src.services.nfo_update_service import NFOUpdateService
        
        nfo_update_service = NFOUpdateService()
        
        # 查找对应的NFO文件
        import os
        nfo_path = f"/Users/tanyancong/工作/开发/pilinote/downloads/Blender教程：用几何节点制作极致逼真的程序化毛发/Blender教程：用几何节点制作极致逼真的程序化毛发.nfo"
        
        if os.path.exists(nfo_path):
            print(f"   找到NFO文件: {nfo_path}")
            
            update_result = await nfo_update_service.update_single_nfo(nfo_path)
            
            if update_result.get("success"):
                print(f"✅ NFO更新成功！")
                print(f"   备份文件: {update_result.get('backup_path', '无')}")
                
                # 读取更新后的NFO文件，检查评论数据
                print(f"\n步骤4: 检查更新后的NFO文件...")
                from xml.etree import ElementTree as ET
                
                tree = ET.parse(nfo_path)
                root = tree.getroot()
                
                comments_elem = root.find('comments')
                if comments_elem is not None:
                    comment_count = len(comments_elem.findall('comment'))
                    print(f"✅ 评论数据已保存到NFO文件！")
                    print(f"   评论数量: {comment_count}")
                    
                    # 显示评论内容
                    for i, comment_elem in enumerate(comments_elem.findall('comment')[:3]):
                        author = comment_elem.get('author', 'Unknown')
                        content_elem = comment_elem.find('content')
                        content = content_elem.text if content_elem is not None else ''
                        
                        print(f"\n   {i+1}. {author}")
                        print(f"      内容: {content[:60]}...")
                else:
                    print(f"❌ NFO文件中没有评论数据")
            else:
                print(f"❌ NFO更新失败: {update_result.get('message', '未知错误')}")
        else:
            print(f"❌ NFO文件不存在: {nfo_path}")
    
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        bilibili_service.close()

if __name__ == "__main__":
    asyncio.run(test_comments_api())