from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from src.database import get_db
from src.schemas.favorites import FolderListResponse, FolderDetailResponse
from src.services.bilibili import BilibiliService

router = APIRouter(prefix="/api/favorites", tags=["收藏夹"])


@router.get("/folders", response_model=dict)
async def get_folders(
    sessdata: str = Query(..., description="用户SESSDATA"),
    up_mid: int = Query(..., description="用户mid"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量")
):
    """获取收藏夹列表"""
    service = BilibiliService()
    try:
        result = service.get_folder_list(sessdata, up_mid, page, page_size)
        print(f"收藏夹API原始响应: {result}")
        if result["success"]:
            data = result["data"]
            print(f"解析后的data: {data}")
            folders = data.get("list", [])
            print(f"获取到的folders数量: {len(folders)}")
            
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


@router.get("/folders/{folder_id}", response_model=dict)
async def get_folder_detail(
    folder_id: int,
    sessdata: str = Query(..., description="用户SESSDATA"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: str = Query("", description="搜索关键词"),
    order: str = Query("mtime", description="排序方式: mtime-收藏时间, view-播放量, pubtime-发布时间"),
    type: str = Query("0", description="类型: 0-全部, 2-视频, 12-音频, 21-文章"),
    tid: int = Query(0, description="分区ID")
):
    """获取收藏夹详情（视频列表）"""
    service = BilibiliService()
    try:
        result = service.get_folder_detail(sessdata, folder_id, page, page_size, keyword, order, type, tid)
        if result["success"]:
            data = result["data"]
            
            # 收藏夹信息
            info = data.get("info", {})
            folder_info = {
                "id": info.get("id"),
                "title": info.get("title"),
                "media_count": info.get("media_count", 0),
                "cover": info.get("cover"),
                "intro": info.get("intro"),
                "favorite_state": info.get("fav_state", False)
            }
            
            # 视频列表
            medias = data.get("medias", [])
            if not medias:
                # 如果medias为空或None，尝试其他可能的字段
                medias = data.get("list", []) or []
            
            video_list = []
            for media in medias or []:
                # 获取评论数量，优先从cnt_info获取，其次从stat获取
                comment_count = (
                    media.get("cnt_info", {}).get("reply", 0) or 
                    media.get("stat", {}).get("reply", 0) or 
                    0
                )
                
                video_list.append({
                    "id": media.get("id"),
                    "title": media.get("title"),
                    "cover": media.get("cover"),
                    "duration": media.get("duration", 0),
                    "uploader": {
                        "mid": media.get("upper", {}).get("mid"),
                        "name": media.get("upper", {}).get("name"),
                        "face": media.get("upper", {}).get("face")
                    },
                    "view": media.get("cnt_info", {}).get("play", 0),
                    "danmaku": media.get("cnt_info", {}).get("danmaku", 0),
                    "pubtime": media.get("pubtime", 0),
                    "comment": comment_count,
                    "bvid": media.get("bvid")
                })
            
            return {
                "success": True,
                "data": {
                    "info": folder_info,
                    "medias": video_list,
                    "page": page,
                    "page_size": page_size,
                    "total": data.get("info", {}).get("media_count", 0)
                }
            }
        raise HTTPException(status_code=400, detail=result["message"])
    finally:
        service.close()