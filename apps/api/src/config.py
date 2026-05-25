from pydantic_settings import BaseSettings
import os
from pathlib import Path


def _default_runtime_dir() -> str:
    return os.getenv("PILINOTE_RUNTIME_DIR", os.getcwd())


def _default_database_url() -> str:
    env_database_url = os.getenv("DATABASE_URL")
    if env_database_url:
        return env_database_url
    runtime_dir = Path(_default_runtime_dir())
    return f"sqlite:///{(runtime_dir / 'data' / 'pilinote.db').as_posix()}"


def _normalize_sqlite_url(database_url: str, runtime_dir: str) -> str:
    if database_url.startswith("sqlite:///./"):
        relative = database_url.removeprefix("sqlite:///./")
        return f"sqlite:///{(Path(runtime_dir) / relative).as_posix()}"
    if database_url == "sqlite:///./pilinote.db":
        return f"sqlite:///{(Path(runtime_dir) / 'data' / 'pilinote.db').as_posix()}"
    return database_url


class Settings(BaseSettings):
    app_name: str = "PiliNote API"
    app_version: str = "0.1.0"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000

    runtime_dir: str = _default_runtime_dir()
    log_dir: str = os.getenv("PILINOTE_LOG_DIR", str(Path(_default_runtime_dir()) / "logs"))
    default_download_path: str = os.getenv("PILINOTE_DOWNLOAD_PATH", str(Path(_default_runtime_dir()) / "downloads"))
    default_temp_path: str = os.getenv("PILINOTE_TEMP_PATH", str(Path(_default_runtime_dir()) / "temp"))

    database_url: str = _default_database_url()

    secret_key: str = "pilinote-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    bilibili_api_base: str = "https://api.bilibili.com"
    bilibili_passport_base: str = "https://passport.bilibili.com"

    # Can enable/disable cookies sync during startup and runtime (Phase 3 canary)
    cookies_sync_canary_ratio: float = 0.0
    enable_canary: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

settings.database_url = _normalize_sqlite_url(settings.database_url, settings.runtime_dir)
