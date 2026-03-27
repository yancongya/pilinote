# Copyright (c) 2025 PiliNote

from fastapi import APIRouter, HTTPException
import httpx
from typing import Dict, Any
from src.schemas.download import (
    ParseLinkRequest,
    ParseLinkResponse,
    ParsedVideoId,
    VideoInfo,
    VideoQuality,
    VideoFormat,
    DownloadOptionsResponse,
    VideoPages,
    CreateDownloadTaskRequest,
    DownloadTaskResponse,
    DownloadOption
)
from src.utils.bilibili_utils import link_parser, id_converter

router = APIRouter(prefix="/api/download", tags=["下载"])


# 支持的画质选项
QUALITY_OPTIONS = [
    {"qn": 16, "desc": "360P 流畅"},
    {"qn": 32, "desc": "480P 清晰"},
    {"qn": 64, "desc": "720P 高清"},
    {"qn": 80, "desc": "1080P 高清"},
    {"qn": 112, "desc": "1080P+ 高码率"},
    {"qn": 116, "desc": "4K 超清"},
]

# 支持的格式选项
FORMAT_OPTIONS = [
    {"format": "mp4", "desc": "MP4格式"},
    {"format": "flv", "desc": "FLV格式"},
    {"format": "mkv", "desc": "MKV格式"},
]


@router.post("/parse", response_model=ParseLinkResponse)
async def parse_link(request: ParseLinkRequest):
    """
    解析下载链接，提取视频ID和基本信息
    
    支持的格式:
    - BV编号: BV1xx411c7mh
    - 完整URL: https://www.bilibili.com/video/BV1xx411c7mh
    - 短链接: https://b23.tv/BV1xx411c7mh
    - AV编号: av12345678 或 12345678
    """
    try:
        # 解析链接
        parsed = link_parser.parse_video_link(request.url)
        
        # 获取视频信息
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com"
        }
        
        if request.sessdata:
            headers["Cookie"] = f"SESSDATA={request.sessdata}"
        
        # 构建API URL
        api_url = link_parser.get_video_info_url(parsed["id"], parsed["type"])
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(api_url, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            if data["code"] != 0:
                return ParseLinkResponse(
                    success=False,
                    message=data.get("message", "获取视频信息失败")
                )
            
            video_data = data["data"]
            
            # 构建返回数据
            video_info = {
                "parsed_id": ParsedVideoId(**parsed),
                "video": VideoInfo(
                    bvid=video_data["bvid"],
                    aid=video_data["aid"],
                    title=video_data["title"],
                    desc=video_data["desc"],
                    pic=video_data["pic"],
                    duration=video_data["duration"],
                    pubdate=video_data["pubdate"],
                    cid=video_data["cid"],
                    owner={
                        "mid": video_data["owner"]["mid"],
                        "name": video_data["owner"]["name"],
                        "face": video_data["owner"]["face"]
                    },
                    stat={
                        "view": video_data["stat"]["view"],
                        "danmaku": video_data["stat"]["danmaku"],
                        "reply": video_data["stat"]["reply"],
                        "favorite": video_data["stat"]["favorite"],
                        "coin": video_data["stat"]["coin"],
                        "share": video_data["stat"]["share"],
                        "like": video_data["stat"]["like"]
                    }
                ),
                "download_options": DownloadOptionsResponse(
                    qualities=[VideoQuality(**q) for q in QUALITY_OPTIONS],
                    formats=[VideoFormat(**f) for f in FORMAT_OPTIONS],
                    subtitle_supported=True,
                    danmaku_supported=True,
                    multi_part=len(video_data.get("pages", [])) > 1,
                    pages=[
                        VideoPages(
                            page=page["page"],
                            cid=page["cid"],
                            part=page["part"],
                            duration=page["duration"]
                        ) for page in video_data.get("pages", [])
                    ] if video_data.get("pages") else None
                )
            }
            
            return ParseLinkResponse(
                success=True,
                data=video_info
            )
            
    except ValueError as e:
        return ParseLinkResponse(
            success=False,
            message=str(e)
        )
    except httpx.HTTPError as e:
        return ParseLinkResponse(
            success=False,
            message=f"网络请求失败: {str(e)}"
        )
    except Exception as e:
        return ParseLinkResponse(
            success=False,
            message=f"解析链接失败: {str(e)}"
        )


@router.post("/convert")
async def convert_video_id(video_id: str, target_type: str = "bvid"):
    """
    转换视频ID格式 (BV <-> AV)
    
    Args:
        video_id: 视频ID
        target_type: 目标类型，bvid 或 aid
    """
    try:
        if target_type not in ["bvid", "aid"]:
            raise HTTPException(status_code=400, detail="target_type 必须是 bvid 或 aid")
        
        converted_id = link_parser.normalize_video_id(video_id, target_type)
        
        return {
            "success": True,
            "data": {
                "original": video_id,
                "converted": converted_id,
                "type": target_type
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"转换失败: {str(e)}"
        }


@router.post("/task/create", response_model=DownloadTaskResponse)
async def create_download_task(request: CreateDownloadTaskRequest):
    """
    创建下载任务
    
    注意: 此接口目前仅用于验证参数，实际下载功能需要后续实现
    """
    try:
        # 验证视频ID格式
        if request.id_type == "bvid":
            if not id_converter.is_bvid(request.video_id):
                raise HTTPException(status_code=400, detail="无效的BV编号格式")
        else:
            if not str(request.video_id).isdigit():
                raise HTTPException(status_code=400, detail="无效的AV编号格式")
        
        # 这里应该创建实际的下载任务
        # 目前仅返回模拟数据
        task_id = f"task_{hash(request.video_id)}"
        
        return DownloadTaskResponse(
            success=True,
            task_id=task_id,
            message="下载任务创建成功 (模拟)",
            data={
                "video_id": request.video_id,
                "id_type": request.id_type,
                "options": request.options.model_dump(),
                "status": "pending"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        return DownloadTaskResponse(
            success=False,
            message=f"创建下载任务失败: {str(e)}"
        )


@router.get("/quality/options")
async def get_quality_options():
    """
    获取支持的画质选项
    """
    return {
        "success": True,
        "data": QUALITY_OPTIONS
    }


@router.get("/format/options")
async def get_format_options():
    """
    获取支持的格式选项
    """
    return {
        "success": True,
        "data": FORMAT_OPTIONS
    }