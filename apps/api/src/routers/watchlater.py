from fastapi import APIRouter, HTTPException, Query
from src.services.media_processor import media_processor
from src.services.bilibili import BilibiliService
from src.utils.bilibili_utils import MediaType
from src.schemas.media import MediaStats

router = APIRouter(prefix="/api/watchlater", tags=["稍后再看"])


@router.get("/list", response_model=dict)
async def get_watch_later_list(
    sessdata: str = Query(..., description="用户SESSDATA"),
    pn: int = Query(1, ge=1, description="页码"),
    ps: int = Query(20, ge=1, le=100, description="每页数量")
):
    """获取稍后再看列表（支持分页） - 使用统一媒体处理器确保完整统计信息"""
    try:
        # 使用统一媒体处理器获取稍后再看信息
        result = await media_processor.get_media_info(
            media_id="watchlater",
            media_type=MediaType.WATCH_LATER,
            sessdata=sessdata,
            options={"pn": pn, "ps": ps}
        )
        
        if result["success"]:
            media_info = result["data"]
            
            # 转换为前端需要的格式
            video_list = []
            for item in media_info.list:
                stat = item.stat or MediaStats()
                upper = item.upper if item.upper else None
                
                video_list.append({
                    "id": item.aid,
                    "bvid": item.bvid,
                    "title": item.title,
                    "cover": item.cover,
                    "duration": item.duration,
                    "uploader": {
                        "mid": upper.mid if upper else 0,
                        "name": upper.name if upper else "未知",
                        "face": upper.avatar if upper else ""
                    },
                    "view": stat.play or 0,
                    "danmaku": stat.danmaku or 0,
                    "comment": stat.reply or 0,
                    "like": stat.like or 0,
                    "coin": stat.coin or 0,
                    "favorite": stat.favorite or 0,
                    "share": stat.share or 0,
                    "pubtime": item.pubtime,
                    "progress": item.progress if item.progress is not None else -1,
                    "add_time": item.pubtime  # 暂时使用pubtime作为添加时间
                })
            
            return {
                "success": True,
                "data": {
                    "list": video_list,
                    "total": result.get("total", len(video_list))
                }
            }
        else:
            # 如果统一处理器失败，回退到原始方法
            service = BilibiliService()
            try:
                result = service.get_watch_later(sessdata)
                if result["success"]:
                    data = result["data"]
                    
                    # 视频列表
                    videos = data.get("list", [])
                    video_list = []
                    for video in videos:
                        video_list.append({
                            "id": video.get("aid"),
                            "bvid": video.get("bvid"),
                            "title": video.get("title"),
                            "cover": video.get("pic"),
                            "duration": video.get("duration", 0),
                            "uploader": {
                                "mid": video.get("owner", {}).get("mid"),
                                "name": video.get("owner", {}).get("name"),
                                "face": video.get("owner", {}).get("face")
                            },
                            "view": video.get("stat", {}).get("view", 0),
                            "danmaku": video.get("stat", {}).get("danmaku", 0),
                            "comment": video.get("stat", {}).get("reply", 0) or video.get("cnt_info", {}).get("reply", 0),
                            "like": 0,  # 原始API不提供
                            "coin": 0,  # 原始API不提供
                            "favorite": 0,  # 原始API不提供
                            "share": 0,  # 原始API不提供
                            "pubtime": video.get("pubtime", 0),
                            "progress": video.get("progress", -1),
                            "add_time": video.get("add_at", 0)
                        })
                    
                    return {
                        "success": True,
                        "data": {
                            "list": video_list,
                            "total": len(video_list)
                        }
                    }
                raise HTTPException(status_code=400, detail=result["message"])
            finally:
                service.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取稍后再看列表失败: {str(e)}")