from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from pathlib import Path
from typing import Optional
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/local", tags=["本地文件"])


class LocalFileResponse(BaseModel):
    success: bool
    data: str = None
    error: str = None


def find_video_dir(video_id: str) -> Path:
    """根据video_id找到视频目录"""
    import os

    # 硬编码项目根目录
    project_root = Path("/Users/tanyancong/工作/开发/pilinote")
    downloads = project_root / "downloads"
    logger.info(
        f"find_video_dir: video_id={video_id}, project_root={project_root}, downloads={downloads}, exists={downloads.exists()}"
    )

    # 直接作为路径
    if Path(video_id).exists():
        return Path(video_id)

    if not downloads.exists():
        logger.info("downloads dir does not exist")
        return None

    # 在downloads目录下查找匹配
    for item in downloads.iterdir():
        if item.is_dir():
            # 检查目录名是否包含video_id
            if video_id in item.name:
                return item
            # 检查目录下是否有匹配的nfo文件
            nfo_files = list(item.glob("*.nfo"))
            for nfo in nfo_files:
                if video_id in nfo.read_text():
                    return item

    return None


@router.get("/file/{video_id}", response_model=LocalFileResponse)
async def get_local_file(
    video_id: str,
    file_type: str = Query(..., description="文件类型: subtitle, note"),
    filename: Optional[str] = Query(None, description="指定字幕文件名（如 xxx.ai-zh.srt）"),
):
    """读取本地字幕或笔记文件"""
    try:
        video_dir = find_video_dir(video_id)

        if not video_dir:
            return LocalFileResponse(success=False, error=f"找不到视频目录: {video_id}")

        if file_type == "subtitle":
            if filename:
                # 直接读取指定字幕文件
                srt_file = video_dir / filename
                if not srt_file.exists():
                    return LocalFileResponse(success=False, error=f"字幕文件不存在: {filename}")
                content = srt_file.read_text(encoding="utf-8")
            else:
                # 按优先级查找字幕文件
                from src.services.version_manager import VersionManager
                srt_file = VersionManager.find_subtitle_file(video_dir)
                if not srt_file:
                    return LocalFileResponse(success=True, data="")
                content = srt_file.read_text(encoding="utf-8")
            return LocalFileResponse(success=True, data=content)

        elif file_type == "note":
            # 查找笔记文件
            md_files = list(video_dir.glob("*.ai-note.md"))
            if not md_files:
                return LocalFileResponse(success=True, data="")
            content = md_files[0].read_text(encoding="utf-8")
            return LocalFileResponse(success=True, data=content)

        else:
            return LocalFileResponse(
                success=False, error=f"不支持的文件类型: {file_type}"
            )

    except Exception as e:
        return LocalFileResponse(success=False, error=str(e))


class SaveFileRequest(BaseModel):
    content: str = ""


@router.post("/file/{video_id}")
async def save_local_file(
    video_id: str,
    file_type: str = Query(...),
    filename: Optional[str] = Query(None, description="指定字幕文件名"),
    request: SaveFileRequest = None,
):
    content = request.content if request else ""
    """保存本地字幕或笔记文件（写入后自动保存版本快照）"""
    try:
        video_dir = find_video_dir(video_id)

        if not video_dir:
            return LocalFileResponse(success=False, error=f"找不到视频目录: {video_id}")

        if file_type == "subtitle":
            if filename:
                # 写入指定字幕文件
                srt_file = video_dir / filename
                if not srt_file.exists():
                    return LocalFileResponse(success=False, error=f"字幕文件不存在: {filename}")
            else:
                # 按优先级查找字幕文件
                from src.services.version_manager import VersionManager
                srt_file = VersionManager.find_subtitle_file(video_dir)
                filename = srt_file.name if srt_file else None

            if srt_file:
                srt_file.write_text(content, encoding="utf-8")
                # 写入后自动保存版本快照（传入实际文件名）
                if content.strip() and filename:
                    try:
                        from src.services.version_manager import VersionManager
                        vm = VersionManager(video_dir)
                        await vm.save_version("subtitle", content, source="auto", label="保存后自动快照", filename=filename)
                    except Exception as e:
                        logger.warning("自动版本快照失败（不影响保存）: %s", e)
                return LocalFileResponse(success=True)

        elif file_type == "note":
            md_files = list(video_dir.glob("*.ai-note.md"))
            if md_files:
                md_files[0].write_text(content, encoding="utf-8")
                # 写入后自动保存版本快照
                if content.strip():
                    try:
                        from src.services.version_manager import VersionManager
                        vm = VersionManager(video_dir)
                        await vm.save_version("note", content, source="auto", label="保存后自动快照")
                    except Exception as e:
                        logger.warning("自动版本快照失败（不影响保存）: %s", e)
                return LocalFileResponse(success=True)

        return LocalFileResponse(success=False, error="文件不存在")

    except Exception as e:
        return LocalFileResponse(success=False, error=str(e))
