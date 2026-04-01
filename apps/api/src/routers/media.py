"""
统一媒体信息API路由

提供统一的媒体信息接口，解决API端点重复、数据格式不一致的问题。
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import logging
from datetime import datetime

from src.schemas.media import MediaType, MediaInfo, MediaItem, MediaNfo, MediaStats
from src.services.bilibili import BilibiliService
from src.services.cache.video_cache import video_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/media", tags=["media"])


@router.get("/{media_type}/{media_id}", response_model=MediaInfo)
async def get_media_info(media_type: MediaType, media_id: str):
    """
    获取媒体信息（统一接口）

    支持的媒体类型：
    - video: 普通视频（bvid）
    - bangumi: 番剧（ssid/epid）- 暂未实现
    - music: 音乐（au）- 暂未实现
    - lesson: 课程（ssid）
    - favorite: 收藏夹（fid）
    - watch_later: 稍后再看（无需ID）
    """
    logger.info(f"获取媒体信息: {media_type} - {media_id}")

    try:
        # 创建BilibiliService实例
        bilibili_service = BilibiliService()

        # 根据媒体类型获取信息
        if media_type == MediaType.VIDEO:
            result = await bilibili_service.get_video_info(media_id)
            if result.get("success"):
                return _convert_to_media_info(media_type, media_id, result["data"])
            else:
                raise HTTPException(status_code=404, detail=result.get("message", "获取视频信息失败"))

        elif media_type == MediaType.BANGUMI:
            raise HTTPException(status_code=501, detail="番剧功能暂未实现")

        elif media_type == MediaType.MUSIC:
            raise HTTPException(status_code=501, detail="音乐功能暂未实现")

        elif media_type == MediaType.LESSON:
            result = await bilibili_service.get_classroom_detail(int(media_id), "")
            if result.get("success"):
                return _convert_to_media_info(media_type, media_id, result["data"])
            else:
                raise HTTPException(status_code=404, detail=result.get("message", "获取课程信息失败"))

        elif media_type == MediaType.FAVORITE:
            # 收藏夹需要media_id和mid
            # 这里暂时使用默认mid，实际应该从登录信息获取
            result = await bilibili_service.get_folder_detail("", int(media_id))
            if result.get("success"):
                return _convert_to_media_info(media_type, media_id, result["data"])
            else:
                raise HTTPException(status_code=404, detail=result.get("message", "获取收藏夹信息失败"))

        elif media_type == MediaType.WATCH_LATER:
            result = await bilibili_service.get_watch_later("")
            if result.get("success"):
                return _convert_to_media_info(media_type, "", result["data"])
            else:
                raise HTTPException(status_code=404, detail=result.get("message", "获取稍后再看失败"))

        else:
            raise HTTPException(status_code=400, detail=f"不支持的媒体类型: {media_type}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取媒体信息失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/favorites/{fid}", response_model=MediaInfo)
async def get_favorite_media(fid: str, mid: Optional[str] = None):
    """获取收藏夹媒体信息"""
    logger.info(f"获取收藏夹媒体信息: {fid}")

    try:
        bilibili_service = BilibiliService()
        result = await bilibili_service.get_folder_detail("", int(fid))

        if result.get("success"):
            return _convert_to_media_info(MediaType.FAVORITE, fid, result["data"])
        else:
            raise HTTPException(status_code=404, detail=result.get("message", "获取收藏夹信息失败"))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取收藏夹媒体信息失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/watchlater", response_model=MediaInfo)
async def get_watchlater_media():
    """获取稍后再看媒体信息"""
    logger.info("获取稍后再看媒体信息")

    try:
        bilibili_service = BilibiliService()
        result = await bilibili_service.get_watch_later("")

        if result.get("success"):
            return _convert_to_media_info(MediaType.WATCH_LATER, "", result["data"])
        else:
            raise HTTPException(status_code=404, detail=result.get("message", "获取稍后再看失败"))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取稍后再看媒体信息失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _convert_to_media_info(media_type: MediaType, media_id: str, info: dict) -> MediaInfo:
    """转换为统一的媒体信息格式"""
    # 构建媒体项列表
    items = []

    if media_type == MediaType.VIDEO:
        # 单个视频
        items.append(_create_media_item(info, media_type))

    elif media_type in [MediaType.FAVORITE, MediaType.WATCH_LATER]:
        # 列表类型
        media_list = info.get('medias', info.get('list', []))
        for item in media_list:
            items.append(_create_media_item(item, MediaType.VIDEO))

    elif media_type == MediaType.LESSON:
        # 课程
        for episode in info.get('episodes', []):
            items.append(_create_media_item(episode, MediaType.LESSON))

    # 构建NFO
    nfo = MediaNfo(
        title=info.get('title', ''),
        plot=info.get('desc', info.get('intro', '')),
        studio=info.get('owner', {}).get('name', info.get('uploader', '')),
        premiered=_format_timestamp(info.get('pubdate', info.get('ptime', 0))),
        runtime=info.get('duration', info.get('length', 0)),
        thumb=info.get('pic', info.get('cover', ''))
    )

    # 构建统计信息
    stats_info = info.get('stat', {})
    stats = MediaStats(
        play=stats_info.get('view', stats_info.get('play', 0)),
        danmaku=stats_info.get('danmaku', 0),
        reply=stats_info.get('reply', 0),
        like=stats_info.get('like', 0),
        coin=stats_info.get('coin', 0),
        favorite=stats_info.get('favorite', stats_info.get('fav', 0)),
        share=stats_info.get('share', 0)
    )

    return MediaInfo(
        type=media_type,
        id=media_id,
        title=info.get('title', ''),
        cover=info.get('pic', info.get('cover', '')),
        desc=info.get('desc', info.get('intro', '')),
        nfo=nfo,
        stats=stats,
        list=items
    )


def _create_media_item(info: dict, media_type: MediaType) -> MediaItem:
    """创建媒体项"""
    # 处理不同的数据结构
    if 'title' in info:
        title = info['title']
    elif 'bvid' in info and 'page' in info:
        title = f"第{info['page']}部分"
    else:
        title = "未知"

    # 处理封面
    if 'cover' in info:
        cover = info['cover']
    elif 'pic' in info:
        cover = info['pic']
    elif 'cover' in info.get('owner', {}):
        cover = info['owner']['cover']
    else:
        cover = ""

    # 处理描述
    if 'desc' in info:
        desc = info['desc']
    elif 'intro' in info:
        desc = info['intro']
    elif 'description' in info:
        desc = info['description']
    else:
        desc = ""

    # 处理时长
    if 'duration' in info:
        duration = info['duration']
    elif 'length' in info:
        duration = info['length']
    elif 'page' in info:
        duration = info.get('duration', 0)
    else:
        duration = 0

    # 处理发布时间
    if 'pubtime' in info:
        pubtime = info['pubtime']
    elif 'pubdate' in info:
        pubtime = info['pubdate']
    elif 'ptime' in info:
        pubtime = info['ptime']
    else:
        pubtime = 0

    # 处理URL
    if 'short_link' in info:
        url = info['short_link']
    elif 'bvid' in info:
        url = f"https://www.bilibili.com/video/{info['bvid']}"
    else:
        url = ""

    # 处理索引
    if 'index' in info:
        index = info['index']
    elif 'page' in info:
        index = info['page']
    else:
        index = 0

    return MediaItem(
        title=title,
        cover=cover,
        desc=desc,
        duration=duration,
        pubtime=pubtime,
        is_target=False,
        type=media_type,
        url=url,
        aid=info.get('aid'),
        bvid=info.get('bvid'),
        cid=info.get('cid'),
        epid=info.get('epid'),
        ssid=info.get('ssid'),
        index=index
    )


def _format_timestamp(timestamp: Optional[int]) -> Optional[str]:
    """格式化时间戳"""
    if not timestamp:
        return None
    try:
        dt = datetime.fromtimestamp(timestamp)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None