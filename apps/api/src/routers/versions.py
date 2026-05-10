"""版本管理 API 路由"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from pathlib import Path
from typing import Optional
import logging

from src.services.version_manager import VersionManager
from src.routers.local import find_video_dir, resolve_video_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/local/versions", tags=["版本管理"])


def _get_vm(video_id: str) -> VersionManager:
    video_dir, _ = resolve_video_context(video_id)
    if not video_dir:
        raise HTTPException(status_code=404, detail=f"找不到视频目录: {video_id}")
    return VersionManager(video_dir)


def _preferred_stem(video_id: str) -> Optional[str]:
    _, stem = resolve_video_context(video_id)
    return stem


async def _list_subtitle_files_for(video_id: str):
    vm = _get_vm(video_id)
    files = vm.list_subtitle_files()
    stem = _preferred_stem(video_id)
    if stem:
        files = [file for file in files if str(file.get("name", "")).startswith(f"{stem}.")]
    return {"success": True, "data": files}


async def _get_versions_for(video_id: str, type: str, filename: Optional[str] = None):
    vm = _get_vm(video_id)
    data = await vm.get_versions(type, filename=filename)
    return {"success": True, "data": data}


async def _get_version_content_for(
    video_id: str,
    hash_val: str,
    type: str,
    filename: Optional[str] = None,
):
    vm = _get_vm(video_id)
    content = await vm.get_version_content(type, hash_val, filename=filename)
    if content is None:
        return {"success": False, "error": "版本不存在"}
    return {"success": True, "data": content}


async def _switch_version_for(video_id: str, req):
    vm = _get_vm(video_id)
    ok = await vm.switch_version(req.type, req.hash, filename=req.filename)
    if not ok:
        return {"success": False, "error": "切换失败（版本不存在或为当前版本）"}
    return {"success": True}


async def _delete_version_for(
    video_id: str,
    hash_val: str,
    type: str,
    filename: Optional[str] = None,
):
    vm = _get_vm(video_id)
    ok = await vm.delete_version(type, hash_val, filename=filename)
    if not ok:
        return {"success": False, "error": "删除失败（版本不存在或为当前版本）"}
    return {"success": True}


async def _save_version_for(video_id: str, req):
    vm = _get_vm(video_id)
    meta = await vm.save_version(
        req.type,
        req.content,
        req.source,
        req.label,
        filename=req.filename,
    )
    return {"success": True, "data": meta.to_dict()}


class VersionResponse(BaseModel):
    success: bool
    data: dict = None
    error: str = None


class SwitchRequest(BaseModel):
    type: str  # subtitle | note
    hash: str
    filename: Optional[str] = None


class SaveVersionRequest(BaseModel):
    type: str  # subtitle | note
    content: str
    source: str = "manual"  # ai | manual
    label: str = ""
    filename: Optional[str] = None


@router.get("/by-path/subtitle-files")
async def list_subtitle_files_by_path(video_id: str = Query(...)):
    """按绝对文件路径列出字幕文件。"""
    try:
        return await _list_subtitle_files_for(video_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("按路径列出字幕文件失败: %s", e)
        return {"success": False, "error": str(e)}


@router.get("/by-path")
async def get_versions_by_path(
    video_id: str = Query(...),
    type: str = Query(..., description="subtitle | note"),
    filename: Optional[str] = Query(None, description="字幕文件名"),
):
    try:
        return await _get_versions_for(video_id, type, filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("按路径获取版本列表失败: %s", e)
        return {"success": False, "error": str(e)}


@router.get("/by-path/content/{hash_val}")
async def get_version_content_by_path(
    hash_val: str,
    video_id: str = Query(...),
    type: str = Query(...),
    filename: Optional[str] = Query(None, description="字幕文件名"),
):
    try:
        return await _get_version_content_for(video_id, hash_val, type, filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("按路径获取版本内容失败: %s", e)
        return {"success": False, "error": str(e)}


@router.post("/by-path/switch")
async def switch_version_by_path(req: SwitchRequest, video_id: str = Query(...)):
    try:
        return await _switch_version_for(video_id, req)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("按路径切换版本失败: %s", e)
        return {"success": False, "error": str(e)}


@router.delete("/by-path/content/{hash_val}")
async def delete_version_by_path(
    hash_val: str,
    video_id: str = Query(...),
    type: str = Query(...),
    filename: Optional[str] = Query(None, description="字幕文件名"),
):
    try:
        return await _delete_version_for(video_id, hash_val, type, filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("按路径删除版本失败: %s", e)
        return {"success": False, "error": str(e)}


@router.post("/by-path")
async def save_version_by_path(req: SaveVersionRequest, video_id: str = Query(...)):
    try:
        return await _save_version_for(video_id, req)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("按路径保存版本失败: %s", e)
        return {"success": False, "error": str(e)}


# ---- 字幕文件列表 ----

@router.get("/subtitle-files/{video_id}")
async def list_subtitle_files(video_id: str):
    """列出视频目录下所有字幕文件，供前端下拉选择"""
    try:
        return await _list_subtitle_files_for(video_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("列出字幕文件失败: %s", e)
        return {"success": False, "error": str(e)}


# ---- 版本列表 ----

@router.get("/{video_id}")
async def get_versions(
    video_id: str,
    type: str = Query(..., description="subtitle | note"),
    filename: Optional[str] = Query(None, description="字幕文件名（如 xxx.ai-zh.srt）"),
):
    """获取版本列表"""
    try:
        return await _get_versions_for(video_id, type, filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("获取版本列表失败: %s", e)
        return {"success": False, "error": str(e)}


# ---- 版本内容 ----

@router.get("/{video_id}/{hash_val}")
async def get_version_content(
    video_id: str,
    hash_val: str,
    type: str = Query(...),
    filename: Optional[str] = Query(None, description="字幕文件名"),
):
    """获取指定版本的内容"""
    try:
        return await _get_version_content_for(video_id, hash_val, type, filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("获取版本内容失败: %s", e)
        return {"success": False, "error": str(e)}


# ---- 切换版本 ----

@router.post("/{video_id}/switch")
async def switch_version(video_id: str, req: SwitchRequest):
    """切换到指定版本"""
    try:
        return await _switch_version_for(video_id, req)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("切换版本失败: %s", e)
        return {"success": False, "error": str(e)}


# ---- 删除版本 ----

@router.delete("/{video_id}/{hash_val}")
async def delete_version(
    video_id: str,
    hash_val: str,
    type: str = Query(...),
    filename: Optional[str] = Query(None, description="字幕文件名"),
):
    """删除指定版本"""
    try:
        return await _delete_version_for(video_id, hash_val, type, filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("删除版本失败: %s", e)
        return {"success": False, "error": str(e)}


# ---- 保存新版本 ----

@router.post("/{video_id}")
async def save_version(video_id: str, req: SaveVersionRequest):
    """保存一个新版本"""
    try:
        return await _save_version_for(video_id, req)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("保存版本失败: %s", e)
        return {"success": False, "error": str(e)}
