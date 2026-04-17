import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class OpenAIWhisperBackend:
    """OpenAI Whisper ASR 后端。"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is required for Whisper")

    def transcribe_audio(self, audio_path: str) -> str:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=self.api_key)

            with open(audio_path, "rb") as audio_file:
                response = client.audio.transcriptions.create(
                    model="whisper-1", file=audio_file, response_format="text"
                )

            return response.text if hasattr(response, "text") else str(response)
        except Exception as e:
            logger.error(f"Whisper API 调用失败: {e}")
            return ""
