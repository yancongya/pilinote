import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
from types import SimpleNamespace

from fastapi import APIRouter
from fastapi.testclient import TestClient
import pytest
from starlette.websockets import WebSocketDisconnect


APP_PATH = Path(__file__).resolve().parents[1] / "readonly_acceptance.py"


@pytest.fixture
def acceptance(monkeypatch):
    spec = importlib.util.spec_from_file_location("acceptance_app_test", APP_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with tempfile.TemporaryDirectory(prefix="pilinote-readonly-") as directory:
        runtime = Path(directory).resolve()
        for name in ("data", "logs", "downloads", "temp"):
            (runtime / name).mkdir()
        database = runtime / "data" / "pilinote.db"
        connection = sqlite3.connect(database)
        connection.execute("create table sample (value text)")
        connection.close()
        monkeypatch.chdir(runtime)
        monkeypatch.setenv("PILINOTE_RUNTIME_DIR", str(runtime))
        monkeypatch.setenv("PILINOTE_ACCEPTANCE_MODE", "1")
        monkeypatch.setenv("DATABASE_URL", f"sqlite:///file:{database.as_posix()}?mode=ro&uri=true")
        for variable, name in (("PILINOTE_LOG_DIR", "logs"), ("PILINOTE_DOWNLOAD_PATH", "downloads"), ("PILINOTE_TEMP_PATH", "temp")):
            monkeypatch.setenv(variable, str(runtime / name))
        yield module, runtime


def test_environment_fails_closed(acceptance, monkeypatch):
    module, runtime = acceptance
    assert module.validate_environment() == runtime
    monkeypatch.setenv("PILINOTE_ACCEPTANCE_MODE", "0")
    with pytest.raises(RuntimeError):
        module.validate_environment()


@pytest.mark.parametrize("variable", ["DATABASE_URL", "PILINOTE_LOG_DIR", "PILINOTE_DOWNLOAD_PATH", "PILINOTE_TEMP_PATH"])
def test_unsafe_paths_rejected(acceptance, monkeypatch, variable):
    module, _ = acceptance
    monkeypatch.setenv(variable, "/original-data")
    with pytest.raises(RuntimeError):
        module.validate_environment()


def test_registry_resume_rejected(acceptance):
    module, runtime = acceptance
    (runtime / "data" / "local_asr_models.json").write_text("{}")
    with pytest.raises(RuntimeError):
        module.validate_environment()


def test_only_selected_get_handlers_registered(acceptance, monkeypatch):
    module, runtime = acceptance
    imports = []
    calls = []

    async def handler():
        calls.append(True)
        return {"success": True}

    def fake_import(name):
        imports.append(name)
        router = APIRouter()
        for path in module.READ_ROUTES[name.split(".")[-1]]:
            router.add_api_route(path, handler, methods=["GET"])
            router.add_api_route(path, handler, methods=["POST"])
        router.add_api_route("/api/video-library/refresh", handler, methods=["GET"])
        return SimpleNamespace(router=router)

    monkeypatch.setattr(module.importlib, "import_module", fake_import)
    monkeypatch.setattr(module.logging, "disable", lambda level: None)
    app = module.create_app()
    with TestClient(app) as client:
        assert client.get("/health").json()["background_tasks"] is False
        assert client.get("/api/auth/status").status_code == 200
        previous_calls = len(calls)
        for method in ("post", "put", "patch", "delete"):
            assert getattr(client, method)("/api/auth/status").status_code == 403
        for path in ("/api/video-library/refresh", "/api/queue/tasks", "/api/local/versions/by-path", "/api/auth/accounts/1/credentials"):
            assert client.get(path).status_code == 403
        assert client.get("/api/local/file/BV123", params={"file_type": "note"}).status_code == 200
        assert client.get("/api/local/file/BV123", params={"filename": "../secret"}).status_code == 403
        assert client.get("/api/local/file/BV123", params={"file_type": "other"}).status_code == 403
        assert client.get("/api/local/file//original/video.mp4", params={"file_type": "note"}).status_code == 403
        assert len(calls) == previous_calls + 1
        with pytest.raises(WebSocketDisconnect) as websocket_error:
            with client.websocket_connect("/ws/queue"):
                pass
        assert getattr(websocket_error.value, "code", None) == 1008
    assert all(name.startswith("src.routers.") for name in imports)
    assert "main" not in imports
    assert not (runtime / "data" / "local_asr_models.json").exists()


def test_sqlite_snapshot_rejects_writes(acceptance):
    _, runtime = acceptance
    database = runtime / "data" / "pilinote.db"
    connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    try:
        with pytest.raises(sqlite3.OperationalError, match="readonly"):
            connection.execute("insert into sample values ('change')")
    finally:
        connection.close()
