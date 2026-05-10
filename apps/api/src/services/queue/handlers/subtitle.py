from typing import Any, Dict
from pathlib import Path
import logging

from .base import BaseHandler, ProgressCallback
from src.models.task import Task, SubTask

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

        if not aid or not cid:
            aid, fallback_cid = await self._get_video_info(media_id)
            cid = cid or fallback_cid

        if not aid or not cid:
            logger.warning(f"字幕下载缺少 aid/cid，跳过: {media_id}")
            return False

        output_dir.mkdir(parents=True, exist_ok=True)
        base_filename = Path(subtask_data.get('filename') or meta.get('title') or media_id or 'subtitle').stem
        safe_title = self._safe_filename(base_filename)
        subtitles = await self._get_subtitles(aid, cid)
        if not subtitles:
            logger.info(f"视频 {media_id} cid={cid} 没有可用字幕")
            return False

        downloaded_count = 0
        for index, subtitle in enumerate(self._select_subtitles(subtitles)):
            if await self._download_subtitle(subtitle, output_dir, safe_title, index):
                downloaded_count += 1

        logger.info(f"字幕下载完成: {downloaded_count}/{len(subtitles)} aid={aid} cid={cid}")
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

    async def _get_video_info(self, media_id: str) -> tuple[int | None, int | None]:
        if not media_id:
            return None, None
        try:
            from src.services.bilibili import BilibiliService

            bilibili_service = BilibiliService()
            try:
                await bilibili_service.init()
                video_info = await bilibili_service.get_video_info(media_id)
                if video_info.get("success"):
                    data = video_info.get("data", {})
                    pages = data.get("pages", []) or []
                    return _to_int(data.get("aid")), _to_int(pages[0].get("cid")) if pages else None
            finally:
                bilibili_service.close()
        except Exception as e:
            logger.error(f"获取视频信息失败: {e}")
        return None, None

    async def _get_subtitles(self, aid: int, cid: int) -> list[dict]:
        from src.services.bilibili import BilibiliService

        bilibili_service = BilibiliService()
        try:
            await bilibili_service.init()
            player_info = await bilibili_service.get_player_info(aid, cid)
            if not player_info.get("success"):
                logger.warning(f"获取播放器字幕信息失败: {player_info.get('message')}")
                return []
            subtitle_data = (player_info.get("data", {}) or {}).get("subtitle", {}) or {}
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
