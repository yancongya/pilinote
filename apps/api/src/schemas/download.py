# Copyright (c) 2025 PiliNote

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any


class ParseLinkRequest(BaseModel):
    """解析下载链接请求"""
    url: str = Field(..., description="视频链接或ID")
    sessdata: Optional[str] = Field(None, description="B站SESSDATA，用于认证请求")
    
    @field_validator('url')
    def validate_url(cls, v):
        if not v or not v.strip():
            raise ValueError('链接不能为空')
        return v.strip()


class ParsedVideoId(BaseModel):
    """解析后的视频ID信息"""
    type: str = Field(..., description="ID类型: season, bvid 或 aid")
    id: str = Field(..., description="视频ID或课程ID")
    original: str = Field(..., description="原始输入")


class VideoQuality(BaseModel):
    """视频画质选项"""
    qn: int = Field(..., description="画质代码")
    desc: str = Field(..., description="画质描述")


class VideoFormat(BaseModel):
    """视频格式选项"""
    format: str = Field(..., description="格式代码")
    desc: str = Field(..., description="格式描述")


class DownloadOption(BaseModel):
    """下载选项"""
    quality: int = Field(80, description="画质代码，默认80 (1080p)")
    format: str = Field("mp4", description="输出格式，默认mp4")
    download_subtitle: bool = Field(True, description="是否下载字幕")
    download_danmaku: bool = Field(True, description="是否下载弹幕")
    audio_only: bool = Field(False, description="是否仅下载音频")


class ParseLinkResponse(BaseModel):
    """解析下载链接响应"""
    success: bool = Field(..., description="是否成功")
    data: Optional[Dict[str, Any]] = Field(None, description="解析结果数据")
    message: Optional[str] = Field(None, description="错误消息")


class VideoInfo(BaseModel):
    """视频基本信息"""
    bvid: str = Field(..., description="BV编号")
    aid: int = Field(..., description="AV编号")
    title: str = Field(..., description="视频标题")
    desc: str = Field(..., description="视频描述")
    pic: str = Field(..., description="封面图片URL")
    duration: int = Field(..., description="视频时长(秒)")
    pubdate: int = Field(..., description="发布时间戳")
    cid: int = Field(..., description="视频CID")
    owner: Dict[str, Any] = Field(..., description="UP主信息")
    stat: Dict[str, Any] = Field(..., description="视频统计数据")


class VideoPages(BaseModel):
    """视频分P信息"""
    page: int = Field(..., description="分P序号")
    cid: int = Field(..., description="分P的CID")
    part: str = Field(..., description="分P标题")
    duration: int = Field(..., description="分P时长")


class DownloadOptionsResponse(BaseModel):
    """下载选项响应"""
    qualities: List[VideoQuality] = Field(..., description="可用的画质选项")
    formats: List[VideoFormat] = Field(..., description="可用的格式选项")
    subtitle_supported: bool = Field(..., description="是否支持字幕")
    danmaku_supported: bool = Field(..., description="是否支持弹幕")
    multi_part: bool = Field(..., description="是否为多P视频")
    pages: Optional[List[VideoPages]] = Field(None, description="分P信息")


class CreateDownloadTaskRequest(BaseModel):
    """创建下载任务请求"""
    video_id: str = Field(..., description="视频ID (BV编号或AV编号)")
    id_type: str = Field("bvid", description="ID类型: bvid 或 aid")
    options: DownloadOption = Field(..., description="下载选项")
    sessdata: Optional[str] = Field(None, description="B站SESSDATA")
    
    @field_validator('id_type')
    def validate_id_type(cls, v):
        if v not in ['bvid', 'aid']:
            raise ValueError('id_type 必须是 bvid 或 aid')
        return v


class DownloadTaskStatus(BaseModel):
    """下载任务状态"""
    task_id: str = Field(..., description="任务ID")
    status: str = Field(..., description="任务状态: pending, downloading, completed, failed")
    progress: float = Field(0.0, description="下载进度 0-100")
    downloaded_size: int = Field(0, description="已下载大小(字节)")
    total_size: Optional[int] = Field(None, description="总大小(字节)")
    speed: Optional[float] = Field(None, description="下载速度(MB/s)")
    error_message: Optional[str] = Field(None, description="错误信息")


class DownloadTaskResponse(BaseModel):
    """下载任务响应"""
    success: bool = Field(..., description="是否成功")
    task_id: Optional[str] = Field(None, description="任务ID")
    message: Optional[str] = Field(None, description="响应消息")
    data: Optional[Dict[str, Any]] = Field(None, description="任务数据")