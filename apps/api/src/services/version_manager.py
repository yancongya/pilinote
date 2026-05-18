"""AI 内容版本管理服务

为字幕和笔记提供类似 git 的版本管理功能，支持版本切换、删除、diff 和查看原文。
版本文件存储在视频目录下的 ai-versions/ 子目录中，使用 gzip 压缩。
"""

import gzip
import hashlib
import json
import os
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import logging

logger = logging.getLogger(__name__)

# 每个 video_id 对应一把锁，防止并发写 versions.json
_locks: dict[str, asyncio.Lock] = {}
_locks_guard = asyncio.Lock()


async def _get_lock(video_id: str) -> asyncio.Lock:
    async with _locks_guard:
        if video_id not in _locks:
            _locks[video_id] = asyncio.Lock()
        return _locks[video_id]


# ---------------------------------------------------------------------------
# 元数据结构
# ---------------------------------------------------------------------------

class VersionMeta:
    """单条版本元数据"""

    def __init__(self, hash: str, timestamp: int, filename: str,
                 source: str = "manual", label: str = ""):
        self.hash = hash
        self.timestamp = timestamp
        self.filename = filename
        self.source = source  # ai | manual
        self.label = label

    def to_dict(self) -> dict:
        return {
            "hash": self.hash,
            "timestamp": self.timestamp,
            "filename": self.filename,
            "source": self.source,
            "label": self.label,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "VersionMeta":
        return cls(
            hash=d["hash"],
            timestamp=d["timestamp"],
            filename=d["filename"],
            source=d.get("source", "manual"),
            label=d.get("label", ""),
        )


class VersionIndex:
    """versions.json 读写容器"""

    def __init__(self):
        self.versions: list[VersionMeta] = []
        self.current: str = ""  # 当前版本的 hash

    def to_dict(self) -> dict:
        return {
            "versions": [v.to_dict() for v in self.versions],
            "current": self.current,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "VersionIndex":
        idx = cls()
        idx.versions = [VersionMeta.from_dict(v) for v in d.get("versions", [])]
        idx.current = d.get("current", "")
        return idx


# ---------------------------------------------------------------------------
# VersionManager
# ---------------------------------------------------------------------------

class VersionManager:
    """版本管理核心服务"""

    # 版本文件后缀映射
    EXT_MAP = {
        "subtitle": "srt",
        "note": "md",
    }

    # 字幕文件 glob 模式（优先级从高到低）
    SUBTITLE_PATTERNS = ["*.zh-CN.ai.srt", "*.zh-CN.srt", "*.ai-zh.srt", "*.srt"]
    NOTE_PATTERNS = ["*.ai-note.md"]

    @staticmethod
    def find_subtitle_file(video_dir: Path) -> Optional[Path]:
        """按优先级查找字幕文件，与 GET /api/local/file 保持一致"""
        for pattern in VersionManager.SUBTITLE_PATTERNS:
            files = list(video_dir.glob(pattern))
            if files:
                return files[0]
        return None

    @staticmethod
    def find_note_file(video_dir: Path) -> Optional[Path]:
        """按优先级查找笔记文件"""
        for pattern in VersionManager.NOTE_PATTERNS:
            files = list(video_dir.glob(pattern))
            if files:
                return files[0]
        return None

    @staticmethod
    def make_content_type(content_type: str, filename: Optional[str] = None) -> str:
        """构造带文件名的 content_type，用于按文件独立存储版本

        例如: ("subtitle", "xxx.ai-zh.srt") → "subtitle/xxx.ai-zh.srt"
              ("subtitle", None)              → "subtitle"
        """
        if filename and content_type == "subtitle":
            return f"subtitle/{filename}"
        return content_type

    def __init__(self, video_dir: Path):
        self.video_dir = video_dir
        self.versions_base = video_dir / "ai-versions"

    # ---- 路径工具 ----

    def _versions_dir(self, content_type: str) -> Path:
        d = self.versions_base / content_type
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _versions_json(self, content_type: str) -> Path:
        return self._versions_dir(content_type) / "versions.json"

    def _current_file(self, content_type: str) -> Optional[Path]:
        """返回当前正在使用的主文件路径"""
        if content_type.startswith("subtitle/"):
            filename = content_type[len("subtitle/"):]
            fp = self.video_dir / filename
            return fp if fp.exists() else None
        elif content_type == "subtitle":
            return self.find_subtitle_file(self.video_dir)
        elif content_type == "note":
            return self.find_note_file(self.video_dir)
        return None

    def list_subtitle_files(self) -> list[dict]:
        """列出视频目录下所有字幕文件，供前端下拉选择"""
        result = []
        seen_stems = set()
        for pattern in self.SUBTITLE_PATTERNS:
            for f in self.video_dir.glob(pattern):
                if f.stem not in seen_stems:
                    seen_stems.add(f.stem)
                    # 推断来源标签
                    filename_lower = f.name.lower()
                    if ".ai." in filename_lower or ".ai-" in filename_lower:
                        source_label = "AI语音识别"
                    elif ".zh-cn" in filename_lower:
                        source_label = "B站CC字幕"
                    else:
                        source_label = "字幕"
                    result.append({
                        "name": f.name,
                        "path": str(f),
                        "source_label": source_label,
                    })
        return result

    # ---- 元数据读写 ----

    def _read_index(self, content_type: str) -> VersionIndex:
        p = self._versions_json(content_type)
        if not p.exists():
            return VersionIndex()
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            return VersionIndex.from_dict(data)
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning("versions.json 损坏，将重建: %s", e)
            return VersionIndex()

    def _write_index(self, content_type: str, index: VersionIndex):
        p = self._versions_json(content_type)
        # 原子写入：先写 .tmp 再 rename
        tmp = p.with_suffix(".tmp")
        tmp.write_text(json.dumps(index.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(p)

    # ---- 版本文件操作 ----

    @staticmethod
    def _content_hash(content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()[:8]

    @staticmethod
    def _make_filename(timestamp_ms: int, short_hash: str, ext: str) -> str:
        dt = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
        ts_str = dt.strftime("%Y%m%d%H%M%S")
        return f"v_{ts_str}_{short_hash}.{ext}.gz"

    def _write_version_file(self, content_type: str, filename: str, content: str):
        d = self._versions_dir(content_type)
        fp = d / filename
        with gzip.open(fp, "wt", encoding="utf-8") as f:
            f.write(content)

    def _read_version_file(self, content_type: str, filename: str) -> str:
        fp = self._versions_dir(content_type) / filename
        if not fp.exists():
            raise FileNotFoundError(f"版本文件不存在: {fp}")
        with gzip.open(fp, "rt", encoding="utf-8") as f:
            return f.read()

    # ---- 公开 API ----

    async def save_version(self, content_type: str, content: str,
                           source: str = "manual", label: str = "",
                           filename: Optional[str] = None) -> VersionMeta:
        """保存一个新版本

        如果内容与当前版本相同则跳过。
        filename: 字幕文件名（如 "xxx.ai-zh.srt"），用于按文件独立存储版本。
        """
        ct = self.make_content_type(content_type, filename)
        lock = await _get_lock(str(self.video_dir))
        async with lock:
            short_hash = self._content_hash(content)
            ext = self.EXT_MAP.get(content_type, "txt")
            timestamp_ms = int(datetime.now(tz=timezone.utc).timestamp() * 1000)
            version_filename = self._make_filename(timestamp_ms, short_hash, ext)

            index = self._read_index(ct)

            # 如果内容与当前版本完全相同，跳过
            if index.current == short_hash:
                logger.debug("内容未变化，跳过版本保存: %s/%s", self.video_dir.name, ct)
                return next((v for v in index.versions if v.hash == short_hash), None) or VersionMeta(
                    hash=short_hash, timestamp=timestamp_ms, filename=version_filename, source=source, label=label
                )

            # 写入版本文件
            self._write_version_file(ct, version_filename, content)

            # 更新元数据
            meta = VersionMeta(
                hash=short_hash,
                timestamp=timestamp_ms,
                filename=version_filename,
                source=source,
                label=label,
            )
            index.versions.append(meta)
            index.current = short_hash
            self._write_index(ct, index)

            logger.info("版本已保存: %s/%s hash=%s source=%s", self.video_dir.name, ct, short_hash, source)
            return meta

    async def get_versions(self, content_type: str,
                           filename: Optional[str] = None) -> dict:
        """获取版本列表"""
        ct = self.make_content_type(content_type, filename)
        lock = await _get_lock(str(self.video_dir))
        async with lock:
            index = self._read_index(ct)

            # 首次迁移：如果 versions.json 不存在但主文件存在，自动创建 v1
            if not index.versions:
                current_file = self._current_file(ct)
                if current_file and current_file.exists():
                    content = current_file.read_text(encoding="utf-8")
                    if content.strip():
                        short_hash = self._content_hash(content)
                        ext = self.EXT_MAP.get(content_type, "txt")
                        timestamp_ms = int(current_file.stat().st_mtime * 1000) or int(datetime.now(tz=timezone.utc).timestamp() * 1000)
                        version_filename = self._make_filename(timestamp_ms, short_hash, ext)
                        self._write_version_file(ct, version_filename, content)
                        meta = VersionMeta(
                            hash=short_hash,
                            timestamp=timestamp_ms,
                            filename=version_filename,
                            source="migration",
                            label="自动迁移",
                        )
                        index.versions.append(meta)
                        index.current = short_hash
                        self._write_index(ct, index)

            # 自修复：如果 current 指针与磁盘文件内容不匹配，将当前文件内容补录为新版本
            if index.versions and index.current:
                current_file = self._current_file(ct)
                if current_file and current_file.exists():
                    file_content = current_file.read_text(encoding="utf-8")
                    if file_content.strip():
                        file_hash = self._content_hash(file_content)
                        if file_hash != index.current:
                            # 当前文件内容没有对应版本，补录
                            ext = self.EXT_MAP.get(content_type, "txt")
                            timestamp_ms = int(datetime.now(tz=timezone.utc).timestamp() * 1000)
                            version_filename = self._make_filename(timestamp_ms, file_hash, ext)
                            self._write_version_file(ct, version_filename, file_content)
                            meta = VersionMeta(
                                hash=file_hash,
                                timestamp=timestamp_ms,
                                filename=version_filename,
                                source="auto",
                                label="自动修复",
                            )
                            index.versions.append(meta)
                            index.current = file_hash
                            self._write_index(ct, index)

            return index.to_dict()

    async def get_version_content(self, content_type: str, hash_val: str,
                                  filename: Optional[str] = None) -> Optional[str]:
        """获取指定版本的内容"""
        ct = self.make_content_type(content_type, filename)
        lock = await _get_lock(str(self.video_dir))
        async with lock:
            index = self._read_index(ct)
            for v in index.versions:
                if v.hash == hash_val:
                    return self._read_version_file(ct, v.filename)
            return None

    async def switch_version(self, content_type: str, hash_val: str,
                             filename: Optional[str] = None) -> bool:
        """切换到指定版本（将版本内容写回主文件）"""
        ct = self.make_content_type(content_type, filename)
        lock = await _get_lock(str(self.video_dir))
        async with lock:
            index = self._read_index(ct)
            target = None
            for v in index.versions:
                if v.hash == hash_val:
                    target = v
                    break
            if not target:
                return False

            content = self._read_version_file(ct, target.filename)
            current_file = self._current_file(ct)
            if current_file:
                current_file.write_text(content, encoding="utf-8")

            index.current = hash_val
            self._write_index(ct, index)

            logger.info("版本已切换: %s/%s -> %s", self.video_dir.name, ct, hash_val)
            return True

    async def delete_version(self, content_type: str, hash_val: str,
                             filename: Optional[str] = None) -> bool:
        """删除指定版本"""
        ct = self.make_content_type(content_type, filename)
        lock = await _get_lock(str(self.video_dir))
        async with lock:
            index = self._read_index(ct)
            target = None
            for v in index.versions:
                if v.hash == hash_val:
                    target = v
                    break
            if not target:
                return False

            # 不允许删除当前正在使用的版本
            if index.current == hash_val:
                logger.warning("不允许删除当前版本: %s", hash_val)
                return False

            # 删除版本文件
            fp = self._versions_dir(ct) / target.filename
            if fp.exists():
                fp.unlink()

            # 更新元数据
            index.versions = [v for v in index.versions if v.hash != hash_val]
            self._write_index(ct, index)

            logger.info("版本已删除: %s/%s hash=%s", self.video_dir.name, ct, hash_val)
            return True
