from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from src.schemas.local_asr_models import (
    LocalASRModelActionRequest,
    LocalASRModelActionResponse,
    LocalASRModelListResponse,
    LocalASRModelProgressResponse,
    LocalASRReadinessResponse,
)
from src.services.ai.local_asr_model_service import (
    LocalASRModelNotReadyError,
    get_local_asr_model_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai/asr", tags=["ai-asr-models"])


@router.get("/models", response_model=LocalASRModelListResponse)
async def list_models():
    service = get_local_asr_model_service()
    return service.to_list_response()


@router.get("/readiness", response_model=LocalASRReadinessResponse)
async def readiness():
    service = get_local_asr_model_service()
    return service.to_readiness_response()


@router.get("/models/{model_id}/progress", response_model=LocalASRModelProgressResponse)
async def model_progress(model_id: str):
    service = get_local_asr_model_service()
    try:
        return LocalASRModelProgressResponse(model=service.get_progress(model_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/models/{model_id}/download", response_model=LocalASRModelActionResponse)
async def download_model(model_id: str):
    service = get_local_asr_model_service()
    try:
        model = service.download_model(model_id)
        return LocalASRModelActionResponse(
            message="已开始下载本地 ASR 模型",
            model=model,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/models/active", response_model=LocalASRModelActionResponse)
async def set_active_model(request: LocalASRModelActionRequest):
    service = get_local_asr_model_service()
    try:
        model = service.set_active_model(request.model_id)
        return LocalASRModelActionResponse(
            message="已切换激活模型",
            model=model,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/models/{model_id}", response_model=LocalASRModelActionResponse)
async def delete_cached_model(model_id: str):
    service = get_local_asr_model_service()
    try:
        model = service.delete_cached_model(model_id)
        return LocalASRModelActionResponse(
            message="已删除本地模型缓存",
            model=model,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/models/{model_id}", response_model=LocalASRModelActionResponse)
async def get_model(model_id: str):
    service = get_local_asr_model_service()
    try:
        model = service.get_model(model_id)
        return LocalASRModelActionResponse(
            message="ok",
            model=model,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

