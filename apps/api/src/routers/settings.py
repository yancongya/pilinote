"""
Settings router for managing system settings
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from src.database import get_db
from src.schemas.settings import (
    Settings,
    SettingResponse,
    SettingUpdate,
    SettingsUpdate,
    SettingsExport
)
from src.services.settings_service import SettingsService


router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/", response_model=Settings)
async def get_settings(db: Session = Depends(get_db)):
    """
    Get all system settings grouped by category
    
    Returns:
        Settings object containing download, storage, and general settings
    """
    try:
        service = SettingsService(db)
        return service.get_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get settings: {str(e)}")


@router.get("/list", response_model=list[SettingResponse])
async def get_settings_list(
    category: Optional[str] = Query(None, description="Filter by category"),
    db: Session = Depends(get_db)
):
    """
    Get all settings as a list
    
    Args:
        category: Optional category filter (download, storage, general)
    
    Returns:
        List of all settings
    """
    try:
        service = SettingsService(db)
        all_settings = service.get_all_settings()
        
        if category:
            all_settings = {
                key: setting for key, setting in all_settings.items()
                if setting.category == category
            }
        
        return [
            SettingResponse(
                id=setting.id,
                key=setting.key,
                value=setting.value,
                type=setting.type,
                category=setting.category,
                description=setting.description,
                default_value=setting.default_value,
                created_at=setting.created_at,
                updated_at=setting.updated_at
            )
            for setting in all_settings.values()
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get settings list: {str(e)}")


@router.put("/", response_model=Settings)
async def update_settings(settings_update: SettingsUpdate, db: Session = Depends(get_db)):
    """
    Update system settings
    
    Args:
        settings_update: Settings to update (download, storage, general)
    
    Returns:
        Updated settings object
    """
    try:
        service = SettingsService(db)
        
        # Update download settings
        if settings_update.download:
            service.update_settings(settings_update.download)
        
        # Update storage settings
        if settings_update.storage:
            service.update_settings(settings_update.storage)
        
        # Update general settings
        if settings_update.general:
            service.update_settings(settings_update.general)
        
        return service.get_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")


@router.post("/reset", response_model=Settings)
async def reset_settings(
    category: Optional[str] = Query(None, description="Category to reset (download, storage, general)"),
    db: Session = Depends(get_db)
):
    """
    Reset settings to default values
    
    Args:
        category: Optional category to reset. If not provided, resets all settings.
    
    Returns:
        Settings object after reset
    """
    try:
        service = SettingsService(db)
        service.reset_settings(category)
        return service.get_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset settings: {str(e)}")


@router.get("/export", response_model=SettingsExport)
async def export_settings(db: Session = Depends(get_db)):
    """
    Export all settings to JSON format
    
    Returns:
        Settings export object containing all settings
    """
    try:
        service = SettingsService(db)
        return service.export_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export settings: {str(e)}")


@router.post("/import")
async def import_settings(settings_data: dict, db: Session = Depends(get_db)):
    """
    Import settings from JSON data
    
    Args:
        settings_data: Dictionary of settings to import
    
    Returns:
        Success message
    """
    try:
        service = SettingsService(db)
        service.import_settings(settings_data)
        return {"success": True, "message": "Settings imported successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import settings: {str(e)}")