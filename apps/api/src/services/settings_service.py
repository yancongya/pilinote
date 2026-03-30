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
            output_format=all_settings.get('download.output_format', Setting()).value,
            download_path=all_settings.get('download.download_path', Setting()).value
        )
        
        # Extract storage settings
        storage_settings = StorageSettings(
            temp_path=all_settings.get('storage.temp_path', Setting()).value,
            auto_cleanup=all_settings.get('storage.auto_cleanup', Setting()).value.lower() in ('true', '1', 'yes'),
            keep_failed=all_settings.get('storage.keep_failed', Setting()).value.lower() in ('true', '1', 'yes')
        )
        
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
                # Convert value to string for storage
                if isinstance(value, bool):
                    str_value = str(value).lower()
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