from fastapi import APIRouter, Query, Body, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional

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
