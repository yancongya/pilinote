from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from pathlib import Path
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
    video_id: str, file_type: str = Query(..., description="文件类型: subtitle, note")
):
    """读取本地字幕或笔记文件"""
    try:
        video_dir = find_video_dir(video_id)

        if not video_dir:
            return LocalFileResponse(success=False, error=f"找不到视频目录: {video_id}")

        if file_type == "subtitle":
            # 查找字幕文件
            srt_files = list(video_dir.glob("*.srt"))
            if not srt_files:
                return LocalFileResponse(success=True, data="")
            content = srt_files[0].read_text(encoding="utf-8")
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
    video_id: str, file_type: str = Query(...), request: SaveFileRequest = None
):
    content = request.content if request else ""
    """保存本地字幕或笔记文件"""
    try:
        video_dir = find_video_dir(video_id)

        if not video_dir:
            return LocalFileResponse(success=False, error=f"找不到视频目录: {video_id}")

        if file_type == "subtitle":
            srt_files = list(video_dir.glob("*.srt"))
            if srt_files:
                srt_files[0].write_text(content, encoding="utf-8")
                return LocalFileResponse(success=True)

        elif file_type == "note":
            md_files = list(video_dir.glob("*.ai-note.md"))
            if md_files:
                md_files[0].write_text(content, encoding="utf-8")
                return LocalFileResponse(success=True)

        return LocalFileResponse(success=False, error="文件不存在")

    except Exception as e:
        return LocalFileResponse(success=False, error=str(e))
