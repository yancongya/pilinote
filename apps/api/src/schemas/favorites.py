from pydantic import BaseModel, Field
from typing import Optional, List


class FolderInfo(BaseModel):
    """收藏夹信息"""
    id: int = Field(..., description="收藏夹ID")
    title: str = Field(..., description="收藏夹标题")
    media_count: int = Field(..., description="收藏内容数量")
    cover: Optional[str] = Field(None, description="收藏夹封面")
    intro: Optional[str] = Field(None, description="收藏夹简介")
    favorite_state: bool = Field(False, description="是否已收藏")

    class Config:
        json_schema_extra = {
            "example": {
                "id": 123456,
                "title": "学习资料",
                "media_count": 12,
                "cover": "https://...",
                "intro": "学习视频收藏",
                "favorite_state": True
            }
        }


class VideoInfo(BaseModel):
    """视频信息"""
    id: int = Field(..., description="视频ID")
    title: str = Field(..., description="视频标题")
    cover: str = Field(..., description="视频封面")
    duration: int = Field(..., description="视频时长（秒）")
    uploader: dict = Field(..., description="UP主信息")
    view: int = Field(..., description="播放量")
    danmaku: int = Field(..., description="弹幕数")
    pubtime: int = Field(..., description="发布时间戳")
    comment: int = Field(..., description="评论数")
    bvid: str = Field(..., description="视频BV号")

    class Config:
        json_schema_extra = {
            "example": {
                "id": 123456789,
                "title": "视频标题",
                "cover": "https://...",
                "duration": 600,
                "uploader": {
                    "mid": 123,
                    "name": "UP主名称",
                    "face": "https://..."
                },
                "view": 10000,
                "danmaku": 100,
                "pubtime": 1234567890,
                "comment": 50,
                "bvid": "BV1234567890"
            }
        }


class FolderListResponse(BaseModel):
    """收藏夹列表响应"""
    success: bool
    data: Optional[List[FolderInfo]] = None
    message: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": [
                    {
                        "id": 123456,
                        "title": "学习资料",
                        "media_count": 12,
                        "cover": "https://...",
                        "intro": "学习视频收藏",
                        "favorite_state": True
                    }
                ]
            }
        }


class FolderDetailResponse(BaseModel):
    """收藏夹详情响应"""
    success: bool
    data: Optional[dict] = None
    message: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "info": {
                        "id": 123456,
                        "title": "学习资料",
                        "media_count": 12,
                        "cover": "https://...",
                        "intro": "学习视频收藏"
                    },
                    "medias": [
                        {
                            "id": 123456789,
                            "title": "视频标题",
                            "cover": "https://...",
                            "duration": 600,
                            "uploader": {
                                "mid": 123,
                                "name": "UP主名称",
                                "face": "https://..."
                            },
                            "view": 10000,
                            "danmaku": 100,
                            "pubtime": 1234567890,
                            "comment": 50,
                            "bvid": "BV1234567890"
                        }
                    ],
                    "page": 1,
                    "page_size": 20,
                    "total": 12
                }
            }
        }