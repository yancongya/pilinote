import json
import logging
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class NFOReader:
    """Read and normalize local NFO files into T0 text."""

    @staticmethod
    def find_nfo_path(video_path: str) -> Optional[Path]:
        video_file = Path(video_path)
        if not video_file.exists():
            return None

        directory = video_file.parent
        candidates = [
            directory / f"{video_file.stem}.nfo",
            directory / "video.nfo",
        ]

        for candidate in candidates:
            if candidate.exists():
                return candidate

        for candidate in sorted(directory.glob("*.nfo")):
            return candidate

        return None

    @staticmethod
    def read_t0_text(video_path: str) -> Dict[str, Any]:
        nfo_path = NFOReader.find_nfo_path(video_path)
        if not nfo_path:
            return {
                "found": False,
                "nfo_path": None,
                "data": {},
                "text": "当前视频没有找到 NFO 文件。",
            }

        data = NFOReader._parse_nfo_file(nfo_path)
        text = NFOReader._build_t0_text(data)
        return {
            "found": True,
            "nfo_path": str(nfo_path),
            "data": data,
            "text": text,
        }

    @staticmethod
    def _parse_nfo_file(nfo_path: Path) -> Dict[str, Any]:
        try:
            tree = ET.parse(nfo_path)
            root = tree.getroot()
            data: Dict[str, Any] = {
                "title": root.findtext("title", default="") or "",
                "showtitle": root.findtext("showtitle", default="") or "",
                "plot": root.findtext("plot", default="") or "",
                "intro": root.findtext("intro", default="") or "",
                "studio": root.findtext("studio", default="") or "",
                "premiered": root.findtext("premiered", default="") or "",
                "runtime": root.findtext("runtime", default="") or "",
                "thumb": root.findtext("thumb", default="") or "",
                "url": root.findtext("url", default="") or "",
                "tags": [],
                "comments": [],
            }

            tags_elem = root.find("tags")
            if tags_elem is not None:
                data["tags"] = [
                    tag.text.strip()
                    for tag in tags_elem.findall("tag")
                    if tag.text and tag.text.strip()
                ]

            comments_elem = root.find("comments")
            if comments_elem is not None:
                comments: List[Dict[str, Any]] = []
                for comment_elem in comments_elem.findall("comment"):
                    content = (comment_elem.findtext("content", default="") or "").strip()
                    comments.append(
                        {
                            "type": comment_elem.get("type", "unknown"),
                            "content": content,
                            "like": int(comment_elem.get("like", "0") or 0),
                            "reply": int(comment_elem.get("reply", "0") or 0),
                            "author": comment_elem.get("author", "") or "",
                            "time": int(comment_elem.get("time", "0") or 0),
                        }
                    )
                data["comments"] = comments

            return data
        except Exception as exc:
            logger.warning(f"解析 NFO 失败: {nfo_path} - {exc}")
            return {}

    @staticmethod
    def _build_t0_text(data: Dict[str, Any]) -> str:
        title = (data.get("title") or data.get("showtitle") or "未知标题").strip()
        intro = (data.get("intro") or data.get("plot") or "无简介").strip()
        studio = (data.get("studio") or "").strip()
        premiered = (data.get("premiered") or "").strip()
        runtime = (data.get("runtime") or "").strip()
        tags = [tag for tag in (data.get("tags") or []) if tag]
        comments = data.get("comments") or []

        top_comment = next((c for c in comments if c.get("type") == "top"), None)
        if not top_comment and comments:
            top_comment = comments[0]

        hot_comments = sorted(
            [c for c in comments if c is not top_comment],
            key=lambda item: int(item.get("like", 0) or 0),
            reverse=True,
        )[:2]

        lines = [
            "后端已从目录中的 NFO 文件整理出以下视频信息说明：",
            f"- 当前视频标题为：{title}",
            f"- 视频简介为：{intro}",
        ]

        if studio:
            lines.append(f"- 影片来源或厂牌为：{studio}")
        if premiered:
            lines.append(f"- 首次发布或上映时间为：{premiered}")
        if runtime:
            lines.append(f"- 视频时长为：{runtime}")
        if tags:
            lines.append(f"- 视频标签为：{'、'.join(tags)}")

        if top_comment:
            lines.append(
                "- 置顶评论为："
                + f"{top_comment.get('author', '匿名')}：{top_comment.get('content', '').strip() or '无内容'}"
            )
        else:
            lines.append("- 置顶评论为：无")

        if hot_comments:
            lines.append("- 点赞最多的评论为：")
            for index, comment in enumerate(hot_comments, start=1):
                lines.append(
                    f"  - 评论{index}：{comment.get('author', '匿名')}：{comment.get('content', '').strip() or '无内容'}"
                )
        else:
            lines.append("- 点赞最多的评论为：无")

        lines.append("以上内容为后端对 NFO 元数据和评论区信息的整理结果，请据此继续分析。")
        return "\n".join(lines)
