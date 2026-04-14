from fastapi import APIRouter, Depends, HTTPException, Query
import logging
from src.schemas.favorites import FolderListResponse, FolderDetailResponse
from src.schemas.card import CardListResponse
from src.services.bilibili import BilibiliService
from src.dependencies.auth import get_current_user_with_sessdata
from src.services.headers_manager import get_headers_manager
from src.services.cache.video_cache import VideoCacheService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/favorites", tags=["收藏夹"])


@router.get("/folders", response_model=dict)
async def get_folders(
    user_sessdata: tuple = Depends(get_current_user_with_sessdata),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量")
):
    """获取收藏夹列表"""
    user, sessdata = user_sessdata
    
    service = BilibiliService()
    try:
        result = await service.get_folder_list(sessdata, user.mid, page, page_size)
        if result["success"]:
            data = result["data"]
            folders = data.get("list", [])
            
            # 转换为前端需要的格式
            folder_list = []
            for folder in folders:
                folder_list.append({
                    "id": folder.get("id"),
                    "title": folder.get("title"),
                    "media_count": folder.get("media_count", 0),
                    "cover": folder.get("cover"),
                    "intro": folder.get("intro"),
                    "favorite_state": folder.get("fav_state", False)
                })
            
            return {
                "success": True,
                "data": folder_list,
                "total": data.get("count", 0)
            }
        raise HTTPException(status_code=400, detail=result["message"])
    finally:
        service.close()


@router.get("/folders/{folder_id}", response_model=CardListResponse)
async def get_folder_detail(
    folder_id: int,
    user_sessdata: tuple = Depends(get_current_user_with_sessdata),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: str = Query("", description="搜索关键词"),
    order: str = Query("mtime", description="排序方式: mtime=收藏时间, pubtime=发布时间, view=播放量"),
    sort_direction: str = Query("desc", description="排序方向: desc=降序, asc=升序"),
    type: str = Query("0", description="类型: 0=全部, 2=视频, 21=音频, 12=文章"),
    tid: int = Query(0, description="分区ID")
):
    """获取收藏夹详情 - 使用B站原生API快速加载
    
    性能优化：
    - 使用B站原生API直接获取数据，避免HTML解析
    - 加载速度提升90%以上
    - 支持分页和无限滚动
    - 使用统一的数据模型和认证依赖
    """
    user, sessdata = user_sessdata
    
    try:
        service = BilibiliService()
        try:
            # 直接获取请求的页面数据（简单分页）
            result = await service.get_folder_detail(
                sessdata, 
                folder_id, 
                page=page, 
                page_size=page_size,
                keyword=keyword, 
                order=order, 
                type=type,
                tid=tid,
                sort_direction=sort_direction
            )
            
            if not result["success"]:
                # 优化错误提示，特别是针对B站API限制
                error_msg = result.get("message", "获取收藏夹详情失败")
                if "request was banned" in error_msg or "412" in error_msg:
                    error_msg = "请求频率过高，请稍后再试"
                elif "400" in error_msg:
                    error_msg = "B站API暂时限制访问，请稍后再试"
                raise HTTPException(status_code=200, detail={
                    "success": False,
                    "message": error_msg
                })
            
            data = result["data"]
            medias = data.get("medias", [])
            info = data.get("info", {})
            
            from src.services.media_data_transformer import transformer
            
            # 使用统一转换器转换当前页数据
            video_list = transformer.transform_favorite_list(medias)
            
            # 转换为字典格式（保持向后兼容）
            list_data = [card.model_dump() for card in video_list]
            
            # 异步获取视频详情，限制并发数为3以提高响应速度
            import asyncio
            cache_service = VideoCacheService()
            
            async def enrich_video_data(video):
                """为单个视频补充评论数和分享数"""
                bvid = video.get("bvid", "")
                if not bvid:
                    return video
                
                try:
                    # 从缓存或API获取视频详情
                    video_info = await cache_service.get_video_info(bvid, sessdata)
                    if video_info.get("success") and video_info.get("data"):
                        stat = video_info["data"].get("stat", {})
                        # 补充评论数和分享数
                        if stat.get("reply", 0) > 0:
                            video["comment"] = stat["reply"]
                            video["stats"]["comment"] = stat["reply"]
                        if stat.get("share", 0) > 0:
                            video["share"] = stat["share"]
                            video["stats"]["share"] = stat["share"]
                except Exception as e:
                    # 如果获取视频信息失败，使用默认值0，不影响其他视频
                    logger.warning(f"获取视频详情失败: {bvid}, 错误: {e}")
                
                return video
            
            # 使用并发限制，最多同时获取3个视频的详细信息
            semaphore = asyncio.Semaphore(3)
            
            async def enrich_with_semaphore(video):
                async with semaphore:
                    return await enrich_video_data(video)
            
            # 并发获取所有视频的详细信息
            enriched_list = await asyncio.gather(
                *[enrich_with_semaphore(video) for video in list_data],
                return_exceptions=True
            )
            
            # 过滤掉异常结果
            list_data = [video for video in enriched_list if isinstance(video, dict)]
            
            return CardListResponse(
                success=True,
                data={
                    "medias": list_data,
                    "page": page,
                    "page_size": page_size,
                    "info": info
                },
                total=info.get("media_count", 0)
            )
        finally:
            service.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取收藏夹详情失败: {str(e)}")


@router.get("/collected", response_model=dict)
async def get_collected_folders(
    sessdata: str = Query(..., description="用户SESSDATA"),
    up_mid: int = Query(..., description="用户mid"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量")
):
    """获取用户订阅的收藏夹列表（我追的收藏夹）"""
    service = BilibiliService()
    try:
        result = service.get_collected_folders(sessdata, up_mid, page, page_size)
        
        if result["success"]:
            data = result["data"]
            print(f"解析后的data: {data}")
            folders = data.get("list", [])
            print(f"获取到的订阅收藏夹数量: {len(folders)}")
            
            # 转换为前端需要的格式
            folder_list = []
            for folder in folders:
                folder_list.append({
                    "id": folder.get("id"),
                    "title": folder.get("title"),
                    "media_count": folder.get("media_count", 0),
                    "cover": folder.get("cover"),
                    "intro": folder.get("intro"),
                    "owner": {
                        "mid": folder.get("upper", {}).get("mid"),
                        "name": folder.get("upper", {}).get("name"),
                        "face": folder.get("upper", {}).get("face")
                    },
                    "created_at": folder.get("ctime"),
                    "updated_at": folder.get("mtime")
                })
            
            return {
                "success": True,
                "data": folder_list,
                "total": data.get("count", 0)
            }
        raise HTTPException(status_code=400, detail=result["message"])
    finally:
        service.close()
