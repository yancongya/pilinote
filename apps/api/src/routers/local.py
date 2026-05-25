from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from pathlib import Path
from typing import Optional
import os
import logging
from src.config import settings as app_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/local", tags=["本地文件"])


class LocalFileResponse(BaseModel):
    success: bool
    data: Optional[str] = None
    error: Optional[str] = None
    file_path: Optional[str] = None
    folder_path: Optional[str] = None


def resolve_video_context(video_id: str) -> tuple[Optional[Path], Optional[str]]:
    """Resolve a video id or local file path to its working directory and optional file stem."""
    direct_path = Path(video_id)
    if direct_path.exists():
        if direct_path.is_file():
            return direct_path.parent, direct_path.stem
        return direct_path, None

    video_dir = find_video_dir(video_id)
    return video_dir, None


def find_video_dir(video_id: str) -> Path:
    """根据video_id找到视频目录"""
    import os

    downloads = Path(app_settings.default_download_path)
    try:
        from src.database import SessionLocal
        from src.services.settings_service import SettingsService

        db = SessionLocal()
        try:
            current_settings = SettingsService(db).get_settings()
            if current_settings.storage.download_path:
                downloads = Path(current_settings.storage.download_path)
        finally:
            db.close()
    except Exception as exc:
        logger.debug("find_video_dir: failed to load storage settings, fallback to default: %s", exc)
    logger.info(
        f"find_video_dir: video_id={video_id}, downloads={downloads}, exists={downloads.exists()}"
    )

    # 直接作为路径
    direct_path = Path(video_id)
    if direct_path.exists():
        return direct_path.parent if direct_path.is_file() else direct_path

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


def build_note_file_response(video_dir: Path, preferred_stem: Optional[str] = None) -> LocalFileResponse:
    """构造笔记文件响应，携带目录与文件路径信息。"""
    md_files = []
    if preferred_stem:
        preferred = video_dir / f"{preferred_stem}.ai-note.md"
        # When a specific file stem is requested (typically by passing a local
        # video file path), only return the matching note. Do not fall back to
        # other notes in the folder, otherwise multi-part pages may show the
        # wrong episode note.
        if not preferred.exists():
            return LocalFileResponse(
                success=True,
                data="",
                folder_path=str(video_dir),
            )
        md_files.append(preferred)
    md_files.extend(
        file for file in sorted(video_dir.glob("*.ai-note.md")) if file not in md_files
    )
    if not md_files:
        return LocalFileResponse(
            success=True,
            data="",
            folder_path=str(video_dir),
        )

    note_file = md_files[0]
    content = note_file.read_text(encoding="utf-8")
    return LocalFileResponse(
        success=True,
        data=content,
        file_path=str(note_file),
        folder_path=str(video_dir),
    )


def build_source_markdown_response(video_dir: Path, preferred_stem: Optional[str] = None) -> LocalFileResponse:
    """构造图文原文响应，优先返回同名 Markdown 正文。"""
    md_files = []
    if preferred_stem:
        preferred = video_dir / f"{preferred_stem}.md"
        if preferred.exists() and not preferred.name.endswith(".ai-note.md"):
            md_files.append(preferred)
    md_files.extend([
        f for f in video_dir.glob("*.md")
        if not f.name.endswith(".ai-note.md") and f not in md_files
    ])
    if not md_files:
        return LocalFileResponse(
            success=True,
            data="",
            folder_path=str(video_dir),
        )

    note_file = sorted(md_files, key=lambda f: f.name)[0]
    content = note_file.read_text(encoding="utf-8")
    return LocalFileResponse(
        success=True,
        data=content,
        file_path=str(note_file),
        folder_path=str(video_dir),
    )


@router.get("/file/{video_id:path}", response_model=LocalFileResponse)
async def get_local_file(
    video_id: str,
    file_type: str = Query(..., description="文件类型: subtitle, note, source"),
    filename: Optional[str] = Query(None, description="指定字幕文件名（如 xxx.ai-zh.srt）"),
):
    """读取本地字幕或笔记文件"""
    try:
        video_dir, preferred_stem = resolve_video_context(video_id)

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
                srt_file = None
                if preferred_stem:
                    for pattern in VersionManager.SUBTITLE_PATTERNS:
                        candidates = sorted(video_dir.glob(pattern))
                        srt_file = next((file for file in candidates if file.name.startswith(f"{preferred_stem}.")), None)
                        if srt_file:
                            break
                if not srt_file:
                    srt_file = VersionManager.find_subtitle_file(video_dir)
                if not srt_file:
                    return LocalFileResponse(success=True, data="")
                content = srt_file.read_text(encoding="utf-8")
            return LocalFileResponse(success=True, data=content)

        elif file_type == "note":
            return build_note_file_response(video_dir, preferred_stem)

        elif file_type == "source":
            return build_source_markdown_response(video_dir, preferred_stem)

        else:
            return LocalFileResponse(
                success=False, error=f"不支持的文件类型: {file_type}"
            )

    except Exception as e:
        return LocalFileResponse(success=False, error=str(e))


class SaveFileRequest(BaseModel):
    content: str = ""


@router.post("/file/{video_id:path}")
async def save_local_file(
    video_id: str,
    file_type: str = Query(...),
    filename: Optional[str] = Query(None, description="指定字幕文件名"),
    request: SaveFileRequest = None,
):
    content = request.content if request else ""
    """保存本地字幕或笔记文件（写入后自动保存版本快照）"""
    try:
        video_dir, preferred_stem = resolve_video_context(video_id)

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
            md_files = []
            if preferred_stem:
                preferred = video_dir / f"{preferred_stem}.ai-note.md"
                if preferred.exists():
                    md_files.append(preferred)
            md_files.extend(
                file for file in sorted(video_dir.glob("*.ai-note.md")) if file not in md_files
            )
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
