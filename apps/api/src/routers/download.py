# Copyright (c) 2025 PiliNote

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import httpx

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
from src.services.download_service import download_service

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


# 下载任务相关模型
class StartDownloadRequest(BaseModel):
    bvid: str
    title: str
    cid: Optional[int] = None
    aid: Optional[int] = None
    quality: int = 64
    output_format: str = "mp4"
    thumbnail_url: Optional[str] = None
    duration: Optional[int] = None
    uploader: Optional[str] = None
    uploader_mid: Optional[int] = None
    sessdata: Optional[str] = None


class StartDownloadResponse(BaseModel):
    success: bool
    download_id: Optional[str] = None
    message: Optional[str] = None


class DownloadListResponse(BaseModel):
    success: bool
    downloads: List[Dict[str, Any]]
    total: int


class DownloadDetailResponse(BaseModel):
    success: bool
    download: Optional[Dict[str, Any]] = None
    message: Optional[str] = None


@router.post("/parse", response_model=ParseLinkResponse)
async def parse_link(request: ParseLinkRequest):
    """
    解析下载链接，提取视频ID和基本信息
    
    支持的格式:
    - 课程ID: ss360 或直接输入 360
    - 课程链接: https://www.bilibili.com/cheese/play/ss360
    - BV编号: BV1xx411c7mh
    - 完整URL: https://www.bilibili.com/video/BV1xx411c7mh
    - 短链接: https://b23.tv/BV1xx411c7mh
    - AV编号: av12345678 或 12345678
    """
    try:
        # 解析链接
        parsed = link_parser.parse_video_link(request.url)
        
        # 获取信息
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com"
        }
        
        if request.sessdata:
            headers["Cookie"] = f"SESSDATA={request.sessdata}"
        
        # 如果是课程链接，使用课程API
        if parsed["type"] == "season":
            from src.services.bilibili import BilibiliService
            bilibili_service = BilibiliService()
            
            try:
                # 获取课程详情
                season_id = int(parsed["id"])
                course_detail_result = bilibili_service.get_classroom_detail(season_id, request.sessdata or "")
                
                if not course_detail_result["success"]:
                    return ParseLinkResponse(
                        success=False,
                        message=course_detail_result.get("message", "获取课程信息失败")
                    )
                
                course_detail = course_detail_result["data"]
                
                # 获取课程分集列表
                course_episodes_result = bilibili_service.get_classroom_episodes(season_id, request.sessdata or "", 1, 100)
                
                if not course_episodes_result["success"]:
                    return ParseLinkResponse(
                        success=False,
                        message=course_episodes_result.get("message", "获取课程分集失败")
                    )
                
                course_data = course_episodes_result["data"]
                episodes = course_data.get("items", [])
                
                if not episodes:
                    return ParseLinkResponse(
                        success=False,
                        message="课程暂无分集内容或需要购买"
                    )
                
                # 获取UP主信息
                up_info = course_detail.get("up_info", {})
                
                # 获取统计数据
                stat = course_detail.get("stat", {})
                
                # 返回课程信息（使用真实的课程详情）
                return ParseLinkResponse(
                    success=True,
                    data={
                        "parsed_id": ParsedVideoId(**parsed),
                        "video": VideoInfo(
                            bvid=episodes[0].get("bvid", ""),  # 使用第一个分集的bvid
                            aid=episodes[0].get("aid", 0),     # 使用第一个分集的aid
                            title=course_detail.get("title", ""),  # 使用课程真实标题
                            desc=course_detail.get("subtitle", "") or course_detail.get("description", ""),
                            pic=course_detail.get("cover", ""),   # 使用课程封面
                            duration=sum(ep.get("duration", 0) for ep in episodes),  # 课程总时长
                            pubdate=course_detail.get("pubtime", 0) or int(course_detail.get("release_date", 0)),  # 课程发布时间
                            cid=episodes[0].get("cid", 0),      # 使用第一个分集的cid
                            owner={
                                "mid": up_info.get("mid", 0),
                                "name": up_info.get("uname", ""),
                                "face": up_info.get("avatar", "")
                            },
                            stat={
                                "view": stat.get("play", 0),
                                "danmaku": 0  # 课程可能没有弹幕统计
                            }
                        ),
                        "download_options": {
                            "multi_part": True,
                            "pages": [
                                VideoPages(
                                    page=ep.get("index", 0),
                                    cid=ep.get("cid", 0),
                                    part=ep.get("title", f"第{ep.get('index', 0)}集"),
                                    duration=ep.get("duration", 0)
                                )
                                for ep in episodes
                            ]
                        },
                        "course_info": {
                            "season_id": season_id,
                            "total_episodes": len(episodes),
                            "episodes": episodes
                        }
                    }
                )
            finally:
                bilibili_service.close()
        
        # 普通视频链接处理
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


@router.post("/start", response_model=StartDownloadResponse)
async def start_download(request: StartDownloadRequest, background_tasks: BackgroundTasks):
    """
    创建并启动下载任务
    """
    try:
        # 创建下载任务
        download_id = download_service.create_download_task(
            bvid=request.bvid,
            title=request.title,
            cid=request.cid,
            aid=request.aid,
            quality=request.quality,
            output_format=request.output_format,
            thumbnail_url=request.thumbnail_url,
            duration=request.duration,
            uploader=request.uploader,
            uploader_mid=request.uploader_mid,
            sessdata=request.sessdata
        )
        
        # 在后台启动下载任务
        background_tasks.add_task(download_service._process_download, download_id)
        
        return StartDownloadResponse(
            success=True,
            download_id=download_id,
            message="下载任务创建成功"
        )
        
    except Exception as e:
        return StartDownloadResponse(
            success=False,
            message=f"创建下载任务失败: {str(e)}"
        )


@router.get("/list", response_model=DownloadListResponse)
async def get_download_list(status: Optional[str] = None):
    """
    获取下载任务列表
    
    Args:
        status: 可选，筛选特定状态的任务
    """
    try:
        downloads = download_service.get_all_downloads(status)
        
        # 转换为字典格式
        download_list = []
        for download in downloads:
            download_list.append({
                "id": download.id,
                "bvid": download.bvid,
                "title": download.title,
                "status": download.status,
                "progress": download.progress,
                "downloaded_bytes": download.downloaded_bytes,
                "total_bytes": download.total_bytes,
                "download_speed": download.download_speed,
                "eta": download.eta,
                "thumbnail_url": download.thumbnail_url,
                "duration": download.duration,
                "uploader": download.uploader,
                "file_path": download.file_path,
                "error_message": download.error_message,
                "created_at": download.created_at.isoformat() if download.created_at else None,
                "started_at": download.started_at.isoformat() if download.started_at else None,
                "completed_at": download.completed_at.isoformat() if download.completed_at else None,
                "aid": download.aid  # 添加aid字段用于系列分组
            })
        
        return DownloadListResponse(
            success=True,
            downloads=download_list,
            total=len(download_list)
        )
        
    except Exception as e:
        return DownloadListResponse(
            success=False,
            downloads=[],
            total=0
        )


@router.get("/{download_id}", response_model=DownloadDetailResponse)
async def get_download_detail(download_id: str):
    """
    获取单个下载任务详情
    """
    try:
        download = download_service.get_download(download_id)
        
        if not download:
            return DownloadDetailResponse(
                success=False,
                message="下载任务不存在"
            )
        
        download_data = {
            "id": download.id,
            "bvid": download.bvid,
            "title": download.title,
            "status": download.status,
            "progress": download.progress,
            "downloaded_bytes": download.downloaded_bytes,
            "total_bytes": download.total_bytes,
            "download_speed": download.download_speed,
            "eta": download.eta,
            "thumbnail_url": download.thumbnail_url,
            "duration": download.duration,
            "uploader": download.uploader,
            "file_path": download.file_path,
            "file_size": download.file_size,
            "error_message": download.error_message,
            "created_at": download.created_at.isoformat() if download.created_at else None,
            "started_at": download.started_at.isoformat() if download.started_at else None,
            "completed_at": download.completed_at.isoformat() if download.completed_at else None
        }
        
        return DownloadDetailResponse(
            success=True,
            download=download_data
        )
        
    except Exception as e:
        return DownloadDetailResponse(
            success=False,
            message=f"获取下载详情失败: {str(e)}"
        )


@router.post("/{download_id}/cancel")
async def cancel_download(download_id: str):
    """
    取消下载任务
    """
    try:
        success = download_service.cancel_download(download_id)
        
        if success:
            return {"success": True, "message": "下载任务已取消"}
        else:
            return {"success": False, "message": "下载任务不存在"}
            
    except Exception as e:
        return {"success": False, "message": f"取消下载失败: {str(e)}"}


@router.post("/{download_id}/retry")
async def retry_download(download_id: str):
    """
    重试失败的下载任务
    """
    try:
        success = download_service.retry_download(download_id)
        
        if success:
            return {"success": True, "message": "下载任务已重新开始"}
        else:
            return {"success": False, "message": "无法重试此任务"}
            
    except Exception as e:
        return {"success": False, "message": f"重试失败: {str(e)}"}


@router.delete("/{download_id}")
async def delete_download(download_id: str):
    """
    删除下载任务记录
    """
    try:
        # 先取消正在进行的下载
        download_service.cancel_download(download_id)
        
        # 从数据库中删除
        from src.database import SessionLocal
        from src.models.download import Download
        
        with SessionLocal() as session:
            download = session.query(Download).filter(Download.id == download_id).first()
            if download:
                session.delete(download)
                session.commit()
                return {"success": True, "message": "下载任务已删除"}
            else:
                return {"success": False, "message": "下载任务不存在"}
            
    except Exception as e:
        return {"success": False, "message": f"删除失败: {str(e)}"}


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