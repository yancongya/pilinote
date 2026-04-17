import asyncio

import pytest

from src.services.download_service import DownloadService
from src.services.queue.handlers.subtitle import SubtitleHandler
from src.models.download import Download


def test_subtitle_handler_downloads_real_subtitle(monkeypatch, tmp_path):
    async def fake_download_preferred_subtitles(self, download, output_dir):
        output_path = output_dir / "Sample.zh-CN.user.srt"
        output_path.write_text(
            "1\n00:00:00,000 --> 00:00:01,000\n真实字幕\n",
            encoding="utf-8",
        )
        return {"downloaded": 1, "attempted": 1, "languages": ["zh-CN:user"]}

    monkeypatch.setattr(
        DownloadService,
        "_download_preferred_subtitles",
        fake_download_preferred_subtitles,
    )

    handler = SubtitleHandler()
    asyncio.run(
        handler.handle(
            {"bvid": "BV1test", "filename": "Sample.zh.srt"},
            tmp_path / "temp",
            tmp_path / "output",
            {"title": "Sample", "aid": 123, "cid": 456},
        )
    )

    subtitle_file = tmp_path / "output" / "Sample.zh-CN.user.srt"
    assert subtitle_file.exists()
    assert "真实字幕" in subtitle_file.read_text(encoding="utf-8")
    assert not (tmp_path / "output" / "Sample.zh.srt").exists()


def test_download_service_downloads_real_subtitle(monkeypatch, tmp_path):
    from src.services import download_service as download_service_module
    from src.services.bilibili import BilibiliService

    async def fake_get_player_info(self, aid, cid, sessdata=""):
        return {
            "success": True,
            "data": {
                "subtitle": {
                    "subtitles": [
                        {
                            "lan": "zh-CN",
                            "lan_doc": "中文",
                            "subtitle_url": "//example.com/subtitle.json",
                            "is_lock": False,
                        }
                    ]
                }
            },
        }

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "body": [
                    {
                        "from": 0,
                        "to": 1,
                        "content": "真实字幕",
                    }
                ]
            }

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url):
            return FakeResponse()

    monkeypatch.setattr(BilibiliService, "get_player_info_public", fake_get_player_info)
    monkeypatch.setattr(download_service_module.httpx, "AsyncClient", FakeAsyncClient)

    download = Download(
        id="download-test-1",
        bvid="BV1test",
        title="Sample",
        aid=123,
        cid=456,
        sessdata="sessdata",
    )

    (tmp_path / "Sample.mp4").write_bytes(b"video")

    result = asyncio.run(
        DownloadService()._download_preferred_subtitles(download, tmp_path)
    )

    subtitle_file = tmp_path / "Sample.zh-CN.user.srt"
    assert result["downloaded"] == 1
    assert result["attempted"] == 1
    assert subtitle_file.exists()
    assert "真实字幕" in subtitle_file.read_text(encoding="utf-8")


def test_download_service_downloads_ai_subtitle(monkeypatch, tmp_path):
    from src.services import download_service as download_service_module
    from src.services.bilibili import BilibiliService

    async def fake_get_player_info(self, aid, cid, sessdata=""):
        return {
            "success": True,
            "data": {
                "subtitle": {
                    "subtitles": [
                        {
                            "lan": "zh-Hans",
                            "lan_doc": "中文（自动生成）",
                            "subtitle_url": "//example.com/ai-subtitle.json",
                            "is_lock": False,
                            "type": 1,
                            "ai_type": 0,
                            "ai_status": 2,
                        }
                    ]
                }
            },
        }

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "body": [
                    {
                        "from": 0,
                        "to": 1,
                        "content": "AI 字幕内容",
                    }
                ]
            }

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url):
            return FakeResponse()

    monkeypatch.setattr(BilibiliService, "get_player_info_public", fake_get_player_info)
    monkeypatch.setattr(download_service_module.httpx, "AsyncClient", FakeAsyncClient)

    download = Download(
        id="download-test-ai",
        bvid="BV1testAI",
        title="Sample AI",
        aid=123,
        cid=456,
        sessdata="sessdata",
    )

    (tmp_path / "Sample AI.mp4").write_bytes(b"video")

    result = asyncio.run(
        DownloadService()._download_preferred_subtitles(download, tmp_path)
    )

    subtitle_file = tmp_path / "Sample AI.zh-CN.ai.srt"
    assert result["downloaded"] == 1
    assert result["attempted"] == 1
    assert subtitle_file.exists()
    assert "AI 字幕内容" in subtitle_file.read_text(encoding="utf-8")


def test_subtitle_handler_recovers_missing_aid_cid(monkeypatch, tmp_path):
    from src.services.bilibili import BilibiliService

    async def fake_get_video_info(self, bvid, sessdata=""):
        return {
            "success": True,
            "data": {
                "aid": 999,
                "title": "Recovered Title",
                "pages": [{"cid": 888}],
            },
        }

    async def fake_download_preferred_subtitles(self, download, output_dir):
        output_path = output_dir / "Recovered Title.zh-CN.user.srt"
        output_path.write_text(
            "1\n00:00:00,000 --> 00:00:01,000\n恢复字幕\n",
            encoding="utf-8",
        )
        return {"downloaded": 1, "attempted": 1, "languages": ["zh-CN:user"]}

    monkeypatch.setattr(BilibiliService, "get_video_info", fake_get_video_info)
    monkeypatch.setattr(
        DownloadService,
        "_download_preferred_subtitles",
        fake_download_preferred_subtitles,
    )

    handler = SubtitleHandler()
    asyncio.run(
        handler.handle(
            {"bvid": "BV1recover"},
            tmp_path / "temp",
            tmp_path / "output",
            {"title": "Recovered Title"},
        )
    )

    subtitle_file = tmp_path / "output" / "Recovered Title.zh-CN.user.srt"
    assert subtitle_file.exists()
    assert "恢复字幕" in subtitle_file.read_text(encoding="utf-8")


def test_get_player_info_falls_back_to_public_api(monkeypatch):
    from src.services.bilibili import BilibiliService

    class FakeResponse:
        def __init__(self, status_code, payload):
            self.status_code = status_code
            self._payload = payload

        def json(self):
            return self._payload

    async def fake_get_headers():
        return {}

    async def fake_update_cookie(name, value):
        return None

    async def fake_request(self, method, url, **kwargs):
        if "nav" in url:
            return FakeResponse(200, {"code": 0, "data": {"img_url": "a", "sub_url": "b"}})
        if "x/player/wbi/v2" in url:
            return FakeResponse(412, {"code": -412, "message": "request was banned"})
        if "x/player/v2" in url:
            return FakeResponse(
                200,
                {
                    "code": 0,
                    "data": {
                        "subtitle": {
                            "allow_submit": False,
                            "subtitles": [
                                {
                                    "lan": "zh-CN",
                                    "lan_doc": "中文",
                                    "subtitle_url": "//example.com/subtitle.json",
                                    "is_lock": False,
                                }
                            ],
                        }
                    },
                },
            )
        raise AssertionError(f"Unexpected URL: {url}")

    service = BilibiliService()
    monkeypatch.setattr(service.headers_manager, "get_headers", fake_get_headers)
    monkeypatch.setattr(service.headers_manager, "update_cookie", fake_update_cookie)
    monkeypatch.setattr(service, "_request", fake_request.__get__(service, BilibiliService))

    result = asyncio.run(service.get_player_info(123, 456, "sessdata"))

    assert result["success"] is True
    assert result["data"]["subtitle"]["subtitles"][0]["lan"] == "zh-CN"


def test_download_service_skips_subtitles_without_url(monkeypatch, tmp_path):
    from src.services.bilibili import BilibiliService

    async def fake_get_player_info(self, aid, cid, sessdata=""):
        return {
            "success": True,
            "data": {
                "subtitle": {
                    "subtitles": [
                        {
                            "lan": "zh",
                            "lan_doc": "中文",
                            "subtitle_url": "",
                            "is_lock": False,
                            "type": 0,
                        }
                    ]
                }
            },
        }

    monkeypatch.setattr(BilibiliService, "get_player_info_public", fake_get_player_info)

    download = Download(
        id="download-test-2",
        bvid="BV1test2",
        title="Sample",
        aid=123,
        cid=456,
        sessdata="sessdata",
    )

    result = asyncio.run(
        DownloadService()._download_preferred_subtitles(download, tmp_path)
    )

    assert result["downloaded"] == 0
    assert result["attempted"] == 0
    assert result.get("skipped_no_url", 0) == 0
    assert not list(tmp_path.glob("*.srt"))


def test_download_service_keeps_only_zh_and_en_subtitles(monkeypatch, tmp_path):
    from src.services import download_service as download_service_module
    from src.services.bilibili import BilibiliService

    async def fake_get_player_info_public(self, aid, cid, sessdata=""):
        subtitles = [
            {
                "lan": "ai-zh",
                "lan_doc": "中文",
                "subtitle_url": "//example.com/ai-zh.json",
                "is_lock": False,
                "type": 1,
                "ai_type": 0,
                "ai_status": 2,
            },
            {
                "lan": "ai-en",
                "lan_doc": "English",
                "subtitle_url": "//example.com/ai-en.json",
                "is_lock": False,
                "type": 1,
                "ai_type": 1,
                "ai_status": 2,
            },
            {
                "lan": "ai-ja",
                "lan_doc": "日本語",
                "subtitle_url": "//example.com/ai-ja.json",
                "is_lock": False,
                "type": 1,
                "ai_type": 1,
                "ai_status": 2,
            },
        ]

        return {
            "success": True,
            "data": {
                "subtitle": {
                    "subtitles": subtitles,
                }
            },
        }

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "body": [
                    {
                        "from": 0,
                        "to": 1,
                        "content": "字幕内容",
                    }
                ]
            }

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url):
            return FakeResponse()

    monkeypatch.setattr(BilibiliService, "get_player_info_public", fake_get_player_info_public)
    monkeypatch.setattr(download_service_module.httpx, "AsyncClient", FakeAsyncClient)

    download = Download(
        id="download-test-multi-ai",
        bvid="BV1testMulti",
        title="Sample Multi AI",
        aid=123,
        cid=456,
        sessdata="sessdata",
    )

    (tmp_path / "Sample Multi AI.mp4").write_bytes(b"video")

    result = asyncio.run(
        DownloadService()._download_preferred_subtitles(download, tmp_path)
    )

    assert result["downloaded"] == 2
    assert result["attempted"] == 2
    assert len(list(tmp_path.glob("*.srt"))) == 2
    assert (tmp_path / "Sample Multi AI.zh-CN.ai.srt").exists()
    assert (tmp_path / "Sample Multi AI.en-US.ai.1.srt").exists()


def test_official_ai_subtitle_regression_path(tmp_path):
    """
    真实回归测试：
    - 从数据库加载当前登录 cookies
    - 通过公开视频播放器接口拿到官方 AI 字幕
    - 下载并转换为 SRT，验证链路没有退化
    """

    from src.services.headers_manager import get_headers_manager
    from src.services.headers_manager import HeadersManager, init_headers
    import src.services.headers_manager as headers_manager_module
    from src.database import SessionLocal
    from src.models.user import User
    import importlib
    import httpx

    async def run():
        bvid = "BV1WrQ5BGEEN"
        aid = 116406465075374
        cid = 37516150221

        download_service = DownloadService()
        with SessionLocal() as db:
            active_user = db.query(User).filter(User.is_active.is_(True)).first()

        assert active_user is not None, "数据库里没有可用的 active user"

        importlib.reload(httpx)
        HeadersManager._instance = None
        headers_manager_module._headers_manager = None
        init_result = await init_headers()
        assert init_result["success"] is True

        headers_manager = get_headers_manager()
        sessdata = headers_manager.cookie_manager.get_cookie("SESSDATA")
        assert sessdata, "数据库里未加载到 SESSDATA，无法验证官方 AI 字幕链路"

        output_dir = tmp_path / "output"
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / f"{bvid}.mp4").write_bytes(b"video")

        result = await download_service._download_preferred_subtitles(
            Download(
                id="subtitle-regression-test",
                bvid=bvid,
                title="Official AI Subtitle Regression",
                aid=aid,
                cid=cid,
                sessdata=sessdata,
            ),
            output_dir,
        )

        assert result["downloaded"] == 2
        assert result["attempted"] >= 2
        assert "zh-CN:ai" in result["languages"]
        assert "en-US:ai" in result["languages"]

        srt_files = list(output_dir.glob("*.srt"))
        assert len(srt_files) == 2
        assert (output_dir / "BV1WrQ5BGEEN.zh-CN.ai.srt").exists()
        assert (output_dir / "BV1WrQ5BGEEN.en-US.ai.1.srt").exists()

    asyncio.run(run())
