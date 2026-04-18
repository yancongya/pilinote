from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class LocalASRModelInfo(BaseModel):
    """本地 ASR 模型信息与状态。"""

    model_id: str = Field(..., description="模型 ID，例如 base、small")
    name: str = Field(..., description="展示名称")
    repo_id: str = Field(..., description="Hugging Face 仓库 ID")
    description: str = Field(default="", description="模型说明")
    size_bytes: int = Field(default=0, description="模型预估体积（字节）")
    size_label: str = Field(default="", description="模型体积显示文案")
    cache_path: str = Field(default="", description="本地缓存目录")
    download_state: str = Field(
        default="not_downloaded",
        description="下载状态：not_downloaded/downloading/ready/failed",
    )
    progress: float = Field(default=0.0, description="下载进度（0-100）")
    downloaded_bytes: int = Field(default=0, description="已下载字节数")
    total_bytes: int = Field(default=0, description="总字节数")
    ready: bool = Field(default=False, description="模型是否可用于分析")
    active: bool = Field(default=False, description="是否为当前激活模型")
    error: Optional[str] = Field(default=None, description="最近一次错误信息")
    updated_at: Optional[str] = Field(default=None, description="更新时间")


class LocalASRModelListResponse(BaseModel):
    success: bool = True
    message: str = "ok"
    active_model_id: str = ""
    active_model: LocalASRModelInfo
    ready: bool = False
    models: List[LocalASRModelInfo]


class LocalASRModelActionRequest(BaseModel):
    model_id: str = Field(..., description="目标模型 ID")


class LocalASRModelActionResponse(BaseModel):
    success: bool = True
    message: str = "ok"
    model: LocalASRModelInfo


class LocalASRModelProgressResponse(BaseModel):
    success: bool = True
    message: str = "ok"
    model: LocalASRModelInfo


class LocalASRReadinessResponse(BaseModel):
    success: bool = True
    ready: bool = False
    message: str = "ok"
    active_model_id: str = ""
    model: Optional[LocalASRModelInfo] = None
