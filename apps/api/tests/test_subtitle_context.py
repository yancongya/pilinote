import asyncio
import json
from pathlib import Path

from src.routers import ai_subtitle as ai_subtitle_router
from src.services.ai.subtitle_context import (
    build_video_context,
    collect_nfo_context,
    parse_srt_blocks,
)


def test_parse_srt_blocks_preserves_structure():
    content = (
        "1\n00:00:01,000 --> 00:00:03,000\n你好世界\n\n"
        "2\n00:00:03,500 --> 00:00:05,000\n第二条字幕\n"
    )

    blocks = parse_srt_blocks(content)

    assert len(blocks) == 2
    assert blocks[0]["index"] == 1
    assert blocks[0]["start_time"] == "00:00:01,000"
    assert blocks[0]["end_time"] == "00:00:03,000"
    assert blocks[0]["text"] == "你好世界"
    assert blocks[1]["index"] == 2


def test_build_video_context_reads_nfo_metadata(tmp_path: Path):
    video_dir = tmp_path / "video"
    video_dir.mkdir()
    (video_dir / "sample.nfo").write_text(
        """<movie>
<title>测试视频</title>
<showtitle>测试别名</showtitle>
<studio>测试UP主</studio>
<runtime>12</runtime>
<plot>简介内容</plot>
</movie>
""",
        encoding="utf-8",
    )

    context = build_video_context(video_dir)

    assert context["title"] == "测试视频"
    assert context["showtitle"] == "测试别名"
    assert context["studio"] == "测试UP主"
    assert context["runtime"] == "12"
    assert "sample.nfo" in context["nfo_files"]
    assert "测试视频" in context["nfo_text"]


def test_collect_nfo_context_prefers_parseable_nfo_and_lists_all_files(tmp_path: Path):
    video_dir = tmp_path / "video"
    video_dir.mkdir()
    (video_dir / "broken.nfo").write_text("<movie>", encoding="utf-8")
    (video_dir / "sample.nfo").write_text(
        """<movie>
<title>主标题</title>
<studio>主厂牌</studio>
<runtime>66</runtime>
</movie>
""",
        encoding="utf-8",
    )

    context = collect_nfo_context(video_dir)

    assert context["found"] is True
    assert context["title"] == "主标题"
    assert context["studio"] == "主厂牌"
    assert context["runtime"] == "66"
    assert context["nfo_files"] == ["broken.nfo", "sample.nfo"]
    assert context["nfo_path"].endswith("sample.nfo")


def test_pipeline_analyze_uses_context_helper_and_keeps_stage_names(
    monkeypatch, tmp_path: Path
):
    video_dir = tmp_path / "video"
    video_dir.mkdir()
    captured = {}

    def fake_find_video_dir(video_id: str):
        captured["video_id"] = video_id
        return video_dir

    def fake_build_video_context(resolved_dir):
        captured["video_dir"] = resolved_dir
        return {
            "title": "主标题",
            "showtitle": "别名",
            "studio": "主厂牌",
            "runtime": "66",
            "intro": "",
            "plot": "",
            "tags": [],
            "comments": [],
            "nfo_files": ["sample.nfo"],
            "nfo_text": "NFO 文本",
            "nfo_path": str(video_dir / "sample.nfo"),
            "raw": {},
            "found": True,
        }

    async def fake_analyze(**kwargs):
        captured["analyze_kwargs"] = kwargs
        return {"success": True, "issues": [], "summary": "ok"}

    monkeypatch.setattr("src.routers.local.find_video_dir", fake_find_video_dir)
    monkeypatch.setattr(ai_subtitle_router, "build_video_context", fake_build_video_context)
    monkeypatch.setattr(ai_subtitle_router.subtitle_analyzer, "analyze", fake_analyze)

    request = ai_subtitle_router.PipelineAnalyzeRequest(
        video_id="video-123",
        content="1\n00:00:01,000 --> 00:00:02,000\n第一句字幕",
    )

    async def run() -> str:
        response = await ai_subtitle_router.pipeline_analyze_subtitle(request)
        chunks = []
        async for chunk in response.body_iterator:
            if isinstance(chunk, bytes):
                chunks.append(chunk.decode("utf-8"))
            else:
                chunks.append(chunk)
        return "".join(chunks)

    stream_text = asyncio.run(run())
    events = [
        json.loads(part.removeprefix("data: ").strip())
        for part in stream_text.split("\n\n")
        if part.strip()
    ]

    assert [event["stage"] for event in events] == [
        "META",
        "READ_NFO",
        "SUBTITLE_OVERVIEW",
        "AI_ANALYZE",
        "DONE",
    ]
    assert captured["video_id"] == "video-123"
    assert captured["video_dir"] == video_dir
    assert captured["analyze_kwargs"]["video_context"]["title"] == "主标题"
    assert events[1]["data"]["nfo_files"] == ["sample.nfo"]
    assert events[4]["data"]["summary"] == "ok"


def test_pipeline_analyze_streams_batch_progress(
    monkeypatch, tmp_path: Path
):
    video_dir = tmp_path / "video"
    video_dir.mkdir()

    def fake_find_video_dir(video_id: str):
        return video_dir

    def fake_build_video_context(resolved_dir):
        return {
            "title": "主标题",
            "showtitle": "别名",
            "studio": "主厂牌",
            "runtime": "66",
            "intro": "",
            "plot": "",
            "tags": [],
            "comments": [],
            "nfo_files": ["sample.nfo"],
            "nfo_text": "NFO 文本",
            "nfo_path": str(video_dir / "sample.nfo"),
            "raw": {},
            "found": True,
        }

    async def fake_analyze(**kwargs):
        progress_callback = kwargs.get("progress_callback")
        if progress_callback:
            await progress_callback(
                {
                    "stage": "AI_ANALYZE",
                    "status": "processing",
                    "data": {
                        "phase": "batch_started",
                        "batch_index": 1,
                        "total_batches": 2,
                        "parsed_batches": 0,
                        "issues": 0,
                    },
                }
            )
            await progress_callback(
                {
                    "stage": "AI_ANALYZE",
                    "status": "processing",
                    "data": {
                        "phase": "batch_completed",
                        "batch_index": 1,
                        "total_batches": 2,
                        "parsed_batches": 1,
                        "issues": 1,
                    },
                }
            )
        return {"success": True, "issues": [], "summary": "ok"}

    monkeypatch.setattr("src.routers.local.find_video_dir", fake_find_video_dir)
    monkeypatch.setattr(ai_subtitle_router, "build_video_context", fake_build_video_context)
    monkeypatch.setattr(ai_subtitle_router.subtitle_analyzer, "analyze", fake_analyze)

    request = ai_subtitle_router.PipelineAnalyzeRequest(
        video_id="video-123",
        content="1\n00:00:01,000 --> 00:00:02,000\n第一句字幕\n\n2\n00:00:02,000 --> 00:00:03,000\n第二句字幕",
    )

    async def run() -> str:
        response = await ai_subtitle_router.pipeline_analyze_subtitle(request)
        chunks = []
        async for chunk in response.body_iterator:
            if isinstance(chunk, bytes):
                chunks.append(chunk.decode("utf-8"))
            else:
                chunks.append(chunk)
        return "".join(chunks)

    stream_text = asyncio.run(run())
    events = [
        json.loads(part.removeprefix("data: ").strip())
        for part in stream_text.split("\n\n")
        if part.strip()
    ]

    phases = [
        event["data"].get("phase")
        for event in events
        if event["stage"] == "AI_ANALYZE" and event["status"] == "processing"
    ]

    assert "batch_started" in phases
    assert "batch_completed" in phases
