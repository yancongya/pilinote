"""Compatibility imports for the canonical prompt template service."""

from src.services.prompt_template_service import (
    PromptTemplateService,
    get_prompt_template_service,
)

__all__ = ["PromptTemplateService", "get_prompt_template_service"]
