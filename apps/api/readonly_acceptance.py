import importlib
import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.routing import Match


READ_ROUTES = {
    "auth": {"/api/auth/status", "/api/auth/accounts"},
    "favorites": {"/api/favorites/folders", "/api/favorites/folders/{folder_id}", "/api/favorites/collected"},
    "history": {"/api/history/list"},
    "watchlater": {"/api/watch-later/list"},
    "video": {"/api/video/{video_id}"},
    "settings": {"/api/settings/"},
    "local": {"/api/local/file/{video_id:path}"},
    "versions": {"/api/local/versions/by-path/subtitle-files", "/api/local/versions/subtitle-files/{video_id}"},
    "ai_runtime_state": {"/api/ai/runtime-state"},
    "note": {"/api/note/by-video", "/api/note/{note_id}"},
    "video_library": {"/api/video-library/playback/{bvid}", "/api/video-library/opus/{opus_id}/content"},
}


def validate_environment() -> Path:
    runtime = Path(os.environ.get("PILINOTE_RUNTIME_DIR", "")).resolve()
    api_root = Path(__file__).resolve().parent
    database = runtime / "data" / "pilinote.db"
    expected_url = f"sqlite:///file:{database.as_posix()}?mode=ro&uri=true"
    if (
        os.environ.get("PILINOTE_ACCEPTANCE_MODE") != "1"
        or not runtime.name.startswith("pilinote-readonly-")
        or runtime.is_relative_to(api_root.parent.parent)
        or Path.cwd().resolve() != runtime
        or not database.is_file()
        or database.is_symlink()
        or not database.resolve().is_relative_to(runtime)
        or os.environ.get("DATABASE_URL") != expected_url
    ):
        raise RuntimeError("Use scripts/run_readonly_acceptance.py with an isolated database snapshot")
    for variable, directory in (
        ("PILINOTE_LOG_DIR", "logs"),
        ("PILINOTE_DOWNLOAD_PATH", "downloads"),
        ("PILINOTE_TEMP_PATH", "temp"),
    ):
        if Path(os.environ.get(variable, "")).resolve() != runtime / directory:
            raise RuntimeError(f"Unsafe acceptance directory: {variable}")
    if (runtime / "data" / "local_asr_models.json").exists():
        raise RuntimeError("Acceptance must not restore ASR model state")
    return runtime


class ReadOnlyGate:
    def __init__(self, app, routes, runtime: Path):
        self.app = app
        self.routes = routes
        self.runtime = runtime

    async def __call__(self, scope, receive, send):
        if scope["type"] == "websocket":
            await send({"type": "websocket.close", "code": 1008})
            return
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        allowed = scope["method"] == "GET"
        selected_scope = None
        if allowed:
            for route in self.routes:
                match, child_scope = route.matches(scope)
                if match == Match.FULL:
                    selected_scope = child_scope
                    break
            allowed = selected_scope is not None
        if allowed and scope["path"].startswith("/api/local/"):
            from starlette.requests import Request

            request = Request(scope)
            video_id = selected_scope.get("path_params", {}).get("video_id") or request.query_params.get("video_id", "")
            filename = request.query_params.get("filename")
            file_type = request.query_params.get("file_type")
            candidate = Path(video_id).expanduser()
            if candidate.exists() or candidate.is_absolute() or "/" in video_id or "\\" in video_id or video_id in {".", ".."}:
                allowed = candidate.resolve().is_relative_to(self.runtime / "downloads")
            if filename and (Path(filename).name != filename or "\\" in filename or filename in {".", ".."}):
                allowed = False
            if file_type and file_type not in {"note", "source", "subtitle"}:
                allowed = False
        if not allowed:
            response = JSONResponse({"detail": "Read-only acceptance: operation blocked"}, status_code=403)
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)


def create_app() -> FastAPI:
    runtime = validate_environment()
    logging.disable(logging.CRITICAL)
    app = FastAPI(title="PiliNote read-only acceptance", docs_url=None, redoc_url=None, openapi_url=None)

    @app.get("/health")
    async def health():
        return {"status": "healthy", "mode": "readonly-acceptance", "database": "snapshot", "background_tasks": False}

    for module_name, paths in READ_ROUTES.items():
        module = importlib.import_module(f"src.routers.{module_name}")
        for route in module.router.routes:
            if route.path in paths and route.methods == {"GET"}:
                app.router.routes.append(route)
    app.add_middleware(ReadOnlyGate, routes=list(app.routes), runtime=runtime)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5178", "http://localhost:5178"],
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    return app
