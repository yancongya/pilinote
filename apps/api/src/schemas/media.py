"""
统一媒体信息Schema定义

提供统一的媒体信息数据结构，解决当前数据格式不一致的问题。
"""
from pydantic import BaseModel, Field
from typing import List, Optional
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
    """媒体统计信息"""
    play: int = Field(default=0, alias="view")
    danmaku: int = Field(default=0)
    reply: int = Field(default=0)
    like: int = Field(default=0)
    coin: int = Field(default=0)
    favorite: int = Field(default=0)
    share: int = Field(default=0)

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "play": 10000,
                "danmaku": 500,
                "reply": 100,
                "like": 1000,
                "coin": 500,
                "favorite": 200,
                "share": 50
            }
        }
    }


class MediaUpper(BaseModel):
    """UP主信息"""
    mid: int
    name: str
    avatar: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "mid": 123456789,
                "name": "UP主名称",
                "avatar": "https://..."
            }
        }
    }


class MediaThumbnail(BaseModel):
    """缩略图信息"""
    id: str
    url: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": "cover",
                "url": "https://..."
            }
        }
    }


class MediaSection(BaseModel):
    """分节信息"""
    id: int
    title: str
    type: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": 1,
                "title": "分节标题",
                "type": "section"
            }
        }
    }


class MediaItem(BaseModel):
    """媒体项"""
    title: str
    cover: str
    desc: str
    duration: int
    pubtime: int
    is_target: bool
    type: MediaType
    url: str
    aid: Optional[int] = None
    bvid: Optional[str] = None
    cid: Optional[int] = None
    epid: Optional[int] = None
    ssid: Optional[int] = None
    index: int = 0

    model_config = {
        "json_schema_extra": {
            "example": {
                "title": "视频标题",
                "cover": "https://...",
                "desc": "视频描述",
                "duration": 600,
                "pubtime": 1704067200,
                "is_target": False,
                "type": "video",
                "url": "https://bilibili.com/video/BV...",
                "aid": 123456789,
                "bvid": "BV...",
                "cid": 987654321,
                "epid": None,
                "ssid": None,
                "index": 0
            }
        }
    }


class MediaNfo(BaseModel):
    """媒体NFO信息"""
    title: str = Field(default="")
    showtitle: str = Field(default="")
    plot: str = Field(default="")
    intro: str = Field(default="")
    studio: str = Field(default="")
    premiered: Optional[str] = None
    runtime: int = Field(default=0)
    thumb: str = Field(default="")
    url: str = Field(default="")
    stat: Optional[MediaStats] = None
    thumbs: List[MediaThumbnail] = Field(default_factory=list)
    upper: Optional[MediaUpper] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "title": "视频标题",
                "showtitle": "显示标题",
                "plot": "视频描述",
                "intro": "简介",
                "studio": "UP主名称",
                "premiered": "2024-01-01",
                "runtime": 600,
                "thumb": "https://...",
                "url": "https://...",
                "stat": {
                    "play": 10000,
                    "danmaku": 500,
                    "reply": 100,
                    "like": 1000,
                    "coin": 500,
                    "favorite": 200,
                    "share": 50
                },
                "thumbs": [],
                "upper": {
                    "mid": 123456789,
                    "name": "UP主名称",
                    "avatar": "https://..."
                }
            }
        }
    }


class MediaInfo(BaseModel):
    """媒体信息（统一格式）"""
    type: MediaType
    id: str
    title: str
    cover: str
    desc: str
    nfo: MediaNfo
    stats: MediaStats
    list: List[MediaItem]

    model_config = {
        "json_schema_extra": {
            "example": {
                "type": "video",
                "id": "BV1xx411c7mD",
                "title": "视频标题",
                "cover": "https://...",
                "desc": "视频描述",
                "nfo": {
                    "title": "视频标题",
                    "plot": "视频描述",
                    "studio": "UP主名称",
                    "premiered": "2024-01-01",
                    "runtime": 600,
                    "thumb": "https://..."
                },
                "stats": {
                    "play": 10000,
                    "danmaku": 500,
                    "reply": 100,
                    "like": 1000,
                    "coin": 500,
                    "favorite": 200,
                    "share": 50
                },
                "list": []
            }
        }
    }