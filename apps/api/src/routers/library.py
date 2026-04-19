"""
本地视频库管理路由
提供本地视频库扫描、导入和清理功能
"""

import os
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List

from src.database import get_db
from src.services.local_library_service import LocalLibraryService, LibraryScanResult
from src.services.cache.video_cache import VideoCacheService


router = APIRouter(prefix="/api/library", tags=["本地视频库"])


@router.get("/statistics")
async def get_library_statistics(db: Session = Depends(get_db)):
    """
    获取本地视频库统计信息

    Returns:
        视频库统计信息（文件数量、总大小、数据库记录等）
    """
    cache_service = VideoCacheService()
    cached = cache_service.get("local_library", key="statistics")
    if cached and cached.get("success"):
        return cached

    try:
        service = LocalLibraryService(db)
        stats = service.get_library_statistics()
        response = {"success": True, "data": stats}
        cache_service.set("local_library", response, key="statistics")
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取视频库统计信息失败: {str(e)}")


@router.post("/scan")
async def scan_library(db: Session = Depends(get_db)):
    """
    扫描本地视频库并同步状态

    Returns:
        扫描结果，包括新文件、已存在文件、文件丢失的记录
    """
    try:
        service = LocalLibraryService(db)
        result = service.scan_library()

        return {
            "success": True,
            "data": result.to_dict(),
            "message": f"扫描完成：发现 {result.total_files} 个文件，其中 {len(result.new_files)} 个新文件，{len(result.missing_files)} 个文件丢失",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"扫描视频库失败: {str(e)}")


@router.post("/import")
async def import_new_files(
    import_all: bool = Query(False, description="是否导入所有新文件"),
    file_paths: Optional[List[str]] = Body(None, description="要导入的文件路径列表"),
    db: Session = Depends(get_db),
):
    """
    导入新发现的视频文件到数据库

    Args:
        import_all: 是否导入所有新文件（默认为False）
        file_paths: 要导入的文件路径列表（如果import_all为False）

    Returns:
        导入结果
    """
    try:
        service = LocalLibraryService(db)

        # 先扫描获取新文件
        scan_result = service.scan_library()

        if not scan_result.new_files:
            return {
                "success": True,
                "message": "没有新文件需要导入",
                "imported_count": 0,
                "imported_files": [],
            }

        # 确定要导入的文件
        files_to_import = scan_result.new_files

        if not import_all and file_paths:
            # 只导入指定的文件
            files_to_import = [f for f in scan_result.new_files if f.path in file_paths]

        if not files_to_import:
            return {
                "success": True,
                "message": "没有选择要导入的文件",
                "imported_count": 0,
                "imported_files": [],
            }

        # 执行导入
        imported_count, imported_paths = service.import_new_files(files_to_import)

        return {
            "success": True,
            "message": f"成功导入 {imported_count} 个视频文件",
            "imported_count": imported_count,
            "imported_files": imported_paths,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入文件失败: {str(e)}")


@router.post("/cleanup")
async def cleanup_missing_files(
    auto_cleanup: bool = Query(False, description="是否自动清理所有文件丢失的记录"),
    download_ids: Optional[List[str]] = Body(
        None, description="要清理的下载记录ID列表"
    ),
    db: Session = Depends(get_db),
):
    """
    清理文件丢失的下载记录

    Args:
        auto_cleanup: 是否自动清理所有文件丢失的记录（默认为False）
        download_ids: 要清理的下载记录ID列表（如果auto_cleanup为False）

    Returns:
        清理结果
    """
    try:
        service = LocalLibraryService(db)

        if auto_cleanup:
            # 清理所有文件丢失的记录
            scan_result = service.scan_library()
            ids_to_cleanup = [d.id for d in scan_result.missing_files]
        else:
            # 清理指定的记录
            ids_to_cleanup = download_ids or []

        if not ids_to_cleanup:
            return {
                "success": True,
                "message": "没有需要清理的记录",
                "cleaned_count": 0,
            }

        # 执行清理
        cleaned_count = service.cleanup_missing_files(ids_to_cleanup)

        return {
            "success": True,
            "message": f"成功清理 {cleaned_count} 个文件丢失的记录",
            "cleaned_count": cleaned_count,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清理记录失败: {str(e)}")


@router.post("/sync")
async def sync_library(
    auto_import: bool = Query(False, description="是否自动导入新文件"),
    auto_cleanup: bool = Query(False, description="是否自动清理文件丢失的记录"),
    db: Session = Depends(get_db),
):
    """
    完整同步本地视频库（扫描 + 导入 + 清理）

    Args:
        auto_import: 是否自动导入新文件
        auto_cleanup: 是否自动清理文件丢失的记录

    Returns:
        同步结果
    """
    try:
        service = LocalLibraryService(db)

        # 1. 扫描视频库
        scan_result = service.scan_library()

        imported_count = 0
        cleaned_count = 0

        # 2. 自动导入新文件
        if auto_import and scan_result.new_files:
            imported_count, _ = service.import_new_files(scan_result.new_files)

        # 3. 自动清理文件丢失的记录
        if auto_cleanup and scan_result.missing_files:
            missing_ids = [d.id for d in scan_result.missing_files]
            cleaned_count = service.cleanup_missing_files(missing_ids)

        return {
            "success": True,
            "message": f"同步完成：扫描 {scan_result.total_files} 个文件",
            "data": {
                "scan_result": scan_result.to_dict(),
                "imported_count": imported_count,
                "cleaned_count": cleaned_count,
                "auto_import": auto_import,
                "auto_cleanup": auto_cleanup,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"同步视频库失败: {str(e)}")


@router.get("/image")
async def get_local_image(file_path: str = Query(..., description="本地图片文件路径")):
    """
    获取本地图片文件

    Args:
        file_path: 本地图片文件的绝对路径

    Returns:
        图片文件
    """
    try:
        # 安全检查：确保路径是合法的
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"文件不存在: {file_path}")

        # 检查文件类型
        allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
        file_ext = os.path.splitext(file_path)[1].lower()

        if file_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail=f"不支持的文件类型: {file_ext}")

        # 返回文件
        return FileResponse(
            file_path,
            media_type=f"image/{file_ext[1:]}",  # 去掉点号
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取图片失败: {str(e)}")


@router.get("/video")
async def get_local_video(file_path: str = Query(..., description="本地视频文件路径")):
    """
    获取本地视频文件
    """
    try:
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"文件不存在: {file_path}")

        media_types = {
            ".mp4": "video/mp4",
            ".m4v": "video/mp4",
            ".webm": "video/webm",
            ".mkv": "video/x-matroska",
            ".flv": "video/x-flv",
            ".avi": "video/x-msvideo",
            ".mov": "video/quicktime",
            ".wmv": "video/x-ms-wmv",
        }
        file_ext = os.path.splitext(file_path)[1].lower()

        if file_ext not in media_types:
            raise HTTPException(status_code=400, detail=f"不支持的视频类型: {file_ext}")

        return FileResponse(file_path, media_type=media_types[file_ext])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取视频失败: {str(e)}")


@router.post("/nfo/update")
async def update_nfo_file(
    nfo_path: str = Body(..., embed=True), db: Session = Depends(get_db)
):
    """
    更新单个NFO文件的元数据

    Args:
        nfo_path: NFO文件路径

    Returns:
        更新结果
    """
    try:
        from src.services.nfo_update_service import NFOUpdateService

        nfo_service = NFOUpdateService()
        result = await nfo_service.update_single_nfo(nfo_path)

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新NFO文件失败: {str(e)}")


@router.post("/nfo/batch-update")
async def batch_update_nfo_files(
    directory: str = Body(..., embed=True),
    limit: int = Body(10, embed=True),
    offset: int = Body(0, embed=True),
    db: Session = Depends(get_db),
):
    """
    批量更新目录下的NFO文件（支持分页）

    Args:
        directory: 目录路径
        limit: 最大更新数量（默认10）
        offset: 跳过的文件数量（默认0，用于分页）

    Returns:
        批量更新结果
    """
    try:
        from src.services.nfo_update_service import NFOUpdateService

        nfo_service = NFOUpdateService()
        result = await nfo_service.batch_update_nfos(directory, limit, offset)

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量更新NFO文件失败: {str(e)}")
