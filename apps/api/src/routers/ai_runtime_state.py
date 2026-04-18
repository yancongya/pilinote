from __future__ import annotations

from fastapi import APIRouter

from src.services.ai.ai_runtime_state_service import get_ai_runtime_state_service

router = APIRouter(prefix="/api/ai/runtime-state", tags=["ai-runtime-state"])


@router.get("")
async def get_runtime_state():
    service = get_ai_runtime_state_service()
    return {
        "success": True,
        "state": service.get_state(),
    }
