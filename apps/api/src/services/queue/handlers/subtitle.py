from typing import Dict, Any
from pathlib import Path
import logging

from .base import BaseHandler

logger = logging.getLogger(__name__)


def _to_int(value: Any) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None

class SubtitleHandler(BaseHandler):
    """字幕处理器"""

    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理字幕下载"""
        bvid = params.get('bvid', '') or meta.get('bvid', '')
        title = meta.get('title') or params.get('title') or bvid or 'subtitle'
        aid = _to_int(meta.get('aid') or params.get('aid'))
        cid = _to_int(meta.get('cid') or params.get('cid'))
        sessdata = meta.get('sessdata') or params.get('sessdata') or ''

        logger.info(f"开始处理字幕下载: bvid={bvid}, title={title}, aid={aid}, cid={cid}")

        if (not aid or not cid) and bvid:
            bilibili_service = None
            try:
                from src.services.bilibili import BilibiliService

                bilibili_service = BilibiliService()
                video_info = await bilibili_service.get_video_info(bvid, sessdata)
                if video_info.get("success"):
                    video_data = video_info.get("data", {}) or {}
                    aid = aid or _to_int(video_data.get("aid"))
                    title = title or video_data.get("title") or title

                    if not cid:
                        pages = video_data.get("pages", []) or []
                        if pages:
                            cid = _to_int(pages[0].get("cid"))
                else:
                    logger.warning(
                        "字幕处理器获取视频信息失败: %s",
                        video_info.get("message", "unknown error")
                    )
            except Exception as e:
                logger.warning(f"字幕处理器回退获取视频信息失败: {e}")
            finally:
                if bilibili_service:
                    bilibili_service.close()

        if not aid or not cid:
            logger.warning(f"字幕下载缺少 aid/cid，跳过: bvid={bvid}, aid={aid}, cid={cid}")
            return

        output_dir.mkdir(parents=True, exist_ok=True)
        temp_dir.mkdir(parents=True, exist_ok=True)

        try:
            from src.models.download import Download
            from src.services.download_service import DownloadService

            download = Download(
                id=f"subtitle_{bvid}_{cid}",
                bvid=bvid,
                title=title,
                aid=aid,
                cid=cid,
                sessdata=sessdata,
            )

            download_service = DownloadService()
            result = await download_service._download_preferred_subtitles(download, output_dir)

            logger.info(
                "✓ 字幕处理完成: downloaded=%s, attempted=%s, languages=%s",
                result.get('downloaded', 0),
                result.get('attempted', 0),
                ', '.join(result.get('languages', [])) if result.get('languages') else '无匹配'
            )

            if result.get("skipped_no_url", 0) > 0:
                logger.warning(
                    "字幕已检测到但不可下载: total=%s, downloadable=%s, skipped_no_url=%s, bvid=%s, title=%s",
                    result.get("attempted", 0),
                    result.get("downloadable", 0),
                    result.get("skipped_no_url", 0),
                    bvid,
                    title,
                )

            if result.get('downloaded', 0) == 0:
                logger.warning(f"字幕未成功下载: bvid={bvid}, title={title}")
        except Exception as e:
            logger.error(f"字幕下载失败: {e}", exc_info=True)
