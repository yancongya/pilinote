"""
Settings schemas for data validation and API request/response
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
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


class FTPConfig(BaseModel):
    """FTP 配置"""
    host: str = Field(default="", description="FTP 服务器地址（可包含端口，如 ftp.example.com:21）")
    username: str = Field(default="", description="用户名")
    password: str = Field(default="", description="密码")
    remote_path: str = Field(default="/pilinote", description="远程存储路径")
    use_tls: bool = Field(default=False, description="是否使用 TLS 加密（FTPS）")


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
    ftp: FTPConfig = Field(
        default_factory=FTPConfig,
        description="FTP 配置"
    )


class GeneralSettings(BaseModel):
    """General settings"""
    theme: str = Field(default="auto", description="Theme setting (auto/light/dark)")
    language: str = Field(default="zh-CN", description="Language setting")
    auto_download: bool = Field(default=False, description="Auto download")
    clipboard_monitor: bool = Field(default=False, description="Clipboard monitor")


class ConcurrentLimit(BaseModel):
    """并发限制设置"""
    video: int = Field(default=3, ge=1, le=5, description="视频并发数")
    page: int = Field(default=3, ge=1, le=5, description="分页并发数")


class FolderScanConfig(BaseModel):
    """收藏夹扫描配置"""
    folder_name: str = Field(default="", description="收藏夹名称")
    max_videos: int = Field(default=0, ge=0, le=999, description="最大扫描视频数，0表示不扫描")


class CustomScanConfig(BaseModel):
    """自定义扫描配置"""
    enabled: bool = Field(default=False, description="是否启用自定义扫描")
    folder_list: List[FolderScanConfig] = Field(default_factory=list, description="收藏夹扫描列表")


class AutoDownloadSettings(BaseModel):
    """自动下载设置"""
    enabled: bool = Field(default=False, description="启用自动下载")
    trigger_type: str = Field(default="interval", description="触发方式 (interval/cron)")
    scan_interval: int = Field(default=60, ge=15, description="扫描间隔（分钟）")
    cron_expression: str = Field(default="", description="Cron 表达式")
    concurrent_limit: ConcurrentLimit = Field(default_factory=ConcurrentLimit)
    custom_scan: CustomScanConfig = Field(default_factory=CustomScanConfig)
    watch_later_max: int = Field(default=0, ge=0, le=999, description="稍后再看最大扫描数量，0表示不扫描")


class Settings(BaseModel):
    """All settings"""
    download: DownloadSettings
    storage: StorageSettings
    general: GeneralSettings
    auto_download: AutoDownloadSettings


class SettingsUpdate(BaseModel):
    """Settings update request"""
    download: Optional[Dict[str, Any]] = None
    storage: Optional[Dict[str, Any]] = None
    general: Optional[Dict[str, Any]] = None
    auto_download: Optional[Dict[str, Any]] = None


class SettingsExport(BaseModel):
    """Settings export model"""
    export_time: str
    version: str
    settings: Dict[str, Any]


class SettingUpdate(BaseModel):
    """Setting update request"""
    key: str
    value: str