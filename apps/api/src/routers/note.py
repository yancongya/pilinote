from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel, Field
from datetime import datetime
from fastapi.responses import FileResponse
import tempfile

from src.services.ai import AiNoteService
from src.database import SessionLocal
from src.models.download import Download

router = APIRouter(prefix="/api/note", tags=["note"])


class AnalyzeRequest(BaseModel):
    """AI 分析请求"""

    video_id: str = Field(..., description="视频 ID")
    style: Optional[str] = Field("detailed", description="笔记风格")
    formats: Optional[List[str]] = Field(
        default_factory=lambda: ["summary"], description="启用的格式"
    )
    model_provider: Optional[str] = Field("openai", description="LLM 提供商")
    model_name: Optional[str] = Field("gpt-4o-mini", description="模型名称")
    extras: Optional[str] = Field(None, description="额外提示词")


class AnalyzeResponse(BaseModel):
    """AI 分析响应"""

    note_id: str
    status: str
    success: bool = True
    message: Optional[str] = None


class NoteStatusResponse(BaseModel):
    """笔记状态响应"""

    success: bool = True
    note_id: str
    status: str
    progress: Optional[float] = None
    message: Optional[str] = None
    error: Optional[str] = None


class NoteResponse(BaseModel):
    """笔记详情响应"""

    success: bool = True
    id: str
    video_id: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    style: Optional[str] = None
    formats: Optional[List[str]] = None
    status: str
    model_provider: Optional[str] = None
    model_name: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None


class ErrorResponse(BaseModel):
    """错误响应"""

    success: bool = False
    message: str


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_video(request: AnalyzeRequest):
    """触发 AI 分析"""
    try:
        # 检查视频是否存在
        db = SessionLocal()
        download = db.query(Download).filter(Download.id == request.video_id).first()
        db.close()

        if not download:
            raise HTTPException(status_code=404, detail="视频不存在")

        if not download.file_path:
            raise HTTPException(status_code=400, detail="视频文件路径不存在")

        # 创建笔记记录并执行分析
        service = AiNoteService()
        note = service.analyze_video(
            video_id=request.video_id,
            style=request.style or "detailed",
            formats=request.formats or ["summary"],
            model_provider=request.model_provider or "openai",
            model_name=request.model_name or "gpt-4o-mini",
            extras=request.extras,
        )

        return AnalyzeResponse(
            note_id=note.id,
            status=note.status,
            success=True,
            message="分析完成" if note.status == "completed" else None,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{note_id}", response_model=NoteStatusResponse)
async def get_note_status(note_id: str):
    """获取笔记状态"""
    service = AiNoteService()
    note = service.get_note(note_id)

    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    progress = None
    if note.status == "processing":
        progress = 50.0
    elif note.status == "completed":
        progress = 100.0

    return NoteStatusResponse(
        success=True,
        note_id=note.id,
        status=note.status,
        progress=progress,
        message="处理中" if note.status == "processing" else None,
        error=note.error,
    )


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(note_id: str):
    """获取笔记详情"""
    service = AiNoteService()
    note = service.get_note(note_id)

    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    return NoteResponse(
        success=True,
        id=note.id,
        video_id=note.video_id,
        content=note.content,
        summary=note.summary,
        style=note.style,
        formats=note.formats,
        status=note.status,
        model_provider=note.model_provider,
        model_name=note.model_name,
        error=note.error,
        created_at=note.created_at,
        updated_at=note.updated_at,
        completed_at=note.completed_at,
    )


@router.get("/by-video/{video_id}", response_model=NoteResponse)
async def get_note_by_video(video_id: str):
    """根据视频 ID 获取笔记"""
    service = AiNoteService()
    note = service.get_note_by_video(video_id)

    if not note:
        raise HTTPException(status_code=404, detail="该视频暂无笔记")

    return NoteResponse(
        success=True,
        id=note.id,
        video_id=note.video_id,
        content=note.content,
        summary=note.summary,
        style=note.style,
        formats=note.formats,
        status=note.status,
        model_provider=note.model_provider,
        model_name=note.model_name,
        error=note.error,
        created_at=note.created_at,
        updated_at=note.updated_at,
        completed_at=note.completed_at,
    )


@router.get("/recommend-style")
async def recommend_style(
    title: str = "",
    tags: str = "",
    description: str = "",
):
    """根据视频信息推荐笔记风格"""
    from src.services.ai.video_classifier import VideoClassifier

    result = VideoClassifier.classify(title, tags, description)
    return {"success": True, **result}


@router.get("/export/{note_id}")
async def export_note(note_id: str):
    """导出笔记为 Markdown 文件"""
    service = AiNoteService()
    note = service.get_note(note_id)

    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    if not note.content:
        raise HTTPException(status_code=400, detail="笔记内容为空")

    # 创建临时文件
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".md", delete=False, encoding="utf-8"
    ) as f:
        f.write(note.content)
        temp_path = f.name

    filename = f"ai_note_{note_id[:8]}.md"

    return FileResponse(
        temp_path,
        media_type="text/markdown",
        filename=filename,
    )
