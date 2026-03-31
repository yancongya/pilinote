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
        
        # Extract download settings
        download_settings = DownloadSettings(
            default_quality=int(all_settings.get('download.default_quality', Setting()).value),
            max_concurrent=int(all_settings.get('download.max_concurrent', Setting()).value),
            speed_limit=int(all_settings.get('download.speed_limit', Setting()).value),
            output_format=all_settings.get('download.output_format', Setting()).value
        )
        
        # Extract storage settings - 修复 download_path 和 sidecar
        storage_settings_dict = {
            'download_path': all_settings.get('storage.download_path', Setting()).value if all_settings.get('storage.download_path') else './downloads',
            'temp_path': all_settings.get('storage.temp_path', Setting()).value if all_settings.get('storage.temp_path') else './temp',
            'auto_cleanup': all_settings.get('storage.auto_cleanup', Setting()).value.lower() in ('true', '1', 'yes'),
            'keep_failed': all_settings.get('storage.keep_failed', Setting()).value.lower() in ('true', '1', 'yes')
        }
        
        # 读取 sidecar 设置
        sidecar_setting = all_settings.get('storage.sidecar')
        if sidecar_setting:
            try:
                # 尝试解析 JSON
                sidecar_dict = json.loads(sidecar_setting.value)
                storage_settings_dict['sidecar'] = sidecar_dict
            except json.JSONDecodeError:
                # 如果解析失败，使用默认值
                storage_settings_dict['sidecar'] = {
                    'ffmpeg': 'ffmpeg',
                    'aria2c': 'aria2c',
                    'danmakufactory': 'danmakufactory'
                }
        else:
            # 如果没有 sidecar 设置，使用默认值
            storage_settings_dict['sidecar'] = {
                'ffmpeg': 'ffmpeg',
                'aria2c': 'aria2c',
                'danmakufactory': 'danmakufactory'
            }
        
        storage_settings = StorageSettings(**storage_settings_dict)
        
        # Extract general settings
        general_settings = GeneralSettings(
            theme=all_settings.get('general.theme', Setting()).value,
            language=all_settings.get('general.language', Setting()).value,
            auto_download=all_settings.get('general.auto_download', Setting()).value.lower() in ('true', '1', 'yes'),
            clipboard_monitor=all_settings.get('general.clipboard_monitor', Setting()).value.lower() in ('true', '1', 'yes')
        )
        
        return Settings(
            download=download_settings,
            storage=storage_settings,
            general=general_settings
        )
    
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
            for key, value in settings_dict.items():
                # 处理嵌套的 sidecar 字段
                if key == 'sidecar' and isinstance(value, dict):
                    # 将 sidecar 字典转换为 JSON 字符串存储
                    str_value = json.dumps(value)
                elif isinstance(value, bool):
                    str_value = str(value).lower()
                elif isinstance(value, dict):
                    # 处理其他嵌套字典
                    str_value = json.dumps(value)
                else:
                    str_value = str(value)
                
                setting = self.get_setting(key)
                if setting:
                    setting.value = str_value
                    setting.updated_at = datetime.utcnow()
                else:
                    # Create new setting if not exists
                    new_setting = Setting(
                        key=key,
                        value=str_value,
                        type=type(value).__name__,
                        category=key.split('.')[0],
                        description=f"Setting for {key}"
                    )
                    self.db.add(new_setting)
            
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            raise e
    
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
                'download.default_quality': '80',
                'download.max_concurrent': '3',
                'download.speed_limit': '0',
                'download.output_format': 'mp4',
            }
            
            # 存储设置默认值
            storage_defaults = {
                'storage.download_path': './downloads',
                'storage.temp_path': './temp',
                'storage.auto_cleanup': 'true',
                'storage.keep_failed': 'false',
                'storage.sidecar': json.dumps({
                    'ffmpeg': 'ffmpeg',
                    'aria2c': 'aria2c',
                    'danmakufactory': 'danmakufactory'
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