"""
Auto download schemas for data validation and API request/response
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ScanRecord(BaseModel):
    """扫描记录模型"""
    id: str = Field(..., description="记录 ID")
    source_type: str = Field(..., description="视频源类型 (favorite/watch_later/subscription)")
    source_id: str = Field(..., description="视频源 ID")
    last_scan_time: datetime = Field(..., description="最后扫描时间")
    total_videos: int = Field(..., ge=0, description="总视频数")
    new_videos: int = Field(..., ge=0, description="新视频数")
    added_to_queue: int = Field(..., ge=0, description="添加到队列数")
    status: str = Field(..., description="状态 (success/failed)")
    created_at: Optional[datetime] = Field(None, description="创建时间")

    class Config:
        from_attributes = True


class ScanTriggerRequest(BaseModel):
    """触发扫描请求"""
    source_type: str = Field(..., description="视频源类型 (favorite/watch_later/subscription)")
    source_id: str = Field(default="all", description="视频源 ID，默认为 all")


class FolderScanInfo(BaseModel):
    """收藏夹扫描信息"""
    id: int = Field(..., description="收藏夹 ID")
    title: str = Field(..., description="收藏夹标题")
    video_count: int = Field(..., ge=0, description="扫描到的视频数")
    new_count: int = Field(..., ge=0, description="新视频数")
    media_count: int = Field(..., ge=0, description="收藏夹总视频数")


class ScanTriggerResponse(BaseModel):
    """扫描结果响应"""
    total: int = Field(..., ge=0, description="扫描到的总视频数")
    new: int = Field(..., ge=0, description="新视频数")
    added: int = Field(..., ge=0, description="添加到队列的视频数")
    folder_count: int = Field(..., ge=0, description="扫描的收藏夹数量")
    folders: List[FolderScanInfo] = Field(default=[], description="收藏夹扫描详情")


class ScanVideoInfo(BaseModel):
    """扫描到的视频信息"""
    bvid: str = Field(..., description="视频 BV 号")
    title: str = Field(..., description="视频标题")
    author: str = Field(..., description="UP 主名称")
    duration: int = Field(..., ge=0, description="视频时长（秒）")
    cover: Optional[str] = Field(None, description="封面图片 URL")
    pubdate: Optional[int] = Field(None, description="发布时间戳")
    is_new: bool = Field(default=False, description="是否为新视频")
    folder_id: Optional[int] = Field(None, description="所属收藏夹 ID")


class ScanResult(BaseModel):
    """扫描完整结果"""
    records: List[ScanRecord] = Field(..., description="扫描记录列表")
    videos: List[ScanVideoInfo] = Field(..., description="扫描到的视频列表")
    total: int = Field(..., ge=0, description="总视频数")
    new: int = Field(..., ge=0, description="新视频数")
