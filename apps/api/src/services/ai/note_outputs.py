import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict


logger = logging.getLogger(__name__)
SERIES_MEMORY_FILENAME = "series.ai-note.memory.json"


def safe_read_json(path: Path) -> Dict[str, Any]:
    try:
        if not path.exists():
            return {}
        raw = path.read_text(encoding="utf-8")
        if not raw.strip():
            return {}
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def compact_markdown_for_memory(markdown: str) -> str:
    if not markdown:
        return ""
    lines = [line.rstrip() for line in markdown.splitlines()]
    picked = []
    for line in lines:
        if line.startswith("#"):
            picked.append(line)
        elif line.lstrip().startswith(("-", "*")) and len(picked) < 40:
            picked.append(line)
        if len(picked) >= 50:
            break
    compact = "\n".join(picked).strip()
    return compact[:4000]


def _resolve_output_parts(source_path: str, note_id: str) -> tuple[Path, str]:
    source_file = Path(source_path)
    output_dir = source_file.parent if source_file.parent.exists() else Path.cwd()
    output_dir.mkdir(parents=True, exist_ok=True)
    base_name = source_file.stem
    if base_name.endswith(".ai-note"):
        base_name = base_name[: -len(".ai-note")]
    if not base_name or source_file.name.startswith("."):
        base_name = source_file.parent.name or note_id
    return output_dir, base_name


def write_markdown_output(source_path: str, note_id: str, markdown: str) -> str:
    output_dir, base_name = _resolve_output_parts(source_path, note_id)
    output_path = output_dir / f"{base_name}.ai-note.md"
    output_path.write_text(markdown, encoding="utf-8")
    return str(output_path)


def resolve_index_path(source_path: str, note_id: str) -> Path:
    output_dir, base_name = _resolve_output_parts(source_path, note_id)
    return output_dir / f"{base_name}.ai-note.index.json"


def read_note_index_output(
    index_path: Path, read_json: Callable[[Path], Dict[str, Any]] = safe_read_json
) -> Dict[str, Any]:
    return read_json(index_path)


def write_note_index_output(
    index_path: Path,
    source_path: str,
    note_id: str,
    metadata: Dict[str, Any],
) -> str:
    payload = {
        "schema": 1,
        "note_id": note_id,
        "source_path": str(source_path),
        "markdown_path": str(metadata["markdown_path"]),
        "input_fingerprint": metadata["input_fingerprint"],
        "cache_fingerprint": metadata["cache_fingerprint"],
        "pipeline_mode": metadata["pipeline_mode"],
        "style": metadata["style"],
        "formats": list(metadata.get("formats") or []),
        "model_provider": metadata["model_provider"],
        "model_name": metadata["model_name"],
        "extras": metadata.get("extras") or "",
        "transcript_language": metadata.get("transcript_language") or "",
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }
    index_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return str(index_path)


def resolve_series_root(video_path: str, downloads_root: str) -> Path:
    video_file = Path(video_path)
    start = video_file.parent if video_file.is_file() else video_file
    root_path = Path(downloads_root)
    current = start
    best = start
    while True:
        if current.name.startswith("系列-") or (current / "tvshow.nfo").exists():
            best = current
        if current == root_path or current.parent == current:
            break
        if root_path in current.parents:
            current = current.parent
            continue
        break
    return best


def read_series_memory(
    series_root: Path, read_json: Callable[[Path], Dict[str, Any]] = safe_read_json
) -> str:
    payload = read_json(series_root / SERIES_MEMORY_FILENAME)
    memory = payload.get("memory_text") if isinstance(payload, dict) else ""
    return str(memory or "").strip()


def update_series_memory(
    series_root: Path,
    note_id: str,
    markdown: str,
    read_json: Callable[[Path], Dict[str, Any]] = safe_read_json,
    compact_markdown: Callable[[str], str] = compact_markdown_for_memory,
) -> str:
    memory_path = series_root / SERIES_MEMORY_FILENAME
    payload = read_json(memory_path)
    previous = str(payload.get("memory_text") or "").strip()
    delta = compact_markdown(markdown)
    if not delta:
        return str(memory_path)
    merged = (previous + "\n\n" + delta).strip() if previous else delta
    merged = merged[:6000]
    output = {
        "schema": 1,
        "series_root": str(series_root),
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "updated_by_note_id": note_id,
        "memory_text": merged,
    }
    try:
        memory_path.write_text(
            json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except Exception as exc:
        logger.warning("Failed to write series memory: %s", exc)
    return str(memory_path)
