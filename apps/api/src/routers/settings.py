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


@router.post("/clear-cache")
async def clear_cache(
    cache_type: str = Query(..., description="Type of cache to clear (downloads, all)"),
    db: Session = Depends(get_db)
):
    """
    Clear download cache
    
    Args:
        cache_type: Type of cache to clear ('downloads' for download files, 'all' for all caches)
    
    Returns:
        Success message with details about cleared files
    """
    try:
        import os
        import shutil
        import logging
        
        logger = logging.getLogger(__name__)
        
        if cache_type == "downloads":
            # 清理下载文件
            downloads_dir = "downloads"
            if os.path.exists(downloads_dir):
                # 只清理文件，保留目录结构
                deleted_files = 0
                deleted_size = 0
                
                for download_id in os.listdir(downloads_dir):
                    download_path = os.path.join(downloads_dir, download_id)
                    if os.path.isdir(download_path):
                        try:
                            # 删除整个下载目录
                            dir_size = sum(
                                os.path.getsize(os.path.join(dirpath, filename))
                                for dirpath, dirnames, filenames in os.walk(download_path)
                                for filename in filenames
                            )
                            shutil.rmtree(download_path)
                            deleted_files += 1
                            deleted_size += dir_size
                            logger.info(f"Deleted download directory: {download_id}")
                        except Exception as e:
                            logger.error(f"Failed to delete {download_path}: {e}")
                
                # 清理数据库中的文件路径信息
                from src.models.download import Download
                downloads = db.query(Download).all()
                for download in downloads:
                    if download.file_path and not os.path.exists(download.file_path):
                        download.file_path = None
                        download.file_size = 0
                        download.total_bytes = 0
                        download.downloaded_bytes = 0
                db.commit()
                
                return {
                    "success": True,
                    "message": f"已清理 {deleted_files} 个下载目录",
                    "deleted_files": deleted_files,
                    "deleted_size": deleted_size
                }
            else:
                return {"success": True, "message": "下载目录不存在，无需清理"}
        
        elif cache_type == "all":
            # 清理所有缓存
            deleted_files = 0
            deleted_size = 0
            
            # 清理下载文件
            downloads_dir = "downloads"
            if os.path.exists(downloads_dir):
                for download_id in os.listdir(downloads_dir):
                    download_path = os.path.join(downloads_dir, download_id)
                    if os.path.isdir(download_path):
                        try:
                            dir_size = sum(
                                os.path.getsize(os.path.join(dirpath, filename))
                                for dirpath, dirnames, filenames in os.walk(download_path)
                                for filename in filenames
                            )
                            shutil.rmtree(download_path)
                            deleted_files += 1
                            deleted_size += dir_size
                        except Exception as e:
                            logger.error(f"Failed to delete {download_path}: {e}")
            
            # 清理数据库中的文件路径信息
            from src.models.download import Download
            downloads = db.query(Download).all()
            for download in downloads:
                if download.file_path and not os.path.exists(download.file_path):
                    download.file_path = None
                    download.file_size = 0
                    download.total_bytes = 0
                    download.downloaded_bytes = 0
            db.commit()
            
            return {
                "success": True,
                "message": f"已清理所有缓存，删除 {deleted_files} 个目录",
                "deleted_files": deleted_files,
                "deleted_size": deleted_size
            }
        
        else:
            raise HTTPException(status_code=400, detail="无效的缓存类型，必须是 'downloads' 或 'all'")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清理缓存失败: {str(e)}")


@router.get("/storage-info")
async def get_storage_info(db: Session = Depends(get_db)):
    """
    Get storage information including total space used by downloads
    
    Returns:
        Storage information with total size and file count
    """
    try:
        import os
        
        downloads_dir = "downloads"
        total_size = 0
        file_count = 0
        directory_count = 0
        
        if os.path.exists(downloads_dir):
            for download_id in os.listdir(downloads_dir):
                download_path = os.path.join(downloads_dir, download_id)
                if os.path.isdir(download_path):
                    directory_count += 1
                    for dirpath, dirnames, filenames in os.walk(download_path):
                        for filename in filenames:
                            file_path = os.path.join(dirpath, filename)
                            if os.path.isfile(file_path):
                                try:
                                    file_size = os.path.getsize(file_path)
                                    total_size += file_size
                                    file_count += 1
                                except Exception:
                                    pass
        
        # 获取数据库中的统计信息
        from src.models.download import Download
        total_downloads = db.query(Download).count()
        completed_downloads = db.query(Download).filter(Download.status == "completed").count()
        
        return {
            "success": True,
            "data": {
                "total_size": total_size,
                "total_size_formatted": format_size(total_size),
                "file_count": file_count,
                "directory_count": directory_count,
                "total_downloads": total_downloads,
                "completed_downloads": completed_downloads
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取存储信息失败: {str(e)}")


def format_size(size_bytes: int) -> str:
    """格式化文件大小显示"""
    if size_bytes == 0:
        return "0 B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    size = float(size_bytes)
    
    while size >= 1024 and i < len(size_names) - 1:
        size /= 1024
        i += 1
    
    return f"{size:.1f} {size_names[i]}"