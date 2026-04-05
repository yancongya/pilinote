"""
统一卡片数据模型

为 Watch Later 和 Favorites 页面提供统一的卡片数据结构，
确保前端使用相同的数据格式，减少重复代码。
"""
from pydantic import BaseModel, Field
from typing import Optional


class UploaderInfo(BaseModel):
    """UP主信息"""
    mid: int = Field(default=0, description="UP主ID")
    name: str = Field(default="未知", description="UP主名称")
    face: str = Field(default="", description="UP主头像URL")

    model_config = {
        "json_schema_extra": {
            "example": {
                "mid": 123456789,
                "name": "UP主名称",
                "face": "https://..."
            }
        }
    }


class CardStats(BaseModel):
    """卡片统计信息"""
    view: int = Field(default=0, description="播放量")
    danmaku: int = Field(default=0, description="弹幕数")
    comment: int = Field(default=0, description="评论数")
    like: int = Field(default=0, description="点赞数")
    coin: int = Field(default=0, description="投币数")
    favorite: int = Field(default=0, description="收藏数")
    share: int = Field(default=0, description="分享数")

    model_config = {
        "json_schema_extra": {
            "example": {
                "view": 10000,
                "danmaku": 500,
                "comment": 100,
                "like": 1000,
                "coin": 500,
                "favorite": 200,
                "share": 50
            }
        }
    }


class CardData(BaseModel):
    """统一的视频卡片数据模型

    用于 Watch Later 和 Favorites 页面的视频卡片展示，
    确保所有卡片使用相同的字段结构和命名。
    """
    id: int = Field(..., description="视频ID (aid)")
    bvid: str = Field(..., description="视频BV号")
    title: str = Field(..., description="视频标题")
    cover: str = Field(..., description="封面URL")
    duration: int = Field(default=0, description="时长（秒）")
    pubtime: int = Field(default=0, description="发布时间（时间戳）")
    uploader: UploaderInfo = Field(default_factory=UploaderInfo, description="UP主信息")
    stats: CardStats = Field(default_factory=CardStats, description="统计信息")
    
    # 前端兼容字段（从 stats 对象提升到顶层）
    view: int = Field(default=0, description="播放量")
    danmaku: int = Field(default=0, description="弹幕数")
    comment: int = Field(default=0, description="评论数")
    like: int = Field(default=0, description="点赞数")
    coin: int = Field(default=0, description="投币数")
    favorite: int = Field(default=0, description="收藏数")
    share: int = Field(default=0, description="分享数")
    
    # Watch Later 特有字段
    progress: Optional[int] = Field(default=-1, description="观看进度（秒），-1表示未开始")
    add_time: Optional[int] = Field(default=0, description="添加时间（时间戳）")
    
    # Favorites 特有字段
    intro: Optional[str] = Field(default="", description="视频简介")

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": 123456789,
                "bvid": "BV1xx411c7mD",
                "title": "视频标题",
                "cover": "https://...",
                "duration": 600,
                "pubtime": 1704067200,
                "uploader": {
                    "mid": 123456789,
                    "name": "UP主名称",
                    "face": "https://..."
                },
                "stats": {
                    "view": 10000,
                    "danmaku": 500,
                    "comment": 100,
                    "like": 1000,
                    "coin": 500,
                    "favorite": 200,
                    "share": 50
                },
                "progress": -1,
                "add_time": 1704067200,
                "intro": "视频简介"
            }
        }
    }


class CardListResponse(BaseModel):
    """卡片列表响应"""
    success: bool = Field(default=True, description="是否成功")
    data: dict = Field(..., description="响应数据")
    total: Optional[int] = Field(default=0, description="总数")

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "data": {
                    "list": [],
                    "page": 1,
                    "page_size": 20
                },
                "total": 100
            }
        }
    }