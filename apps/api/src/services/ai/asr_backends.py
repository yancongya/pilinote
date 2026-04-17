import logging
import os
import tempfile
import subprocess
from typing import Optional, Protocol

logger = logging.getLogger(__name__)


class AudioExtractor(Protocol):
    def extract(self, video_path: str) -> Optional[str]:
        """提取音频文件路径"""
        ...


class ASRBackend(Protocol):
    def transcribe_audio(self, audio_path: str) -> str:
        """将音频转写成文本"""
        ...


class FFmpegAudioExtractor:
    """使用 ffmpeg 从视频中提取音频。"""

    def __init__(self, ffmpeg_path: str = "ffmpeg"):
        self.ffmpeg_path = ffmpeg_path

    def extract(self, video_path: str) -> Optional[str]:
        if not video_path or not os.path.exists(video_path):
            logger.error("视频文件不存在: %s", video_path)
            return None

        audio_fd, audio_path = tempfile.mkstemp(suffix=".mp3")
        os.close(audio_fd)

        try:
            cmd = [
                self.ffmpeg_path,
                "-y",
                "-i",
                video_path,
                "-vn",
                "-acodec",
                "mp3",
                audio_path,
            ]
            logger.info("提取音频: %s", " ".join(cmd))
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if result.returncode != 0:
                logger.error("ffmpeg 提取音频失败: %s", result.stderr.strip())
                if os.path.exists(audio_path):
                    os.remove(audio_path)
                return None

            return audio_path
        except Exception as exc:
            logger.error("音频提取异常: %s", exc)
            if os.path.exists(audio_path):
                os.remove(audio_path)
            return None
