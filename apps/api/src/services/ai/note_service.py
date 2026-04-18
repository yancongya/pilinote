import os
import logging
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.ai_note import AiNote
from src.models.download import Download
from src.llm import LLMProvider, LLMClientFactory, LLMMessage
from src.llm.prompts import PromptBuilder, DEFAULT_STYLE, DEFAULT_FORMATS
from src.services.ai.nfo_reader import NFOReader

logger = logging.getLogger(__name__)


@dataclass
class AiTraceStep:
    stage: str
    title: str
    summary: str
    detail: Optional[Dict[str, Any]] = None
    progress: float = 0.0
    ts: str = ""


class AiNoteService:
    """AI 笔记分析服务"""

    def __init__(self):
        self.db: Session = SessionLocal()
        self.trace: List[AiTraceStep] = []

    def _add_trace(
        self,
        stage: str,
        title: str,
        summary: str,
        progress: float,
        detail: Optional[Dict[str, Any]] = None,
        note: Optional[AiNote] = None,
    ):
        self.trace.append(
            AiTraceStep(
                stage=stage,
                title=title,
                summary=summary,
                detail=detail,
                progress=progress,
                ts=datetime.utcnow().isoformat(),
            )
        )
        logger.info(f"[AI:{stage}] {title} - {summary}")
        if note is not None:
            self._persist_note_meta(note)

    def _persist_note_meta(self, note: AiNote):
        note.meta = {
            **(note.meta or {}),
            "trace": [asdict(step) for step in self.trace],
        }
        self.db.add(note)
        self.db.commit()

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
        note = self.create_note_record(
            video_id=video_id,
            style=style,
            formats=formats or DEFAULT_FORMATS,
            model_provider=model_provider,
            model_name=model_name,
        )

        self._run_analysis(
            note=note,
            video_id=video_id,
            file_path=file_path,
            style=style,
            formats=formats or DEFAULT_FORMATS,
            model_provider=model_provider,
            model_name=model_name,
            extras=extras,
        )

        return note

    def create_note_record(
        self,
        video_id: str,
        style: str,
        formats: List[str],
        model_provider: str,
        model_name: str,
    ) -> AiNote:
        note = AiNote(
            id=os.urandom(16).hex(),
            video_id=video_id,
            style=style,
            formats=formats,
            status="processing",
            model_provider=model_provider,
            model_name=model_name,
            meta={},
        )
        self.db.add(note)
        self.db.commit()
        self.db.refresh(note)
        return note

    def analyze_note(
        self,
        note_id: str,
        video_id: str,
        file_path: Optional[str] = None,
        style: str = DEFAULT_STYLE,
        formats: Optional[List[str]] = None,
        model_provider: str = "openai",
        model_name: str = "gpt-4o-mini",
        extras: Optional[str] = None,
    ) -> AiNote:
        note = self.db.query(AiNote).filter(AiNote.id == note_id).first()
        if not note:
            raise ValueError(f"Note not found: {note_id}")

        self._run_analysis(
            note=note,
            video_id=video_id,
            file_path=file_path,
            style=style,
            formats=formats or DEFAULT_FORMATS,
            model_provider=model_provider,
            model_name=model_name,
            extras=extras,
        )
        return note

    def _run_analysis(
        self,
        note: AiNote,
        video_id: str,
        file_path: Optional[str],
        style: str,
        formats: List[str],
        model_provider: str,
        model_name: str,
        extras: Optional[str],
    ) -> None:
        download = None
        actual_file_path = file_path

        if file_path and os.path.exists(file_path):
            actual_file_path = file_path
            video_title = os.path.splitext(os.path.basename(file_path))[0]
        else:
            download = self.db.query(Download).filter(Download.id == video_id).first()
            if not download:
                raise ValueError(f"Video not found: {video_id}")
            actual_file_path = download.file_path
            video_title = download.title

        if not actual_file_path or not os.path.exists(actual_file_path):
            raise ValueError(f"Video file not found: {actual_file_path}")

        try:
            context = self._prepare_analysis_context(actual_file_path, video_id, style, note)

            if download:
                download.transcript = context["transcript"]
                download.transcript_lang = "whisper"
                self.db.commit()

            self._add_trace("PROMPT.BUILD", "构建 Prompt", "正在按固定顺序拼装最终 prompt", 85.0, note=note)
            prompt = self._build_prompt_from_context(
                context=context,
                style=style,
                formats=formats or DEFAULT_FORMATS,
                extras=extras,
            )
            self._add_trace(
                "PROMPT.BUILD",
                "Prompt 生成完成",
                prompt[:300],
                88.0,
                {"prompt_length": len(prompt)},
                note=note,
            )

            markdown = self._generate_note(
                prompt=prompt,
                model_provider=model_provider,
                model_name=model_name,
            )
            self._add_trace(
                "LLM",
                "模型返回完成",
                markdown[:240],
                95.0,
                {"response_length": len(markdown or "")},
                note=note,
            )

            summary = self._extract_summary(markdown)

            note.content = markdown
            note.summary = summary
            note.status = "completed"
            note.completed_at = datetime.utcnow()
            self._persist_note_meta(note)

            if download:
                download.ai_note_id = note.id
                download.ai_markdown = markdown
                download.ai_summary = summary
                download.ai_style = style
                download.ai_status = "completed"
                self.db.commit()

            self._add_trace("DONE", "分析完成", "AI 笔记生成成功", 100.0, note=note)
            self._persist_note_meta(note)
            logger.info(f"笔记生成完成: {note.id}")

        except Exception as e:
            logger.error(f"笔记生成失败: {e}", exc_info=True)
            note.status = "failed"
            note.error = str(e)
            self._add_trace("ERROR", "分析失败", str(e), 100.0, {"error": str(e)}, note=note)
            self._persist_note_meta(note)

            if download:
                download.ai_status = "failed"
                download.ai_error = str(e)
                self.db.commit()

        finally:
            self.db.close()

    def _resolve_level(self, style: str) -> str:
        return "simple" if style in {"minimal", "task_oriented"} else "detailed"

    def _prepare_analysis_context(
        self,
        video_path: str,
        video_id: str,
        style: str,
        note: Optional[AiNote] = None,
    ) -> Dict[str, Any]:
        self._add_trace("PREP.T0", "读取 NFO", "正在读取目录中的 NFO 并整理视频信息", 10.0, note=note)
        t0 = NFOReader.read_t0_text(video_path)
        self._add_trace(
            "PREP.T0",
            "NFO 解析完成",
            t0["text"][:240],
            20.0,
            {"found": t0["found"], "nfo_path": t0["nfo_path"]},
            note=note,
        )

        self._add_trace("PREP.T1", "语音转文字", "正在使用本地 ASR 从音频生成正文转写", 35.0, note=note)
        transcript = self._transcribe_video(video_path, video_id)
        self._add_trace(
            "PREP.T1",
            "转写完成",
            transcript[:240] if transcript else "未获取到转写结果",
            55.0,
            {"length": len(transcript or ""), "transcriber": "local-asr"},
            note=note,
        )

        level = self._resolve_level(style)
        self._add_trace(
            "PREP.T2",
            "详细程度",
            f"当前使用 {level} 模板",
            70.0,
            {"level": level},
            note=note,
        )

        self._add_trace(
            "PREP.T3",
            "风格选择",
            f"当前风格: {style}",
            80.0,
            {"style": style},
            note=note,
        )

        return {
            "t0_text": t0["text"],
            "transcript": transcript,
            "level": level,
        }

    def _build_prompt_from_context(
        self,
        context: Dict[str, Any],
        style: str,
        formats: List[str],
        extras: Optional[str],
    ) -> str:
        return PromptBuilder.build(
            t0_text=context["t0_text"],
            t1_text=context["transcript"],
            level=context["level"],
            style=style,
            formats=formats,
            extras=extras,
        )

    def _transcribe_video(self, video_path: str, video_id: str) -> str:
        """转写视频，默认走 Whisper 音频转写。"""
        try:
            from src.services.ai.transcriber import get_transcriber
            from src.services.ai.local_asr_model_service import (
                LocalASRModelNotReadyError,
                get_local_asr_model_service,
            )

            model_service = get_local_asr_model_service()
            active_model = model_service.ensure_active_model_ready()
            self._add_trace(
                "PREP.T1.0",
                "检查本地模型",
                f"当前激活模型 {active_model.name} 已就绪",
                38.0,
                {"model": active_model.model_id, "cache_path": active_model.cache_path},
            )
            transcriber = get_transcriber("asr", model_config=active_model.model_dump())
            pipeline_name = getattr(transcriber, "get_pipeline_name", lambda: "ffmpeg + faster-whisper")()
            self._add_trace(
                "PREP.T1.1",
                "提取音频",
                f"正在使用 {pipeline_name} 提取音频",
                40.0,
                {"video_path": video_path, "pipeline": pipeline_name},
            )
            self._add_trace(
                "PREP.T1.2",
                "本地 ASR 请求",
                "正在调用本地 ASR 生成字幕文本",
                45.0,
                {"pipeline": pipeline_name},
            )
            result = transcriber.transcribe(video_path, video_id)
            if not result or not result.strip():
                raise ValueError("转写失败，未获取到文本内容")
            self._add_trace(
                "PREP.T1.3",
                "本地 ASR 完成",
                result[:240],
                50.0,
                {"length": len(result), "pipeline": pipeline_name},
            )
            return result
        except LocalASRModelNotReadyError:
            raise
        except Exception as e:
            logger.error(f"转写失败: {e}", exc_info=True)
            raise

    def _generate_note(
        self,
        prompt: str,
        model_provider: str,
        model_name: str,
    ) -> str:
        """调用 LLM 生成笔记"""
        try:
            self._add_trace(
                "LLM.CALL",
                "调用模型",
                f"正在请求 {model_provider}/{model_name}",
                92.0,
                {"provider": model_provider, "model": model_name},
            )
            provider = LLMProvider(model_provider)
            client = LLMClientFactory.create_client(provider)
            messages = [
                LLMMessage(role="system", content=prompt),
                LLMMessage(role="user", content="请根据以上信息生成笔记。"),
            ]
            response = client.chat(messages, model=model_name, temperature=0.7)
            self._add_trace(
                "LLM.RESPONSE",
                "模型响应",
                "模型已返回结果",
                94.0,
                {"has_content": bool(response.content)},
            )
            return response.content
        except Exception as e:
            logger.error(f"LLM 生成失败: {e}", exc_info=True)
            raise

    def _extract_summary(self, markdown: str) -> str:
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

        return "\n".join(summary_lines[:5])

    def get_note(self, note_id: str) -> Optional[AiNote]:
        note = self.db.query(AiNote).filter(AiNote.id == note_id).first()
        self.db.close()
        return note

    def get_note_by_video(self, video_id: str) -> Optional[AiNote]:
        note = self.db.query(AiNote).filter(AiNote.video_id == video_id).first()
        if note:
            self.db.close()
            return note

        download = self.db.query(Download).filter(Download.id == video_id).first()
        if not download:
            download = (
                self.db.query(Download).filter(Download.file_path == video_id).first()
            )
        if not download:
            # Frontend media library typically only has BV id; resolve to downloads.id.
            download = (
                self.db.query(Download)
                .filter(Download.bvid == video_id, Download.status == "completed")
                .first()
            )
            if not download:
                download = self.db.query(Download).filter(Download.bvid == video_id).first()
        if download:
            note = self.db.query(AiNote).filter(AiNote.video_id == download.id).first()
            if note:
                self.db.close()
                return note

            if download.file_path:
                note = self.db.query(AiNote).filter(AiNote.video_id == download.file_path).first()
                if note:
                    self.db.close()
                    return note

                folder_name = os.path.basename(os.path.dirname(download.file_path))
                if folder_name:
                    folder_key = f"folder-{folder_name}"
                    note = self.db.query(AiNote).filter(AiNote.video_id == folder_key).first()
                    if note:
                        self.db.close()
                        return note

        self.db.close()
        return None

    def update_status(self, note_id: str, status: str, error: Optional[str] = None):
        note = self.db.query(AiNote).filter(AiNote.id == note_id).first()
        if note:
            note.status = status
            if error:
                note.error = error
            if status == "completed":
                note.completed_at = datetime.utcnow()
            self.db.commit()
        self.db.close()
