from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime


class AiNoteCreate(BaseModel):
    """创建 AI 笔记请求"""

    video_id: str = Field(..., description="关联的视频 ID")
    style: Optional[str] = Field("detailed", description="笔记风格")
    formats: Optional[List[str]] = Field(
        default_factory=lambda: ["summary"], description="启用的格式"
    )
    model_provider: Optional[str] = Field("openai", description="LLM 提供商")
    model_name: Optional[str] = Field("gpt-4o-mini", description="模型名称")
    extras: Optional[str] = Field(None, description="额外提示词")


class AiNoteUpdate(BaseModel):
    """更新 AI 笔记"""

    content: Optional[str] = None
    summary: Optional[str] = None
    mindmap_json: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    error: Optional[str] = None
    pipeline_mode: Optional[str] = None


class AiNoteResponse(BaseModel):
    """AI 笔记响应"""

    id: str
    task_id: Optional[str] = None
    video_id: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    mindmap_json: Optional[Dict[str, Any]] = None
    style: Optional[str] = None
    formats: Optional[List[str]] = None
    pipeline_mode: Optional[str] = None
    status: str
    model_provider: Optional[str] = None
    model_name: Optional[str] = None
    error: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    generated_markdown_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AiNoteStatusResponse(BaseModel):
    """AI 笔记状态响应"""

    note_id: str
    status: str
    progress: Optional[float] = None
    message: Optional[str] = None
    trace: Optional[List[Dict[str, Any]]] = None
