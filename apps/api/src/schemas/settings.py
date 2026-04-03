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


class VideoSettings(BaseModel):
    """Video quality settings"""
    default_quality: int = Field(
        default=64,
        description="Default video quality (16=360P, 32=480P, 64=720P, 80=1080P, 112=1080P+, 116=4K)"
    )
    audio_bitrate: int = Field(
        default=192,
        description="Audio bitrate (64/128/132/192/30232/30251/30250)"
    )
    codec: str = Field(
        default="avc",
        description="Video codec (avc/hevc/av1/vp9)"
    )
    output_format: str = Field(
        default="mp4",
        description="Output format (mp4/flv/mkv/webm)"
    )


class MetadataSettings(BaseModel):
    """Metadata settings"""
    enable_nfo: bool = Field(default=True, description="Enable NFO metadata file")
    enable_subtitle: bool = Field(default=True, description="Download subtitles")
    enable_cover: bool = Field(default=True, description="Download cover image")
    enable_avatar: bool = Field(default=False, description="Download uploader avatar")


class DownloadSettings(BaseModel):
    """Download settings"""
    video: VideoSettings = Field(default_factory=VideoSettings)
    max_concurrent: int = Field(default=3, ge=1, le=5, description="Max concurrent downloads")
    speed_limit: int = Field(default=0, ge=0, description="Speed limit (KB/s), 0 means no limit")
    metadata: MetadataSettings = Field(default_factory=MetadataSettings)


class StorageSettings(BaseModel):
    """Storage settings"""
    download_path: str = Field(default="./downloads", description="Download directory path")
    temp_path: str = Field(default="./temp", description="Temporary file path")
    auto_cleanup: bool = Field(default=True, description="Auto cleanup temp files")
    keep_failed: bool = Field(default=False, description="Keep failed tasks")
    sidecar: Dict[str, str] = Field(
        default={
            "ffmpeg": "ffmpeg",
            "aria2c": "aria2c"
        },
        description="Sidecar工具路径（命令名称或绝对路径）"
    )


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