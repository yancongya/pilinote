from unittest.mock import MagicMock

from src.services.local_library_service import LocalLibraryService


def test_find_folder_metadata_reads_tvshow_nfo(tmp_path):
    folder = tmp_path / "系列标题"
    folder.mkdir()
    (folder / "tvshow.nfo").write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<tvshow>
  <title>系列标题</title>
  <plot>系列简介</plot>
  <studio>作者</studio>
  <thumb>https://example.com/cover.jpg</thumb>
  <bvid>BV1multi123</bvid>
</tvshow>
""",
        encoding="utf-8",
    )
    (folder / "cover.jpg").write_bytes(b"cover")
    (folder / "avatar.jpg").write_bytes(b"avatar")

    service = LocalLibraryService(MagicMock())

    metadata = service._find_folder_metadata(str(folder), folder.name)

    assert metadata["title"] == "系列标题"
    assert metadata["studio"] == "作者"
    assert metadata["cover"] == "https://example.com/cover.jpg"
    assert metadata["cover_path"] == str(folder / "cover.jpg")
    assert metadata["avatar_path"] == str(folder / "avatar.jpg")
    assert metadata["nfo_data"]["bvid"] == "BV1multi123"
