import logging
from datetime import timedelta
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class FasterWhisperBackend:
    """本地 faster-whisper ASR 后端。"""

    def __init__(
        self,
        model_size: str = "base",
        model_path: Optional[str] = None,
        device: str = "auto",
        compute_type: str = "auto",
    ):
        self.model_size = model_size
        self.model_path = model_path
        self.device = device
        self.compute_type = compute_type

    def transcribe_audio(self, audio_path: str, output_srt_path: Optional[str] = None) -> str:
        try:
            from faster_whisper import WhisperModel

            model_source = self.model_path or self.model_size

            model = WhisperModel(
                model_source,
                device=self.device,
                compute_type=self.compute_type,
            )
            segments, info = model.transcribe(audio_path, beam_size=5)
            lines = []
            srt_lines = []
            index = 1
            for segment in segments:
                text = (segment.text or "").strip()
                if text:
                    lines.append(text)
                    if output_srt_path:
                        srt_lines.extend(
                            [
                                str(index),
                                f"{self._format_srt_time(segment.start)} --> {self._format_srt_time(segment.end)}",
                                text,
                                "",
                            ]
                        )
                        index += 1
            if output_srt_path:
                self._write_srt(output_srt_path, srt_lines, language=getattr(info, "language", None))
            return "\n".join(lines).strip()
        except Exception as exc:
            logger.error("faster-whisper 转写失败: %s", exc)
            return ""

    @staticmethod
    def _format_srt_time(seconds: float) -> str:
        total_milliseconds = max(0, int(seconds * 1000))
        hours, remainder = divmod(total_milliseconds, 3_600_000)
        minutes, remainder = divmod(remainder, 60_000)
        secs, milliseconds = divmod(remainder, 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"

    def _write_srt(self, output_srt_path: str, srt_lines: list[str], language: Optional[str] = None) -> None:
        path = Path(output_srt_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        header = []
        if language:
            header.append(f"Language: {language}")
        content = "\n".join(header + srt_lines).strip() + "\n"
        path.write_text(content, encoding="utf-8")
