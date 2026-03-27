from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import httpx

router = APIRouter(prefix="/api/video", tags=["video"])

class VideoDetailResponse(BaseModel):
    bvid: str
    aid: int
    title: str
    desc: str
    pic: str
    owner: dict
    stat: dict
    cid: int
    duration: int
    pubdate: int
    pages: Optional[list] = None
    dimension: Optional[dict] = None
    rights: Optional[dict] = None
    descV2: Optional[list] = None
    staff: Optional[list] = None
    ugcSeason: Optional[dict] = None

@router.get("/{video_id}")
async def get_video_detail(
    video_id: str,
    sessdata: Optional[str] = Query(None, description="B站SESSDATA for authenticated requests")
):
    """
    获取视频详情
    
    Args:
        video_id: 视频ID (bvid或aid)
        sessdata: 可选的SESSDATA用于认证请求
    
    Returns:
        视频详情信息
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.bilibili.com"
    }
    
    if sessdata:
        headers["Cookie"] = f"SESSDATA={sessdata}"
    
    # 判断是bvid还是aid
    if video_id.startswith("BV"):
        params = {"bvid": video_id}
    else:
        params = {"aid": video_id}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(
                "https://api.bilibili.com/x/web-interface/view",
                params=params,
                headers=headers
            )
            response.raise_for_status()
            data = response.json()
            
            if data["code"] != 0:
                return {
                    "success": False,
                    "message": data.get("message", "获取视频详情失败"),
                    "code": data["code"]
                }
            
            video_data = data["data"]
            
            return {
                "success": True,
                "data": {
                    "bvid": video_data["bvid"],
                    "aid": video_data["aid"],
                    "title": video_data["title"],
                    "desc": video_data["desc"],
                    "pic": video_data["pic"],
                    "owner": {
                        "mid": video_data["owner"]["mid"],
                        "name": video_data["owner"]["name"],
                        "face": video_data["owner"]["face"]
                    },
                    "stat": {
                        "view": video_data["stat"]["view"],
                        "danmaku": video_data["stat"]["danmaku"],
                        "reply": video_data["stat"]["reply"],
                        "favorite": video_data["stat"]["favorite"],
                        "coin": video_data["stat"]["coin"],
                        "share": video_data["stat"]["share"],
                        "like": video_data["stat"]["like"]
                    },
                    "cid": video_data["cid"],
                    "duration": video_data["duration"],
                    "pubdate": video_data["pubdate"],
                    "pages": video_data.get("pages"),
                    "dimension": video_data.get("dimension"),
                    "rights": video_data.get("rights"),
                    "descV2": video_data.get("desc_v2"),
                    "staff": video_data.get("staff"),
                    "ugcSeason": video_data.get("ugc_season")
                }
            }
            
        except httpx.HTTPError as e:
            return {
                "success": False,
                "message": f"获取视频数据失败: {str(e)}",
                "code": 500
            }