"""
视频库状态管理路由

提供视频库状态检查和刷新的API端点：
- POST /api/video-library/check-batch - 批量检查视频
- GET /api/video-library/refresh - 刷新视频库
- GET /api/video-library/status - 获取视频库状态
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List
from sqlalchemy.orm import Session

from src.database import get_db
from src.services.video_library_service import VideoLibraryService


router = APIRouter(prefix="/api/video-library", tags=["视频库"])


class CheckBatchRequest(BaseModel):
    """批量检查视频请求"""
    bvids: List[str] = Field(..., description="视频BVID列表")


class CheckBatchResponse(BaseModel):
    """批量检查视频响应"""
    downloaded: List[str] = Field(default=[], description="已下载的视频BVID列表")
    not_downloaded: List[str] = Field(default=[], description="未下载的视频BVID列表")


class LibraryStatusResponse(BaseModel):
    """视频库状态响应"""
    total_folders: int = Field(default=0, description="总文件夹数")
    total_videos: int = Field(default=0, description="总视频数")
    total_size_mb: float = Field(default=0.0, description="总大小（MB）")
    last_scan_time: int = Field(default=0, description="最后扫描时间戳")


@router.post("/check-batch", response_model=dict)
async def check_videos_in_library(
    request: CheckBatchRequest,
    db: Session = Depends(get_db)
):
    """
    批量检查视频是否在视频库中

    Args:
        request: 包含bvids列表的请求体
        db: 数据库会话

    Returns:
        {
            "success": True,
            "data": {
                "downloaded": ["BV1xx", "BV1yy"],
                "not_downloaded": ["BV1zz"]
            }
        }
    """
    try:
        service = VideoLibraryService(db)
        result = service.check_videos_in_library(request.bvids)

        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"批量检查视频失败: {str(e)}"
        )


@router.get("/refresh", response_model=dict)
async def refresh_library(db: Session = Depends(get_db)):
    """
    刷新视频库

    Args:
        db: 数据库会话

    Returns:
        {
            "success": True,
            "data": {
                "folders": [...],
                "total_files": 100,
                ...
            }
        }
    """
    try:
        service = VideoLibraryService(db)
        result = service.refresh_library()

        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"刷新视频库失败: {str(e)}"
        )


@router.get("/status", response_model=dict)
async def get_library_status(db: Session = Depends(get_db)):
    """
    获取视频库状态

    Args:
        db: 数据库会话

    Returns:
        {
            "success": True,
            "data": {
                "total_folders": 10,
                "total_videos": 100,
                "total_size_mb": 1024.5,
                "last_scan_time": 1234567890
            }
        }
    """
    try:
        service = VideoLibraryService(db)
        status = service.get_library_status()

        return {
            "success": True,
            "data": status
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取视频库状态失败: {str(e)}"
        )


@router.get("/playback/{bvid}", response_model=dict)
async def get_local_playback_map(
    bvid: str,
    db: Session = Depends(get_db)
):
    """
    获取视频的本地可播放文件映射
    """
    try:
        service = VideoLibraryService(db)
        result = service.get_local_playback_map(bvid)

        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取本地播放映射失败: {str(e)}"
        )
