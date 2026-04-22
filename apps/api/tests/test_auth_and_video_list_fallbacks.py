from types import SimpleNamespace

from fastapi.testclient import TestClient

from main import app
from src.database import get_db
from src.routers import auth as auth_router
from src.routers import favorites as favorites_router
from src.routers import watchlater as watchlater_router
from src.services.cache.video_cache import VideoCacheService, video_cache


class _FakeQuery:
    def __init__(self, user):
        self._user = user

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._user


class _FakeDB:
    def __init__(self, user):
        self._user = user

    def query(self, *args, **kwargs):
        return _FakeQuery(self._user)

    def close(self):
        return None


class _FakeCookieManager:
    def __init__(self, cookies):
        self._cookies = cookies

    def get_cookies(self):
        return dict(self._cookies)


class _FakeHeadersManager:
    def __init__(self, cookies):
        self.cookie_manager = _FakeCookieManager(cookies)

    async def sync_cookies_from_db(self, user_id):
        return {"success": True, "loaded_count": 1}


class _FailingAuthService:
    async def get_user_info(self, sessdata):
        return {"success": False, "message": "temporary upstream failure"}

    def close(self):
        return None


class _FailingListService:
    def __init__(self, message="temporary upstream failure"):
        self._message = message

    async def get_folder_list(self, sessdata, up_mid, page, page_size):
        return {"success": False, "message": self._message}

    async def get_watch_later(self, sessdata):
        return {"success": False, "message": self._message}

    def close(self):
        return None


def _build_test_client(monkeypatch, fake_user, fake_headers_manager):
    app.dependency_overrides[get_db] = lambda: _FakeDB(fake_user)
    monkeypatch.setattr(auth_router, "BilibiliService", lambda: _FailingAuthService())
    monkeypatch.setattr(
        "src.services.headers_manager.get_headers_manager",
        lambda: fake_headers_manager,
    )
    return TestClient(app)


def test_auth_status_keeps_logged_in_when_verification_fails(monkeypatch):
    fake_user = SimpleNamespace(
        id=1,
        mid=100881808,
        username="烟囱鸭",
        avatar="https://example.com/avatar.jpg",
        sessdata="sessdata-token-for-auth-status",
    )
    fake_headers_manager = _FakeHeadersManager({"SESSDATA": fake_user.sessdata})

    client = _build_test_client(monkeypatch, fake_user, fake_headers_manager)
    try:
        response = client.get("/api/auth/status")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["is_logged_in"] is True
    assert "登录状态待验证" in payload["message"]
    assert payload["user"]["mid"] == fake_user.mid


def test_favorites_folders_returns_cached_data_when_upstream_fails(monkeypatch):
    fake_user = SimpleNamespace(
        id=1,
        mid=100881808,
        username="烟囱鸭",
        avatar="https://example.com/avatar.jpg",
        sessdata="sessdata-token-for-favorites-cache",
    )
    cache_service = VideoCacheService()
    cached_response = {
        "success": True,
        "data": [
            {
                "id": 1,
                "title": "缓存收藏夹",
                "media_count": 3,
                "cover": "",
                "intro": "",
                "favorite_state": False,
            }
        ],
        "total": 1,
    }
    cache_service.set("favorites", cached_response, user_id=fake_user.mid, page=99)

    app.dependency_overrides[get_db] = lambda: _FakeDB(fake_user)
    monkeypatch.setattr(
        favorites_router,
        "BilibiliService",
        lambda: _FailingListService("favorites upstream failed"),
    )
    client = TestClient(app)

    try:
        response = client.get("/api/favorites/folders?page=99&page_size=20")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"][0]["title"] == "缓存收藏夹"


def test_watchlater_list_returns_cached_data_when_upstream_fails(monkeypatch):
    fake_sessdata = "sessdata-token-for-watchlater-cache"
    fake_user = SimpleNamespace(
        id=1,
        mid=100881808,
        username="烟囱鸭",
        avatar="https://example.com/avatar.jpg",
        sessdata=fake_sessdata,
    )
    cached_raw = {
        "list": [
            {
                "aid": 1,
                "bvid": "BV1cached",
                "title": "缓存稍后再看",
                "pic": "https://example.com/cover.jpg",
                "duration": 120,
                "pubdate": 1710000000,
                "owner": {
                    "mid": 2,
                    "name": "UP主",
                    "face": "https://example.com/face.jpg",
                },
                "stat": {
                    "view": 100,
                    "danmaku": 2,
                    "reply": 3,
                    "like": 4,
                    "coin": 5,
                    "favorite": 6,
                    "share": 7,
                },
                "progress": 30,
                "add_at": 1710001000,
            }
        ],
        "count": 1,
    }
    video_cache.set(
        "watch_later",
        {"success": True, "data": cached_raw},
        user_id=fake_sessdata[:20],
    )

    app.dependency_overrides[get_db] = lambda: _FakeDB(fake_user)
    monkeypatch.setattr(
        watchlater_router,
        "BilibiliService",
        lambda: _FailingListService("watchlater upstream failed"),
    )
    client = TestClient(app)

    try:
        response = client.get("/api/watch-later/list?pn=1&ps=20")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["list"][0]["title"] == "缓存稍后再看"
