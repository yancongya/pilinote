import logging
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

    def transcribe_audio(self, audio_path: str) -> str:
        try:
            from faster_whisper import WhisperModel

            model_source = self.model_path or self.model_size

            model = WhisperModel(
                model_source,
                device=self.device,
                compute_type=self.compute_type,
            )
            segments, _ = model.transcribe(audio_path, beam_size=5)
            lines = []
            for segment in segments:
                text = (segment.text or "").strip()
                if text:
                    lines.append(text)
            return "\n".join(lines).strip()
        except Exception as exc:
            logger.error("faster-whisper 转写失败: %s", exc)
            return ""
