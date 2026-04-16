# Copyright (c) 2025 PiliNote

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import os

from src.services.media_processor import media_processor
from src.services.local_library_service import LocalLibraryService
from src.utils.bilibili_utils import LinkParser, MediaType

router = APIRouter(prefix="/api/video", tags=["video"])


def get_local_comments(bvid: str) -> list:
    """从本地NFO文件获取评论数据"""
    comments = []
    try:
        # 查找 downloads 目录下匹配 bvid 的文件夹
        downloads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "downloads")
        if not os.path.exists(downloads_dir):
            return comments
        
        for folder_name in os.listdir(downloads_dir):
            folder_path = os.path.join(downloads_dir, folder_name)
            if not os.path.isdir(folder_path):
                continue
            
            # 查找 NFO 文件
            nfo_files = [f for f in os.listdir(folder_path) if f.endswith('.nfo')]
            for nfo_file in nfo_files:
                nfo_path = os.path.join(folder_path, nfo_file)
                try:
                    with open(nfo_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        # 检查是否包含匹配的 bvid
                        if f'<bvid>{bvid}</bvid>' in content or bvid in content:
                            # 解析评论数据
                            import xml.etree.ElementTree as ET
                            tree = ET.parse(nfo_path)
                            root = tree.getroot()
                            comments_elem = root.find('comments')
                            if comments_elem is not None:
                                for comment_elem in comments_elem.findall('comment'):
                                    comment_data = {
                                        'type': comment_elem.get('type', 'unknown'),
                                        'content': '',
                                        'like': 0,
                                        'reply': 0,
                                        'author': '',
                                        'time': 0
                                    }
                                    content_elem = comment_elem.find('content')
                                    if content_elem is not None and content_elem.text:
                                        comment_data['content'] = content_elem.text
                                    like_attr = comment_elem.get('like')
                                    if like_attr:
                                        try:
                                            comment_data['like'] = int(like_attr)
                                        except ValueError:
                                            pass
                                    reply_attr = comment_elem.get('reply')
                                    if reply_attr:
                                        try:
                                            comment_data['reply'] = int(reply_attr)
                                        except ValueError:
                                            pass
                                    author_attr = comment_elem.get('author')
                                    if author_attr:
                                        comment_data['author'] = author_attr
                                    time_attr = comment_elem.get('time')
                                    if time_attr:
                                        try:
                                            comment_data['time'] = int(time_attr)
                                        except ValueError:
                                            pass
                                    comments.append(comment_data)
                            return comments
                except Exception:
                    continue
    except Exception:
        pass
    return comments


@router.get("/{video_id}")
async def get_video_detail(
    video_id: str,
    sessdata: Optional[str] = Query(None, description="B站SESSDATA for authenticated requests")
):
    """
    获取视频详情 - 使用统一媒体处理器
    
    Args:
        video_id: 视频ID (bvid或aid)
        sessdata: 可选的SESSDATA用于认证请求
    
    Returns:
        视频详情信息（包含完整的7项统计数据和评论数据）
    """
    try:
        # 首先尝试从本地NFO文件获取评论数据
        local_comments = get_local_comments(video_id)
        
        # 使用统一媒体处理器获取视频信息
        result = await media_processor.get_media_info(
            media_id=video_id,
            media_type=MediaType.VIDEO,
            sessdata=sessdata
        )
        
        if result["success"]:
            media_info = result["data"]
            # 优先使用本地评论数据，否则使用API返回的
            comments = local_comments if local_comments else media_info.nfo.comments or []
            
            # 转换为兼容格式
            return {
                "success": True,
                "data": {
                    "bvid": media_info.nfo.url.split("/")[-1],
                    "aid": media_info.list[0].aid if media_info.list else 0,
                    "title": media_info.nfo.showtitle or "",
                    "desc": media_info.nfo.intro or "",
                    "pic": media_info.nfo.thumbs[0].url if media_info.nfo.thumbs else "",
                    "owner": {
                        "mid": media_info.nfo.upper.mid if media_info.nfo.upper else 0,
                        "name": media_info.nfo.upper.name if media_info.nfo.upper else "",
                        "face": media_info.nfo.upper.avatar if media_info.nfo.upper else ""
                    },
                    "stat": {
                        "view": media_info.nfo.stat.play or 0,
                        "danmaku": media_info.nfo.stat.danmaku or 0,
                        "reply": media_info.nfo.stat.reply or 0,
                        "like": media_info.nfo.stat.like or 0,
                        "coin": media_info.nfo.stat.coin or 0,
                        "favorite": media_info.nfo.stat.favorite or 0,
                        "share": media_info.nfo.stat.share or 0
                    },
                    "cid": media_info.list[0].cid if media_info.list else 0,
                    "duration": media_info.list[0].duration if media_info.list else 0,
                    "pubdate": media_info.nfo.premiered or 0,
                    "pages": [
                        {
                            "page": item.index + 1,
                            "cid": item.cid,
                            "part": item.title,
                            "duration": item.duration
                        }
                        for item in media_info.list
                    ],
                    "comments": comments
                }
            }
        else:
            return result
            
    except Exception as e:
        return {
            "success": False,
            "message": f"获取视频详情失败: {str(e)}"
        }