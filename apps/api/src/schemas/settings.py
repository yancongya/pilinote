"""
Settings schemas for data validation and API request/response
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class SettingResponse(BaseModel):
    """Setting model for API response"""
    id: int
    key: str
    value: str
    type: str
    category: Optional[str] = None
    description: Optional[str] = None
    default_value: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DownloadSettings(BaseModel):
    """Download settings"""
    default_quality: int = Field(default=80, description="Default video quality (80=1080P)")
    max_concurrent: int = Field(default=3, ge=1, le=5, description="Max concurrent downloads")
    speed_limit: int = Field(default=0, ge=0, description="Speed limit (KB/s), 0 means no limit")
    output_format: str = Field(default="mp4", description="Output format")
    download_path: str = Field(default="./downloads", description="Download path")


class StorageSettings(BaseModel):
    """Storage settings"""
    temp_path: str = Field(default="./temp", description="Temporary file path")
    auto_cleanup: bool = Field(default=True, description="Auto cleanup temp files")
    keep_failed: bool = Field(default=False, description="Keep failed tasks")


class GeneralSettings(BaseModel):
    """General settings"""
    theme: str = Field(default="auto", description="Theme setting (auto/light/dark)")
    language: str = Field(default="zh-CN", description="Language setting")
    auto_download: bool = Field(default=False, description="Auto download")
    clipboard_monitor: bool = Field(default=False, description="Clipboard monitor")


class Settings(BaseModel):
    """All settings"""
    download: DownloadSettings
    storage: StorageSettings
    general: GeneralSettings


class SettingUpdate(BaseModel):
    """Setting update request"""
    key: str
    value: str


class SettingsUpdate(BaseModel):
    """Settings update request"""
    download: Optional[Dict[str, Any]] = None
    storage: Optional[Dict[str, Any]] = None
    general: Optional[Dict[str, Any]] = None


class SettingsExport(BaseModel):
    """Settings export model"""
    export_time: str
    version: str
    settings: Dict[str, Any]