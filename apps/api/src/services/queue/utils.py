from typing import Any, Optional

from src.services.media_processor import media_processor
from src.utils.bilibili_utils import MediaType


def _to_int(value: Any) -> Optional[int]:
    try:
        if value in (None, ""):
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _normalize_text(value: Any) -> str:
    return str(value or "").strip().casefold()


async def resolve_video_part_context(media_id: str, meta: Optional[dict] = None) -> dict:
    """Resolve stable aid/pages/cid information for a Bilibili video task.

    `get_video_info()` in the current codebase returns compact data without `pages`.
    For download/post-processing we need a reliable part list, so use
    `media_processor.get_media_info()` as the canonical source.
    """
    if not media_id:
        return {
            "aid": None,
            "part_count": 0,
            "pages": [],
            "matched": None,
        }

    result = await media_processor.get_media_info(
        media_id=media_id,
        media_type=MediaType.VIDEO,
    )
    if not result.get("success"):
        return {
            "aid": None,
            "part_count": 0,
            "pages": [],
            "matched": None,
        }

    media = result.get("data")
    items = list(getattr(media, "list", []) or [])
    pages: list[dict] = []
    for index, item in enumerate(items, start=1):
        pages.append(
            {
                "page": index,
                "cid": _to_int(getattr(item, "cid", None)),
                "part": getattr(item, "title", "") or f"P{index}",
                "duration": getattr(item, "duration", 0) or 0,
                "aid": _to_int(getattr(item, "aid", None)),
            }
        )

    aid = next((page["aid"] for page in pages if page.get("aid")), None)
    incoming_meta = meta if isinstance(meta, dict) else {}
    incoming_cid = _to_int(incoming_meta.get("cid"))
    incoming_page = _to_int(incoming_meta.get("page"))
    incoming_part_title = _normalize_text(incoming_meta.get("part_title"))

    matched = None
    if incoming_cid is not None:
        matched = next((page for page in pages if page.get("cid") == incoming_cid), None)

    if matched is None and incoming_part_title:
        matched = next(
            (page for page in pages if _normalize_text(page.get("part")) == incoming_part_title),
            None,
        )

    if matched is None and incoming_page is not None and 1 <= incoming_page <= len(pages):
        matched = pages[incoming_page - 1]

    if matched is None and len(pages) == 1:
        matched = pages[0]

    return {
        "aid": aid,
        "part_count": len(pages),
        "pages": pages,
        "matched": matched,
    }
