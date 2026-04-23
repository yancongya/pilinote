import json
import logging
import xml.etree.ElementTree as ET
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class NFOReader:
    """Read and normalize local NFO files into T0 text."""

    @staticmethod
    def _base_content_stem(video_file: Path) -> str:
        stem = video_file.stem
        if stem.endswith(".ai-note"):
            return stem[: -len(".ai-note")]
        return stem

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
    def read_image_text_context(video_path: str) -> Dict[str, Any]:
        """为图文模式读取正文上下文。

        图文正文优先来自同目录的同名 Markdown 文件，其次回退到 NFO。
        """
        text_data = NFOReader._read_markdown_body(video_path)
        if text_data:
            title = text_data.get("title", "")
            body_text = text_data.get("body_text", "")
            summary_text = text_data.get("summary_text", "")
            text_parts = [part for part in [body_text, summary_text] if part]
            return {
                "found": True,
                "nfo_path": text_data.get("source_path"),
                "data": text_data.get("data", {}),
                "text": "\n\n".join(text_parts).strip(),
                "title": title,
                "body_text": body_text,
                "summary_text": summary_text,
            }

        nfo_path = NFOReader.find_nfo_path(video_path)
        if not nfo_path:
            return {
                "found": False,
                "nfo_path": None,
                "data": {},
                "text": "",
                "title": "",
                "body_text": "",
                "summary_text": "",
            }

        data = NFOReader._parse_nfo_file(nfo_path)
        title = (data.get("title") or data.get("showtitle") or "").strip()
        body_text = NFOReader._build_image_text_body(data)
        summary_text = NFOReader._build_image_text_summary(data)
        text_parts = [part for part in [body_text, summary_text] if part]
        return {
            "found": True,
            "nfo_path": str(nfo_path),
            "data": data,
            "text": "\n\n".join(text_parts).strip(),
            "title": title,
            "body_text": body_text,
            "summary_text": summary_text,
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

    @staticmethod
    def _build_image_text_body(data: Dict[str, Any]) -> str:
        title = (data.get("title") or data.get("showtitle") or "未知标题").strip()
        intro = (data.get("intro") or data.get("plot") or "").strip()
        studio = (data.get("studio") or "").strip()
        premiered = (data.get("premiered") or "").strip()
        runtime = (data.get("runtime") or "").strip()
        tags = [tag for tag in (data.get("tags") or []) if tag]

        lines = [
            "## 图文正文",
            f"- 标题：{title}",
        ]
        if intro:
            lines.append(f"- 正文/简介：{intro}")
        if studio:
            lines.append(f"- 来源/作者：{studio}")
        if premiered:
            lines.append(f"- 发布时间：{premiered}")
        if runtime:
            lines.append(f"- 时长：{runtime}")
        if tags:
            lines.append(f"- 标签：{'、'.join(tags)}")

        return "\n".join(lines).strip()

    @staticmethod
    def _read_markdown_body(video_path: str) -> Dict[str, Any]:
        video_file = Path(video_path)
        if not video_file.exists():
            return {}

        directory = video_file.parent
        base_stem = NFOReader._base_content_stem(video_file)
        candidates = [
            directory / f"{base_stem}.md",
            directory / "README.md",
        ]
        md_path = next((candidate for candidate in candidates if candidate.exists()), None)
        if not md_path:
            return {}

        try:
            raw = md_path.read_text(encoding="utf-8").strip()
        except Exception as exc:
            logger.warning("读取图文正文失败: %s - %s", md_path, exc)
            return {}

        if not raw:
            return {}

        image_pattern = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
        cleaned_lines = []
        for line in raw.splitlines():
            stripped = line.strip()
            if not stripped:
                if cleaned_lines and cleaned_lines[-1] != "":
                    cleaned_lines.append("")
                continue

            image_matches = image_pattern.findall(stripped)
            if image_matches and image_pattern.fullmatch(stripped):
                for alt_text, image_path in image_matches:
                    alt_text = alt_text.strip() or "图片"
                    image_name = Path(image_path).name or image_path
                    cleaned_lines.append(f"【图片】{alt_text}（{image_name}）")
                continue

            line_without_images = image_pattern.sub("", stripped).strip()
            if not line_without_images:
                continue
            cleaned_lines.append(line_without_images)

        title = next(
            (
                line.lstrip("# ").strip()
                for line in raw.splitlines()
                if line.lstrip().startswith("# ")
            ),
            video_file.stem,
        )
        body_text = "\n".join(cleaned_lines).strip()
        return {
            "source_path": str(md_path),
            "data": {"title": title, "body": body_text},
            "title": title,
            "body_text": body_text,
            "summary_text": "",
        }

    @staticmethod
    def _build_image_text_summary(data: Dict[str, Any]) -> str:
        comments = data.get("comments") or []
        if not comments:
            return ""

        top_comment = next((c for c in comments if c.get("type") == "top"), None)
        if not top_comment:
            top_comment = comments[0]

        hot_comments = sorted(
            [c for c in comments if c is not top_comment],
            key=lambda item: int(item.get("like", 0) or 0),
            reverse=True,
        )[:2]

        lines = ["## 补充信息"]
        if top_comment:
            lines.append(
                f"- 置顶评论：{top_comment.get('author', '匿名')}：{top_comment.get('content', '').strip() or '无内容'}"
            )
        for index, comment in enumerate(hot_comments, start=1):
            lines.append(
                f"- 热门评论{index}：{comment.get('author', '匿名')}：{comment.get('content', '').strip() or '无内容'}"
            )
        return "\n".join(lines).strip()
