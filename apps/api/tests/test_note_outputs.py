import importlib.util
import json
from pathlib import Path

import pytest


MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "services"
    / "ai"
    / "note_outputs.py"
)


def load_note_outputs():
    spec = importlib.util.spec_from_file_location("note_outputs", MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载模块: {MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


note_outputs = load_note_outputs()


def test_writes_markdown_text_and_preserves_output_names(tmp_path):
    source = tmp_path / "episode.mp4"
    source.write_bytes(b"")

    output_path = Path(
        note_outputs.write_markdown_output(str(source), "note-1", "# 标题\n正文")
    )
    deduplicated_path = Path(
        note_outputs.write_markdown_output(
            str(tmp_path / "episode.ai-note.md"), "note-1", "更新"
        )
    )

    assert output_path == tmp_path / "episode.ai-note.md"
    assert output_path.read_text(encoding="utf-8") == "更新"
    assert deduplicated_path == output_path


def test_resolves_hidden_and_missing_parent_paths(tmp_path, monkeypatch):
    hidden_dir = tmp_path / "series"
    hidden_dir.mkdir()
    monkeypatch.chdir(tmp_path)

    hidden_path = note_outputs.resolve_index_path(str(hidden_dir / ".video"), "note-2")
    missing_path = note_outputs.resolve_index_path(
        str(tmp_path / "missing" / "episode.mp4"), "note-3"
    )

    assert hidden_path == hidden_dir / "series.ai-note.index.json"
    assert missing_path == tmp_path / "episode.ai-note.index.json"


def test_index_round_trip_replaces_existing_payload(tmp_path):
    source = tmp_path / "episode.mp4"
    source.write_bytes(b"")
    index_path = note_outputs.resolve_index_path(str(source), "note-1")
    index_path.write_text('{"legacy": true}', encoding="utf-8")
    metadata = {
        "markdown_path": str(tmp_path / "episode.ai-note.md"),
        "input_fingerprint": "input",
        "cache_fingerprint": "cache",
        "pipeline_mode": "series",
        "style": "detailed",
        "formats": ["summary", "summary"],
        "model_provider": "provider",
        "model_name": "model",
        "extras": None,
        "transcript_language": "zh",
    }

    written_path = note_outputs.write_note_index_output(
        index_path, str(source), "note-1", metadata
    )
    payload = note_outputs.read_note_index_output(index_path)

    assert written_path == str(index_path)
    assert "legacy" not in payload
    assert payload["schema"] == 1
    assert payload["formats"] == ["summary", "summary"]
    assert payload["extras"] == ""
    assert payload["transcript_language"] == "zh"
    assert payload["updated_at"].endswith("Z")


def test_safe_read_json_returns_empty_for_bad_or_non_object_json(tmp_path):
    path = tmp_path / "payload.json"
    path.write_text("{bad", encoding="utf-8")
    assert note_outputs.safe_read_json(path) == {}

    path.write_text('["value"]', encoding="utf-8")
    assert note_outputs.safe_read_json(path) == {}
    assert note_outputs.safe_read_json(tmp_path / "missing.json") == {}


def test_series_root_memory_merge_and_bad_json_recovery(tmp_path):
    downloads_root = tmp_path / "downloads"
    series_root = downloads_root / "系列-测试"
    episode_dir = series_root / "第1集"
    episode_dir.mkdir(parents=True)
    video_path = episode_dir / "video.mp4"
    video_path.write_bytes(b"")
    memory_path = series_root / note_outputs.SERIES_MEMORY_FILENAME
    memory_path.write_text("{bad", encoding="utf-8")

    assert note_outputs.resolve_series_root(
        str(video_path), str(downloads_root)
    ) == series_root
    assert (
        note_outputs.read_series_memory(series_root) == ""
    )

    note_outputs.update_series_memory(
        series_root, "note-1", "# 第一集\n正文\n- 要点一"
    )
    note_outputs.update_series_memory(
        series_root, "note-2", "# 第二集\n* 要点二"
    )

    assert note_outputs.read_series_memory(series_root) == "# 第一集\n- 要点一\n\n# 第二集\n* 要点二"
    payload = json.loads(memory_path.read_text(encoding="utf-8"))
    assert payload["updated_by_note_id"] == "note-2"
    assert payload["series_root"] == str(series_root)


def test_memory_compaction_limits_lines_and_text_length():
    markdown = "\n".join(
        [
            "普通正文",
            *[f"- 要点 {index}" for index in range(45)],
            *[f"# 标题 {index}" for index in range(20)],
        ]
    )
    compact = note_outputs.compact_markdown_for_memory(markdown)

    assert "普通正文" not in compact
    assert "- 要点 39" in compact
    assert "- 要点 40" not in compact
    assert len(compact.splitlines()) == 50
    assert (
        len(note_outputs.compact_markdown_for_memory("#" + "长" * 5000)) == 4000
    )


def test_series_memory_truncates_merged_text_at_existing_limit(tmp_path):
    downloads_root = tmp_path / "downloads"
    series_root = downloads_root / "series"
    series_root.mkdir(parents=True)
    (series_root / "tvshow.nfo").write_text("", encoding="utf-8")
    video_path = series_root / "video.mp4"
    video_path.write_bytes(b"")
    memory_path = series_root / note_outputs.SERIES_MEMORY_FILENAME
    memory_path.write_text(
        json.dumps({"memory_text": "旧" * 5995}, ensure_ascii=False),
        encoding="utf-8",
    )

    note_outputs.update_series_memory(
        series_root, "note-1", "# 新内容"
    )
    memory = note_outputs.read_series_memory(series_root)

    assert len(memory) == 6000
    assert memory.endswith("\n\n# 新")


def test_missing_source_uses_existing_parent_and_missing_parent_uses_cwd(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    existing_parent = tmp_path / "existing"
    existing_parent.mkdir()
    source_without_file = existing_parent / "episode.mp4"
    assert not source_without_file.exists()

    markdown_path = note_outputs.write_markdown_output(
        str(source_without_file), "note-1", "# Note"
    )
    index_path = note_outputs.resolve_index_path(
        str(tmp_path / "absent" / "other.mp4"), "note-2"
    )

    assert markdown_path == str(existing_parent / "episode.ai-note.md")
    assert index_path == tmp_path / "other.ai-note.index.json"
    assert not (tmp_path / "absent").exists()


def test_output_resolver_calls_mkdir_on_selected_directory(tmp_path, monkeypatch):
    source = tmp_path / "missing.mp4"
    original_mkdir = Path.mkdir
    created = []

    def record_mkdir(path, *args, **kwargs):
        created.append((path, kwargs))
        return original_mkdir(path, *args, **kwargs)

    monkeypatch.setattr(Path, "mkdir", record_mkdir)
    note_outputs.resolve_index_path(str(source), "note-1")

    assert (tmp_path, {"parents": True, "exist_ok": True}) in created


def test_markdown_and_index_write_errors_propagate(tmp_path, monkeypatch):
    source = tmp_path / "episode.mp4"
    index_path = tmp_path / "episode.ai-note.index.json"
    original_write = Path.write_text

    def fail_output_writes(path, *args, **kwargs):
        if path.name in {"episode.ai-note.md", "episode.ai-note.index.json"}:
            raise OSError("write denied")
        return original_write(path, *args, **kwargs)

    monkeypatch.setattr(Path, "write_text", fail_output_writes)
    with pytest.raises(OSError, match="write denied"):
        note_outputs.write_markdown_output(str(source), "note-1", "# Note")
    with pytest.raises(OSError, match="write denied"):
        note_outputs.write_note_index_output(
            index_path,
            str(source),
            "note-1",
            {
                "markdown_path": "note.md",
                "input_fingerprint": "input",
                "cache_fingerprint": "cache",
                "pipeline_mode": "single",
                "style": "default",
                "model_provider": "provider",
                "model_name": "model",
            },
        )


def test_empty_series_delta_does_not_write_and_reads_first(tmp_path, monkeypatch):
    memory_path = tmp_path / note_outputs.SERIES_MEMORY_FILENAME
    memory_path.write_text('{"memory_text": "unchanged"}', encoding="utf-8")
    original_write = Path.write_text
    calls = []

    def record_write(path, *args, **kwargs):
        if path == memory_path:
            calls.append(path)
        return original_write(path, *args, **kwargs)

    def read_memory(path):
        calls.append("read")
        return note_outputs.safe_read_json(path)

    def compact_memory(markdown):
        calls.append("compact")
        return ""

    monkeypatch.setattr(Path, "write_text", record_write)
    result = note_outputs.update_series_memory(
        tmp_path, "note-1", "body only", read_memory, compact_memory
    )

    assert result == str(memory_path)
    assert calls == ["read", "compact"]
    assert note_outputs.read_series_memory(tmp_path) == "unchanged"


def test_series_memory_write_error_is_logged_and_returns_path(tmp_path, monkeypatch, caplog):
    memory_path = tmp_path / note_outputs.SERIES_MEMORY_FILENAME
    original_write = Path.write_text

    def fail_memory_write(path, *args, **kwargs):
        if path == memory_path:
            raise OSError("write denied")
        return original_write(path, *args, **kwargs)

    monkeypatch.setattr(Path, "write_text", fail_memory_write)
    result = note_outputs.update_series_memory(tmp_path, "note-1", "# New")

    assert result == str(memory_path)
    assert not memory_path.exists()
    assert "Failed to write series memory: write denied" in caplog.text


def test_series_root_nested_markers_choose_outer_and_stop_at_downloads(tmp_path):
    downloads_root = tmp_path / "downloads"
    outer = downloads_root / "系列-outer"
    inner = outer / "系列-inner"
    episode = inner / "episode"
    episode.mkdir(parents=True)
    video = episode / "video.mp4"
    video.write_bytes(b"")
    (downloads_root / "tvshow.nfo").write_text("", encoding="utf-8")

    assert note_outputs.resolve_series_root(str(video), str(downloads_root)) == downloads_root
    (downloads_root / "tvshow.nfo").unlink()
    assert note_outputs.resolve_series_root(str(video), str(downloads_root)) == outer


def test_series_root_nfo_only_and_outside_downloads(tmp_path):
    downloads_root = tmp_path / "downloads"
    series_root = downloads_root / "plain-series"
    episode = series_root / "episode"
    episode.mkdir(parents=True)
    (series_root / "tvshow.nfo").write_text("", encoding="utf-8")
    video = episode / "video.mp4"
    video.write_bytes(b"")

    outside = tmp_path / "outside" / "episode"
    outside.mkdir(parents=True)
    outside_video = outside / "video.mp4"
    outside_video.write_bytes(b"")
    (outside.parent / "tvshow.nfo").write_text("", encoding="utf-8")

    assert note_outputs.resolve_series_root(str(video), str(downloads_root)) == series_root
    assert note_outputs.resolve_series_root(str(outside_video), str(downloads_root)) == outside
