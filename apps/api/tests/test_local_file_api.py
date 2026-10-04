from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.routers import local as local_router


def _build_client(monkeypatch, video_dir):
    app = FastAPI()
    app.include_router(local_router.router)
    monkeypatch.setattr(local_router, "find_video_dir", lambda video_id: video_dir)
    return TestClient(app)


def test_get_local_note_file_returns_content_and_paths(tmp_path, monkeypatch):
    video_dir = tmp_path / "video_001"
    video_dir.mkdir()
    note_file = video_dir / "sample.ai-note.md"
    note_file.write_text("# 标题\n\n内容", encoding="utf-8")

    client = _build_client(monkeypatch, video_dir)
    response = client.get("/api/local/file/bv1?file_type=note")

    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "data": "# 标题\n\n内容",
        "error": None,
        "file_path": str(note_file),
        "folder_path": str(video_dir),
    }


def test_get_local_note_file_returns_empty_content_when_missing(tmp_path, monkeypatch):
    video_dir = tmp_path / "video_002"
    video_dir.mkdir()

    client = _build_client(monkeypatch, video_dir)
    response = client.get("/api/local/file/bv2?file_type=note")

    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "data": "",
        "error": None,
        "file_path": None,
        "folder_path": str(video_dir),
    }


def test_get_local_subtitle_file_keeps_existing_content_response(tmp_path, monkeypatch):
    video_dir = tmp_path / "video_003"
    video_dir.mkdir()
    subtitle_file = video_dir / "demo.srt"
    subtitle_file.write_text("1\n00:00:00,000 --> 00:00:01,000\n你好", encoding="utf-8")

    client = _build_client(monkeypatch, video_dir)
    response = client.get("/api/local/file/bv3?file_type=subtitle&filename=demo.srt")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"] == "1\n00:00:00,000 --> 00:00:01,000\n你好"
    assert payload["error"] is None
