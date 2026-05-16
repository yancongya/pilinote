from typing import Any, Dict
from pathlib import Path
import logging

from .base import BaseHandler, ProgressCallback
from src.models.task import Task, SubTask
from src.services.queue.utils import resolve_video_part_context

logger = logging.getLogger(__name__)


def _to_int(value: Any) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


class SubtitleHandler(BaseHandler):
    """Bilibili subtitle downloader using BiliTools-style player WBI data."""

    async def handle(self, subtask_data: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        media_id = subtask_data.get('bvid') or meta.get('bvid') or ''
        aid = _to_int(meta.get('aid') or subtask_data.get('aid'))
        cid = _to_int(meta.get('cid') or subtask_data.get('cid'))
        output_dir.mkdir(parents=True, exist_ok=True)
        base_filename = Path(subtask_data.get('filename') or meta.get('title') or media_id or 'subtitle').stem
        safe_title = self._safe_filename(base_filename)
        resolved = await resolve_video_part_context(media_id, meta)
        aid = aid or _to_int(resolved.get("aid"))

        part_contexts: list[dict] = []
        if cid:
            part_contexts.append({
                "cid": cid,
                "page": _to_int(meta.get("page")),
                "part": meta.get("part_title") or safe_title,
                "base_filename": safe_title,
            })
        else:
            pages = resolved.get("pages") or []
            for page in pages:
                page_cid = _to_int(page.get("cid"))
                if not page_cid:
                    continue
                page_num = _to_int(page.get("page")) or len(part_contexts) + 1
                part_title = page.get("part") or f"P{page_num}"
                part_contexts.append({
                    "cid": page_cid,
                    "page": page_num,
                    "part": part_title,
                    "base_filename": self._safe_filename(f"P{page_num:02d} - {part_title}"),
                })

        if not aid or not part_contexts:
            logger.warning(f"字幕下载缺少 aid/cid，跳过: {media_id}")
            return False

        downloaded_count = 0
        attempted_tracks = 0
        for part_context in part_contexts:
            subtitles = await self._get_subtitles(aid, part_context["cid"])
            if not subtitles:
                logger.info(f"视频 {media_id} cid={part_context['cid']} 没有可用字幕")
                continue

            selected = self._select_subtitles(subtitles)
            attempted_tracks += len(selected)
            for index, subtitle in enumerate(selected):
                if await self._download_subtitle(
                    subtitle,
                    output_dir,
                    part_context["base_filename"],
                    index,
                ):
                    downloaded_count += 1

        logger.info(
            f"字幕下载完成: {downloaded_count}/{attempted_tracks} aid={aid} parts={len(part_contexts)}"
        )
        return downloaded_count > 0

    async def execute(self, task: Task, subtask: SubTask, progress_callback: ProgressCallback) -> bool:
        try:
            await progress_callback.update(0, 100, "准备下载字幕...")
            output_dir = Path("downloads") / "subtitles" / self._safe_filename(task.title or task.media_id)
            success = await self.handle({}, Path("temp"), output_dir, task.meta or {})
            subtask.output_path = str(output_dir)
            await progress_callback.update(100, 100, "字幕下载完成" if success else "无可用字幕")
            return success
        except Exception as e:
            logger.error(f"字幕下载异常: {e}", exc_info=True)
            await progress_callback.update(0, 100, f"字幕下载失败: {str(e)}")
            return False

    async def _get_subtitles(self, aid: int, cid: int) -> list[dict]:
        from src.services.bilibili import BilibiliService

        bilibili_service = BilibiliService()
        try:
            await bilibili_service.init()
            subtitle_info = await bilibili_service.get_subtitle_info(aid, cid)
            if not subtitle_info.get("success"):
                logger.warning(f"获取字幕信息失败: {subtitle_info.get('message')}")
                return []
            subtitle_data = (subtitle_info.get("data", {}) or {}).get("subtitle", {}) or {}
            return subtitle_data.get("subtitles") or subtitle_data.get("list") or []
        finally:
            bilibili_service.close()

    def _select_subtitles(self, subtitles: list[dict]) -> list[dict]:
        # Prefer one Chinese track and one English track, user-created before AI when both exist.
        targets = ["zh-CN", "en-US"]
        selected: dict[str, dict] = {}
        for subtitle in subtitles:
            if not self._subtitle_url(subtitle):
                continue
            language = self._normalize_language(subtitle)
            if language not in targets:
                continue
            existing = selected.get(language)
            if existing is None or self._source_priority(subtitle) < self._source_priority(existing):
                selected[language] = subtitle
        if selected:
            return [selected[language] for language in targets if language in selected]
        return [subtitle for subtitle in subtitles if self._subtitle_url(subtitle)]

    async def _download_subtitle(self, subtitle: dict, output_dir: Path, base_filename: str, index: int = 0) -> bool:
        import httpx

        subtitle_url = self._subtitle_url(subtitle)
        if not subtitle_url:
            return False
        if subtitle_url.startswith('//'):
            subtitle_url = 'https:' + subtitle_url
        elif subtitle_url.startswith('/'):
            subtitle_url = 'https://api.bilibili.com' + subtitle_url

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(subtitle_url, headers={
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://www.bilibili.com/",
            })
            response.raise_for_status()
            subtitle_data = response.json()

        srt_content = self._convert_to_srt(subtitle_data)
        if not srt_content.strip():
            logger.warning(f"字幕内容为空，跳过: {subtitle_url}")
            return False

        language = self._normalize_language(subtitle)
        source = self._classify_source(subtitle)
        suffix = f"{language}.{source}"
        if index > 0:
            suffix = f"{suffix}.{index}"
        output_path = output_dir / f"{base_filename}.{suffix}.srt"
        output_path.write_text(srt_content, encoding='utf-8')
        logger.info(f"字幕下载成功: {output_path}")
        return True

    @staticmethod
    def _subtitle_url(subtitle: dict) -> str:
        for key in ("subtitle_url", "subtitleUrl", "url", "subtitleURL"):
            value = subtitle.get(key)
            if value:
                return value
        return ""

    def _normalize_language(self, subtitle: dict) -> str:
        lan = str(subtitle.get("lan") or "").lower()
        if lan in {"ai-zh", "ai-hans", "ai-zh-cn", "ai-zh-hans", "zh", "zh-cn", "zh-hans", "zh-sg"}:
            return "zh-CN"
        if lan in {"zh-hant", "zh-tw"}:
            return "zh-TW"
        if lan in {"ai-en", "ai-en-us", "en", "en-us", "en-gb"}:
            return "en-US"
        return subtitle.get("lan") or "unknown"

    def _classify_source(self, subtitle: dict) -> str:
        lan = str(subtitle.get("lan") or "").lower()
        lan_doc = str(subtitle.get("lan_doc") or "").lower()
        url = self._subtitle_url(subtitle).lower()
        if "aisubtitle.hdslb.com" in url or lan.startswith("ai-") or "自动生成" in lan_doc or subtitle.get("type") == 1:
            return "ai"
        return "user"

    def _source_priority(self, subtitle: dict) -> int:
        return 1 if self._classify_source(subtitle) == "ai" else 0

    def _convert_to_srt(self, subtitle_data: dict) -> str:
        body = subtitle_data.get("body", []) or []
        lines = []
        for index, item in enumerate(body, 1):
            start = self._seconds_to_srt_time(float(item.get("from", 0)))
            end = self._seconds_to_srt_time(float(item.get("to", 0)))
            content = str(item.get("content", ""))
            lines.extend([str(index), f"{start} --> {end}", content, ""])
        return "\n".join(lines)

    def _seconds_to_srt_time(self, seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millisecs = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millisecs:03d}"
