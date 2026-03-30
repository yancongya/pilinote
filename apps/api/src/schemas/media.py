# Copyright (c) 2025 PiliNote

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from enum import Enum


class MediaType(str, Enum):
    """媒体类型枚举"""
    VIDEO = "video"
    BANGUMI = "bangumi"
    MUSIC = "music"
    MUSIC_LIST = "music_list"
    LESSON = "lesson"
    WATCH_LATER = "watch_later"
    FAVORITE = "favorite"
    OPUS = "opus"
    OPUS_LIST = "opus_list"
    USER_VIDEO = "user_video"
    USER_OPUS = "user_opus"
    USER_AUDIO = "user_audio"


class MediaStats(BaseModel):
    """媒体统计信息 - 统一的7项统计数据"""
    play: Optional[int] = Field(None, description="播放量")
    danmaku: Optional[int] = Field(None, description="弹幕数")
    reply: Optional[int] = Field(None, description="评论数")
    like: Optional[int] = Field(None, description="点赞数")
    coin: Optional[int] = Field(None, description="投币数")
    favorite: Optional[int] = Field(None, description="收藏数")
    share: Optional[int] = Field(None, description="转发数")


class MediaUpper(BaseModel):
    """上传者/作者信息"""
    name: str = Field(..., description="名称")
    mid: int = Field(..., description="用户ID")
    avatar: str = Field(..., description="头像URL")


class MediaThumbnail(BaseModel):
    """缩略图信息"""
    id: str = Field(..., description="缩略图ID")
    url: str = Field(..., description="缩略图URL")


class MediaNfo(BaseModel):
    """媒体元数据"""
    showtitle: Optional[str] = Field(None, description="系列标题")
    intro: Optional[str] = Field(None, description="简介")
    tags: List[str] = Field(default_factory=list, description="标签列表")
    url: str = Field(..., description="媒体URL")
    stat: MediaStats = Field(default_factory=MediaStats, description="统计信息")
    thumbs: List[MediaThumbnail] = Field(default_factory=list, description="缩略图列表")
    premiered: Optional[int] = Field(None, description="发布时间戳")
    upper: Optional[MediaUpper] = Field(None, description="上传者信息")
    credits: Optional[Dict[str, Any]] = Field(None, description="制作人员信息")


class MediaItem(BaseModel):
    """单个媒体项目"""
    title: str = Field(..., description="标题")
    cover: str = Field(..., description="封面URL")
    desc: str = Field(default="", description="描述")
    duration: int = Field(0, description="时长（秒）")
    pubtime: int = Field(0, description="发布时间戳")
    is_target: bool = Field(False, description="是否为目标项目")
    type: MediaType = Field(..., description="媒体类型")
    url: str = Field(..., description="媒体URL")
    aid: Optional[int] = Field(None, description="视频ID")
    sid: Optional[int] = Field(None, description="音乐ID")
    fid: Optional[int] = Field(None, description="收藏夹ID")
    cid: Optional[int] = Field(None, description="CID")
    bvid: Optional[str] = Field(None, description="BV号")
    epid: Optional[int] = Field(None, description="番剧剧集ID")
    ssid: Optional[int] = Field(None, description="番剧季节ID")
    opid: Optional[str] = Field(None, description="图文ID")
    rlid: Optional[int] = Field(None, description="图文列表ID")
    index: int = Field(0, description="索引")
    stat: Optional[MediaStats] = Field(None, description="统计信息")


class MediaSection(BaseModel):
    """媒体分区信息"""
    target: int = Field(..., description="目标ID")
    tabs: List[Dict[str, Any]] = Field(default_factory=list, description="分区标签")


class MediaInfo(BaseModel):
    """媒体信息容器 - 统一的媒体数据结构"""
    type: MediaType = Field(..., description="媒体类型")
    id: str = Field(..., description="媒体ID")
    pn: bool = Field(False, description="是否支持分页")
    nfo: MediaNfo = Field(..., description="媒体元数据")
    edge: Optional[Dict[str, Any]] = Field(None, description="互动视频信息")
    offset: Optional[str] = Field(None, description="分页偏移")
    sections: Optional[MediaSection] = Field(None, description="分区信息")
    list: List[MediaItem] = Field(default_factory=list, description="媒体项目列表")


class MediaProcessorResponse(BaseModel):
    """媒体处理器响应"""
    success: bool = Field(..., description="是否成功")
    data: Optional[MediaInfo] = Field(None, description="媒体信息")
    message: Optional[str] = Field(None, description="错误信息")