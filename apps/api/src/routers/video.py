# Copyright (c) 2025 PiliNote

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from src.services.media_processor import media_processor
from src.utils.bilibili_utils import LinkParser, MediaType

router = APIRouter(prefix="/api/video", tags=["video"])


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
        视频详情信息（包含完整的7项统计数据）
    """
    try:
        # 使用统一媒体处理器获取视频信息
        result = await media_processor.get_media_info(
            media_id=video_id,
            media_type=MediaType.VIDEO,
            sessdata=sessdata
        )
        
        if result["success"]:
            media_info = result["data"]
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
                    ]
                }
            }
        else:
            return result
            
    except Exception as e:
        return {
            "success": False,
            "message": f"获取视频详情失败: {str(e)}"
        }