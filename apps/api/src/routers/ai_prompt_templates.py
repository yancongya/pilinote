from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.services.prompt_template_service import get_prompt_template_service

router = APIRouter(prefix="/api/ai/prompt-templates", tags=["ai-prompt-templates"])


class PromptTemplatesResponse(BaseModel):
    success: bool = True
    templates: Dict[str, Any]


class PromptTemplatesUpdateRequest(BaseModel):
    templates: Dict[str, Any] = Field(default_factory=dict)


@router.get("", response_model=PromptTemplatesResponse)
async def get_prompt_templates():
    try:
        service = get_prompt_template_service()
        return PromptTemplatesResponse(success=True, templates=service.get_templates())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get prompt templates: {exc}")


@router.get("/defaults", response_model=PromptTemplatesResponse)
async def get_default_prompt_templates():
    try:
        service = get_prompt_template_service()
        return PromptTemplatesResponse(success=True, templates=service.get_default_templates())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get default prompt templates: {exc}")


@router.get("/override", response_model=PromptTemplatesResponse)
async def get_override_prompt_templates():
    try:
        service = get_prompt_template_service()
        return PromptTemplatesResponse(success=True, templates=service.get_override_templates())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get override prompt templates: {exc}")


@router.put("")
async def save_prompt_templates(payload: PromptTemplatesUpdateRequest):
    try:
        service = get_prompt_template_service()
        service.save_templates(payload.templates)
        return {"success": True, "message": "Prompt templates saved successfully"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save prompt templates: {exc}")


@router.post("/reset")
async def reset_prompt_templates():
    try:
        service = get_prompt_template_service()
        service.reset_templates()
        return {"success": True, "message": "Prompt templates reset successfully"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to reset prompt templates: {exc}")
