from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "PiliNote API"
    app_version: str = "0.1.0"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000

    database_url: str = "sqlite:///./data/pilinote.db"

    secret_key: str = "pilinote-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    bilibili_api_base: str = "https://api.bilibili.com"
    bilibili_passport_base: str = "https://passport.bilibili.com"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()