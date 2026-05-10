"""Shared helpers for enriching and generating NFO metadata."""
import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)


async def attach_video_comments(
    bilibili_service: Any,
    meta: Dict[str, Any],
    sessdata: str = "",
) -> None:
    """Attach top comments to video NFO metadata when they are not already present."""
    if not isinstance(meta, dict) or meta.get("comments"):
        return

    aid = meta.get("aid")
    if not aid:
        return

    try:
        comments_result = await bilibili_service.get_video_comments(int(aid), sessdata or "")
        if comments_result.get("success"):
            comments = (comments_result.get("data") or {}).get("comments") or []
            if comments:
                meta["comments"] = comments
                logger.info("NFO metadata attached comments: %s", len(comments))
    except Exception as exc:
        logger.warning("获取评论数据失败，继续生成NFO: %s", exc)


def generate_video_nfo(meta: Dict[str, Any]) -> str:
    """Generate video NFO content through the single video NFO implementation."""
    from src.services.queue.handlers.nfo import SingleNfoHandler

    return SingleNfoHandler()._generate_nfo(meta)
