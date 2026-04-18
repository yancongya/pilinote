"""
Settings service for managing system settings
"""

from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import json
import logging
from datetime import datetime

from src.models.setting import Setting
from src.schemas.settings import (
    Settings,
    DownloadSettings,
    StorageSettings,
    GeneralSettings,
    SettingsExport,
    AutoDownloadSettings,
    ConcurrentLimit,
    AiNoteSettings,
)
from src.services.ai.ai_runtime_state_service import get_ai_runtime_state_service


logger = logging.getLogger(__name__)


class SettingsService:
    """Settings management service"""

    _LLM_MIRROR_KEYS = ("provider", "base_url", "model", "api_key", "temperature")

    def __init__(self, db: Session):
        self.db = db

    def _get_project_tool_path(self, tool_name: str) -> Optional[str]:
        """获取项目内工具路径"""
        from src.services.tool_initializer import ToolInitializer

        initializer = ToolInitializer()
        return initializer.get_tool_path(tool_name)

    def get_tool_status(self) -> Dict[str, Dict[str, Any]]:
        """获取工具状态（用于显示）"""
        import shutil

        status = {}

        # 检测 ffmpeg（优先使用项目内工具）
        ffmpeg_path = self._get_project_tool_path("ffmpeg") or shutil.which("ffmpeg")
        status["ffmpeg"] = {
            "installed": ffmpeg_path is not None,
            "path": ffmpeg_path or "未安装",
            "bundled": self._get_project_tool_path("ffmpeg") is not None,
        }

        # 检测 aria2c（优先使用项目内工具）
        aria2c_path = self._get_project_tool_path("aria2c") or shutil.which("aria2c")
        status["aria2c"] = {
            "installed": aria2c_path is not None,
            "path": aria2c_path or "未安装",
            "bundled": self._get_project_tool_path("aria2c") is not None,
        }

        return status

    def get_tool_path(self, tool_name: str) -> str:
        """获取工具路径（优先使用项目内工具）"""
        project_path = self._get_project_tool_path(tool_name)
        if project_path:
            return project_path

        # 回退到系统工具
        import shutil

        system_path = shutil.which(tool_name)
        return system_path or tool_name

    def get_setting(self, key: str) -> Optional[Setting]:
        """Get setting by key"""
        setting = self.db.query(Setting).filter(Setting.key == key).first()
        if not setting:
            logger.info(f"Setting key '{key}' not found in database")
        return setting

    def get_all_settings(self) -> Dict[str, Setting]:
        """Get all settings as dictionary"""
        settings = self.db.query(Setting).all()
        return {setting.key: setting for setting in settings}

    def get_settings(self) -> Settings:
        """Get all settings grouped by category"""
        all_settings = self.get_all_settings()

        # 提取video设置
        video_settings = {
            "default_quality": int(
                self._get_setting_value(
                    all_settings, "download.video.default_quality", 64
                )
            ),
            "audio_bitrate": int(
                self._get_setting_value(
                    all_settings, "download.video.audio_bitrate", 192
                )
            ),
            "codec": self._get_setting_value(
                all_settings, "download.video.codec", "avc"
            ),
            "output_format": self._get_setting_value(
                all_settings, "download.video.output_format", "mp4"
            ),
        }

        # 提取metadata设置
        metadata_settings = {
            "enable_nfo": self._get_setting_value(
                all_settings, "download.metadata.enable_nfo", True
            ),
            "enable_subtitle": self._get_setting_value(
                all_settings, "download.metadata.enable_subtitle", True
            ),
            "enable_cover": self._get_setting_value(
                all_settings, "download.metadata.enable_cover", True
            ),
            "enable_avatar": self._get_setting_value(
                all_settings, "download.metadata.enable_avatar", False
            ),
        }

        # 构建download设置
        download_settings = DownloadSettings(
            video=video_settings,
            max_concurrent=int(
                self._get_setting_value(all_settings, "download.max_concurrent", 3)
            ),
            speed_limit=int(
                self._get_setting_value(all_settings, "download.speed_limit", 0)
            ),
            metadata=metadata_settings,
        )

        # 提取storage设置
        storage_settings_dict = {
            "download_path": self._get_setting_value(
                all_settings, "storage.download_path", "./downloads"
            ),
            "temp_path": self._get_setting_value(
                all_settings, "storage.temp_path", "./temp"
            ),
            "auto_cleanup": self._get_setting_value(
                all_settings, "storage.auto_cleanup", True
            ),
            "keep_failed": self._get_setting_value(
                all_settings, "storage.keep_failed", False
            ),
        }

        # 读取webdav设置
        webdav_dict = {
            "url": self._get_setting_value(all_settings, "storage.webdav.url", ""),
            "username": self._get_setting_value(
                all_settings, "storage.webdav.username", ""
            ),
            "password": self._get_setting_value(
                all_settings, "storage.webdav.password", ""
            ),
            "remote_path": self._get_setting_value(
                all_settings, "storage.webdav.remote_path", "/pilinote"
            ),
            "verify_ssl": self._get_setting_value(
                all_settings, "storage.webdav.verify_ssl", False
            ),
        }
        storage_settings_dict["webdav"] = webdav_dict

        # 读取FTP设置
        ftp_dict = {
            "host": self._get_setting_value(all_settings, "storage.ftp.host", ""),
            "username": self._get_setting_value(
                all_settings, "storage.ftp.username", ""
            ),
            "password": self._get_setting_value(
                all_settings, "storage.ftp.password", ""
            ),
            "remote_path": self._get_setting_value(
                all_settings, "storage.ftp.remote_path", "/pilinote"
            ),
            "use_tls": self._get_setting_value(
                all_settings, "storage.ftp.use_tls", False
            ),
        }
        storage_settings_dict["ftp"] = ftp_dict

        # 读取sidecar设置
        # 优先尝试从 storage.sidecar 读取 JSON 对象
        sidecar_setting = all_settings.get("storage.sidecar")
        if sidecar_setting:
            try:
                sidecar_dict = json.loads(sidecar_setting.value)
                storage_settings_dict["sidecar"] = sidecar_dict
            except json.JSONDecodeError:
                # 如果 JSON 解析失败，尝试从单独的字段读取
                storage_settings_dict["sidecar"] = {
                    "ffmpeg": self._get_setting_value(
                        all_settings,
                        "storage.sidecar.ffmpeg",
                        self.get_tool_path("ffmpeg"),
                    ),
                    "aria2c": self._get_setting_value(
                        all_settings,
                        "storage.sidecar.aria2c",
                        self.get_tool_path("aria2c"),
                    ),
                }
        else:
            # 如果没有 storage.sidecar，尝试从单独的字段读取
            ffmpeg_path = self._get_setting_value(
                all_settings, "storage.sidecar.ffmpeg", None
            )
            aria2c_path = self._get_setting_value(
                all_settings, "storage.sidecar.aria2c", None
            )

            if ffmpeg_path or aria2c_path:
                storage_settings_dict["sidecar"] = {
                    "ffmpeg": ffmpeg_path or self.get_tool_path("ffmpeg"),
                    "aria2c": aria2c_path or self.get_tool_path("aria2c"),
                }
            else:
                # 如果都没有，使用默认值
                storage_settings_dict["sidecar"] = {
                    "ffmpeg": self.get_tool_path("ffmpeg"),
                    "aria2c": self.get_tool_path("aria2c"),
                }

        storage_settings = StorageSettings(**storage_settings_dict)

        # 提取general设置
        general_settings = GeneralSettings(
            theme=self._get_setting_value(all_settings, "general.theme", "auto"),
            language=self._get_setting_value(all_settings, "general.language", "zh-CN"),
            auto_download=self._get_setting_value(
                all_settings, "general.auto_download", False
            ),
            clipboard_monitor=self._get_setting_value(
                all_settings, "general.clipboard_monitor", False
            ),
        )

        # 提取auto_download设置
        concurrent_limit_dict = {
            "video": int(
                self._get_setting_value(
                    all_settings, "auto_download.concurrent_limit.video", 3
                )
            ),
            "page": int(
                self._get_setting_value(
                    all_settings, "auto_download.concurrent_limit.page", 3
                )
            ),
        }

        # 提取custom_scan配置
        custom_scan_setting = all_settings.get("auto_download.custom_scan")
        custom_scan_dict = {"enabled": False, "folder_list": []}
        if custom_scan_setting:
            try:
                custom_scan_data = json.loads(custom_scan_setting.value)
                custom_scan_dict = {
                    "enabled": custom_scan_data.get("enabled", False),
                    "folder_list": custom_scan_data.get("folder_list", []),
                }
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse custom_scan setting: {e}")

        auto_download_settings = AutoDownloadSettings(
            enabled=self._get_setting_value(
                all_settings, "auto_download.enabled", False
            ),
            trigger_type=self._get_setting_value(
                all_settings, "auto_download.trigger_type", "interval"
            ),
            scan_interval=int(
                self._get_setting_value(all_settings, "auto_download.scan_interval", 60)
            ),
            cron_expression=self._get_setting_value(
                all_settings, "auto_download.cron_expression", ""
            ),
            concurrent_limit=concurrent_limit_dict,
            custom_scan=custom_scan_dict,
            watch_later_max=int(
                self._get_setting_value(
                    all_settings, "auto_download.watch_later_max", 0
                )
            ),
            auto_start_after_scan=self._get_setting_value(
                all_settings, "auto_download.auto_start_after_scan", False
            ),
            storage_threshold_gb=int(
                self._get_setting_value(
                    all_settings, "auto_download.storage_threshold_gb", 20
                )
            ),
        )

        # 读取统一 LLM 配置
        llm_providers = self._get_json_setting(all_settings, "llm.providers", [])
        if not isinstance(llm_providers, list):
            llm_providers = []
        unified_llm_dict = {
            "provider": self._get_setting_value(
                all_settings,
                "llm.provider",
                self._get_setting_value(all_settings, "ai_note.llm.provider", "openai"),
            ),
            "base_url": self._get_setting_value(
                all_settings,
                "llm.base_url",
                self._get_setting_value(all_settings, "ai_note.llm.base_url", ""),
            ),
            "model": self._get_setting_value(
                all_settings,
                "llm.model",
                self._get_setting_value(all_settings, "ai_note.llm.model", "gpt-4o-mini"),
            ),
            "api_key": self._get_setting_value(
                all_settings,
                "llm.api_key",
                self._get_setting_value(all_settings, "ai_note.llm.api_key", ""),
            ),
            "temperature": float(
                self._get_setting_value(
                    all_settings,
                    "llm.temperature",
                    self._get_setting_value(all_settings, "ai_note.llm.temperature", 0.7),
                )
            ),
            "providers": llm_providers,
        }

        # 提取ai_note设置（兼容旧字段，默认跟随统一 LLM 配置）
        ai_note_llm_dict = {
            "provider": self._get_setting_value(
                all_settings, "ai_note.llm.provider", unified_llm_dict["provider"]
            ),
            "base_url": self._get_setting_value(
                all_settings, "ai_note.llm.base_url", unified_llm_dict["base_url"]
            ),
            "model": self._get_setting_value(
                all_settings, "ai_note.llm.model", unified_llm_dict["model"]
            ),
            "api_key": self._get_setting_value(
                all_settings, "ai_note.llm.api_key", unified_llm_dict["api_key"]
            ),
            "temperature": float(
                self._get_setting_value(
                    all_settings,
                    "ai_note.llm.temperature",
                    unified_llm_dict["temperature"],
                )
            ),
        }
        style_dict = {
            "style": "",
            "length": int(
                self._get_setting_value(all_settings, "ai_note.style.length", 500)
            ),
            "custom_styles": self._get_json_setting(
                all_settings, "ai_note.style.custom_styles", []
            ),
        }
        format_dict = {
            "format": self._get_setting_value(
                all_settings, "ai_note.format.format", "markdown"
            ),
            "include_timestamp": self._get_setting_value(
                all_settings, "ai_note.format.include_timestamp", True
            ),
            "include_summary": self._get_setting_value(
                all_settings, "ai_note.format.include_summary", True
            ),
        }
        ai_note_settings = AiNoteSettings(
            llm=ai_note_llm_dict,
            style=style_dict,
            format=format_dict,
            auto_analyze=self._get_setting_value(
                all_settings, "ai_note.auto_analyze", False
            ),
        )

        return Settings(
            download=download_settings,
            storage=storage_settings,
            general=general_settings,
            auto_download=auto_download_settings,
            llm=unified_llm_dict,
            ai_note=ai_note_settings,
        )

    def _get_setting_value(
        self, all_settings: Dict[str, Setting], key: str, default: Any = None
    ):
        """Get setting value with default"""
        setting = all_settings.get(key)
        if not setting:
            return default

        value = setting.value
        # 转换布尔值
        if isinstance(default, bool):
            return value.lower() in ("true", "1", "yes")
        # 转换整数
        elif isinstance(default, int):
            return int(value)
        # 其他类型直接返回
        else:
            return value

    def _get_json_setting(
        self, all_settings: Dict[str, Setting], key: str, default: Any = None
    ):
        setting = all_settings.get(key)
        if not setting:
            return default
        try:
            return json.loads(setting.value)
        except json.JSONDecodeError:
            return default

    def _mirror_llm_fields(
        self, source: Dict[str, Any], target: Dict[str, Any], overwrite: bool = False
    ) -> None:
        """将 LLM 字段在不同配置块之间同步。"""
        if not isinstance(source, dict) or not isinstance(target, dict):
            return

        for key in self._LLM_MIRROR_KEYS:
            if key not in source:
                continue

            target_value = target.get(key)
            if overwrite or key not in target or target_value in (None, ""):
                target[key] = source[key]

    def update_setting(self, key: str, value: str) -> Optional[Setting]:
        """Update a single setting"""
        setting = self.get_setting(key)
        if setting:
            setting.value = value
            setting.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(setting)
        return setting

    def update_settings(self, settings_dict: Dict[str, Any]) -> bool:
        """Update multiple settings"""
        try:
            # 顶层 llm 和 ai_note.llm 同步到统一存储（llm 优先）
            if "llm" in settings_dict and isinstance(settings_dict["llm"], dict):
                llm_dict = settings_dict["llm"]
                if "providers" in llm_dict:
                    self._update_single_setting("llm.providers", llm_dict["providers"])
                    del llm_dict["providers"]
                ai_note_dict = settings_dict.setdefault("ai_note", {})
                if isinstance(ai_note_dict, dict):
                    ai_note_llm_dict = ai_note_dict.setdefault("llm", {})
                    if isinstance(ai_note_llm_dict, dict):
                        self._mirror_llm_fields(llm_dict, ai_note_llm_dict, overwrite=True)

            # AI 笔记 LLM 里的 tested_models 只写入 runtime cache，不再进入 settings 持久化层
            if "ai_note" in settings_dict and "llm" in settings_dict["ai_note"]:
                ai_llm_dict = settings_dict["ai_note"]["llm"]
                if isinstance(ai_llm_dict, dict) and "tested_models" in ai_llm_dict:
                    get_ai_runtime_state_service().set_tested_models(
                        ai_llm_dict["tested_models"]
                    )
                    del ai_llm_dict["tested_models"]
                if isinstance(ai_llm_dict, dict):
                    # 兼容期：ai_note.llm 仍然作为镜像来源，补齐统一 llm
                    settings_dict.setdefault("llm", {})
                    if isinstance(settings_dict["llm"], dict):
                        self._mirror_llm_fields(ai_llm_dict, settings_dict["llm"])

            # 预先处理 custom_scan，将其作为JSON存储
            if (
                "auto_download" in settings_dict
                and "custom_scan" in settings_dict["auto_download"]
            ):
                custom_scan_value = settings_dict["auto_download"]["custom_scan"]
                if isinstance(custom_scan_value, dict):
                    self._update_single_setting(
                        "auto_download.custom_scan", custom_scan_value
                    )
                del settings_dict["auto_download"]["custom_scan"]

            # 预先处理 concurrent_limit，避免在主循环中被处理
            if (
                "auto_download" in settings_dict
                and "concurrent_limit" in settings_dict["auto_download"]
            ):
                concurrent_limit_dict = settings_dict["auto_download"][
                    "concurrent_limit"
                ]
                if isinstance(concurrent_limit_dict, dict):
                    if "video" in concurrent_limit_dict:
                        self._update_single_setting(
                            "auto_download.concurrent_limit.video",
                            concurrent_limit_dict["video"],
                        )
                    if "page" in concurrent_limit_dict:
                        self._update_single_setting(
                            "auto_download.concurrent_limit.page",
                            concurrent_limit_dict["page"],
                        )
                del settings_dict["auto_download"]["concurrent_limit"]

            # 如果 auto_download 只剩下空字典，也删除它
            if "auto_download" in settings_dict and not settings_dict["auto_download"]:
                del settings_dict["auto_download"]

            # 处理嵌套的settings_dict
            for category, category_dict in settings_dict.items():
                if isinstance(category_dict, dict):
                    for sub_key, value in category_dict.items():
                        if isinstance(value, dict):
                            if category == "ai_note" and sub_key == "llm":
                                for llm_key, llm_value in value.items():
                                    self._update_single_setting(
                                        f"{category}.{sub_key}.{llm_key}", llm_value
                                    )
                                continue
                            # 处理二级嵌套（如download.video和download.metadata，以及storage.sidecar）
                            for nested_key, nested_value in value.items():
                                self._update_single_setting(
                                    f"{category}.{sub_key}.{nested_key}", nested_value
                                )
                        else:
                            # 处理一级字段（如download.max_concurrent）
                            self._update_single_setting(f"{category}.{sub_key}", value)
                else:
                    # 处理非嵌套字段
                    self._update_single_setting(category, category_dict)

            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            raise e

    def _update_single_setting(self, db_key: str, value: Any):
        """Update a single setting"""
        logger.info(f"Updating setting: {db_key} = {value}")

        # 转换值为字符串
        if isinstance(value, bool):
            str_value = str(value).lower()
        elif isinstance(value, dict):
            str_value = json.dumps(value)
        elif isinstance(value, list):
            str_value = json.dumps(value)
        else:
            str_value = str(value)

        # 获取或创建设置
        setting = self.get_setting(db_key)
        logger.info(f"Found setting: {setting}")

        if setting:
            setting.value = str_value
            setting.updated_at = datetime.utcnow()
        else:
            # 创建新设置
            category = db_key.split(".")[0]
            logger.info(f"Creating new setting: {db_key}")
            new_setting = Setting(
                key=db_key,
                value=str_value,
                type=type(value).__name__,
                category=category,
                description=f"Setting for {db_key}",
            )
            self.db.add(new_setting)

    def reset_settings(self, category: Optional[str] = None) -> bool:
        """Reset settings to default values"""
        try:
            query = self.db.query(Setting)
            if category:
                query = query.filter(Setting.category == category)

            settings = query.all()
            for setting in settings:
                if setting.default_value:
                    setting.value = setting.default_value
                    setting.updated_at = datetime.utcnow()

            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            raise e

    def export_settings(self) -> SettingsExport:
        """Export all settings to JSON format"""
        all_settings = self.get_all_settings()
        settings_dict = {key: setting.value for key, setting in all_settings.items()}

        return SettingsExport(
            export_time=datetime.utcnow().isoformat(),
            version="1.0.0",
            settings=settings_dict,
        )

    def import_settings(self, settings_data: Dict[str, Any]) -> bool:
        """Import settings from JSON data"""
        try:
            for key, value in settings_data.items():
                setting = self.get_setting(key)
                if setting:
                    setting.value = str(value)
                    setting.updated_at = datetime.utcnow()

            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            raise e

    def init_default_settings(self) -> bool:
        """初始化默认设置"""
        try:
            # 下载设置默认值
            download_defaults = {
                "download.video.default_quality": "64",
                "download.video.audio_bitrate": "192",
                "download.video.codec": "avc",
                "download.video.output_format": "mp4",
                "download.max_concurrent": "3",
                "download.speed_limit": "0",
                "download.metadata.enable_nfo": "true",
                "download.metadata.enable_subtitle": "true",
                "download.metadata.enable_cover": "true",
                "download.metadata.enable_avatar": "false",
            }

            # 存储设置默认值
            # 根据平台获取工具路径
            from src.services.tool_initializer import ToolInitializer

            tool_initializer = ToolInitializer()

            ffmpeg_path = tool_initializer.get_tool_path("ffmpeg") or "ffmpeg"
            aria2c_path = tool_initializer.get_tool_path("aria2c") or "aria2c"

            storage_defaults = {
                "storage.download_path": "./downloads",
                "storage.temp_path": "./temp",
                "storage.auto_cleanup": "true",
                "storage.keep_failed": "false",
                "storage.sidecar": json.dumps(
                    {"ffmpeg": ffmpeg_path, "aria2c": aria2c_path}
                ),
            }

            # 通用设置默认值
            general_defaults = {
                "general.theme": "auto",
                "general.language": "zh-CN",
                "general.auto_download": "false",
                "general.clipboard_monitor": "false",
            }

            # 自动下载设置默认值
            auto_download_defaults = {
                "auto_download.enabled": "false",
                "auto_download.trigger_type": "interval",
                "auto_download.scan_interval": "60",
                "auto_download.cron_expression": "",
                "auto_download.concurrent_limit.video": "3",
                "auto_download.concurrent_limit.page": "3",
                "auto_download.watch_later_max": "0",
                "auto_download.auto_start_after_scan": "false",
                "auto_download.storage_threshold_gb": "20",
            }

            # AI笔记设置默认值
            ai_note_defaults = {
                "ai_note.llm.provider": "openai",
                "ai_note.llm.base_url": "",
                "ai_note.llm.model": "gpt-4o-mini",
                "ai_note.llm.api_key": "",
                "ai_note.llm.temperature": "0.7",
                "ai_note.style.style": "",
                "ai_note.style.length": "500",
                "ai_note.style.custom_styles": json.dumps([]),
                "ai_note.format.format": "markdown",
                "ai_note.format.include_timestamp": "true",
                "ai_note.format.include_summary": "true",
                "ai_note.auto_analyze": "false",
            }

            llm_default_providers = [
                {
                    "id": "openai",
                    "name": "OpenAI",
                    "baseUrl": "https://api.openai.com/v1",
                    "apiKey": "",
                    "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
                    "isDefault": True,
                    "isCustom": False,
                },
                {
                    "id": "claude",
                    "name": "Claude",
                    "baseUrl": "https://api.anthropic.com",
                    "apiKey": "",
                    "models": [
                        "claude-sonnet-4-20250614",
                        "claude-opus-4-20250514",
                        "claude-haiku-3-20250620",
                    ],
                    "isDefault": True,
                    "isCustom": False,
                },
                {
                    "id": "deepseek",
                    "name": "DeepSeek",
                    "baseUrl": "https://api.deepseek.com/v1",
                    "apiKey": "",
                    "models": ["deepseek-chat", "deepseek-coder"],
                    "isDefault": True,
                    "isCustom": False,
                },
                {
                    "id": "qwen",
                    "name": "Qwen",
                    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
                    "apiKey": "",
                    "models": ["qwen-turbo", "qwen-plus", "qwen-max"],
                    "isDefault": True,
                    "isCustom": False,
                },
                {
                    "id": "volcengine",
                    "name": "火山引擎",
                    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
                    "apiKey": "",
                    "models": ["doubao-seed-1-6", "doubao-pro-32k", "doubao-lite-32k"],
                    "isDefault": True,
                    "isCustom": False,
                },
                {
                    "id": "modelscope",
                    "name": "魔搭社区",
                    "baseUrl": "https://api.modelscope.cn/v1",
                    "apiKey": "",
                    "models": ["qwen-turbo", "qwen-plus", "qwen-max"],
                    "isDefault": True,
                    "isCustom": False,
                },
                {
                    "id": "openrouter",
                    "name": "OpenRouter",
                    "baseUrl": "https://openrouter.ai/api/v1",
                    "apiKey": "",
                    "models": [
                        "openai/gpt-4o",
                        "anthropic/claude-3.5-sonnet",
                        "deepseek/deepseek-chat",
                    ],
                    "isDefault": True,
                    "isCustom": False,
                },
                {
                    "id": "moonshot",
                    "name": "Moonshot",
                    "baseUrl": "https://api.moonshot.cn/v1",
                    "apiKey": "",
                    "models": ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
                    "isDefault": True,
                    "isCustom": False,
                },
                {
                    "id": "zhipu",
                    "name": "智谱清言",
                    "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
                    "apiKey": "",
                    "models": ["glm-4-plus", "glm-4-air", "glm-4-flash"],
                    "isDefault": True,
                    "isCustom": False,
                },
                {
                    "id": "minimax",
                    "name": "MiniMax",
                    "baseUrl": "https://api.minimax.chat/v1",
                    "apiKey": "",
                    "models": ["abab6.5s-chat", "abab6.5-chat", "abab6.5t-chat"],
                    "isDefault": True,
                    "isCustom": False,
                },
                {
                    "id": "baidu",
                    "name": "文心一言",
                    "baseUrl": "https://qianfan.baidubce.com/v2",
                    "apiKey": "",
                    "models": ["ernie-4.0", "ernie-3.5-128k", "ernie-lite-8k"],
                    "isDefault": True,
                    "isCustom": False,
                },
            ]

            # 合并所有默认设置
            all_defaults = {
                **download_defaults,
                **storage_defaults,
                **general_defaults,
                **auto_download_defaults,
                "llm.provider": "openai",
                "llm.base_url": "",
                "llm.model": "gpt-4o-mini",
                "llm.api_key": "",
                "llm.temperature": "0.7",
                "llm.providers": json.dumps(llm_default_providers),
                **ai_note_defaults,
            }

            # 只创建不存在的设置
            for key, value in all_defaults.items():
                setting = self.get_setting(key)
                if not setting:
                    new_setting = Setting(
                        key=key,
                        value=value,
                        type="string",
                        category=key.split(".")[0],
                        description=f"Default setting for {key}",
                        default_value=value,
                    )
                    self.db.add(new_setting)

            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            raise e
