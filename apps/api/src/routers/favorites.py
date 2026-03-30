from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from src.database import get_db
from src.schemas.favorites import FolderListResponse, FolderDetailResponse
from src.services.media_processor import media_processor
from src.services.bilibili import BilibiliService
from src.utils.bilibili_utils import MediaType
from src.schemas.media import MediaStats

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
    order: str = Query("mtime", description="排序方式: mtime=收藏时间, pubtime=发布时间, view=播放量"),
    type: str = Query("0", description="类型: 0=全部, 2=视频, 21=音频, 12=文章"),
    tid: int = Query(0, description="分区ID")
):
    """获取收藏夹详情 - 使用统一媒体处理器确保完整统计信息"""
    try:
        # 使用统一媒体处理器获取收藏夹信息
        result = await media_processor.get_media_info(
            media_id=str(folder_id),
            media_type=MediaType.FAVORITE,
            sessdata=sessdata,
            options={
                "target": folder_id, 
                "pn": page, 
                "ps": page_size,
                "keyword": keyword,
                "order": order,
                "type": type,
                "tid": tid
            }
        )
        
        if result["success"]:
            media_info = result["data"]
            
            # 转换为前端需要的格式
            videos = []
            for item in media_info.list:
                # 优先使用item的stat，如果没有则使用nfo的stat
                stat = item.stat if item.stat else media_info.nfo.stat
                
                videos.append({
                    "id": item.aid,
                    "bvid": item.bvid,
                    "title": item.title,
                    "cover": item.cover,
                    "duration": item.duration,
                    "intro": item.desc,
                    "pubtime": item.pubtime,
                    "view": stat.play or 0,
                    "danmaku": stat.danmaku or 0,
                    "comment": stat.reply or 0,
                    "like": stat.like or 0,
                    "coin": stat.coin or 0,
                    "favorite": stat.favorite or 0,
                    "share": stat.share or 0,
                    "uploader": {
                        "mid": media_info.nfo.upper.mid if media_info.nfo.upper else item.aid,  # 收藏夹可能没有具体的upper信息
                        "name": media_info.nfo.upper.name if media_info.nfo.upper else "未知",
                        "face": media_info.nfo.upper.avatar if media_info.nfo.upper else ""
                    }
                })
            
            return {
                "success": True,
                "data": {
                    "medias": videos,
                    "page_size": page_size,
                    "info": {
                        "media_count": len(videos),
                        "title": media_info.nfo.showtitle,
                        "intro": media_info.nfo.intro
                    }
                },
                "total": len(videos)
            }
        else:
            # 如果统一处理器失败，回退到原始方法
            service = BilibiliService()
            try:
                result = service.get_folder_detail(sessdata, folder_id, page, page_size, keyword, order, type, tid)
                
                if result["success"]:
                    data = result["data"]
                    medias = data.get("medias", [])
                    
                    # 转换为前端需要的格式
                    videos = []
                    for media in medias:
                        videos.append({
                            "id": media.get("id"),
                            "bvid": media.get("bvid"),
                            "title": media.get("title"),
                            "cover": media.get("cover"),
                            "duration": media.get("duration"),
                            "intro": media.get("intro"),
                            "pubtime": media.get("pubtime"),
                            "view": media.get("cnt_info", {}).get("play", 0),
                            "danmaku": media.get("cnt_info", {}).get("danmaku", 0),
                            "comment": media.get("cnt_info", {}).get("reply", 0),
                            "coin": media.get("cnt_info", {}).get("coin", 0),
                            "favorite": media.get("cnt_info", {}).get("collect", 0),
                            "share": media.get("cnt_info", {}).get("share", 0),
                            "like": media.get("cnt_info", {}).get("like", 0),
                            "uploader": {
                                "mid": media.get("upper", {}).get("mid"),
                                "name": media.get("upper", {}).get("name"),
                                "face": media.get("upper", {}).get("face")
                            }
                        })
                    
                    return {
                        "success": True,
                        "data": {
                            "medias": videos,
                            "page_size": page_size,
                            "info": data.get("info", {})
                        },
                        "total": data.get("info", {}).get("media_count", 0)
                    }
                raise HTTPException(status_code=400, detail=result["message"])
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
        print(f"订阅收藏夹API原始响应: {result}")
        
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