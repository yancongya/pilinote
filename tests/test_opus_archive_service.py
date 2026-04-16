import os
import sys
from pathlib import Path


project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
apps_api_path = os.path.join(project_root, "apps", "api")
sys.path.insert(0, apps_api_path)

from src.services.opus_archive_service import (  # type: ignore
    build_local_image_filename,
    render_opus_markdown,
)
from src.services.video_library_service import VideoLibraryService  # type: ignore


def test_build_local_image_filename_prefers_url_basename_and_deduplicates():
    used_names = set()

    first = build_local_image_filename(
        "https://i0.hdslb.com/bfs/new_dyn/example-card.png@800w.webp",
        used_names,
        1,
    )
    second = build_local_image_filename(
        "https://i0.hdslb.com/bfs/new_dyn/example-card.png@400w.webp",
        used_names,
        2,
    )

    assert first == "example-card.png"
    assert second == "example-card-2.png"


def test_render_opus_markdown_uses_local_images_and_keeps_text_paragraphs():
    markdown = render_opus_markdown(
        title="测试图文",
        paragraphs=[
            {
                "para_type": 1,
                "text": {
                    "nodes": [
                        {
                            "word": {
                                "words": "第一段正文",
                            }
                        }
                    ]
                },
            },
            {
                "para_type": 2,
                "pic": {
                    "pics": [
                        {"url": "https://i0.hdslb.com/bfs/opus/a.png"},
                        {"url": "https://i0.hdslb.com/bfs/opus/b.webp"},
                    ]
                },
            },
        ],
        image_filename_map={
            "https://i0.hdslb.com/bfs/opus/a.png": "images/a.png",
            "https://i0.hdslb.com/bfs/opus/b.webp": "images/b.webp",
        },
    )

    assert "# 测试图文" in markdown
    assert "第一段正文" in markdown
    assert "![图文图片 1](images/a.png)" in markdown
    assert "![图文图片 2](images/b.webp)" in markdown
    assert "https://i0.hdslb.com" not in markdown


def test_get_local_opus_content_looks_up_folder_by_opus_id(tmp_path: Path):
    folder = tmp_path / "示例图文"
    folder.mkdir()
    (folder / "示例图文.nfo").write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<movie>
  <opus_id>cv123456</opus_id>
  <title>示例图文</title>
</movie>
""",
        encoding="utf-8",
    )
    (folder / "示例图文.md").write_text("# 示例图文\n\n正文", encoding="utf-8")
    (folder / "avatar.jpg").write_bytes(b"avatar")
    (folder / "cover.jpg").write_bytes(b"cover")

    class FakeLocalLibraryService:
        def scan_library(self):
            class Result:
                folders = [
                    {
                        "name": "示例图文",
                        "title": "示例图文",
                        "path": str(folder),
                        "markdown_path": str(folder / "示例图文.md"),
                        "cover_path": str(folder / "cover.jpg"),
                        "avatar_path": str(folder / "avatar.jpg"),
                        "nfo_data": {
                            "opus_id": "cv123456",
                            "title": "示例图文",
                        },
                    }
                ]

            return Result()

    service = VideoLibraryService(db=None)
    service.local_library = FakeLocalLibraryService()

    result = service.get_local_opus_content("cv123456")

    assert result["opus_id"] == "cv123456"
    assert result["title"] == "示例图文"
    assert result["markdown_content"] == "# 示例图文\n\n正文"
    assert result["markdown_path"] == str(folder / "示例图文.md")
    assert result["cover_path"] == str(folder / "cover.jpg")
    assert result["avatar_path"] == str(folder / "avatar.jpg")
