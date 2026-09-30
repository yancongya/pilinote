"""Pure pipeline mode and stage rules for AI note analysis."""

from typing import Any, Optional


PIPELINE_STAGES = {
    "video": (
        "AUDIO.FETCH",
        "SUBTITLE.GENERATE",
        "NFO.READ",
        "PROMPT.BUILD",
        "LLM.ANALYZE",
        "CONTENT.GENERATE",
    ),
    "series": (
        "AUDIO.FETCH",
        "SUBTITLE.GENERATE",
        "NFO.READ",
        "PROMPT.BUILD",
        "LLM.ANALYZE",
        "CONTENT.GENERATE",
    ),
    "image_text": (
        "DOC.READ",
        "NFO.READ",
        "PROMPT.BUILD",
        "LLM.ANALYZE",
        "CONTENT.GENERATE",
    ),
}
SEMANTIC_STAGES = PIPELINE_STAGES["video"]


def normalize_pipeline_mode(pipeline_mode: Optional[str]) -> str:
    """Return a supported pipeline mode, defaulting to video."""
    mode = (pipeline_mode or "").strip().lower()
    if mode in {"series", "image_text", "video"}:
        return mode
    return "video"


def infer_pipeline_mode(video_id: str, download: Optional[Any] = None) -> str:
    """Infer a pipeline from a video id and optional download-like object."""
    media_type = (getattr(download, "media_type", None) or "").strip().lower()
    source_type = (getattr(download, "source_type", None) or "").strip().lower()

    if media_type in {"opus", "opus_list", "user_opus"} or source_type == "opus":
        return "image_text"
    if media_type in {"bangumi", "lesson", "music_list"}:
        return "series"
    if video_id.startswith("cv"):
        return "image_text"
    return "video"


def trace_stage(pipeline_mode: str, stage: str) -> str:
    """Build the persisted stage identifier."""
    return f"{pipeline_mode}.{stage}"


def get_pipeline_stages(pipeline_mode: str) -> tuple[str, ...]:
    """Return the configured stages for a mode, using video stages as fallback."""
    return PIPELINE_STAGES.get(pipeline_mode, SEMANTIC_STAGES)


def stage_key(stage: str) -> str:
    """Normalize a bare or mode-qualified stage name to its bare form."""
    normalized = (stage or "").strip().upper()
    if not normalized:
        raise ValueError("resume_from_stage 不能为空")
    all_stages = {stage for stages in PIPELINE_STAGES.values() for stage in stages}
    if "." in normalized:
        suffix = normalized.split(".", 1)[-1]
        if suffix in all_stages:
            return suffix
    if normalized in all_stages:
        return normalized
    raise ValueError(f"未知阶段: {stage}")


def stage_index(stage: str) -> int:
    """Return the existing cross-pipeline ordinal for a stage."""
    key = stage_key(stage)
    for stages in PIPELINE_STAGES.values():
        if key in stages:
            return stages.index(key)
    raise ValueError(f"未知阶段: {stage}")
