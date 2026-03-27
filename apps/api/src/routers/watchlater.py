from fastapi import APIRouter, HTTPException, Query
from src.services.bilibili import BilibiliService

router = APIRouter(prefix="/api/watchlater", tags=["稍后再看"])


@router.get("/list", response_model=dict)
async def get_watch_later_list(
    sessdata: str = Query(..., description="用户SESSDATA"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量")
):
    """获取稍后再看列表"""
    service = BilibiliService()
    try:
        result = service.get_watch_later(sessdata, page, page_size)
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
                    "comment": video.get("stat", {}).get("reply", 0),
                    "pubtime": video.get("pubtime", 0),
                    "progress": video.get("progress", -1),  # -1表示未开始观看
                    "add_time": video.get("add_at", 0)
                })
            
            return {
                "success": True,
                "data": {
                    "list": video_list,
                    "page": page,
                    "page_size": page_size,
                    "total": len(video_list)
                }
            }
        raise HTTPException(status_code=400, detail=result["message"])
    finally:
        service.close()