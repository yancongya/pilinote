import os
import sys
import asyncio
from pathlib import Path


project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
apps_api_path = os.path.join(project_root, "apps", "api")
sys.path.insert(0, apps_api_path)

from src.services.nfo_update_service import NFOUpdateService  # type: ignore


def test_update_single_nfo_supports_opus(monkeypatch, tmp_path: Path):
    nfo_path = tmp_path / "示例图文.nfo"
    nfo_path.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<movie>
  <opus_id>cv123456</opus_id>
  <title>旧标题</title>
</movie>
""",
        encoding="utf-8",
    )

    service = NFOUpdateService()

    async def fake_get_opus_details(opus_id: str, sessdata: str = ""):
        assert opus_id == "123456"
        return {
            "success": True,
            "data": {
                "id": "123456",
                "title": "新图文标题",
                "paragraphs": [],
                "image_urls": ["https://i0.hdslb.com/bfs/opus/example.jpg"],
                "author": {
                    "name": "作者A",
                    "mid": 42,
                },
                "stat": {
                    "like": {"count": 12},
                    "comment": {"count": 3},
                    "forward": {"count": 4},
                    "favorite": {"count": 5},
                    "coin": {"count": 6},
                },
                "basic": {},
            },
        }

    monkeypatch.setattr(service.bilibili_service, "get_opus_details", fake_get_opus_details)

    result = asyncio.run(service.update_single_nfo(str(nfo_path)))

    assert result["success"] is True
    updated_content = nfo_path.read_text(encoding="utf-8")
    assert "<opus_id>cv123456</opus_id>" in updated_content
    assert "<title>新图文标题</title>" in updated_content
    assert "<studio>作者A</studio>" in updated_content
    assert "<like>12</like>" in updated_content


def test_parse_nfo_file_reads_opus_id(tmp_path: Path):
    nfo_path = tmp_path / "示例图文.nfo"
    nfo_path.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<movie>
  <opus_id>cv999</opus_id>
  <title>示例图文</title>
</movie>
""",
        encoding="utf-8",
    )

    service = NFOUpdateService()
    parsed = service._parse_nfo_file(str(nfo_path))

    assert parsed["opus_id"] == "cv999"
    assert parsed["title"] == "示例图文"
