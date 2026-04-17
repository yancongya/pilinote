import os
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.ai_note import AiNote
from src.models.download import Download
from src.llm import LLMProvider, LLMClientFactory, LLMMessage
from src.llm.prompts import PromptBuilder, DEFAULT_STYLE, DEFAULT_FORMATS

logger = logging.getLogger(__name__)


class AiNoteService:
    """AI 笔记分析服务"""

    def __init__(self):
        self.db: Session = SessionLocal()

    def analyze_video(
        self,
        video_id: str,
        file_path: Optional[str] = None,
        style: str = DEFAULT_STYLE,
        formats: Optional[List[str]] = None,
        model_provider: str = "openai",
        model_name: str = "gpt-4o-mini",
        extras: Optional[str] = None,
    ) -> AiNote:
        """
        分析视频并生成笔记

        Args:
            video_id: 视频 ID (downloads.id 或文件路径)
            file_path: 可选的直接文件路径
            style: 笔记风格
            formats: 格式列表
            model_provider: LLM 提供商
            model_name: 模型名称
            extras: 额外提示词

        Returns:
            AiNote: 生成的笔记记录
        """
        # 获取视频信息
        download = None
        actual_file_path = file_path

        if file_path and os.path.exists(file_path):
            # 直接使用文件路径
            actual_file_path = file_path
            video_title = os.path.splitext(os.path.basename(file_path))[0]
        else:
            # 从数据库查找
            download = self.db.query(Download).filter(Download.id == video_id).first()
            if not download:
                raise ValueError(f"Video not found: {video_id}")
            actual_file_path = download.file_path
            video_title = download.title

        # 检查文件是否存在
        if not actual_file_path or not os.path.exists(actual_file_path):
            raise ValueError(f"Video file not found: {actual_file_path}")

        # 创建 AiNote 记录
        note = AiNote(
            id=os.urandom(16).hex(),
            video_id=video_id,
            style=style,
            formats=formats or DEFAULT_FORMATS,
            status="processing",
            model_provider=model_provider,
            model_name=model_name,
        )
        self.db.add(note)
        self.db.commit()

        try:
            # Step 1: 转写视频
            logger.info(f"开始转写视频: {video_id}")
            transcript = self._transcribe_video(actual_file_path, video_id)

            # Step 2: 生成笔记
            logger.info(f"开始生成笔记: {note.id}")
            markdown = self._generate_note(
                title=video_title or "未知标题",
                transcript=transcript,
                style=style,
                formats=formats or DEFAULT_FORMATS,
                model_provider=model_provider,
                model_name=model_name,
                extras=extras,
            )

            # Step 3: 提取总结
            summary = self._extract_summary(markdown)

            # 保存结果
            note.content = markdown
            note.summary = summary
            note.status = "completed"
            note.completed_at = datetime.utcnow()
            self.db.commit()

            # 更新 download 表的 AI 状态
            download.ai_note_id = note.id
            download.ai_markdown = markdown
            download.ai_summary = summary
            download.ai_style = style
            download.ai_status = "completed"
            self.db.commit()

            logger.info(f"笔记生成完成: {note.id}")

        except Exception as e:
            logger.error(f"笔记生成失败: {e}")
            note.status = "failed"
            note.error = str(e)
            self.db.commit()

            # 更新 download 表
            download.ai_status = "failed"
            download.ai_error = str(e)
            self.db.commit()

        finally:
            self.db.close()

        return note

    def _transcribe_video(self, video_path: str, video_id: str) -> str:
        """转写视频"""
        try:
            from src.services.ai.transcriber import get_transcriber

            transcriber = get_transcriber()
            result = transcriber.transcribe(video_path, video_id)
            return result or "转写失败，未获取到文本内容"
        except Exception as e:
            logger.error(f"转写失败: {e}")
            return f"转写失败: {str(e)}"

    def _generate_note(
        self,
        title: str,
        transcript: str,
        style: str,
        formats: List[str],
        model_provider: str,
        model_name: str,
        extras: Optional[str] = None,
    ) -> str:
        """调用 LLM 生成笔记"""
        # 构建 prompt
        prompt = PromptBuilder.build(
            video_title=title,
            segment_text=transcript[:8000],  # 限制长度
            formats=formats,
            style=style,
            extras=extras,
        )

        # 创建 LLM 客户端
        provider = LLMProvider(model_provider)
        client = LLMClientFactory.create_client(provider)

        # 发送请求
        messages = [
            LLMMessage(role="system", content=prompt),
            LLMMessage(role="user", content="请根据以上转写内容生成笔记"),
        ]

        response = client.chat(messages, model=model_name, temperature=0.7)

        return response.content

    def _extract_summary(self, markdown: str) -> str:
        """从 Markdown 中提取总结"""
        # 简单实现：查找 ## AI 总结 部分
        lines = markdown.split("\n")
        in_summary = False
        summary_lines = []

        for line in lines:
            if "## AI 总结" in line or "## 总结" in line:
                in_summary = True
                continue
            if in_summary and line.startswith("##"):
                break
            if in_summary and line.strip():
                summary_lines.append(line.strip())

        return "\n".join(summary_lines[:5])  # 取前5行

    def get_note(self, note_id: str) -> Optional[AiNote]:
        """获取笔记详情"""
        note = self.db.query(AiNote).filter(AiNote.id == note_id).first()
        self.db.close()
        return note

    def get_note_by_video(self, video_id: str) -> Optional[AiNote]:
        """根据视频 ID 获取笔记"""
        note = self.db.query(AiNote).filter(AiNote.video_id == video_id).first()
        self.db.close()
        return note

    def update_status(self, note_id: str, status: str, error: Optional[str] = None):
        """更新笔记状态"""
        note = self.db.query(AiNote).filter(AiNote.id == note_id).first()
        if note:
            note.status = status
            if error:
                note.error = error
            if status == "completed":
                note.completed_at = datetime.utcnow()
            self.db.commit()
        self.db.close()
