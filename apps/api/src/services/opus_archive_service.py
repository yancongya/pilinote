import mimetypes
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import unquote, urlparse


def normalize_opus_id(opus_id: str) -> str:
    raw = (opus_id or "").strip()
    if not raw:
        return ""
    if raw.lower().startswith("cv"):
        return f"cv{raw[2:]}"
    return f"cv{raw}"


def sanitize_filename_component(value: str, fallback: str = "file") -> str:
    text = re.sub(r'[\\/:*?"<>|]+', "_", (value or "").strip())
    text = re.sub(r"\s+", " ", text).strip(" .")
    return text or fallback


def _guess_extension_from_url(url: str) -> str:
    parsed = urlparse(url)
    path = unquote(parsed.path or "")
    suffix = Path(path).suffix.lower()

    if suffix and len(suffix) <= 6:
        return suffix

    mime_type, _ = mimetypes.guess_type(path)
    if mime_type:
        guessed = mimetypes.guess_extension(mime_type)
        if guessed:
            return guessed

    return ".jpg"


def build_local_image_filename(url: str, used_names: set[str], index: int) -> str:
    parsed = urlparse(url)
    raw_name = unquote(Path(parsed.path or "").name)
    raw_name = raw_name.split("@", 1)[0].split("?", 1)[0]
    stem = sanitize_filename_component(Path(raw_name).stem, fallback=f"image-{index}")
    suffix = Path(raw_name).suffix.lower()

    if not suffix or len(suffix) > 6:
        suffix = _guess_extension_from_url(url)

    candidate = f"{stem}{suffix}"
    dedupe_index = 2
    while candidate in used_names:
        candidate = f"{stem}-{dedupe_index}{suffix}"
        dedupe_index += 1

    used_names.add(candidate)
    return candidate


def _extract_text_from_paragraph(paragraph: Dict[str, Any]) -> str:
    nodes = ((paragraph or {}).get("text") or {}).get("nodes") or []
    words: List[str] = []
    for node in nodes:
        word = (node or {}).get("word") or {}
        content = word.get("words")
        if content:
            words.append(str(content))
    return "".join(words).strip()


def render_opus_markdown(
    title: str,
    paragraphs: Iterable[Dict[str, Any]],
    image_filename_map: Dict[str, str],
) -> str:
    lines: List[str] = [f"# {title or '未命名图文'}", ""]
    image_counter = 1

    for paragraph in paragraphs or []:
        para_type = paragraph.get("para_type")
        if para_type == 1:
            text = _extract_text_from_paragraph(paragraph)
            if text:
                lines.append(text)
                lines.append("")
            continue

        if para_type == 2:
            pics = ((paragraph.get("pic") or {}).get("pics")) or []
            for pic in pics:
                url = pic.get("url")
                local_path = image_filename_map.get(url or "")
                if not local_path:
                    continue
                lines.append(f"![图文图片 {image_counter}]({local_path})")
                lines.append("")
                image_counter += 1

    while lines and not lines[-1].strip():
        lines.pop()

    return "\n".join(lines) + "\n"


def build_opus_meta(task_media_id: str, opus_data: Dict[str, Any]) -> Dict[str, Any]:
    author = opus_data.get("author", {}) or {}
    stat = opus_data.get("stat", {}) or {}
    basic = opus_data.get("basic", {}) or {}
    normalized_id = normalize_opus_id(task_media_id or str(opus_data.get("id", "")))
    image_urls = opus_data.get("image_urls", []) or []
    first_image = image_urls[0] if image_urls else ""

    return {
        "type": "opus",
        "opus_id": normalized_id,
        "title": opus_data.get("title") or "未命名图文",
        "desc": "",
        "paragraphs": opus_data.get("paragraphs", []) or [],
        "image_urls": image_urls,
        "pic": first_image,
        "author": {
            "name": author.get("name", "") or basic.get("name", ""),
            "mid": author.get("mid", 0),
            "avatar": author.get("avatar_url", ""),
        },
        "owner": {
            "name": author.get("name", "") or basic.get("name", ""),
            "mid": author.get("mid", 0),
            "face": author.get("avatar_url", ""),
        },
        "stat": {
            "like": stat.get("like", 0),
            "reply": stat.get("reply", 0),
            "share": stat.get("share", 0),
            "favorite": stat.get("favorite", 0),
            "coin": stat.get("coin", 0),
        },
        "pubdate": opus_data.get("pubdate", 0),
    }


def generate_opus_nfo(meta: Dict[str, Any]) -> str:
    def esc(value: Optional[Any]) -> str:
        text = "" if value is None else str(value)
        return (
            text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&apos;")
        )

    stat = meta.get("stat", {}) or {}
    author = meta.get("author", {}) or {}

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<movie>",
        f"  <opus_id>{esc(meta.get('opus_id'))}</opus_id>",
        f"  <title>{esc(meta.get('title'))}</title>",
        f"  <plot>{esc(meta.get('desc'))}</plot>",
        f"  <studio>{esc(author.get('name'))}</studio>",
    ]

    if meta.get("pubdate"):
        try:
            published = datetime.fromtimestamp(int(meta.get("pubdate"))).strftime("%Y-%m-%d")
        except Exception:
            published = str(meta.get("pubdate"))
        lines.append(f"  <premiered>{esc(published)}</premiered>")

    if meta.get("pic"):
        lines.append(f"  <thumb>{esc(meta.get('pic'))}</thumb>")

    lines.extend(
        [
            "  <statistics>",
            f"    <like>{stat.get('like', 0)}</like>",
            f"    <reply>{stat.get('reply', 0)}</reply>",
            f"    <share>{stat.get('share', 0)}</share>",
            f"    <favorite>{stat.get('favorite', 0)}</favorite>",
            f"    <coin>{stat.get('coin', 0)}</coin>",
            "  </statistics>",
            "</movie>",
        ]
    )
    return "\n".join(lines)
