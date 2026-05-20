from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel, Field
from datetime import datetime
from fastapi.responses import FileResponse, StreamingResponse
from pathlib import Path
import tempfile
import asyncio
import json

import os

from src.services.ai import AiNoteService
from src.database import SessionLocal
from src.models.download import Download

router = APIRouter(prefix="/api/note", tags=["note"])


def _resolve_download_for_note(video_id: str) -> Optional[Download]:
    db = SessionLocal()
    try:
        download = db.query(Download).filter(Download.id == video_id).first()
        if not download:
            download = (
                db.query(Download)
                .filter(Download.file_path == video_id)
                .first()
            )
        if not download:
            download = (
                db.query(Download)
                .filter(Download.bvid == video_id, Download.status == "completed")
                .order_by(Download.cid.asc(), Download.created_at.asc())
                .first()
            )
        if not download:
            download = (
                db.query(Download)
                .filter(Download.bvid == video_id)
                .order_by(Download.cid.asc(), Download.created_at.asc())
                .first()
            )
        return download
    finally:
        db.close()


def _run_ai_analysis_background(
    note_id: str,
    video_id: str,
    file_path: str,
    style: str,
    formats: List[str],
    model_provider: str,
    model_name: str,
    extras: Optional[str],
    subtitle_filename: Optional[str] = None,
    level: Optional[str] = None,
    pipeline_mode: Optional[str] = None,
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
            subtitle_filename=subtitle_filename,
            level=level,
            pipeline_mode=pipeline_mode,
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
    subtitle_filename: Optional[str] = Field(None, description="指定使用的字幕文件名")
    pipeline_mode: Optional[str] = Field(None, description="流水线模式：video/series/image_text")
    generate_page: bool = Field(False, description="是否额外生成网页展示产物")
    generate_image: bool = Field(False, description="是否额外生成图解图片产物")


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


class ReanalyzeRequest(BaseModel):
    pipeline_mode: Optional[str] = Field(None, description="流水线模式：video/series/image_text")


class ErrorResponse(BaseModel):
    """错误响应"""

    success: bool = False
    message: str


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_video(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """触发 AI 分析"""
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[analyze] video_id={request.video_id}, subtitle_filename={request.subtitle_filename}")
    try:
        # 支持四种方式：1) file_path（本地文件路径）2) downloads.id  3) bvid 4) 本地目录名
        file_path = request.video_id
        video_id = request.video_id

        # 检查是否是有效的本地文件路径
        if file_path and os.path.exists(file_path):
            # 直接使用文件路径
            video_id = file_path
        else:
            # 尝试在 downloads 目录中查找本地文件
            from src.routers.local import find_video_dir
            video_dir = find_video_dir(request.video_id)
            if video_dir and video_dir.exists():
                # 在目录中查找视频文件
                from src.services.ai.note_service import AiNoteService as NoteService
                resolved_path = NoteService()._resolve_video_file_path(str(video_dir))
                if resolved_path:
                    logger.info(f"[analyze] 本地目录找到视频: {resolved_path}")
                    file_path = resolved_path
                    video_id = request.video_id
                else:
                    # 尝试数据库查找
                    download = _resolve_download_for_note(request.video_id)
                    if not download:
                        raise HTTPException(status_code=404, detail=f"视频不存在或未下载: {request.video_id}")
                    if not download.file_path:
                        raise HTTPException(status_code=400, detail="视频文件路径不存在")
                    file_path = download.file_path
                    video_id = download.id
            else:
                # 尝试数据库查找
                download = _resolve_download_for_note(request.video_id)
                if not download:
                    raise HTTPException(status_code=404, detail=f"视频不存在或未下载: {request.video_id}")
                if not download.file_path:
                    raise HTTPException(status_code=400, detail="视频文件路径不存在")
                file_path = download.file_path
                video_id = download.id

        service = AiNoteService()
        note = service.create_note_record(
            video_id=video_id,
            style=request.style or "detailed",
            formats=request.formats or ["summary"],
            model_provider=request.model_provider or "openai",
            model_name=request.model_name or "gpt-4o-mini",
            pipeline_mode=request.pipeline_mode,
            meta={
                "generate_page": bool(request.generate_page),
                "generate_image": bool(request.generate_image),
            },
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
            request.subtitle_filename,
            None,
            request.pipeline_mode,
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
async def reanalyze_note(note_id: str, request: ReanalyzeRequest | None = None):
    """基于之前的分析结果进行增量分析（节省 tokens）"""
    service = AiNoteService()
    note = service.get_note(note_id)

    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    if not note.content:
        raise HTTPException(status_code=400, detail="没有可用的之前分析结果")

    result = service.reanalyze_incremental(note_id, request.pipeline_mode if request else None)
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


# ============ SSE 流式分析端点 ============

class PipelineAnalyzeRequest(BaseModel):
    """流式分析请求"""
    video_id: str = Field(..., description="视频 ID")
    style: Optional[str] = Field("detailed", description="笔记风格")
    level: Optional[str] = Field("detailed", description="详细程度 (simple/detailed)")
    formats: Optional[List[str]] = Field(None, description="输出格式")
    model_provider: Optional[str] = Field("openai", description="模型提供商")
    model_name: Optional[str] = Field(None, description="模型名称")
    subtitle_filename: Optional[str] = Field(None, description="字幕文件名")
    pipeline_mode: Optional[str] = Field(None, description="流水线模式：video/series/image_text")


@router.post("/pipeline-analyze")
async def pipeline_analyze_note(request: PipelineAnalyzeRequest, background_tasks: BackgroundTasks):
    """流水线式笔记分析，通过 SSE 逐步推送进度"""
    import logging
    logger = logging.getLogger(__name__)
    from src.routers.local import find_video_dir
    from src.services.ai.note_service import AiNoteService as NoteService

    logger.info(f"[SSE] pipeline-analyze called with video_id={request.video_id}")

    # 查找视频文件
    file_path = None

    # 1) If caller passes a local path (file or dir), prefer it directly.
    try:
        direct = Path(request.video_id)
        if direct.exists():
            file_path = str(direct)
            logger.info(f"[SSE] resolved direct file_path={file_path}")
    except Exception:
        file_path = None

    # 2) Otherwise try resolving by bvid/cv id from downloads folder.
    if not file_path:
        video_dir = find_video_dir(request.video_id)
        logger.info(f"[SSE] video_dir={video_dir}")

        if video_dir and video_dir.exists():
            service = NoteService()
            resolved_path = service._resolve_video_file_path(str(video_dir))
            logger.info(f"[SSE] resolved_path={resolved_path}")
            if resolved_path:
                file_path = resolved_path
            service.db.close()

    if not file_path:
        download = _resolve_download_for_note(request.video_id)
        if download and download.file_path:
            file_path = download.file_path
            logger.info(f"[SSE] resolved download file_path={file_path}")

    if not file_path:
        logger.error(f"[SSE] Video file not found for {request.video_id}")
        raise HTTPException(status_code=404, detail="视频文件未找到")

    # 创建笔记记录
    service = NoteService()
    note = service.create_note_record(
        video_id=request.video_id,
        style=request.style or "detailed",
        formats=request.formats or ["summary"],
        model_provider=request.model_provider or "openai",
        model_name=request.model_name or "gpt-4o-mini",
        pipeline_mode=request.pipeline_mode,
    )
    note_id = note.id
    service.db.close()

    logger.info(f"[SSE] Created note: {note_id}")

    # 在单独的线程池中启动分析任务，避免阻塞 SSE 事件循环
    loop = asyncio.get_event_loop()
    loop.run_in_executor(
        None,  # 使用默认线程池
        _run_ai_analysis_background,
        note_id,
        request.video_id,
        file_path,
        request.style or "detailed",
        request.formats or ["summary"],
        request.model_provider or "openai",
        request.model_name or "gpt-4o-mini",
        None,
        request.subtitle_filename,
        request.level or "detailed",
        request.pipeline_mode,
    )
    logger.info(f"[SSE] Analysis task started in background thread for note {note_id}")

    # SSE 流：轮询笔记状态并推送事件
    async def event_stream():
        try:
            import time
            
            # 追踪已推送的 trace 条目，避免重复推送
            pushed_trace_stages = set()
            
            # 发送初始事件
            yield f"data: {json.dumps({'stage': 'INIT', 'status': 'processing', 'data': {'note_id': note_id, 'message': '开始分析...'}}, ensure_ascii=False)}\n\n"
            
            # 轮询状态
            while True:
                try:
                    svc = NoteService()
                    note_status = svc.get_note(note_id)
                    
                    if not note_status:
                        yield f"data: {json.dumps({'stage': 'DONE', 'status': 'error', 'data': {'error': '笔记记录丢失'}}, ensure_ascii=False)}\n\n"
                        svc.db.close()
                        break
                    
                    # 推送新增的 trace 事件（从 meta 中获取）
                    trace = (note_status.meta or {}).get("trace", [])
                    logger.info(f"[SSE] note_id={note_id}, trace_count={len(trace)}, pushed_count={len(pushed_trace_stages)}")
                    
                    for trace_entry in trace:
                        stage_key = trace_entry.get("stage", "")
                        if stage_key and stage_key not in pushed_trace_stages:
                            pushed_trace_stages.add(stage_key)
                            logger.info(f"[SSE] Pushing stage: {stage_key}")
                            event_data = {
                                "stage": stage_key,
                                "status": "completed",
                                "data": trace_entry,
                            }
                            yield f"data: {json.dumps(event_data, ensure_ascii=False)}\n\n"
                    
                    # 推送当前阶段（仅当正在处理时）
                    control = (note_status.meta or {}).get("control", {})
                    current_stage = control.get("current_stage")
                    if current_stage and note_status.status == "processing":
                        logger.info(f"[SSE] Current stage: {current_stage}")
                        # 获取当前阶段的trace详情
                        trace = (note_status.meta or {}).get("trace", [])
                        stage_detail = {}
                        for t in trace:
                            if t.get("stage") == current_stage:
                                stage_detail = t
                                break
                        event_data = {
                            "stage": current_stage,
                            "status": "processing",
                            "data": stage_detail or {"stage": current_stage, "summary": "处理中...", "detail": {"message": "处理中..."}},
                        }
                        yield f"data: {json.dumps(event_data, ensure_ascii=False)}\n\n"
                    
                    # 检查是否完成
                    if note_status.status == "completed":
                        logger.info(f"[SSE] Analysis completed for note {note_id}")
                        yield f"data: {json.dumps({'stage': 'DONE', 'status': 'completed', 'data': {'note_id': note_id}}, ensure_ascii=False)}\n\n"
                        svc.db.close()
                        break
                    elif note_status.status == "failed":
                        logger.error(f"[SSE] Analysis failed for note {note_id}: {note_status.error}")
                        yield f"data: {json.dumps({'stage': 'DONE', 'status': 'error', 'data': {'error': note_status.error or '分析失败'}}, ensure_ascii=False)}\n\n"
                        svc.db.close()
                        break
                    
                    svc.db.close()
                    await asyncio.sleep(1)
                except Exception as poll_error:
                    # 轮询失败，记录但继续尝试
                    logger.warning(f"[SSE] Poll error: {poll_error}, retrying...")
                    await asyncio.sleep(1)
                
        except Exception as e:
            logger.error(f"[SSE] Error in event_stream: {e}", exc_info=True)
            yield f"data: {json.dumps({'stage': 'DONE', 'status': 'error', 'data': {'error': str(e)}}, ensure_ascii=False)}\n\n"

    logger.info(f"[SSE] Starting event stream for note {note_id}")
    return StreamingResponse(event_stream(), media_type="text/event-stream")
