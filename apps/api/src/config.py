from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    app_name: str = "PiliNote API"
    app_version: str = "0.1.0"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000

    # 确保数据库路径指向data目录
    database_url: str = "sqlite:///./data/pilinote.db"

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

# 确保数据库URL指向data目录
if settings.database_url == "sqlite:///./pilinote.db":
    # 如果使用的是旧路径，自动更新为新路径
    settings.database_url = "sqlite:///./data/pilinote.db"
