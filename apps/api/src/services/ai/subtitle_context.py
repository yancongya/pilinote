from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.services.ai.nfo_reader import NFOReader

logger = logging.getLogger(__name__)

_SRT_TIME_LINE_RE = re.compile(r"^\s*(?P<start>.+?)\s*-->\s*(?P<end>.+?)(?:\s+.*)?$")


def _resolve_video_dir(video_dir: Path | str | None) -> Optional[Path]:
    if video_dir is None:
        return None

    path = Path(video_dir)
    if path.is_file():
        return path.parent
    if path.is_dir():
        return path
    return None


def find_nfo_files(video_dir: Path | str | None) -> List[Path]:
    """Find local NFO files in a video directory in a stable order."""
    directory = _resolve_video_dir(video_dir)
    if not directory:
        return []

    nfo_files = [
        item
        for item in directory.iterdir()
        if item.is_file() and item.suffix.lower() == ".nfo"
    ]
    return sorted(nfo_files, key=lambda item: (item.name.lower(), item.name))


def parse_srt_blocks(content: str) -> List[Dict[str, Any]]:
    """Parse SRT content into stable subtitle blocks."""
    content = content.strip()
    if not content:
        return []

    blocks: List[Dict[str, Any]] = []
    raw_blocks = [block for block in re.split(r"\r?\n\s*\r?\n", content) if block.strip()]

    for fallback_index, raw_block in enumerate(raw_blocks, start=1):
        lines = [line.rstrip("\r") for line in raw_block.splitlines()]
        if not lines:
            continue

        index = fallback_index
        line_cursor = 0

        first_line = lines[0].strip("\ufeff").strip()
        if first_line.isdigit():
            index = int(first_line)
            line_cursor = 1

        time_line_index: Optional[int] = None
        for idx in range(line_cursor, len(lines)):
            if "-->" in lines[idx]:
                time_line_index = idx
                break

        start_time = ""
        end_time = ""
        text_start = line_cursor

        if time_line_index is not None:
            time_line = lines[time_line_index].strip()
            match = _SRT_TIME_LINE_RE.match(time_line)
            if match:
                start_time = match.group("start").strip()
                end_time = match.group("end").strip()
            else:
                parts = [part.strip() for part in time_line.split("-->", 1)]
                start_time = parts[0] if parts else ""
                end_time = parts[1] if len(parts) > 1 else ""
            text_start = time_line_index + 1
        elif line_cursor == 0:
            text_start = 0

        text_lines = lines[text_start:]
        text = "\n".join(text_lines).strip()

        blocks.append(
            {
                "index": index,
                "start_time": start_time,
                "end_time": end_time,
                "text": text,
                "original_text": text,
                "raw_text": raw_block,
                "raw": raw_block,
            }
        )

    return blocks


def _empty_nfo_context(message: str, nfo_files: List[Path]) -> Dict[str, Any]:
    return {
        "title": "",
        "showtitle": "",
        "studio": "",
        "runtime": "",
        "intro": "",
        "plot": "",
        "tags": [],
        "comments": [],
        "nfo_files": [item.name for item in nfo_files],
        "nfo_text": message,
        "nfo_path": "",
        "raw": {},
        "found": False,
    }


def collect_nfo_context(video_dir: Path | str | None) -> Dict[str, Any]:
    """Collect NFO metadata for subtitle analysis."""
    nfo_files = find_nfo_files(video_dir)
    if not nfo_files:
        return _empty_nfo_context("当前视频目录没有找到 NFO 文件。", [])

    for nfo_file in nfo_files:
        try:
            data = NFOReader._parse_nfo_file(nfo_file)  # noqa: SLF001 - shared parsing helper
        except Exception as exc:  # pragma: no cover - defensive guard
            logger.warning("读取 NFO 失败: %s - %s", nfo_file, exc)
            continue

        if not data:
            continue

        title = (data.get("title") or data.get("showtitle") or "").strip()
        showtitle = (data.get("showtitle") or data.get("title") or "").strip()

        return {
            "title": title,
            "showtitle": showtitle,
            "studio": (data.get("studio") or "").strip(),
            "runtime": (data.get("runtime") or "").strip(),
            "intro": (data.get("intro") or "").strip(),
            "plot": (data.get("plot") or "").strip(),
            "tags": data.get("tags", []) or [],
            "comments": data.get("comments", []) or [],
            "nfo_files": [item.name for item in nfo_files],
            "nfo_text": NFOReader._build_t0_text(data),  # noqa: SLF001 - shared rendering helper
            "nfo_path": str(nfo_file),
            "raw": data,
            "found": True,
        }

    return _empty_nfo_context("NFO 文件存在，但解析失败。", nfo_files)


def build_video_context(video_dir: Path | str | None) -> Dict[str, Any]:
    """Backward-compatible alias for the subtitle analysis router."""
    return collect_nfo_context(video_dir)
