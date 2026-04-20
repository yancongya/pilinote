from fastapi import APIRouter, Query, Body, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from fastapi.responses import StreamingResponse
import asyncio
import json

from src.services.ai.term_base_service import term_base_service
from src.services.ai.subtitle_analyzer import subtitle_analyzer

router = APIRouter(prefix="/api/ai", tags=["AI字幕处理"])


# ============ 术语库 ============


class AddTermRequest(BaseModel):
    source: str
    target: str
    note: str = ""
    filename: str = "custom.csv"


class TermResponse(BaseModel):
    success: bool
    data: Optional[List[Dict]] = None
    error: Optional[str] = None
    files: Optional[List[str]] = None


@router.get("/vocabulary", response_model=TermResponse)
async def get_vocabulary():
    """获取所有术语"""
    try:
        terms = term_base_service.get_all_terms()
        files = term_base_service.list_files()
        return TermResponse(success=True, data=terms, files=files)
    except Exception as e:
        return TermResponse(success=False, error=str(e))


@router.post("/vocabulary", response_model=TermResponse)
async def add_vocabulary(request: AddTermRequest):
    """添加术语"""
    try:
        term_base_service.add_term(
            source=request.source,
            target=request.target,
            note=request.note,
            filename=request.filename,
        )
        terms = term_base_service.get_all_terms()
        return TermResponse(success=True, data=terms)
    except Exception as e:
        return TermResponse(success=False, error=str(e))


@router.delete("/vocabulary/{source}", response_model=TermResponse)
async def delete_vocabulary(source: str, filename: str = Query("custom.csv")):
    """删除术语"""
    try:
        term_base_service.delete_term(source, filename)
        terms = term_base_service.get_all_terms()
        return TermResponse(success=True, data=terms)
    except Exception as e:
        return TermResponse(success=False, error=str(e))


# ============ 字幕处理 ============


class AnalyzeRequest(BaseModel):
    video_id: str
    content: str
    model_provider: str = "openai"


class ApplyTermsRequest(BaseModel):
    video_id: str
    content: str


class AnalyzeResponse(BaseModel):
    success: bool
    data: Optional[Dict] = None
    error: Optional[str] = None


@router.post("/subtitle/analyze", response_model=AnalyzeResponse)
async def analyze_subtitle(request: AnalyzeRequest):
    """AI分析字幕（错别字、语法问题）"""
    try:
        result = await subtitle_analyzer.analyze(
            subtitle_content=request.content, model_provider=request.model_provider
        )
        return AnalyzeResponse(success=result.get("success", False), data=result)
    except Exception as e:
        return AnalyzeResponse(success=False, error=str(e))


@router.post("/subtitle/apply-terms", response_model=AnalyzeResponse)
async def apply_terms_to_subtitle(request: ApplyTermsRequest):
    """应用术语替换到字幕"""
    try:
        term_base_service.load()  # 确保已加载

        # 解析SRT并应用替换
        lines = request.content.split("\n")
        result_lines = []
        all_replacements = []

        for line in lines:
            if line.strip() and not line.strip().isdigit() and "-->" not in line:
                replaced_line, replacements = term_base_service.replace_term(line)
                result_lines.append(replaced_line)
                if replacements:
                    all_replacements.extend(replacements)
            else:
                result_lines.append(line)

        return AnalyzeResponse(
            success=True,
            data={"content": "\n".join(result_lines), "replacements": all_replacements},
        )
    except Exception as e:
        return AnalyzeResponse(success=False, error=str(e))


@router.post("/subtitle/check-line", response_model=AnalyzeResponse)
async def check_subtitle_line(
    text: str = Body(...), model_provider: str = Query("openai")
):
    """检查单条字幕"""
    try:
        result = await subtitle_analyzer.check_subtitle_line(text, model_provider)
        return AnalyzeResponse(success=result.get("success", False), data=result)
    except Exception as e:
        return AnalyzeResponse(success=False, error=str(e))


class PipelineAnalyzeRequest(BaseModel):
    video_id: str
    content: str
    model_provider: str = "openai"


@router.post("/subtitle/pipeline-analyze")
async def pipeline_analyze_subtitle(request: PipelineAnalyzeRequest):
    """流水线式字幕分析，通过 SSE 逐步推送进度

    阶段：
    1. READ_NFO - 读取 NFO 视频信息
    2. SUBTITLE_OVERVIEW - 字幕概况分析
    3. AI_ANALYZE - AI 修正分析
    4. DONE - 完成，附带 issues 结果
    """
    from src.routers.local import find_video_dir
    from src.services.ai.nfo_reader import NFOReader

    video_dir = find_video_dir(request.video_id)

    async def event_stream():
        # ---- Stage 1: 读取 NFO ----
        nfo_info = {}
        try:
            # 在视频目录中找 NFO 文件
            nfo_file = None
            if video_dir:
                for candidate in video_dir.glob("*.nfo"):
                    nfo_file = candidate
                    break
            if nfo_file:
                nfo_result = NFOReader.read_t0_text(str(nfo_file))
                nfo_info = nfo_result.get("data", {})
                nfo_text = nfo_result.get("text", "")
            else:
                nfo_text = "未找到 NFO 文件"
        except Exception as e:
            nfo_text = f"读取 NFO 失败: {e}"

        yield f"data: {json.dumps({'stage': 'READ_NFO', 'status': 'completed', 'data': {'nfo_text': nfo_text, 'title': nfo_info.get('title', ''), 'studio': nfo_info.get('studio', ''), 'runtime': nfo_info.get('runtime', '')}}, ensure_ascii=False)}\n\n"
        await asyncio.sleep(0.1)

        # ---- Stage 2: 字幕概况 ----
        lines = request.content.strip().split("\n")
        subtitle_blocks = [b for b in request.content.strip().split("\n\n") if b.strip()]
        total_lines = len(lines)
        total_blocks = len(subtitle_blocks)

        # 统计字幕概况
        avg_text_len = 0
        if total_blocks > 0:
            text_lens = []
            for block in subtitle_blocks:
                parts = block.strip().split("\n")
                if len(parts) >= 3:
                    text_lens.append(len(parts[2]))
            avg_text_len = sum(text_lens) // len(text_lens) if text_lens else 0

        overview = f"共 {total_blocks} 条字幕，{total_lines} 行，平均每条 {avg_text_len} 字"
        yield f"data: {json.dumps({'stage': 'SUBTITLE_OVERVIEW', 'status': 'completed', 'data': {'overview': overview, 'total_blocks': total_blocks, 'total_lines': total_lines}}, ensure_ascii=False)}\n\n"
        await asyncio.sleep(0.1)

        # ---- Stage 3: AI 修正分析 ----
        yield f"data: {json.dumps({'stage': 'AI_ANALYZE', 'status': 'processing', 'data': {}}, ensure_ascii=False)}\n\n"

        try:
            result = await subtitle_analyzer.analyze(
                subtitle_content=request.content,
                model_provider=request.model_provider,
            )
            if result.get("success"):
                yield f"data: {json.dumps({'stage': 'DONE', 'status': 'completed', 'data': {'issues': result.get('issues', []), 'summary': result.get('summary', '')}}, ensure_ascii=False)}\n\n"
            else:
                yield f"data: {json.dumps({'stage': 'DONE', 'status': 'error', 'data': {'error': result.get('error', '分析失败')}}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'stage': 'DONE', 'status': 'error', 'data': {'error': str(e)}}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
