"""
Settings router for managing system settings
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
import logging
import shutil

from src.database import get_db
from src.schemas.settings import (
    Settings,
    SettingResponse,
SettingUpdate,
    SettingsUpdate,
    SettingsExport
)
from src.services.settings_service import SettingsService

logger = logging.getLogger(__name__)

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


@router.get("/tool-status")
async def get_tool_status(db: Session = Depends(get_db)):
    """
    Get tool installation status
    
    Returns:
        Tool status information for ffmpeg and aria2c
    """
    try:
        service = SettingsService(db)
        return {
            "success": True,
            "data": service.get_tool_status()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tool status: {str(e)}")


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

        # 将 Pydantic 模型转换为字典
        settings_dict = settings_update.model_dump(exclude_none=True)

        # 一次性更新所有设置
        service.update_settings(settings_dict)

        # 如果更新了sidecar，刷新下载引擎
        if settings_update.storage and 'sidecar' in settings_update.storage:
            from src.services.download_service import download_service
            download_service.update_engine_settings()
        
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
        
        # 从设置中获取下载路径
        settings_service = SettingsService(db)
        settings = settings_service.get_settings()
        downloads_dir = settings.storage.download_path if settings.storage else "./downloads"
        
        if cache_type == "downloads":
            # 清理下载文件
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
        
        # 从设置中获取下载路径
        settings_service = SettingsService(db)
        settings = settings_service.get_settings()
        downloads_dir = settings.storage.download_path if settings.storage else "./downloads"
        
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


@router.get("/cache-info")
async def get_cache_info(db: Session = Depends(get_db)):
    """
    Get cache information
    
    Returns:
        Cache information for log, temp, webview
    """
    try:
        import os
        import platform
        
        # 定义缓存目录（不包含downloads和data，因为那些不是缓存）
        cache_dirs = {
            "log": "logs",
            "temp": "temp",
            "webview": "webview_cache"
        }
        
        cache_info = {}
        
        for cache_type, cache_dir in cache_dirs.items():
            total_size = 0
            file_count = 0
            dir_exists = os.path.exists(cache_dir)
            
            if dir_exists:
                for dirpath, dirnames, filenames in os.walk(cache_dir):
                    for filename in filenames:
                        file_path = os.path.join(dirpath, filename)
                        if os.path.isfile(file_path):
                            try:
                                file_size = os.path.getsize(file_path)
                                total_size += file_size
                                file_count += 1
                            except Exception:
                                pass
            
            cache_info[cache_type] = {
                "exists": dir_exists,
                "path": os.path.abspath(cache_dir) if dir_exists else cache_dir,
                "size": total_size,
                "size_formatted": format_size(total_size),
                "file_count": file_count
            }
        
        return {
            "success": True,
            "data": cache_info
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取缓存信息失败: {str(e)}")


@router.post("/clear-cache/{cache_type}")
async def clear_cache_by_type(
    cache_type: str,
    db: Session = Depends(get_db)
):
    """
    Clear specific cache type
    
    Args:
        cache_type: Cache type to clear (log, temp, webview, database, downloads, all)
    
    Returns:
        Success message with details about cleared files
    """
    try:
        import os
        import shutil
        import logging
        
        logger = logging.getLogger(__name__)
        
        valid_cache_types = ["log", "temp", "webview", "all"]
        
        if cache_type not in valid_cache_types:
            raise HTTPException(
                status_code=400,
                detail=f"无效的缓存类型，必须是: {', '.join(valid_cache_types)}"
            )
        
        if cache_type == "all":
            # 清理所有缓存（不包含downloads，因为那是用户下载的文件）
            deleted_files = 0
            deleted_size = 0
            cache_dirs = ["logs", "temp", "webview_cache"]
            
            for cache_dir in cache_dirs:
                if os.path.exists(cache_dir):
                    try:
                        dir_size = sum(
                            os.path.getsize(os.path.join(dirpath, filename))
                            for dirpath, dirnames, filenames in os.walk(cache_dir)
                            for filename in filenames
                        )
                        shutil.rmtree(cache_dir)
                        deleted_files += 1
                        deleted_size += dir_size
                        logger.info(f"Deleted cache directory: {cache_dir}")
                    except Exception as e:
                        logger.error(f"Failed to delete {cache_dir}: {e}")
            
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
        
        # 清理指定类型的缓存
        cache_dirs_map = {
            "log": "logs",
            "temp": "temp",
            "webview": "webview_cache"
        }
        
        cache_dir = cache_dirs_map[cache_type]
        
        if not os.path.exists(cache_dir):
            return {"success": True, "message": f"{cache_type} 缓存目录不存在，无需清理"}
        
        try:
            dir_size = sum(
                os.path.getsize(os.path.join(dirpath, filename))
                for dirpath, dirnames, filenames in os.walk(cache_dir)
                for filename in filenames
            )
            shutil.rmtree(cache_dir)
            
            return {
                "success": True,
                "message": f"已清理 {cache_type} 缓存",
                "deleted_size": dir_size,
                "deleted_size_formatted": format_size(dir_size)
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"清理 {cache_type} 缓存失败: {str(e)}")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清理缓存失败: {str(e)}")


@router.post("/open-cache/{cache_type}")
async def open_cache_directory(cache_type: str, db: Session = Depends(get_db)):
    """
    Open cache directory in file explorer
    
    Args:
        cache_type: Cache type to open (log, temp, webview, database, downloads)
    
    Returns:
        Success message
    """
    try:
        import os
        import platform
        import subprocess
        
        # 从设置中获取下载路径
        settings_service = SettingsService(db)
        settings = settings_service.get_settings()
        downloads_dir = settings.storage.download_path if settings.storage else "./downloads"
        
        cache_dirs_map = {
            "log": "logs",
            "temp": "temp",
            "webview": "webview_cache",
            "downloads": downloads_dir
        }
        
        if cache_type not in cache_dirs_map:
            raise HTTPException(
                status_code=400,
                detail=f"无效的缓存类型，必须是: {', '.join(cache_dirs_map.keys())}"
            )
        
        cache_dir = cache_dirs_map[cache_type]
        
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir, exist_ok=True)
        
        abs_path = os.path.abspath(cache_dir)
        
        # 根据操作系统打开目录
        if platform.system() == "Windows":
            os.startfile(abs_path)
        elif platform.system() == "Darwin":  # macOS
            subprocess.run(["open", abs_path])
        else:  # Linux
            subprocess.run(["xdg-open", abs_path])
        
        return {
            "success": True,
            "message": f"已打开 {cache_type} 缓存目录",
            "path": abs_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"打开缓存目录失败: {str(e)}")


@router.get("/database/export")
async def export_database():
    """
    Export database to a file
    
    Returns:
        File response for download
    """
    try:
        import os
        from datetime import datetime
        from fastapi.responses import FileResponse
        
        # 获取数据库文件路径
        db_path = "pilinote.db"
        
        if not os.path.exists(db_path):
            raise HTTPException(status_code=404, detail="数据库文件不存在")
        
        # 生成导出文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_filename = f"pilinote_backup_{timestamp}.db"
        
        # 创建备份目录
        backup_dir = "backups"
        os.makedirs(backup_dir, exist_ok=True)
        
        # 复制数据库文件到备份目录
        backup_path = os.path.join(backup_dir, export_filename)
        shutil.copy2(db_path, backup_path)
        
        # 返回文件下载
        return FileResponse(
            path=backup_path,
            filename=export_filename,
            media_type="application/x-sqlite3",
            headers={
                "Content-Disposition": f"attachment; filename={export_filename}"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出数据库失败: {str(e)}")


@router.post("/database/import")
async def import_database(file: UploadFile = File(..., description="Database file to import")):
    """
    Import database from a file
    
    Args:
        file: Uploaded database file
    
    Returns:
        Success message
    """
    try:
        import os
        import shutil
        from datetime import datetime
        import tempfile
        
        # 验证文件类型
        if not file.filename.endswith('.db'):
            raise HTTPException(status_code=400, detail="数据库文件必须是.db格式")
        
        # 备份当前数据库
        current_db_path = "pilinote.db"
        backup_path = None
        
        if os.path.exists(current_db_path):
            backup_dir = "backups"
            os.makedirs(backup_dir, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = os.path.join(backup_dir, f"pilinote_backup_{timestamp}.db")
            shutil.copy2(current_db_path, backup_path)
        
        # 保存上传的文件到临时位置
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        temp_file.write(await file.read())
        temp_file.close()
        
        try:
            # 验证SQLite数据库文件
            import sqlite3
            try:
                conn = sqlite3.connect(temp_file.name)
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = cursor.fetchall()
                conn.close()
                
                if not tables:
                    raise HTTPException(status_code=400, detail="无效的SQLite数据库文件")
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"无效的SQLite数据库文件: {str(e)}")
            
            # 导入数据库
            shutil.copy2(temp_file.name, current_db_path)
            
            return {
                "success": True,
                "message": "数据库导入成功",
                "backup_path": backup_path
            }
        finally:
            # 清理临时文件
            if os.path.exists(temp_file.name):
                os.unlink(temp_file.name)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入数据库失败: {str(e)}")


@router.post("/cleanup/trigger")
async def trigger_cleanup():
    """
    手动触发清理任务
    
    Returns:
        清理结果
    """
    try:
        from src.services.scheduler_service import scheduler_service
        
        # 执行清理
        scheduler_service.cleanup_old_temp_files()
        
        return {
            "success": True,
            "message": "清理任务已触发"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"清理任务触发失败: {str(e)}"
        )


@router.get("/cleanup/status")
async def get_cleanup_status():
    """
    获取清理状态
    
    Returns:
        清理状态信息
    """
    try:
        from pathlib import Path
        from datetime import datetime, timedelta
        
        # 获取临时路径
        from src.services.settings_service import SettingsService
        from src.database import SessionLocal
        
        with SessionLocal() as db:
            settings_service = SettingsService(db)
            settings = settings_service.get_settings()
            temp_path = settings.storage.temp_path
        
        temp_dir = Path(temp_path)
        if not temp_dir.exists():
            return {
                "temp_path": str(temp_path),
                "exists": False,
                "total_count": 0,
                "old_count": 0,
                "recent_count": 0
            }
        
        # 统计临时文件
        now = datetime.now()
        cutoff_time = now - timedelta(hours=24)
        
        total_count = 0
        old_count = 0
        recent_count = 0
        
        for item in temp_dir.iterdir():
            if item.is_dir():
                total_count += 1
                mod_time = datetime.fromtimestamp(item.stat().st_mtime)
                if mod_time < cutoff_time:
                    old_count += 1
                else:
                    recent_count += 1
        
        return {
            "temp_path": str(temp_path),
            "exists": True,
            "total_count": total_count,
            "old_count": old_count,
            "recent_count": recent_count,
            "cutoff_time": cutoff_time.strftime('%Y-%m-%d %H:%M:%S')
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取清理状态失败: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入数据库失败: {str(e)}")