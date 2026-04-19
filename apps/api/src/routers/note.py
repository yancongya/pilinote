from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel, Field
from datetime import datetime
from fastapi.responses import FileResponse
import tempfile

import os

from src.services.ai import AiNoteService
from src.database import SessionLocal
from src.models.download import Download

router = APIRouter(prefix="/api/note", tags=["note"])


def _run_ai_analysis_background(
    note_id: str,
    video_id: str,
    file_path: str,
    style: str,
    formats: List[str],
    model_provider: str,
    model_name: str,
    extras: Optional[str],
):
    service = AiNoteService()
    try:
        service.analyze_note(
            note_id=note_id,
            video_id=video_id,
            file_path=file_path,
            style=style,
            formats=formats,
            model_provider=model_provider,
            model_name=model_name,
            extras=extras,
        )
    finally:
        if service.db:
            service.db.close()


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
    trace: Optional[List[Dict[str, Any]]] = None
    control_state: Optional[str] = None
    current_stage: Optional[str] = None


class NoteResponse(BaseModel):
    """笔记详情响应"""

    success: bool = True
    id: str
    video_id: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    style: Optional[str] = None
    formats: Optional[List[str]] = None
    pipeline_mode: Optional[str] = None
    status: str
    model_provider: Optional[str] = None
    model_name: Optional[str] = None
    error: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    control_state: Optional[str] = None
    current_stage: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None


class NoteLookupResponse(BaseModel):
    """按视频查找笔记响应"""

    success: bool = True
    found: bool = False
    note: Optional[NoteResponse] = None
    message: Optional[str] = None


class ResumeFromStageRequest(BaseModel):
    """从指定阶段恢复请求"""

    resume_from_stage: str = Field(..., description="从哪个阶段开始重跑")


class ErrorResponse(BaseModel):
    """错误响应"""

    success: bool = False
    message: str


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_video(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """触发 AI 分析"""
    try:
        # 支持三种方式：1) file_path（本地文件路径）2) downloads.id  3) bvid
        file_path = request.video_id

        # 检查是否是有效的本地文件路径
        if not file_path or not os.path.exists(file_path):
            # 如果不是文件路径，尝试查找数据库记录
            db = SessionLocal()
            download = (
                db.query(Download).filter(Download.id == request.video_id).first()
            )

            if not download:
                # 尝试通过 bvid 查找
                download = (
                    db.query(Download)
                    .filter(
                        Download.bvid == request.video_id,
                        Download.status == "completed",
                    )
                    .first()
                )

            if not download:
                db.close()
                raise HTTPException(status_code=404, detail="视频不存在或未下载")

            if not download.file_path:
                db.close()
                raise HTTPException(status_code=400, detail="视频文件路径不存在")

            file_path = download.file_path
            video_id = download.id
            db.close()
        else:
            # 使用文件路径作为 ID
            video_id = file_path

        service = AiNoteService()
        note = service.create_note_record(
            video_id=video_id,
            style=request.style or "detailed",
            formats=request.formats or ["summary"],
            model_provider=request.model_provider or "openai",
            model_name=request.model_name or "gpt-4o-mini",
        )
        service.db.close()

        background_tasks.add_task(
            _run_ai_analysis_background,
            note.id,
            video_id,
            file_path,
            request.style or "detailed",
            request.formats or ["summary"],
            request.model_provider or "openai",
            request.model_name or "gpt-4o-mini",
            request.extras,
        )

        return AnalyzeResponse(
            note_id=note.id,
            status=note.status,
            success=True,
            message="分析已启动",
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

    trace = (note.meta or {}).get("trace", [])
    control = (note.meta or {}).get("control", {})
    progress = None
    if trace:
        progress = float(trace[-1].get("progress", 0.0))
    elif note.status == "processing":
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
        trace=trace,
        control_state=control.get("state"),
        current_stage=control.get("current_stage"),
    )


@router.get("/by-video", response_model=NoteLookupResponse)
async def get_note_by_video(
    video_id: str = Query(..., description="视频 ID 或文件路径"),
):
    """根据视频 ID 获取笔记"""
    service = AiNoteService()
    note = service.get_note_by_video(video_id)

    if not note:
        return NoteLookupResponse(
            success=True, found=False, note=None, message="该视频暂无笔记"
        )

    return NoteLookupResponse(
        success=True,
        found=True,
        note=NoteResponse(
            success=True,
            id=note.id,
            video_id=note.video_id,
            content=note.content,
            summary=note.summary,
            style=note.style,
            formats=note.formats,
            pipeline_mode=note.pipeline_mode,
            status=note.status,
            model_provider=note.model_provider,
            model_name=note.model_name,
            error=note.error,
            meta=note.meta,
            generated_markdown_path=(note.meta or {}).get("generated_markdown_path")
            if isinstance(note.meta, dict)
            else None,
            control_state=(note.meta or {}).get("control", {}).get("state")
            if isinstance(note.meta, dict)
            else None,
            current_stage=(note.meta or {}).get("control", {}).get("current_stage")
            if isinstance(note.meta, dict)
            else None,
            created_at=note.created_at,
            updated_at=note.updated_at,
            completed_at=note.completed_at,
        ),
    )


@router.post("/pause/{note_id}")
async def pause_note(note_id: str):
    service = AiNoteService()
    if not service.pause_analysis(note_id):
        raise HTTPException(status_code=404, detail="笔记不存在")
    return {"success": True, "message": "已暂停"}


@router.post("/resume/{note_id}")
async def resume_note(note_id: str):
    service = AiNoteService()
    if not service.resume_analysis(note_id):
        raise HTTPException(status_code=404, detail="笔记不存在")
    return {"success": True, "message": "已恢复"}


@router.post("/cancel/{note_id}")
async def cancel_note(note_id: str):
    service = AiNoteService()
    if not service.cancel_analysis(note_id):
        raise HTTPException(status_code=404, detail="笔记不存在")
    return {"success": True, "message": "已取消"}


@router.post("/resume-from-stage/{note_id}")
async def resume_from_stage(note_id: str, request: ResumeFromStageRequest):
    service = AiNoteService()
    if not service.resume_from_stage(note_id, request.resume_from_stage):
        raise HTTPException(status_code=404, detail="笔记不存在")
    return {"success": True, "message": "已从指定阶段重跑"}


@router.post("/reanalyze/{note_id}")
async def reanalyze_note(note_id: str):
    """基于之前的分析结果进行增量分析（节省 tokens）"""
    from pydantic import BaseModel

    class ReanalyzeRequest(BaseModel):
        style: Optional[str] = None
        formats: Optional[List[str]] = None

    service = AiNoteService()
    note = service.get_note(note_id)

    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    if not note.content:
        raise HTTPException(status_code=400, detail="没有可用的之前分析结果")

    result = service.reanalyze_incremental(note_id)
    return result


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
        meta=note.meta,
        generated_markdown_path=(note.meta or {}).get("generated_markdown_path")
        if isinstance(note.meta, dict)
        else None,
        created_at=note.created_at,
        updated_at=note.updated_at,
        completed_at=note.completed_at,
    )
