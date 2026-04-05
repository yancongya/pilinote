"""
Settings service for managing system settings
"""
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import json
from datetime import datetime

from src.models.setting import Setting
from src.schemas.settings import (
    Settings,
    DownloadSettings,
    StorageSettings,
    GeneralSettings,
    SettingsExport
)


class SettingsService:
    """Settings management service"""
    
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
        ffmpeg_path = self._get_project_tool_path('ffmpeg') or shutil.which('ffmpeg')
        status['ffmpeg'] = {
            'installed': ffmpeg_path is not None,
            'path': ffmpeg_path or '未安装',
            'bundled': self._get_project_tool_path('ffmpeg') is not None
        }
        
        # 检测 aria2c（优先使用项目内工具）
        aria2c_path = self._get_project_tool_path('aria2c') or shutil.which('aria2c')
        status['aria2c'] = {
            'installed': aria2c_path is not None,
            'path': aria2c_path or '未安装',
            'bundled': self._get_project_tool_path('aria2c') is not None
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
        return self.db.query(Setting).filter(Setting.key == key).first()
    
    def get_all_settings(self) -> Dict[str, Setting]:
        """Get all settings as dictionary"""
        settings = self.db.query(Setting).all()
        return {setting.key: setting for setting in settings}
    
    def get_settings(self) -> Settings:
        """Get all settings grouped by category"""
        all_settings = self.get_all_settings()

        # 提取video设置
        video_settings = {
            'default_quality': int(self._get_setting_value(all_settings, 'download.video.default_quality', 64)),
            'audio_bitrate': int(self._get_setting_value(all_settings, 'download.video.audio_bitrate', 192)),
            'codec': self._get_setting_value(all_settings, 'download.video.codec', 'avc'),
            'output_format': self._get_setting_value(all_settings, 'download.video.output_format', 'mp4')
        }

        # 提取metadata设置
        metadata_settings = {
            'enable_nfo': self._get_setting_value(all_settings, 'download.metadata.enable_nfo', True),
            'enable_subtitle': self._get_setting_value(all_settings, 'download.metadata.enable_subtitle', True),
            'enable_cover': self._get_setting_value(all_settings, 'download.metadata.enable_cover', True),
            'enable_avatar': self._get_setting_value(all_settings, 'download.metadata.enable_avatar', False)
        }

        # 构建download设置
        download_settings = DownloadSettings(
            video=video_settings,
            max_concurrent=int(self._get_setting_value(all_settings, 'download.max_concurrent', 3)),
            speed_limit=int(self._get_setting_value(all_settings, 'download.speed_limit', 0)),
            metadata=metadata_settings
        )

        # 提取storage设置
        storage_settings_dict = {
            'download_path': self._get_setting_value(all_settings, 'storage.download_path', './downloads'),
            'temp_path': self._get_setting_value(all_settings, 'storage.temp_path', './temp'),
            'auto_cleanup': self._get_setting_value(all_settings, 'storage.auto_cleanup', True),
            'keep_failed': self._get_setting_value(all_settings, 'storage.keep_failed', False)
        }

        # 读取webdav设置
        webdav_dict = {
            'url': self._get_setting_value(all_settings, 'storage.webdav.url', ''),
            'username': self._get_setting_value(all_settings, 'storage.webdav.username', ''),
            'password': self._get_setting_value(all_settings, 'storage.webdav.password', ''),
            'remote_path': self._get_setting_value(all_settings, 'storage.webdav.remote_path', '/pilinote'),
            'verify_ssl': self._get_setting_value(all_settings, 'storage.webdav.verify_ssl', False)
        }
        storage_settings_dict['webdav'] = webdav_dict

        # 读取sidecar设置
        # 优先尝试从 storage.sidecar 读取 JSON 对象
        sidecar_setting = all_settings.get('storage.sidecar')
        if sidecar_setting:
            try:
                sidecar_dict = json.loads(sidecar_setting.value)
                storage_settings_dict['sidecar'] = sidecar_dict
            except json.JSONDecodeError:
                # 如果 JSON 解析失败，尝试从单独的字段读取
                storage_settings_dict['sidecar'] = {
                    'ffmpeg': self._get_setting_value(all_settings, 'storage.sidecar.ffmpeg', self.get_tool_path('ffmpeg')),
                    'aria2c': self._get_setting_value(all_settings, 'storage.sidecar.aria2c', self.get_tool_path('aria2c'))
                }
        else:
            # 如果没有 storage.sidecar，尝试从单独的字段读取
            ffmpeg_path = self._get_setting_value(all_settings, 'storage.sidecar.ffmpeg', None)
            aria2c_path = self._get_setting_value(all_settings, 'storage.sidecar.aria2c', None)

            if ffmpeg_path or aria2c_path:
                storage_settings_dict['sidecar'] = {
                    'ffmpeg': ffmpeg_path or self.get_tool_path('ffmpeg'),
                    'aria2c': aria2c_path or self.get_tool_path('aria2c')
                }
            else:
                # 如果都没有，使用默认值
                storage_settings_dict['sidecar'] = {
                    'ffmpeg': self.get_tool_path('ffmpeg'),
                    'aria2c': self.get_tool_path('aria2c')
                }

        storage_settings = StorageSettings(**storage_settings_dict)

        # 提取general设置
        general_settings = GeneralSettings(
            theme=self._get_setting_value(all_settings, 'general.theme', 'auto'),
            language=self._get_setting_value(all_settings, 'general.language', 'zh-CN'),
            auto_download=self._get_setting_value(all_settings, 'general.auto_download', False),
            clipboard_monitor=self._get_setting_value(all_settings, 'general.clipboard_monitor', False)
        )

        return Settings(
            download=download_settings,
            storage=storage_settings,
            general=general_settings
        )

    def _get_setting_value(self, all_settings: Dict[str, Setting], key: str, default: Any = None):
        """Get setting value with default"""
        setting = all_settings.get(key)
        if not setting:
            return default

        value = setting.value
        # 转换布尔值
        if isinstance(default, bool):
            return value.lower() in ('true', '1', 'yes')
        # 转换整数
        elif isinstance(default, int):
            return int(value)
        # 其他类型直接返回
        else:
            return value
    
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
            # 处理嵌套的settings_dict
            for category, category_dict in settings_dict.items():
                if isinstance(category_dict, dict):
                    for sub_key, value in category_dict.items():
                        if isinstance(value, dict):
                            # 处理二级嵌套（如download.video和download.metadata，以及storage.sidecar）
                            for nested_key, nested_value in value.items():
                                self._update_single_setting(
                                    f'{category}.{sub_key}.{nested_key}',
                                    nested_value
                                )
                        else:
                            # 处理一级字段（如download.max_concurrent）
                            self._update_single_setting(
                                f'{category}.{sub_key}',
                                value
                            )
                else:
                    # 处理非嵌套字段
                    self._update_single_setting(category, category_dict)

            # 特殊处理：如果有更新 sidecar，同时更新 storage.sidecar JSON 对象
            if 'storage' in settings_dict and 'sidecar' in settings_dict['storage']:
                sidecar_dict = settings_dict['storage']['sidecar']
                if isinstance(sidecar_dict, dict):
                    # 确保 storage.sidecar.ffmpeg 和 storage.sidecar.aria2c 存在
                    if 'ffmpeg' in sidecar_dict:
                        self._update_single_setting('storage.sidecar.ffmpeg', sidecar_dict['ffmpeg'])
                    if 'aria2c' in sidecar_dict:
                        self._update_single_setting('storage.sidecar.aria2c', sidecar_dict['aria2c'])

            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            raise e

    def _update_single_setting(self, db_key: str, value: Any):
        """Update a single setting"""
        # 转换值为字符串
        if isinstance(value, bool):
            str_value = str(value).lower()
        elif isinstance(value, dict):
            str_value = json.dumps(value)
        else:
            str_value = str(value)

        # 获取或创建设置
        setting = self.get_setting(db_key)
        if setting:
            setting.value = str_value
            setting.updated_at = datetime.utcnow()
        else:
            # 创建新设置
            category = db_key.split('.')[0]
            new_setting = Setting(
                key=db_key,
                value=str_value,
                type=type(value).__name__,
                category=category,
                description=f"Setting for {db_key}"
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
            settings=settings_dict
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
                'download.video.default_quality': '64',
                'download.video.audio_bitrate': '192',
                'download.video.codec': 'avc',
                'download.video.output_format': 'mp4',
                'download.max_concurrent': '3',
                'download.speed_limit': '0',
                'download.metadata.enable_nfo': 'true',
                'download.metadata.enable_subtitle': 'true',
                'download.metadata.enable_cover': 'true',
                'download.metadata.enable_avatar': 'false',
            }
            
            # 存储设置默认值
            # 根据平台获取工具路径
            from src.services.tool_initializer import ToolInitializer
            tool_initializer = ToolInitializer()
            
            ffmpeg_path = tool_initializer.get_tool_path('ffmpeg') or 'ffmpeg'
            aria2c_path = tool_initializer.get_tool_path('aria2c') or 'aria2c'
            
            storage_defaults = {
                'storage.download_path': './downloads',
                'storage.temp_path': './temp',
                'storage.auto_cleanup': 'true',
                'storage.keep_failed': 'false',
                'storage.sidecar': json.dumps({
                    'ffmpeg': ffmpeg_path,
                    'aria2c': aria2c_path
                })
            }
            
            # 通用设置默认值
            general_defaults = {
                'general.theme': 'auto',
                'general.language': 'zh-CN',
                'general.auto_download': 'false',
                'general.clipboard_monitor': 'false',
            }
            
            # 合并所有默认设置
            all_defaults = {**download_defaults, **storage_defaults, **general_defaults}
            
            # 只创建不存在的设置
            for key, value in all_defaults.items():
                setting = self.get_setting(key)
                if not setting:
                    new_setting = Setting(
                        key=key,
                        value=value,
                        type='string',
                        category=key.split('.')[0],
                        description=f"Default setting for {key}",
                        default_value=value
                    )
                    self.db.add(new_setting)
            
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            raise e