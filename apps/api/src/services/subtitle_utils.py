"""Pure helpers for selecting and formatting Bilibili subtitles."""

import json
from datetime import timedelta
from typing import Any


def extract_subtitle_url(subtitle: dict[str, Any]) -> str:
    """Extract a subtitle URL while accepting the field variants used by APIs."""
    for key in ("subtitle_url", "subtitleUrl", "url", "subtitleURL"):
        value = subtitle.get(key)
        if value:
            return value
    return ""


def classify_subtitle_source(subtitle: dict[str, Any]) -> str:
    """Normalize a subtitle source to ``user``, ``ai``, or ``unknown``."""
    lan = (subtitle.get("lan") or "").lower()
    lan_doc = (subtitle.get("lan_doc") or "").lower()
    subtitle_url = extract_subtitle_url(subtitle).lower()
    ai_type = subtitle.get("ai_type")
    type_value = subtitle.get("type")
    is_lock = subtitle.get("is_lock")

    if "aisubtitle.hdslb.com" in subtitle_url:
        return "ai"
    if (
        lan.startswith("ai-")
        or "自动生成" in lan_doc
        or ai_type is not None
        or type_value == 1
    ):
        return "ai"
    if is_lock is False:
        return "user"
    if is_lock is True:
        return "user"
    return "unknown"


def subtitle_source_priority(subtitle: dict[str, Any]) -> int:
    """Return the source rank: user first, then AI, then unknown."""
    source = classify_subtitle_source(subtitle)
    if source == "user":
        return 0
    if source == "ai":
        return 1
    return 2


def normalize_subtitle_language(subtitle: dict[str, Any]) -> str:
    """Normalize subtitle language values for matching and file names."""
    lan = subtitle.get("lan") or ""
    lan_lower = lan.lower()
    if lan_lower in {"ai-zh", "ai-hans", "ai-zh-cn", "ai-zh-hans"}:
        return "zh-CN"
    if lan_lower in {"ai-en", "ai-en-us", "ai-en-gb"}:
        return "en-US"
    if lan_lower in {"zh", "zh-cn", "zh-hans", "zh-hant", "zh-sg", "zh-tw"}:
        return "zh-CN" if "hant" not in lan_lower and "tw" not in lan_lower else "zh-TW"
    if lan_lower in {"en", "en-us", "en-gb", "en-au"}:
        return "en-US"
    return lan or "unknown"


def get_subtitle_candidates(
    subtitles: list[dict[str, Any]], target_languages: list[str]
) -> list[dict[str, Any]]:
    """Select one preferred subtitle per requested language, in request order."""
    normalized_targets: list[str] = []
    for language in target_languages:
        normalized = normalize_subtitle_language({"lan": language})
        if normalized not in normalized_targets:
            normalized_targets.append(normalized)

    chosen: dict[str, dict[str, Any]] = {}
    for subtitle in subtitles:
        if not extract_subtitle_url(subtitle):
            continue

        language = normalize_subtitle_language(subtitle)
        if language not in normalized_targets:
            continue

        candidate = {
            "raw": subtitle,
            "language": language,
            "source": classify_subtitle_source(subtitle),
        }
        existing = chosen.get(language)
        if existing is None or subtitle_source_priority(
            subtitle
        ) < subtitle_source_priority(existing["raw"]):
            chosen[language] = candidate

    return [chosen[language] for language in normalized_targets if language in chosen]


def format_srt_timestamp(seconds: float) -> str:
    """Convert seconds to the SRT timestamp representation used by downloads."""
    td = timedelta(seconds=seconds)
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    milliseconds = int((td.total_seconds() - total_seconds) * 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


def convert_bilibili_subtitle_to_srt(subtitle_data: dict[str, Any]) -> str:
    """Convert Bilibili's subtitle JSON payload to SRT."""
    body = subtitle_data.get("body", [])
    if not body:
        return ""

    srt_lines: list[str] = []
    for index, line in enumerate(body, start=1):
        srt_lines.extend(
            [
                str(index),
                f"{format_srt_timestamp(line.get('from', 0))} --> {format_srt_timestamp(line.get('to', 0))}",
                line.get("content", "").strip(),
                "",
            ]
        )
    return "\n".join(srt_lines)


def ms_to_srt_time(milliseconds: float) -> str:
    """Convert milliseconds to an SRT timestamp."""
    seconds = milliseconds / 1000
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def convert_json3_to_srt(content: str) -> str:
    """Convert a JSON3 subtitle payload to SRT, preserving non-JSON input."""
    try:
        data = json.loads(content)
    except BaseException:
        return content

    body = data.get("body", [])
    if not body:
        return content

    lines = []
    for index, item in enumerate(body, 1):
        start = ms_to_srt_time(item.get("from", 0))
        end = ms_to_srt_time(item.get("to", 0))
        text = item.get("content", "").strip()
        lines.append(f"{index}\n{start} --> {end}\n{text}\n")
    return "\n".join(lines)
