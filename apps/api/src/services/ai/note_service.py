import os
import re
import json
import logging
import time
import multiprocessing
import subprocess
import threading
import hashlib
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models.ai_note import AiNote
from src.models.download import Download
from src.llm import LLMProvider, LLMClientFactory, LLMMessage
from src.llm.prompts import PromptBuilder, DEFAULT_STYLE, DEFAULT_FORMATS, NOTE_FORMATS
from src.services.ai.nfo_reader import NFOReader
from src.services.ai.task_control import task_control_registry
from src.services.settings_service import SettingsService
from src.config import settings as app_settings

logger = logging.getLogger(__name__)
_ACTIVE_ASR_PROCESSES: Dict[str, int] = {}
_ACTIVE_ASR_PROCESS_LOCK = threading.RLock()
_PIPELINE_STAGES = {
    "video": (
        "AUDIO.FETCH",
        "SUBTITLE.GENERATE",
        "NFO.READ",
        "PROMPT.BUILD",
        "LLM.ANALYZE",
        "CONTENT.GENERATE",
    ),
    "series": (
        "AUDIO.FETCH",
        "SUBTITLE.GENERATE",
        "NFO.READ",
        "PROMPT.BUILD",
        "LLM.ANALYZE",
        "CONTENT.GENERATE",
    ),
    "image_text": (
        "DOC.READ",
        "NFO.READ",
        "PROMPT.BUILD",
        "LLM.ANALYZE",
        "CONTENT.GENERATE",
    ),
}
_SEMANTIC_STAGES = _PIPELINE_STAGES["video"]
_SUPPORTED_NOTE_FORMATS = {item["value"] for item in NOTE_FORMATS}

_SCREENSHOT_MARKER_PATTERN = re.compile(
    r"\*?Screenshot-\[((?:\d{1,2}:)?\d{2}:\d{2})\]\*?"
)

_SERIES_MEMORY_FILENAME = "series.ai-note.memory.json"


def _safe_read_json(path: Path) -> Dict[str, Any]:
    try:
        if not path.exists():
            return {}
        raw = path.read_text(encoding="utf-8")
        if not raw.strip():
            return {}
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _compact_markdown_for_memory(markdown: str) -> str:
    """Compact markdown into short reusable memory (no LLM)."""
    if not markdown:
        return ""
    lines = [line.rstrip() for line in markdown.splitlines()]
    picked: List[str] = []
    for line in lines:
        if line.startswith("#"):
            picked.append(line)
        elif line.lstrip().startswith(("-", "*")) and len(picked) < 40:
            picked.append(line)
        if len(picked) >= 50:
            break
    compact = "\n".join(picked).strip()
    return compact[:4000]


def _detect_transcript_language(text: str) -> str:
    """Heuristic language detection for subtitles/transcripts.

    Returns: 'zh' | 'en' | 'mixed' | 'unknown'
    """
    if not text:
        return "unknown"
    sample = text[:20000]
    cjk = sum(1 for ch in sample if "\u4e00" <= ch <= "\u9fff")
    latin = sum(1 for ch in sample if ("a" <= ch.lower() <= "z"))
    total_letters = cjk + latin
    if total_letters < 50:
        return "unknown"
    cjk_ratio = cjk / max(1, total_letters)
    latin_ratio = latin / max(1, total_letters)
    if cjk_ratio >= 0.75:
        return "zh"
    if latin_ratio >= 0.75:
        return "en"
    return "mixed"


def _build_language_policy_block(lang: str) -> str:
    if lang == "zh":
        return (
            "## 语言与术语策略\n"
            "- 检测到字幕主要为中文（zh）。\n"
            "- 笔记必须输出中文；专业名词/品牌/快捷键等可保留英文原文。\n"
            "- 遇到英文术语：保留英文 + 给出简短中文解释（同一术语全文保持一致）。"
        )
    if lang == "en":
        return (
            "## 语言与术语策略\n"
            "- 检测到字幕主要为英文（en）。\n"
            "- 笔记必须输出中文为主，但要保留关键英文术语原文。\n"
            "- 处理顺序：\n"
            "  1) 先在正文最前生成 `## 术语对照表`（8-20 条）：`- English term: 中文解释`（必要时补充缩写全称）。\n"
            "  2) 再用中文按章节整理内容；术语首次出现时沿用对照表的翻译与写法。\n"
            "- 不要让整篇笔记在中英文之间摇摆。"
        )
    if lang == "mixed":
        return (
            "## 语言与术语策略\n"
            "- 检测到字幕为中英混合（mixed）。\n"
            "- 笔记以中文为主，英文术语保留原文；首次出现时给出中文解释。\n"
            "- 先生成 `## 术语对照表`（8-20 条），统一关键术语的中文翻译。\n"
            "- 对同一术语/概念保持全篇一致的翻译与写法。"
        )
    return (
        "## 语言与术语策略\n"
        "- 无法可靠判断字幕语言（unknown）。\n"
        "- 笔记仍必须输出中文为主；英文术语可保留并附中文解释。"
    )


def _normalize_note_formats(formats: Optional[List[str]]) -> List[str]:
    if not formats:
        return list(DEFAULT_FORMATS)
    normalized = [format_name for format_name in formats if format_name in _SUPPORTED_NOTE_FORMATS]
    return normalized or list(DEFAULT_FORMATS)


def _resume_analysis_worker(
    note_id: str,
    video_id: str,
    file_path: Optional[str],
    style: str,
    formats: List[str],
    model_provider: str,
    model_name: str,
    extras: Optional[str],
    resume_from_stage: str,
) -> None:
    service = AiNoteService()
    try:
        note = service.db.query(AiNote).filter(AiNote.id == note_id).first()
        if not note:
            logger.error("恢复分析失败: 笔记不存在 note_id=%s", note_id)
            return
        service._run_analysis(
            note=note,
            video_id=video_id,
            file_path=file_path,
            style=style,
            formats=formats,
            model_provider=model_provider,
            model_name=model_name,
            extras=extras,
            resume_from_stage=resume_from_stage,
        )
    finally:
        if service.db:
            service.db.close()


def _transcribe_video_worker(
    video_path: str,
    pipeline_mode: str,
) -> str:
    from src.services.ai.transcriber import get_transcriber
    from src.services.ai.local_asr_model_service import get_local_asr_model_service

    model_service = get_local_asr_model_service()
    active_model = model_service.ensure_active_model_ready()
    transcriber = get_transcriber("asr", model_config=active_model.model_dump())
    video_file = Path(video_path)
    audio_path = str(video_file.with_suffix(".mp3"))
    subtitle_path = str(video_file.with_suffix(".srt"))

    audio_extractor = getattr(transcriber, "audio_extractor", None)
    if not audio_extractor or not hasattr(audio_extractor, "extract"):
        raise RuntimeError("ASR 转写器未暴露音频提取器")
    extracted_audio_path = audio_extractor.extract(video_path, output_path=audio_path)
    if not extracted_audio_path:
        raise RuntimeError("未能提取音频")

    asr_backend = getattr(transcriber, "asr_backend", None)
    if not asr_backend or not hasattr(asr_backend, "transcribe_audio"):
        raise RuntimeError("ASR 转写器未暴露本地转写后端")

    load_model = getattr(asr_backend, "load_model", None)
    model = load_model() if callable(load_model) else None
    return asr_backend.transcribe_audio(
        extracted_audio_path,
        output_srt_path=subtitle_path,
        model=model,
    )


def _transcribe_video_process(
    result_queue: multiprocessing.Queue,
    error_queue: multiprocessing.Queue,
    video_path: str,
    pipeline_mode: str,
) -> None:
    try:
        result = _transcribe_video_worker(video_path, pipeline_mode)
        result_queue.put(("ok", result))
    except Exception as exc:
        error_queue.put(("error", repr(exc)))


def _terminate_asr_process(note_id: str) -> bool:
    with _ACTIVE_ASR_PROCESS_LOCK:
        pid = _ACTIVE_ASR_PROCESSES.pop(note_id, None)
    if not pid:
        return False
    try:
        os.kill(pid, 15)
        return True
    except ProcessLookupError:
        return True
    except Exception as exc:
        logger.warning(
            "终止 ASR 进程失败: note_id=%s pid=%s error=%s", note_id, pid, exc
        )
        return False


@dataclass
class AiTraceStep:
    stage: str
    title: str
    summary: str
    detail: Optional[Dict[str, Any]] = None
    progress: float = 0.0
    ts: str = ""


class AiNoteService:
    def _compute_cache_fingerprint(
        self,
        *,
        pipeline_mode: str,
        model_provider: str,
        model_name: str,
        style: str,
        level: str,
        formats: List[str],
        extras: Optional[str],
        context: Dict[str, Any],
    ) -> str:
        """Stable cache key for reusing artifacts.

        Intentionally excludes series memory injection, and uses the raw inputs
        (t0 + transcript + params) so the fingerprint remains stable across
        replays that only change contextual scaffolding.
        """
        payload = "\n".join(
            [
                pipeline_mode,
                model_provider,
                model_name,
                style,
                level,
                ",".join(formats or []),
                (extras or "").strip(),
                str(context.get("t0_text") or ""),
                str(context.get("transcript") or ""),
            ]
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()
    """AI 笔记分析服务"""

    def __init__(self):
        self.db: Session = SessionLocal()
        self.trace: List[AiTraceStep] = []
        self.logger = logging.getLogger(__name__)

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

    def _run_with_timeout(self, func, timeout_seconds: int, *args, **kwargs):
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(func, *args, **kwargs)
            try:
                return future.result(timeout=timeout_seconds)
            except FuturesTimeoutError as exc:
                future.cancel()
                raise TimeoutError(f"操作超时（{timeout_seconds} 秒）") from exc

    def _run_process_with_timeout_and_cancel(
        self,
        timeout_seconds: int,
        note_id: Optional[str],
        video_path: str,
        pipeline_mode: str,
    ):
        result_queue: multiprocessing.Queue = multiprocessing.Queue(maxsize=1)
        error_queue: multiprocessing.Queue = multiprocessing.Queue(maxsize=1)

        process = multiprocessing.Process(
            target=_transcribe_video_process,
            args=(result_queue, error_queue, video_path, pipeline_mode),
            daemon=True,
        )
        process.start()
        if note_id:
            with _ACTIVE_ASR_PROCESS_LOCK:
                _ACTIVE_ASR_PROCESSES[note_id] = process.pid

        deadline = time.monotonic() + timeout_seconds
        try:
            while process.is_alive():
                if note_id:
                    control = self._get_note_control(note_id)
                    state = (control.get("state") or "running").lower()
                    if state == "cancelled":
                        process.terminate()
                        process.join(timeout=5)
                        if note_id:
                            with _ACTIVE_ASR_PROCESS_LOCK:
                                _ACTIVE_ASR_PROCESSES.pop(note_id, None)
                        raise RuntimeError("分析已取消")
                    if state == "paused":
                        time.sleep(0.5)
                        continue

                if not error_queue.empty():
                    status, payload = error_queue.get_nowait()
                    raise RuntimeError(f"子进程执行失败: {payload}")

                if not result_queue.empty():
                    status, payload = result_queue.get_nowait()
                    if status == "ok":
                        return payload
                    raise RuntimeError(f"子进程执行失败: {payload}")

                if time.monotonic() > deadline:
                    process.terminate()
                    process.join(timeout=5)
                    if note_id:
                        with _ACTIVE_ASR_PROCESS_LOCK:
                            _ACTIVE_ASR_PROCESSES.pop(note_id, None)
                    raise TimeoutError(f"操作超时（{timeout_seconds} 秒）")

                time.sleep(0.5)

            if not result_queue.empty():
                status, payload = result_queue.get_nowait()
                if status == "ok":
                    return payload
                raise RuntimeError(f"子进程执行失败: {payload}")

            if not error_queue.empty():
                _, payload = error_queue.get_nowait()
                raise RuntimeError(f"子进程执行失败: {payload}")

            return None
        finally:
            if process.is_alive():
                process.terminate()
            process.join(timeout=5)
            if note_id:
                with _ACTIVE_ASR_PROCESS_LOCK:
                    _ACTIVE_ASR_PROCESSES.pop(note_id, None)

    def _normalize_pipeline_mode(self, pipeline_mode: Optional[str]) -> str:
        mode = (pipeline_mode or "").strip().lower()
        if mode in {"series", "image_text", "video"}:
            return mode
        return "video"

    def _infer_pipeline_mode(
        self, video_id: str, download: Optional[Download] = None
    ) -> str:
        media_type = (getattr(download, "media_type", None) or "").strip().lower()
        source_type = (getattr(download, "source_type", None) or "").strip().lower()

        if media_type in {"opus", "opus_list", "user_opus"} or source_type == "opus":
            return "image_text"
        if media_type in {"bangumi", "lesson", "music_list"}:
            return "series"
        if video_id.startswith("cv"):
            return "image_text"
        return "video"

    def _resolve_note_pipeline_mode(
        self, note: AiNote, download: Optional[Download] = None
    ) -> str:
        inferred_mode = self._infer_pipeline_mode(
            note.video_id or "", download=download
        )

        pipeline_mode = self._normalize_pipeline_mode(
            getattr(note, "pipeline_mode", None)
        )
        if pipeline_mode != "video" or getattr(note, "pipeline_mode", None):
            if pipeline_mode == "video" and inferred_mode != "video":
                note.pipeline_mode = inferred_mode
                note.meta = {**(note.meta or {}), "pipeline_mode": inferred_mode}
            return note.pipeline_mode or pipeline_mode

        meta_mode = None
        if note.meta and isinstance(note.meta, dict):
            meta_mode = note.meta.get("pipeline_mode")
        pipeline_mode = self._normalize_pipeline_mode(meta_mode)
        if pipeline_mode != "video" or meta_mode:
            note.pipeline_mode = pipeline_mode
            return pipeline_mode

        note.pipeline_mode = inferred_mode
        note.meta = {**(note.meta or {}), "pipeline_mode": inferred_mode}
        return inferred_mode

    def backfill_pipeline_modes(self) -> int:
        """回填历史笔记的 pipeline_mode，确保笔记类型会落到 image_text。"""
        notes = self.db.query(AiNote).all()
        updated = 0

        for note in notes:
            if not note.video_id:
                continue

            download = self.db.query(Download).filter(Download.id == note.video_id).first()
            if not download and note.video_id.startswith("folder-"):
                folder_name = note.video_id.removeprefix("folder-")
                if folder_name:
                    download = (
                        self.db.query(Download)
                        .filter(Download.file_path.contains(folder_name))
                        .first()
                    )

            before = note.pipeline_mode
            resolved = self._resolve_note_pipeline_mode(note, download=download)
            if resolved != before:
                updated += 1

        if updated:
            self.db.commit()
            logger.info("Backfilled %s ai_note pipeline mode records", updated)
        return updated

    def _trace_stage(self, pipeline_mode: str, stage: str) -> str:
        return f"{pipeline_mode}.{stage}"

    def _get_pipeline_stages(self, pipeline_mode: str) -> tuple:
        return _PIPELINE_STAGES.get(pipeline_mode, _SEMANTIC_STAGES)

    def _stage_key(self, stage: str) -> str:
        normalized = (stage or "").strip().upper()
        if not normalized:
            raise ValueError("resume_from_stage 不能为空")
        all_stages = {stage for stages in _PIPELINE_STAGES.values() for stage in stages}
        if "." in normalized:
            suffix = normalized.split(".", 1)[-1]
            if suffix in all_stages:
                return suffix
        if normalized in all_stages:
            return normalized
        raise ValueError(f"未知阶段: {stage}")

    def _stage_index(self, stage: str) -> int:
        key = self._stage_key(stage)
        for stages in _PIPELINE_STAGES.values():
            if key in stages:
                return stages.index(key)
        raise ValueError(f"未知阶段: {stage}")

    def _analysis_artifacts(self, note: AiNote) -> Dict[str, Any]:
        meta = note.meta if isinstance(note.meta, dict) else {}
        artifacts = meta.get("analysis_artifacts")
        return artifacts if isinstance(artifacts, dict) else {}

    def _store_analysis_artifacts(self, note: AiNote, **updates: Any) -> None:
        meta = note.meta if isinstance(note.meta, dict) else {}
        artifacts = meta.get("analysis_artifacts")
        artifacts = artifacts if isinstance(artifacts, dict) else {}
        artifacts.update(
            {key: value for key, value in updates.items() if value is not None}
        )
        meta["analysis_artifacts"] = artifacts
        note.meta = meta
        note.updated_at = datetime.utcnow()
        self.db.add(note)
        self.db.commit()

    def _collect_local_artifact_state(
        self,
        note: AiNote,
        download: Optional[Download] = None,
    ) -> Dict[str, Any]:
        artifacts = self._analysis_artifacts(note)
        source_path = note.video_id
        if download and download.file_path:
            source_path = download.file_path

        resolved_file_path = self._resolve_video_file_path(source_path)
        video_path = Path(resolved_file_path) if resolved_file_path else None
        video_dir = video_path.parent if video_path else None

        audio_path = artifacts.get("audio_path")
        if not audio_path and video_path:
            audio_path = str(video_path.with_suffix(".mp3"))

        subtitle_patterns = ["*.zh-CN.ai.srt", "*.zh-CN.srt", "*.ai-zh.srt", "*.srt"]
        subtitle_files: List[str] = []
        if video_dir and video_dir.exists():
            for pattern in subtitle_patterns:
                subtitle_files.extend([str(path) for path in sorted(video_dir.glob(pattern))])

        nfo_candidates: List[str] = []
        nfo_path = artifacts.get("nfo_path")
        if isinstance(nfo_path, str) and nfo_path:
            nfo_candidates.append(nfo_path)
        if video_path:
            nfo_candidates.append(str(video_path.with_suffix(".nfo")))
        if video_dir and video_dir.exists():
            nfo_candidates.extend([
                str(video_dir / "tvshow.nfo"),
                str(video_dir / "movie.nfo"),
            ])
            for child in sorted(video_dir.iterdir()):
                if child.is_file() and child.suffix.lower() == ".nfo":
                    nfo_candidates.append(str(child))

        generated_markdown_path = None
        if isinstance(note.meta, dict):
            generated_markdown_path = note.meta.get("generated_markdown_path")

        return {
            "video_path": str(video_path) if video_path and video_path.exists() else None,
            "audio_path": audio_path if isinstance(audio_path, str) and Path(audio_path).exists() else None,
            "audio_exists": bool(audio_path and Path(audio_path).exists()),
            "subtitle_files": sorted(set(subtitle_files)),
            "subtitle_exists": bool(subtitle_files),
            "nfo_path": next((path for path in nfo_candidates if path and Path(path).exists()), None),
            "nfo_exists": any(path and Path(path).exists() for path in nfo_candidates),
            "generated_markdown_path": generated_markdown_path if isinstance(generated_markdown_path, str) and Path(generated_markdown_path).exists() else None,
            "analysis_completed": note.status == "completed",
            "has_transcript": bool(artifacts.get("transcript")),
        }

    def _read_nfo_context(
        self,
        video_path: str,
        video_id: str,
        note: Optional[AiNote],
        pipeline_mode: str,
    ) -> Dict[str, Any]:
        self._wait_for_resume(note.id) if note else None
        t0 = NFOReader.read_t0_text(video_path)
        if note:
            self._store_analysis_artifacts(
                note, t0_text=t0["text"], nfo_path=t0["nfo_path"], nfo_found=t0["found"]
            )
        return t0

    def _generate_transcript(
        self,
        video_path: str,
        video_id: str,
        pipeline_mode: str,
        formats: Optional[List[str]] = None,
        note: Optional[AiNote] = None,
    ) -> str:
        self._add_trace(
            self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
            "字幕生成",
            "正在使用本地 ASR 从音频生成正文转写",
            35.0,
            {"video_path": video_path, "video_id": video_id, "timeout_seconds": 600},
            note=note,
        )
        if note:
            self._wait_for_resume(note.id)
        try:
            transcript = self._run_process_with_timeout_and_cancel(
                600,
                note.id if note else None,
                video_path,
                pipeline_mode,
            )
        except TimeoutError as exc:
            self._add_trace(
                self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
                "字幕生成超时",
                "本地 ASR 转写超时",
                55.0,
                {
                    "video_path": video_path,
                    "video_id": video_id,
                    "timeout_seconds": 600,
                    "error": str(exc),
                },
                note=note,
            )
            raise

        # If the caller wants time-coded features (timestamps / screenshots),
        # prefer feeding the LLM an SRT transcript when available, because it
        # includes subtitle timecodes the model can reference.
        normalized_formats = _normalize_note_formats(formats)
        wants_timecoded_transcript = any(
            format_name in {"screenshot", "timestamps"} for format_name in normalized_formats
        )
        if wants_timecoded_transcript:
            video_file = Path(video_path)
            srt_path = str(video_file.with_suffix(".srt"))
            try:
                if Path(srt_path).exists():
                    transcript = Path(srt_path).read_text(encoding="utf-8")
                    self._add_trace(
                        self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
                        "使用字幕时间码",
                        f"已读取 {Path(srt_path).name}（为时间戳/截图功能提供时间码）",
                        54.0,
                        {"srt_path": srt_path, "length": len(transcript or "")},
                        note=note,
                    )
                else:
                    self._add_trace(
                        self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
                        "缺少字幕时间码",
                        "未找到 .srt 文件，将继续使用纯文本转写（时间戳可能不可用）",
                        54.0,
                        {"srt_path": srt_path},
                        note=note,
                    )
            except Exception as exc:
                logger.warning("读取 SRT 失败，将继续使用纯文本转写: %s", exc)
        self._add_trace(
            self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
            "字幕生成完成",
            transcript[:240] if transcript else "未获取到转写结果",
            55.0,
            {
                "length": len(transcript or ""),
                "transcriber": "local-asr",
                "has_transcript": bool(transcript and transcript.strip()),
                "formats": normalized_formats,
            },
            note=note,
        )
        if note:
            self._store_analysis_artifacts(note, transcript=transcript)
        return transcript

    def _truncate_trace_from_stage(
        self,
        note: AiNote,
        resume_from_stage: str,
        pipeline_mode: Optional[str] = None,
    ) -> None:
        stage_key = self._stage_key(resume_from_stage)
        cutoff = self._stage_index(stage_key)
        active_pipeline_mode = pipeline_mode or self._resolve_note_pipeline_mode(note)
        existing_meta = note.meta if isinstance(note.meta, dict) else {}
        trace_entries = (
            existing_meta.get("trace")
            if isinstance(existing_meta.get("trace"), list)
            else []
        )

        kept_trace: List[Dict[str, Any]] = []
        for step in trace_entries:
            if not isinstance(step, dict):
                continue
            step_stage = str(step.get("stage") or "").strip()
            if not step_stage:
                continue
            try:
                step_index = self._stage_index(step_stage)
            except ValueError:
                kept_trace.append(step)
                continue
            if step_index < cutoff:
                kept_trace.append(step)

        control = (
            existing_meta.get("control")
            if isinstance(existing_meta.get("control"), dict)
            else {}
        )
        control = {
            **control,
            "state": "running",
            "resume_from_stage": self._trace_stage(active_pipeline_mode, stage_key),
            "current_stage": self._trace_stage(active_pipeline_mode, stage_key),
        }

        note.meta = {
            **existing_meta,
            "pipeline_mode": active_pipeline_mode,
            "trace": kept_trace,
            "control": control,
        }
        note.status = "processing"
        note.error = None
        note.pipeline_mode = active_pipeline_mode
        note.updated_at = datetime.utcnow()
        self.db.add(note)
        self.db.commit()

    def resume_from_stage(self, note_id: str, resume_from_stage: str) -> bool:
        note = self.db.query(AiNote).filter(AiNote.id == note_id).first()
        if not note:
            return False

        video_id = note.video_id
        file_path = note.meta.get("file_path") if isinstance(note.meta, dict) else None
        style = note.style or DEFAULT_STYLE
        formats = _normalize_note_formats(note.formats)
        model_provider = note.model_provider or "openai"
        model_name = note.model_name or "gpt-4o-mini"
        extras = note.meta.get("extras") if isinstance(note.meta, dict) else None
        self._truncate_trace_from_stage(
            note,
            resume_from_stage=resume_from_stage,
            pipeline_mode=self._resolve_note_pipeline_mode(note),
        )
        _terminate_asr_process(note.id)
        worker = threading.Thread(
            target=_resume_analysis_worker,
            args=(
                note.id,
                video_id,
                file_path,
                style,
                formats,
                model_provider,
                model_name,
                extras,
                resume_from_stage,
            ),
            daemon=True,
        )
        worker.start()
        return True

    def _current_stage_for_error(self, note: AiNote, pipeline_mode: str) -> str:
        control_stage = self._get_note_control(note.id).get("current_stage")
        if control_stage:
            return control_stage
        return self._trace_stage(pipeline_mode, "CONTENT.GENERATE")

    def _persist_note_meta(self, note: AiNote):
        note.meta = {
            **(note.meta or {}),
            "trace": [asdict(step) for step in self.trace],
        }
        self.db.add(note)
        self.db.commit()

    def _get_note_control(self, note_id: str) -> Dict[str, Any]:
        note = self.db.query(AiNote).filter(AiNote.id == note_id).first()
        meta = note.meta if note and isinstance(note.meta, dict) else {}
        control = meta.get("control") if isinstance(meta, dict) else {}
        return control if isinstance(control, dict) else {}

    def _set_note_control(
        self, note_id: str, state: str, current_stage: Optional[str] = None
    ) -> bool:
        note = self.db.query(AiNote).filter(AiNote.id == note_id).first()
        if not note:
            return False
        meta = note.meta if isinstance(note.meta, dict) else {}
        control = {
            **(meta.get("control") if isinstance(meta.get("control"), dict) else {}),
            "state": state,
        }
        if current_stage is not None:
            control["current_stage"] = current_stage
        meta["control"] = control
        note.meta = meta
        self.db.add(note)
        self.db.commit()
        task_control_registry.register(
            note_id,
            "ai_note",
            state=state,
            current_stage=current_stage,
        )
        return True

    def pause_analysis(self, note_id: str) -> bool:
        return self._set_note_control(note_id, "paused")

    def resume_analysis(self, note_id: str) -> bool:
        return self._set_note_control(note_id, "running")

    def cancel_analysis(self, note_id: str) -> bool:
        note = self.db.query(AiNote).filter(AiNote.id == note_id).first()
        if not note:
            return False
        note.status = "failed"
        note.error = "分析已取消"
        self._set_note_control(note_id, "cancelled")
        task_control_registry.cancel(note_id)
        _terminate_asr_process(note_id)
        self.db.commit()
        return True

    def reanalyze_incremental(self, note_id: str, pipeline_mode: Optional[str] = None) -> Dict[str, Any]:
        """重新生成笔记，覆盖之前的分析结果"""
        note = self.db.query(AiNote).filter(AiNote.id == note_id).first()
        if not note:
            raise ValueError(f"笔记不存在: {note_id}")

        if not note.content:
            raise ValueError("没有可用的之前分析结果")

        note.status = "pending"
        note.previous_analysis = note.content[:5000] if note.content else ""
        note.analysis_count = (note.analysis_count or 0) + 1
        note.error = None
        self.db.commit()

        self._set_note_control(note_id, "running")

        note = self.analyze_note(
            note_id=note.id,
            video_id=note.video_id,
            file_path=note.meta.get("file_path") if note.meta else None,
            style=note.style or DEFAULT_STYLE,
            formats=_normalize_note_formats(note.formats),
            model_provider=note.model_provider or "openai",
            model_name=note.model_name or "gpt-4o-mini",
            extras=note.meta.get("extras") if note.meta else None,
            pipeline_mode=pipeline_mode or note.pipeline_mode,
        )

        return {"success": True, "note_id": note.id, "message": "重新分析完成"}

    def _wait_for_resume(self, note_id: str) -> None:
        if not note_id:
            return
        while True:
            if task_control_registry.is_cancelled(note_id):
                raise RuntimeError("分析已取消")
            control = self._get_note_control(note_id)
            state = (control.get("state") or "running").lower()
            if state == "paused":
                time.sleep(0.5)
                continue
            if state == "cancelled":
                raise RuntimeError("分析已取消")
            return

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
            formats=_normalize_note_formats(formats),
            model_provider=model_provider,
            model_name=model_name,
            pipeline_mode=self._infer_pipeline_mode(video_id),
        )

        self._run_analysis(
            note=note,
            video_id=video_id,
            file_path=file_path,
            style=style,
            formats=_normalize_note_formats(formats),
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
        pipeline_mode: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> AiNote:
        normalized_pipeline_mode = self._normalize_pipeline_mode(pipeline_mode)
        note = AiNote(
            id=os.urandom(16).hex(),
            video_id=video_id,
            style=style,
            formats=formats,
            pipeline_mode=normalized_pipeline_mode,
            status="processing",
            model_provider=model_provider,
            model_name=model_name,
            meta={"pipeline_mode": normalized_pipeline_mode, **(meta or {})},
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
        subtitle_filename: Optional[str] = None,
        level: Optional[str] = None,
        pipeline_mode: Optional[str] = None,
    ) -> AiNote:
        note = self.db.query(AiNote).filter(AiNote.id == note_id).first()
        if not note:
            raise ValueError(f"Note not found: {note_id}")

        self._run_analysis(
            note=note,
            video_id=video_id,
            file_path=file_path,
            style=style,
            formats=_normalize_note_formats(formats),
            model_provider=model_provider,
            model_name=model_name,
            extras=extras,
            subtitle_filename=subtitle_filename,
            level=level,
            pipeline_mode=pipeline_mode,
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
        resume_from_stage: Optional[str] = None,
        subtitle_filename: Optional[str] = None,
        level: Optional[str] = None,
        pipeline_mode: Optional[str] = None,
    ) -> None:
        download = None
        actual_source_path = file_path

        if file_path and os.path.isdir(file_path):
            video_files = list(Path(file_path).glob("*.mp4")) + list(
                Path(file_path).glob("*.mkv")
            )
            if video_files:
                actual_source_path = str(video_files[0])
                video_title = video_files[0].stem
            else:
                raise ValueError(f"No video file found in directory: {file_path}")
        elif file_path and os.path.exists(file_path):
            actual_source_path = file_path
            video_title = os.path.splitext(os.path.basename(file_path))[0]
        else:
            download = self.db.query(Download).filter(Download.id == video_id).first()
            if not download:
                raise ValueError(f"Video not found: {video_id}")
            actual_source_path = download.file_path
            video_title = download.title

        if self._is_generated_note_file(actual_source_path):
            raise RuntimeError("当前输入是已生成的 ai-note 文件，请从原始正文文件重新分析")

        if note and task_control_registry.is_cancelled(note.id):
            raise RuntimeError("分析已取消")

        if pipeline_mode is not None:
            pipeline_mode = self._normalize_pipeline_mode(pipeline_mode)
            note.pipeline_mode = pipeline_mode
            note.meta = {
                **(note.meta or {}),
                "pipeline_mode": pipeline_mode,
            }
        else:
            pipeline_mode = self._resolve_note_pipeline_mode(note, download=download)

        actual_file_path = self._resolve_video_file_path(actual_source_path)
        if not actual_file_path:
            raise ValueError(f"Video file not found: {actual_source_path}")
        start_stage = self._stage_index(resume_from_stage) if resume_from_stage else 0
        artifacts = self._analysis_artifacts(note)
        resolved_level = self._resolve_level(style, level)

        subtitle_downloaded = False
        platform_subtitle_path = None

        subtitle_dir = Path(actual_file_path).parent
        subtitle_patterns = ["*.zh-CN.ai.srt", "*.zh-CN.srt", "*.ai-zh.srt", "*.srt"]

        if subtitle_filename:
            # 优先使用指定的字幕文件；如果指定文件不存在，再回退到目录扫描
            candidate = subtitle_dir / subtitle_filename
            if candidate.exists():
                platform_subtitle_path = str(candidate)
                subtitle_downloaded = True
            else:
                logger.warning(f"指定的字幕文件不存在: {candidate}")

        if not subtitle_downloaded:
            # 按优先级查找字幕文件
            for pattern in subtitle_patterns:
                subtitle_files = list(subtitle_dir.glob(pattern))
                if subtitle_files:
                    platform_subtitle_path = str(subtitle_files[0])
                    subtitle_downloaded = True
                    break

        try:
            if subtitle_downloaded and platform_subtitle_path:
                try:
                    subtitle_content = Path(platform_subtitle_path).read_text(
                        encoding="utf-8"
                    )
                    context = {
                        "t0_text": "",
                        "transcript": subtitle_content,
                        "level": resolved_level,
                        "subtitle_source": "platform",
                    }
                    start_stage = self._stage_index("NFO.READ")
                except Exception as e:
                    logger.warning(f"读取字幕失败: {e}")
                    start_stage = (
                        self._stage_index(resume_from_stage) if resume_from_stage else 0
                    )
                    context: Dict[str, Any] = {
                        "t0_text": artifacts.get("t0_text", ""),
                        "transcript": artifacts.get("transcript", ""),
                        "level": artifacts.get("level", resolved_level),
                    }
            else:
                context: Dict[str, Any] = {
                    "t0_text": artifacts.get("t0_text", ""),
                    "transcript": artifacts.get("transcript", ""),
                    "level": artifacts.get("level", resolved_level),
                }

            if pipeline_mode == "image_text":
                context["pipeline_mode"] = pipeline_mode
                if start_stage <= self._stage_index("DOC.READ"):
                    self._set_note_control(
                        note.id,
                        "running",
                        current_stage=self._trace_stage(pipeline_mode, "DOC.READ"),
                    )

                level = resolved_level
                context["level"] = level
                image_context = NFOReader.read_image_text_context(actual_file_path)
                context["t0_text"] = image_context.get("body_text", "") or image_context.get("text", "")
                context["transcript"] = image_context.get("summary_text", "")
                context["image_body_text"] = image_context.get("body_text", "")
                context["image_summary_text"] = image_context.get("summary_text", "")

                if not context["t0_text"].strip() and not context["transcript"].strip():
                    raise RuntimeError("图文正文为空，无法生成高质量笔记")

                self._add_trace(
                    self._trace_stage(pipeline_mode, "DOC.READ"),
                    "文档读取",
                    "图文笔记读取正文/元数据，不执行音频提取与 ASR",
                    20.0,
                    {
                        "level": level,
                        "source_path": actual_file_path,
                        "t0_length": len(context.get("t0_text", "")),
                        "t1_length": len(context.get("transcript", "")),
                        "doc_source": image_context.get("nfo_path"),
                    },
                    note=note,
                )
                self._add_trace(
                    self._trace_stage(pipeline_mode, "NFO.READ"),
                    "元数据读取",
                    f"正在读取元数据并使用 {level} 模板整理内容",
                    70.0,
                    {
                        "level": level,
                        "nfo_path": artifacts.get("nfo_path"),
                        "nfo_found": artifacts.get("nfo_found"),
                        "t0_length": len(context.get("t0_text", "")),
                        "t1_length": len(context.get("transcript", "")),
                    },
                    note=note,
                )
                self._store_analysis_artifacts(
                    note,
                    level=level,
                    t0_text=context["t0_text"],
                    transcript=context["transcript"],
                )
            else:
                context["pipeline_mode"] = pipeline_mode
                if start_stage <= self._stage_index("AUDIO.FETCH"):
                    self._set_note_control(
                        note.id,
                        "running",
                        current_stage=self._trace_stage(pipeline_mode, "AUDIO.FETCH"),
                    )
                    context = self._prepare_analysis_context(
                        actual_file_path,
                        video_id,
                        style,
                        note,
                        pipeline_mode=pipeline_mode,
                        formats=formats,
                    )
                else:
                    if start_stage <= self._stage_index("SUBTITLE.GENERATE"):
                        self._set_note_control(
                            note.id,
                            "running",
                            current_stage=self._trace_stage(
                                pipeline_mode, "SUBTITLE.GENERATE"
                            ),
                        )
                        transcript = self._generate_transcript(
                            actual_file_path,
                            video_id,
                            pipeline_mode,
                            formats=formats,
                            note=note,
                        )
                        context["transcript"] = transcript
                        if not context.get("t0_text"):
                            self._set_note_control(
                                note.id,
                                "running",
                                current_stage=self._trace_stage(
                                    pipeline_mode, "AUDIO.FETCH"
                                ),
                            )
                            t0 = self._read_nfo_context(
                                actual_file_path,
                                video_id,
                                note,
                                pipeline_mode,
                            )
                            context["t0_text"] = t0["text"]

                    if start_stage <= self._stage_index("NFO.READ"):
                        self._set_note_control(
                            note.id,
                            "running",
                            current_stage=self._trace_stage(pipeline_mode, "NFO.READ"),
                        )
                        level = self._resolve_level(style, level)
                        context["level"] = level

                        # 读取 NFO 获取视频元数据（标题、描述、标签等）
                        if not context.get("t0_text"):
                            t0 = self._read_nfo_context(
                                actual_file_path,
                                video_id,
                                note,
                                pipeline_mode,
                            )
                            context["t0_text"] = t0["text"]

                        self._add_trace(
                            self._trace_stage(pipeline_mode, "NFO.READ"),
                            "NFO 读取",
                            "正在读取 NFO 并整理元数据",
                            70.0,
                            {
                                "level": level,
                                "nfo_path": artifacts.get("nfo_path"),
                                "nfo_found": artifacts.get("nfo_found"),
                                "t0_length": len(context.get("t0_text", "")),
                                # For debugging/verification in UI trace.
                                # This can be large, but is only stored in note meta for the current analysis.
                                "t0_text": context.get("t0_text", ""),
                            },
                            note=note,
                        )
                        self._store_analysis_artifacts(note, level=level)

                    if start_stage > self._stage_index("NFO.READ") and not context.get(
                        "t0_text"
                    ):
                        t0_text = artifacts.get("t0_text")
                        if not t0_text:
                            t0 = self._read_nfo_context(
                                actual_file_path,
                                video_id,
                                note,
                                pipeline_mode,
                            )
                            context["t0_text"] = t0["text"]
                        else:
                            context["t0_text"] = t0_text
                    if start_stage > self._stage_index(
                        "SUBTITLE.GENERATE"
                    ) and not context.get("transcript"):
                        context["transcript"] = artifacts.get("transcript", "")
                    if not context.get("level"):
                        context["level"] = artifacts.get(
                            "level", self._resolve_level(style, level)
                        )

            if download:
                download.transcript = context["transcript"]
                download.transcript_lang = "image_text" if pipeline_mode == "image_text" else "whisper"
                self.db.commit()

            self._wait_for_resume(note.id)
            self._set_note_control(
                note.id,
                "running",
                current_stage=self._trace_stage(pipeline_mode, "PROMPT.BUILD"),
            )
            self._add_trace(
                self._trace_stage(pipeline_mode, "PROMPT.BUILD"),
                "构建 Prompt",
                "正在按固定顺序拼装最终 prompt",
                85.0,
                {
                    "style": style,
                    "formats": formats,
                    "has_transcript": bool(context["transcript"]),
                    "pipeline_mode": pipeline_mode,
                },
                note=note,
            )
            series_memory = ""
            if pipeline_mode == "series":
                series_memory = self._read_series_memory(actual_file_path)
            merged_extras = extras
            if series_memory:
                merged_extras = f"## 系列记忆（来自历史分析，请遵循）\n{series_memory}\n\n{extras or ''}".strip()

            transcript_lang = _detect_transcript_language(str(context.get("transcript") or ""))
            lang_block = _build_language_policy_block(transcript_lang)
            merged_extras = f"{lang_block}\n\n{merged_extras or ''}".strip()

            prompt = self._build_prompt_from_context(
                context=context,
                style=style,
                formats=_normalize_note_formats(formats),
                extras=merged_extras,
            )
            self._store_analysis_artifacts(note, prompt=prompt)
            normalized_formats = _normalize_note_formats(formats)
            cache_fingerprint = self._compute_cache_fingerprint(
                pipeline_mode=pipeline_mode,
                model_provider=model_provider,
                model_name=model_name,
                style=style,
                level=str(context.get("level") or ""),
                formats=normalized_formats,
                extras=extras,
                context=context,
            )
            input_fingerprint = hashlib.sha256(
                ("\n".join([
                    pipeline_mode,
                    model_provider,
                    model_name,
                    style,
                    ",".join(normalized_formats),
                    (merged_extras or "").strip(),
                    prompt,
                ])).encode("utf-8")
            ).hexdigest()

            # Always re-run LLM generation even if an older markdown exists.
            # We still persist cache_fingerprint in the index/meta for debugging, but never short-circuit.
            t0_len = len(context.get("t0_text", ""))
            t1_len = len(context.get("transcript", ""))
            self._add_trace(
                self._trace_stage(pipeline_mode, "PROMPT.BUILD"),
                "Prompt 生成完成",
                prompt[:500],
                88.0,
                {
                    "prompt_length": len(prompt),
                    "prompt_preview": prompt[:500],
                    "prompt": prompt,
                    "t0_length": t0_len,
                    "t1_length": t1_len,
                    "has_t1": t1_len > 0,
                },
                note=note,
            )

            self._wait_for_resume(note.id)
            self._set_note_control(
                note.id,
                "running",
                current_stage=self._trace_stage(pipeline_mode, "LLM.ANALYZE"),
            )
            markdown = self._generate_note(
                prompt=prompt,
                model_provider=model_provider,
                model_name=model_name,
                note=note,
                pipeline_mode=pipeline_mode,
            )
            self._add_trace(
                self._trace_stage(pipeline_mode, "CONTENT.GENERATE"),
                "模型返回完成",
                markdown[:240],
                95.0,
                {"response_length": len(markdown or "")},
                note=note,
            )

            # 后处理 Markdown
            markdown = self._post_process_markdown(
                markdown,
                actual_file_path,
                note,
                formats,
            )
            summary = self._extract_summary(markdown)
            markdown_path = self._write_markdown_output(
                actual_file_path, note.id, markdown
            )
            index_path = self._write_note_index_output(
                actual_file_path,
                note.id,
                markdown_path=markdown_path,
                input_fingerprint=input_fingerprint,
                cache_fingerprint=cache_fingerprint,
                pipeline_mode=pipeline_mode,
                style=style,
                formats=normalized_formats,
                model_provider=model_provider,
                model_name=model_name,
                extras=merged_extras,
                transcript_language=transcript_lang,
            )

            note.content = markdown
            note.summary = summary
            note.pipeline_mode = pipeline_mode
            note.meta = {
                **(note.meta or {}),
                "pipeline_mode": pipeline_mode,
                "generated_markdown_path": markdown_path,
                "generated_index_path": index_path,
                "input_fingerprint": input_fingerprint,
                "cache_fingerprint": cache_fingerprint,
                "transcript_language": transcript_lang,
            }
            note.status = "completed"
            note.completed_at = datetime.utcnow()
            self._set_note_control(
                note.id,
                "completed",
                current_stage=self._trace_stage(pipeline_mode, "CONTENT.GENERATE"),
            )
            self._persist_note_meta(note)

            if download:
                download.ai_note_id = note.id
                download.ai_markdown = markdown
                download.ai_summary = summary
                download.ai_style = style
                download.ai_status = "completed"
                self.db.commit()

            if pipeline_mode == "series":
                memory_path = self._update_series_memory(actual_file_path, note.id, markdown)
                note.meta = {**(note.meta or {}), "series_memory_path": memory_path}
                self._persist_note_meta(note)

            self._add_trace(
                self._trace_stage(pipeline_mode, "CONTENT.GENERATE"),
                "分析完成",
                "AI 笔记生成成功",
                100.0,
                note=note,
            )
            self._persist_note_meta(note)
            logger.info(f"笔记生成完成: {note.id}")

        except Exception as e:
            logger.error(f"笔记生成失败: {e}", exc_info=True)
            note.status = "failed"
            note.error = str(e)
            current_stage = self._current_stage_for_error(
                note,
                self._resolve_note_pipeline_mode(note, download=download),
            )
            self._add_trace(
                current_stage,
                "分析失败",
                str(e),
                100.0,
                {
                    "error": str(e),
                    "stage": current_stage,
                },
                note=note,
            )
            self._persist_note_meta(note)

            if download:
                download.ai_status = "failed"
                download.ai_error = str(e)
                self.db.commit()

        finally:
            if note:
                task_control_registry.remove(note.id)
            self.db.close()

    def _resolve_level(self, style: str, level: Optional[str] = None) -> str:
        if level:
            return level
        return "simple" if style in {"minimal", "task_oriented"} else "detailed"

    def _resolve_video_file_path(self, source_path: Optional[str]) -> Optional[str]:
        if not source_path:
            return None

        path = Path(source_path)
        if not path.exists():
            return None

        if path.is_file():
            return str(path)

        if not path.is_dir():
            return None

        # 图文模式的原始正文通常是同名 .md；这里优先挑选原始正文文件，
        # 并显式排除已经生成过的 ai-note 文件，避免二次分析自身产物。
        original_markdown_candidates = sorted(
            [
                child
                for child in path.iterdir()
                if child.is_file()
                and child.suffix.lower() == ".md"
                and not child.name.endswith(".ai-note.md")
            ],
            key=lambda item: item.name,
        )
        if original_markdown_candidates:
            return str(original_markdown_candidates[0])

        preferred_exts = {
            ".mp4",
            ".mkv",
            ".mov",
            ".webm",
            ".flv",
            ".avi",
            ".m4v",
            ".ts",
        }
        candidates = sorted(
            [
                child
                for child in path.rglob("*")
                if child.is_file() and child.suffix.lower() in preferred_exts
            ],
            key=self._source_file_sort_key,
        )
        if candidates:
            return str(candidates[0])

        fallback_candidates = sorted(
            [
                child
                for child in path.rglob("*")
                if child.is_file()
                and child.suffix.lower()
                not in {".nfo", ".jpg", ".jpeg", ".png", ".bak"}
                and not child.name.startswith(".")
                and not child.name.endswith(".ai-note.md")
            ],
            key=self._source_file_sort_key,
        )
        return str(fallback_candidates[0]) if fallback_candidates else None

    def _source_file_sort_key(self, path: Path) -> Tuple[int, str]:
        match = re.search(r"(?:^|[\\/\\s_-])P?0*(\d{1,3})(?=\\s|[.、．_-]|$)", str(path), flags=re.IGNORECASE)
        if match:
            try:
                return int(match.group(1)), str(path)
            except ValueError:
                pass
        return 9999, str(path)

    @staticmethod
    def _is_generated_note_file(path: Optional[str]) -> bool:
        if not path:
            return False
        return Path(path).name.endswith(".ai-note.md")

    def _prepare_analysis_context(
        self,
        video_path: str,
        video_id: str,
        style: str,
        note: Optional[AiNote] = None,
        pipeline_mode: str = "video",
        formats: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        if note:
            self._wait_for_resume(note.id)

        video_file = Path(video_path)
        audio_path = str(video_file.with_suffix(".mp3"))

        if note:
            existing_artifacts = (
                note.meta.get("analysis_artifacts", {})
                if isinstance(note.meta, dict)
                else {}
            )
            existing_audio = existing_artifacts.get("audio_path")
            if existing_audio and Path(existing_audio).exists():
                audio_path = existing_audio
                audio_exists = True
            else:
                audio_exists = Path(audio_path).exists()
        else:
            audio_exists = Path(audio_path).exists()

        self._add_trace(
            self._trace_stage(pipeline_mode, "AUDIO.FETCH"),
            "音频获取",
            "检查音频文件" if audio_exists else "正在提取音频",
            10.0,
            {
                "video_path": video_path,
                "video_id": video_id,
                "resolved_path": video_path,
                "audio_path": audio_path,
                "audio_exists": audio_exists,
            },
            note=note,
        )

        if not audio_exists:
            try:
                from src.services.ai.transcriber import get_transcriber
                from src.services.ai.local_asr_model_service import (
                    get_local_asr_model_service,
                )

                model_service = get_local_asr_model_service()
                active_model = model_service.ensure_active_model_ready()
                transcriber = get_transcriber(
                    "asr", model_config=active_model.model_dump()
                )
                pipeline_name = getattr(
                    transcriber, "get_pipeline_name", lambda: "ffmpeg + faster-whisper"
                )()

                audio_extractor = getattr(transcriber, "audio_extractor", None)
                if audio_extractor and hasattr(audio_extractor, "extract"):
                    extracted = audio_extractor.extract(
                        video_path, output_path=audio_path
                    )
                    if extracted:
                        audio_path = extracted
            except Exception:
                pass

        if note and task_control_registry.is_cancelled(note.id):
            raise RuntimeError("分析已取消")

        audio_final_exists = Path(audio_path).exists() if audio_path else False
        self._add_trace(
            self._trace_stage(pipeline_mode, "AUDIO.FETCH"),
            "音频获取完成",
            f"音频文件: {Path(audio_path).name}"
            if audio_final_exists
            else "未找到音频文件",
            20.0,
            {
                "audio_path": audio_path,
                "audio_exists": audio_final_exists,
            },
            note=note,
        )

        self._add_trace(
            self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
            "字幕生成",
            "正在使用本地 ASR 从音频生成正文转写",
            35.0,
            {
                "video_path": video_path,
                "video_id": video_id,
                "audio_path": audio_path,
                "timeout_seconds": 600,
            },
            note=note,
        )
        if note:
            self._wait_for_resume(note.id)
            if task_control_registry.is_cancelled(note.id):
                raise RuntimeError("分析已取消")
        try:
            transcript = self._run_process_with_timeout_and_cancel(
                600,
                note.id if note else None,
                video_path,
                pipeline_mode,
            )
        except TimeoutError as exc:
            self._add_trace(
                self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
                "字幕生成超时",
                "本地 ASR 转写超时",
                55.0,
                {
                    "video_path": video_path,
                    "video_id": video_id,
                    "timeout_seconds": 600,
                    "error": str(exc),
                },
                note=note,
            )
            raise

        normalized_formats = _normalize_note_formats(formats)
        wants_timecoded_transcript = any(
            format_name in {"screenshot", "timestamps"} for format_name in normalized_formats
        )
        if wants_timecoded_transcript:
            srt_path = str(video_file.with_suffix(".srt"))
            try:
                if Path(srt_path).exists():
                    transcript = Path(srt_path).read_text(encoding="utf-8")
                    self._add_trace(
                        self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
                        "使用字幕时间码",
                        f"已读取 {Path(srt_path).name}（为时间戳/截图功能提供时间码）",
                        54.0,
                        {"srt_path": srt_path, "length": len(transcript or "")},
                        note=note,
                    )
                else:
                    self._add_trace(
                        self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
                        "缺少字幕时间码",
                        "未找到 .srt 文件，将继续使用纯文本转写（时间戳可能不可用）",
                        54.0,
                        {"srt_path": srt_path},
                        note=note,
                    )
            except Exception as exc:
                logger.warning("读取 SRT 失败，将继续使用纯文本转写: %s", exc)
        self._add_trace(
            self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
            "字幕生成完成",
            transcript[:240] if transcript else "未获取到转写结果",
            55.0,
            {
                "length": len(transcript or ""),
                "transcriber": "local-asr",
                "has_transcript": bool(transcript and transcript.strip()),
                "formats": normalized_formats,
            },
            note=note,
        )

        level = self._resolve_level(style)
        t0_for_nfo = NFOReader.read_t0_text(video_path)
        self._add_trace(
            self._trace_stage(pipeline_mode, "NFO.READ"),
            "NFO 读取",
            f"正在读取 NFO 并使用 {level} 模板整理内容",
            70.0,
            {
                "level": level,
                "nfo_path": t0_for_nfo["nfo_path"],
                "nfo_found": t0_for_nfo["found"],
            },
            note=note,
        )
        if note:
            self._wait_for_resume(note.id)
            if task_control_registry.is_cancelled(note.id):
                raise RuntimeError("分析已取消")

        self._add_trace(
            self._trace_stage(pipeline_mode, "PROMPT.BUILD"),
            "Prompt 构建",
            f"当前风格: {style}",
            80.0,
            {
                "style": style,
                "formats": _normalize_note_formats(formats),
                "has_transcript": bool(transcript and transcript.strip()),
            },
            note=note,
        )
        if note:
            self._store_analysis_artifacts(
                note, t0_text=t0_for_nfo["text"], transcript=transcript, level=level
            )

        return {
            "t0_text": t0_for_nfo["text"],
            "transcript": transcript or "",
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
            pipeline_mode=context.get("pipeline_mode", "video"),
        )

    def _transcribe_video(
        self,
        video_path: str,
        video_id: str,
        note: Optional[AiNote] = None,
        pipeline_mode: str = "video",
    ) -> str:
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
                self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
                "检查本地模型",
                f"当前激活模型 {active_model.name} 已就绪",
                38.0,
                {"model": active_model.model_id, "cache_path": active_model.cache_path},
            )
            transcriber = get_transcriber("asr", model_config=active_model.model_dump())
            pipeline_name = getattr(
                transcriber, "get_pipeline_name", lambda: "ffmpeg + faster-whisper"
            )()
            video_file = Path(video_path)
            audio_path = str(video_file.with_suffix(".mp3"))
            subtitle_path = str(video_file.with_suffix(".srt"))

            self._add_trace(
                self._trace_stage(pipeline_mode, "AUDIO.FETCH"),
                "提取音频",
                f"正在使用 {pipeline_name} 从视频提取音频",
                30.0,
                {
                    "video_path": video_path,
                    "audio_path": audio_path,
                    "pipeline": pipeline_name,
                },
            )
            audio_extractor = getattr(transcriber, "audio_extractor", None)
            if not audio_extractor or not hasattr(audio_extractor, "extract"):
                raise RuntimeError("ASR 转写器未暴露音频提取器")
            extracted_audio_path = audio_extractor.extract(
                video_path,
                output_path=audio_path,
            )
            if not extracted_audio_path:
                raise RuntimeError("未能提取音频")
            self._add_trace(
                self._trace_stage(pipeline_mode, "AUDIO.FETCH"),
                "音频提取完成",
                f"音频已提取到 {Path(extracted_audio_path).name}",
                35.0,
                {"audio_path": extracted_audio_path, "pipeline": pipeline_name},
                note=note,
            )
            self._add_trace(
                self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
                "本地 ASR 请求",
                "正在调用本地 ASR 生成字幕文本",
                45.0,
                {
                    "pipeline": pipeline_name,
                    "runtime": getattr(
                        getattr(transcriber, "asr_backend", None),
                        "get_runtime_label",
                        lambda: pipeline_name,
                    )(),
                },
            )
            asr_backend = getattr(transcriber, "asr_backend", None)
            if not asr_backend or not hasattr(asr_backend, "transcribe_audio"):
                raise RuntimeError("ASR 转写器未暴露本地转写后端")
            load_model = getattr(asr_backend, "load_model", None)
            model = None
            if callable(load_model):
                self._add_trace(
                    self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
                    "ASR 模型加载中",
                    f"正在加载 {getattr(asr_backend, 'get_runtime_label', lambda: pipeline_name)()}",
                    46.0,
                    {"audio_path": extracted_audio_path, "pipeline": pipeline_name},
                    note=note,
                )
                model = load_model()
                self._add_trace(
                    self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
                    "ASR 模型加载完成",
                    f"模型已加载: {getattr(asr_backend, 'get_runtime_label', lambda: pipeline_name)()}",
                    47.0,
                    {"audio_path": extracted_audio_path, "pipeline": pipeline_name},
                    note=note,
                )
            self._add_trace(
                self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
                "ASR 转写中",
                "正在对音频执行本地 ASR 转写",
                48.0,
                {
                    "audio_path": extracted_audio_path,
                    "subtitle_path": subtitle_path,
                    "pipeline": pipeline_name,
                },
                note=note,
            )
            result = asr_backend.transcribe_audio(
                extracted_audio_path,
                output_srt_path=subtitle_path,
                model=model,
            )
            if not result or not result.strip():
                self._add_trace(
                    self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
                    "本地 ASR 结果为空",
                    "未获取到有效转写文本，将继续基于其他元数据生成笔记",
                    50.0,
                    {"length": 0, "pipeline": pipeline_name},
                    note=note,
                )
                return ""
            self._add_trace(
                self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"),
                "本地 ASR 完成",
                result[:240],
                50.0,
                {"length": len(result), "pipeline": pipeline_name},
                note=note,
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
        note: Optional[AiNote] = None,
        pipeline_mode: str = "video",
        is_incremental: bool = False,
    ) -> str:
        """调用 LLM 生成笔记

        Args:
            is_incremental: 是否为增量分析（基于之前的分析结果继续）
        """
        try:
            if note:
                self._wait_for_resume(note.id)
            settings = SettingsService(self.db).get_settings()
            provider_config: Dict[str, Any] = {}
            if settings and getattr(settings, "llm", None):
                provider_config["base_url"] = (
                    getattr(settings.llm, "base_url", "") or None
                )
                provider_config["api_key"] = (
                    getattr(settings.llm, "api_key", "") or None
                )
                logger.info(f"[LLM] Initial provider_config: api_key={'***' + provider_config['api_key'][-4:] if provider_config.get('api_key') else 'None'}")
                providers = getattr(settings.llm, "providers", []) or []
                matched_provider = next(
                    (
                        item
                        for item in providers
                        if isinstance(item, dict)
                        and str(item.get("id", "")).strip().lower()
                        == model_provider.lower()
                    ),
                    None,
                )
                if matched_provider:
                    provider_config["base_url"] = (
                        matched_provider.get("baseUrl")
                        or matched_provider.get("base_url")
                        or provider_config["base_url"]
                    ) or None
                    provider_config["api_key"] = (
                        matched_provider.get("apiKey")
                        or matched_provider.get("api_key")
                        or provider_config["api_key"]
                    ) or None
                    logger.info(f"[LLM] Matched provider config: api_key={'***' + provider_config['api_key'][-4:] if provider_config.get('api_key') else 'None'}")

            previous_summary = ""
            if is_incremental and note and note.previous_analysis:
                previous_summary = f"\n\n## 上一次分析的总结摘要\n{note.previous_analysis}\n\n请基于以上摘要和新的分析请求，继续完善笔记内容。"
                self._add_trace(
                    self._trace_stage(pipeline_mode, "LLM.ANALYZE"),
                    "AI 增量分析",
                    f"基于之前分析继续（已节省 tokens）",
                    92.0,
                    {
                        "provider": model_provider,
                        "model": model_name,
                        "prompt_length": len(prompt),
                        "is_incremental": True,
                        "previous_summary_length": len(previous_summary),
                    },
                    note=note,
                )
            else:
                self._add_trace(
                    self._trace_stage(pipeline_mode, "LLM.ANALYZE"),
                    "AI 分析",
                    f"正在请求 {model_provider}/{model_name}，prompt 约 {len(prompt)} 字",
                    92.0,
                    {
                        "provider": model_provider,
                        "model": model_name,
                        "prompt_length": len(prompt),
                        "prompt_preview": prompt[:1200],
                        "base_url": provider_config.get("base_url"),
                    },
                    note=note,
                )
            # Allow user-defined provider ids like "custom_123" stored in settings.llm.providers.
            # For client selection we only need the semantic provider type; unknown ids fall back to CUSTOM.
            try:
                provider = LLMProvider(model_provider)
            except Exception:
                provider = LLMProvider.CUSTOM
            client = LLMClientFactory.create_client(provider, **provider_config)
            if is_incremental and previous_summary:
                incremental_prompt = f"{prompt}{previous_summary}"
                messages = [
                    LLMMessage(role="system", content=incremental_prompt),
                    LLMMessage(
                        role="user",
                        content="请基于上一次的摘要和新的分析请求，继续完善笔记内容。",
                    ),
                ]
            else:
                messages = [
                    LLMMessage(role="system", content=prompt),
                    LLMMessage(role="user", content="请根据以上信息生成笔记。"),
                ]
            
            # 使用流式调用（暂不实时推送，避免数据库锁）
            response_content = ""
            if hasattr(client, 'chat_stream') and model_name:
                # 支持流式调用
                logger.info(f"[LLM] 使用流式调用 {model_provider}/{model_name}")
                stream = client.chat_stream(messages, model=model_name, temperature=0.7)
                self._add_trace(
                    self._trace_stage(pipeline_mode, "LLM.ANALYZE"),
                    "LLM 请求参数",
                    "已构造请求消息（system/user）",
                    92.0,
                    {
                        "provider": model_provider,
                        "model": model_name,
                        "base_url": provider_config.get("base_url"),
                        "messages": [m.dict() if hasattr(m, "dict") else {"role": getattr(m, "role", ""), "content": getattr(m, "content", "")} for m in messages],
                    },
                    note=note,
                )
                try:
                    for chunk_text in stream:
                        if note and task_control_registry.is_cancelled(note.id):
                            raise RuntimeError("分析已取消")
                        if chunk_text:
                            response_content += chunk_text
                finally:
                    close_stream = getattr(stream, "close", None)
                    if callable(close_stream):
                        close_stream()
            else:
                # 回退到同步调用
                logger.info(f"[LLM] 使用同步调用 {model_provider}/{model_name}")
                self._add_trace(
                    self._trace_stage(pipeline_mode, "LLM.ANALYZE"),
                    "LLM 请求参数",
                    "已构造请求消息（system/user）",
                    92.0,
                    {
                        "provider": model_provider,
                        "model": model_name,
                        "base_url": provider_config.get("base_url"),
                        "messages": [m.dict() if hasattr(m, "dict") else {"role": getattr(m, "role", ""), "content": getattr(m, "content", "")} for m in messages],
                    },
                    note=note,
                )
                response = client.chat(messages, model=model_name, temperature=0.7)
                response_content = (
                    response.content
                    if response and hasattr(response, "content")
                    else str(response)
                )
            self._add_trace(
                self._trace_stage(pipeline_mode, "LLM.ANALYZE"),
                "AI 分析完成",
                f"模型返回结果 ({len(response_content or '')} 字)",
                92.0,
                {
                    "response_length": len(response_content or ""),
                    "response_preview": response_content[:500]
                    if response_content
                    else "",
                    "response": response_content or "",
                },
                note=note,
            )
            response_preview = response_content[:800] if response_content else ""
            self._add_trace(
                self._trace_stage(pipeline_mode, "CONTENT.GENERATE"),
                "生成内容",
                response_content[:300] if response_content else "生成完成",
                94.0,
                {
                    "has_content": bool(response_content),
                    "response_length": len(response_content or ""),
                    "response_preview": response_preview,
                },
                note=note,
            )
            return response_content
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

    def _normalize_screenshot_timestamp(self, timestamp: str) -> str:
        parts = timestamp.split(":")
        if len(parts) == 2:
            minutes, seconds = parts
            return f"{int(minutes):02d}{int(seconds):02d}"
        if len(parts) == 3:
            hours, minutes, seconds = parts
            return f"{int(hours):02d}{int(minutes):02d}{int(seconds):02d}"
        raise ValueError(f"无效的截图时间戳: {timestamp}")

    def _process_screenshot_markers(
        self, markdown: str, video_path: str, note: Optional[AiNote] = None
    ) -> str:
        def replace_screenshot(match):
            timestamp = match.group(1)
            parts = list(map(int, timestamp.split(":")))
            if len(parts) == 2:
                minutes, seconds = parts
                total_seconds = minutes * 60 + seconds
            elif len(parts) == 3:
                hours, minutes, seconds = parts
                total_seconds = hours * 3600 + minutes * 60 + seconds
            else:
                logger.warning(f"无效的截图时间戳: {timestamp}")
                return f"[Screenshot at {timestamp}]()"

            video_name = Path(video_path).stem
            # Screenshot is written as a sidecar file alongside the video so it
            # can be moved automatically by the series layout switcher.
            # NOTE: must start with "{stem}." to match VideoLibraryService._sidecars_for_stem().
            filename = f"{video_name}.screenshot.{self._normalize_screenshot_timestamp(timestamp)}.jpg"
            video_dir = Path(video_path).parent
            output_path = str(video_dir / filename)
            # Legacy paths:
            # 1) old flat sidecar name in root: "{stem}_{ts}.jpg"
            legacy_output_path = video_dir / f"{video_name}_{self._normalize_screenshot_timestamp(timestamp)}.jpg"
            # 2) old screenshots subdir: "./screenshots/{stem}_{ts}.jpg"
            legacy_dir_output_path = video_dir / "screenshots" / f"{video_name}_{self._normalize_screenshot_timestamp(timestamp)}.jpg"

            def as_markdown_image(link_path: str) -> str:
                # CommonMark does not allow spaces in link destinations unless they
                # are wrapped in <...>. Our sidecar filenames often contain spaces,
                # so always wrap to ensure markdown renderers treat it as an image.
                return f"![Screenshot at {timestamp}](<{link_path}>)"

            if Path(output_path).exists():
                logger.info(f"截图已存在: {filename}")
                return as_markdown_image(f"./{filename}")
            if legacy_output_path.exists():
                logger.info(f"截图已存在(兼容旧路径): {filename}")
                return as_markdown_image(f"./{legacy_output_path.name}")
            if legacy_dir_output_path.exists():
                logger.info(f"截图已存在(兼容旧路径): {legacy_dir_output_path.name}")
                return as_markdown_image(f"./screenshots/{legacy_dir_output_path.name}")

            try:
                video_dir.mkdir(parents=True, exist_ok=True)
                subprocess.run(
                    [
                        "ffmpeg",
                        "-y",
                        "-ss",
                        str(total_seconds),
                        "-i",
                        video_path,
                        "-vframes",
                        "1",
                        "-q:v",
                        "2",
                        output_path,
                    ],
                    check=True,
                    capture_output=True,
                    timeout=30,
                )
                if Path(output_path).exists():
                    logger.info(f"截图生成成功: {filename}")
                    return as_markdown_image(f"./{filename}")
            except subprocess.TimeoutExpired:
                logger.warning(f"截图生成超时: {timestamp}")
            except FileNotFoundError:
                logger.warning(f"ffmpeg 未找到，无法生成截图: {timestamp}")
            except subprocess.CalledProcessError as e:
                logger.warning(f"截图生成失败: {timestamp}, error: {e}")

            return f"[Screenshot at {timestamp}]()"

        result = _SCREENSHOT_MARKER_PATTERN.sub(replace_screenshot, markdown)
        screenshot_count = len(_SCREENSHOT_MARKER_PATTERN.findall(markdown))
        logger.info(f"处理 {screenshot_count} 个截图标记")
        if screenshot_count == 0:
            logger.warning(
                "未匹配到截图标记，请检查 prompt 是否输出 *Screenshot-[HH:MM:SS] 或 *Screenshot-[MM:SS]"
            )
        return result

    def _post_process_markdown(
        self,
        markdown: str,
        video_path: str,
        note: Optional[AiNote] = None,
        formats: Optional[List[str]] = None,
    ) -> str:
        """后处理 Markdown：替换 screenshot 标记"""
        if not formats:
            return markdown

        result = markdown

        if "screenshot" in formats:
            result = self._process_screenshot_markers(result, video_path, note)

        self.logger.info(f"Markdown 后处理完成，formats={formats}")

        format_status = {
            "screenshot": "screenshot" in formats,
            "summary": "summary" in formats,
        }
        self._add_trace(
            stage="post_process",
            title="格式激活状态",
            summary=str(format_status),
            progress=1.0,
            detail=format_status,
        )

        return result

    def _write_markdown_output(
        self, source_path: str, note_id: str, markdown: str
    ) -> str:
        source_file = Path(source_path)
        output_dir = source_file.parent if source_file.parent.exists() else Path.cwd()
        output_dir.mkdir(parents=True, exist_ok=True)
        base_name = source_file.stem
        if base_name.endswith(".ai-note"):
            base_name = base_name[: -len(".ai-note")]
        if not base_name or source_file.name.startswith("."):
            base_name = source_file.parent.name or note_id
        output_path = output_dir / f"{base_name}.ai-note.md"
        output_path.write_text(markdown, encoding="utf-8")
        return str(output_path)

    def _resolve_index_path(self, source_path: str, note_id: str) -> Path:
        source_file = Path(source_path)
        output_dir = source_file.parent if source_file.parent.exists() else Path.cwd()
        output_dir.mkdir(parents=True, exist_ok=True)
        base_name = source_file.stem
        if base_name.endswith(".ai-note"):
            base_name = base_name[: -len(".ai-note")]
        if not base_name or source_file.name.startswith("."):
            base_name = source_file.parent.name or note_id
        return output_dir / f"{base_name}.ai-note.index.json"

    def _read_note_index_output(self, source_path: str, note_id: str) -> Dict[str, Any]:
        return _safe_read_json(self._resolve_index_path(source_path, note_id))

    def _write_note_index_output(
        self,
        source_path: str,
        note_id: str,
        *,
        markdown_path: str,
        input_fingerprint: str,
        cache_fingerprint: str,
        pipeline_mode: str,
        style: str,
        formats: List[str],
        model_provider: str,
        model_name: str,
        extras: Optional[str] = None,
        transcript_language: str = "",
    ) -> str:
        """Write a lightweight, portable index file next to the generated markdown.

        This index allows stable cache hits even when the DB is missing, and it
        moves together with the episode folder when the series layout changes.
        """
        source_file = Path(source_path)
        output_dir = source_file.parent if source_file.parent.exists() else Path.cwd()
        output_dir.mkdir(parents=True, exist_ok=True)
        base_name = source_file.stem
        if base_name.endswith(".ai-note"):
            base_name = base_name[: -len(".ai-note")]
        if not base_name or source_file.name.startswith("."):
            base_name = source_file.parent.name or note_id

        index_path = output_dir / f"{base_name}.ai-note.index.json"
        payload = {
            "schema": 1,
            "note_id": note_id,
            "source_path": str(source_path),
            "markdown_path": str(markdown_path),
            "input_fingerprint": input_fingerprint,
            "cache_fingerprint": cache_fingerprint,
            "pipeline_mode": pipeline_mode,
            "style": style,
            "formats": list(formats or []),
            "model_provider": model_provider,
            "model_name": model_name,
            "extras": extras or "",
            "transcript_language": transcript_language or "",
            "updated_at": datetime.utcnow().isoformat() + "Z",
        }
        index_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return str(index_path)

    def _resolve_series_root(self, video_path: str) -> Path:
        """Resolve a stable-ish series root folder for both layouts.

        Heuristic:
        - Walk up until reaching downloads folder; pick the nearest folder that
          looks like a series root: contains tvshow.nfo OR name starts with '系列-'.
        - Fallback to the immediate parent.
        """
        video_file = Path(video_path)
        start = video_file.parent if video_file.is_file() else video_file
        downloads_root = Path(app_settings.default_download_path)
        current = start
        best = start
        while True:
            if current.name.startswith("系列-") or (current / "tvshow.nfo").exists():
                best = current
            if current == downloads_root or current.parent == current:
                break
            if downloads_root in current.parents:
                current = current.parent
                continue
            break
        return best

    def _read_series_memory(self, video_path: str) -> str:
        root = self._resolve_series_root(video_path)
        payload = _safe_read_json(root / _SERIES_MEMORY_FILENAME)
        memory = payload.get("memory_text") if isinstance(payload, dict) else ""
        return str(memory or "").strip()

    def _update_series_memory(self, video_path: str, note_id: str, markdown: str) -> str:
        root = self._resolve_series_root(video_path)
        memory_path = root / _SERIES_MEMORY_FILENAME
        payload = _safe_read_json(memory_path)
        prev = str(payload.get("memory_text") or "").strip()
        delta = _compact_markdown_for_memory(markdown)
        if not delta:
            return str(memory_path)
        merged = (prev + "\n\n" + delta).strip() if prev else delta
        merged = merged[:6000]
        out = {
            "schema": 1,
            "series_root": str(root),
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "updated_by_note_id": note_id,
            "memory_text": merged,
        }
        try:
            memory_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.warning("Failed to write series memory: %s", exc)
        return str(memory_path)

    def get_note(self, note_id: str) -> Optional[AiNote]:
        note = self.db.query(AiNote).filter(AiNote.id == note_id).first()
        if note:
            download = self.db.query(Download).filter(Download.id == note.video_id).first()
            self._resolve_note_pipeline_mode(note, download=download)
        self.db.close()
        return note

    def get_note_by_video(self, video_id: str) -> Optional[AiNote]:
        note = (
            self.db.query(AiNote)
            .filter(AiNote.video_id == video_id)
            .order_by(AiNote.updated_at.desc(), AiNote.created_at.desc())
            .first()
        )
        if note:
            self._resolve_note_pipeline_mode(note)
            meta = note.meta if isinstance(note.meta, dict) else {}
            meta["artifact_state"] = self._collect_local_artifact_state(note)
            note.meta = meta
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
                download = (
                    self.db.query(Download).filter(Download.bvid == video_id).first()
                )
        if download:
            note = (
                self.db.query(AiNote)
                .filter(AiNote.video_id == download.id)
                .order_by(AiNote.updated_at.desc(), AiNote.created_at.desc())
                .first()
            )
            if note:
                self._resolve_note_pipeline_mode(note, download=download)
                meta = note.meta if isinstance(note.meta, dict) else {}
                meta["artifact_state"] = self._collect_local_artifact_state(note, download=download)
                note.meta = meta
                self.db.close()
                return note

            if download.file_path:
                note = (
                    self.db.query(AiNote)
                    .filter(AiNote.video_id == download.file_path)
                    .order_by(AiNote.updated_at.desc(), AiNote.created_at.desc())
                    .first()
                )
                if note:
                    self._resolve_note_pipeline_mode(note, download=download)
                    meta = note.meta if isinstance(note.meta, dict) else {}
                    meta["artifact_state"] = self._collect_local_artifact_state(note, download=download)
                    note.meta = meta
                    self.db.close()
                    return note

                folder_name = os.path.basename(os.path.dirname(download.file_path))
                if folder_name:
                    folder_key = f"folder-{folder_name}"
                    note = (
                        self.db.query(AiNote)
                        .filter(AiNote.video_id == folder_key)
                        .order_by(AiNote.updated_at.desc(), AiNote.created_at.desc())
                        .first()
                    )
                    if note:
                        self._resolve_note_pipeline_mode(note, download=download)
                        meta = note.meta if isinstance(note.meta, dict) else {}
                        meta["artifact_state"] = self._collect_local_artifact_state(note, download=download)
                        note.meta = meta
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
