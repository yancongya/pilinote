from fastapi import APIRouter, HTTPException
import logging

from src.services.cache.video_cache import video_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cache", tags=["cache"])

@router.get("/stats")
async def get_cache_stats():
    """获取缓存统计信息"""
    return video_cache.get_stats()

@router.post("/cleanup")
async def cleanup_expired_cache():
    """清理过期缓存"""
    await video_cache.cleanup_expired()
    return {"message": "过期缓存已清理"}

@router.post("/clear")
async def clear_all_cache():
    """清空所有缓存"""
    await video_cache.clear_all()
    return {"message": "所有缓存已清空"}

@router.post("/invalidate/video/{bvid}")
async def invalidate_video_cache(bvid: str):
    """使视频缓存失效"""
    await video_cache.invalidate('video_info', bvid=bvid)
    return {"message": f"视频 {bvid} 缓存已失效"}

@router.post("/invalidate/favorites/{fid}/{mid}")
async def invalidate_favorites_cache(fid: str, mid: str):
    """使收藏夹缓存失效"""
    await video_cache.invalidate('favorites', fid=fid, mid=mid)
    return {"message": f"收藏夹 {fid} 缓存已失效"}

@router.post("/invalidate/watch-later")
async def invalidate_watchlater_cache():
    """使稍后再看缓存失效"""
    await video_cache.invalidate('watch_later')
    return {"message": "稍后再看缓存已失效"}
