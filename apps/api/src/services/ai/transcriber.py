import os
import json
import logging
from abc import ABC, abstractmethod
from typing import Optional
import subprocess

logger = logging.getLogger(__name__)


class TranscriberBase(ABC):
    """转写服务基类"""

    @abstractmethod
    def transcribe(self, video_path: str, video_id: str) -> str:
        """转写视频并返回文本"""
        pass


class BiliSubtitleTranscriber(TranscriberBase):
    """B站字幕提取器 - 优先使用"""

    def __init__(self, download_base_path: str = "data/downloads"):
        self.download_base_path = download_base_path

    def transcribe(self, video_path: str, video_id: str) -> Optional[str]:
        """提取已下载的B站字幕"""
        # 获取视频所在目录
        video_dir = os.path.dirname(video_path)

        # 查找字幕文件
        subtitle_files = []
        if os.path.exists(video_dir):
            for f in os.listdir(video_dir):
                if f.endswith(".srt") or f.endswith(".json"):
                    if "subtitle" in f.lower() or ".zh-" in f or ".en-" in f:
                        subtitle_files.append(os.path.join(video_dir, f))

        if not subtitle_files:
            logger.info(f"未找到字幕文件 for video: {video_id}")
            return None

        # 读取第一个字幕文件
        subtitle_file = subtitle_files[0]
        logger.info(f"使用字幕文件: {subtitle_file}")

        try:
            if subtitle_file.endswith(".json"):
                return self._parse_json_subtitle(subtitle_file)
            else:
                return self._parse_srt_subtitle(subtitle_file)
        except Exception as e:
            logger.error(f"解析字幕失败: {e}")
            return None

    def _parse_json_subtitle(self, filepath: str) -> str:
        """解析 JSON 格式字幕"""
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        # B站字幕格式
        if "body" in data and "subtitle" in data["body"]:
            subtitles = data["body"]["subtitle"]
        else:
            subtitles = data

        lines = []
        for item in subtitles:
            if "content" in item:
                lines.append(item["content"])
            elif "text" in item:
                lines.append(item["text"])

        return "\n".join(lines)

    def _parse_srt_subtitle(self, filepath: str) -> str:
        """解析 SRT 格式字幕"""
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        lines = []
        # SRT 格式: 序号 -> 时间 -> 内容 -> 空行
        for block in content.strip().split("\n\n"):
            parts = block.split("\n")
            if len(parts) >= 3:
                lines.append(parts[2])  # 内容行

        return "\n".join(lines)


class WhisperTranscriber(TranscriberBase):
    """Whisper API 转写器"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is required for Whisper")

    def transcribe(self, video_path: str, video_id: str) -> Optional[str]:
        """使用 Whisper API 转写视频"""
        try:
            # 提取音频
            audio_path = self._extract_audio(video_path)
            if not audio_path:
                return None

            # 调用 Whisper API
            transcript = self._call_whisper_api(audio_path)

            # 清理临时音频文件
            if audio_path != video_path and os.path.exists(audio_path):
                os.remove(audio_path)

            return transcript
        except Exception as e:
            logger.error(f"Whisper 转写失败: {e}")
            return None

    def _extract_audio(self, video_path: str) -> Optional[str]:
        """使用 FFmpeg 提取音频"""
        audio_path = video_path.rsplit(".", 1)[0] + ".mp3"

        if os.path.exists(audio_path):
            return audio_path

        try:
            subprocess.run(
                [
                    "ffmpeg",
                    "-i",
                    video_path,
                    "-vn",
                    "-acodec",
                    "libmp3lame",
                    "-q:a",
                    "2",
                    audio_path,
                    "-y",
                ],
                capture_output=True,
                check=True,
            )
            return audio_path
        except Exception as e:
            logger.error(f"提取音频失败: {e}")
            # 尝试保留原视频路径（可能有内置音频）
            return video_path if os.path.exists(video_path) else None

    def _call_whisper_api(self, audio_path: str) -> str:
        """调用 OpenAI Whisper API"""
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


class TranscriberFactory:
    """转写服务工厂"""

    @staticmethod
    def create(transcriber_type: str = "auto", **kwargs) -> TranscriberBase:
        """创建转写器实例"""
        if transcriber_type == "bilibili" or transcriber_type == "subtitle":
            return BiliSubtitleTranscriber(**kwargs)
        elif transcriber_type == "whisper":
            return WhisperTranscriber(**kwargs)
        elif transcriber_type == "auto":
            # 自动选择：优先字幕，无字幕用 Whisper
            return AutoTranscriber(**kwargs)
        else:
            raise ValueError(f"Unknown transcriber type: {transcriber_type}")


class AutoTranscriber(TranscriberBase):
    """自动转写器 - 优先字幕，无则 Whisper"""

    def __init__(self, **kwargs):
        self.subtitle_transcriber = BiliSubtitleTranscriber(**kwargs)
        self.whisper_transcriber = None
        try:
            self.whisper_transcriber = WhisperTranscriber(**kwargs)
        except ValueError:
            logger.warning("Whisper API 未配置，将仅使用字幕")

    def transcribe(self, video_path: str, video_id: str) -> Optional[str]:
        """自动转写：字幕优先，无则 Whisper"""
        # 先尝试字幕
        result = self.subtitle_transcriber.transcribe(video_path, video_id)
        if result:
            logger.info(f"使用字幕转写成功 for video: {video_id}")
            return result

        # 降级到 Whisper
        if self.whisper_transcriber:
            result = self.whisper_transcriber.transcribe(video_path, video_id)
            if result:
                logger.info(f"使用 Whisper 转写成功 for video: {video_id}")
                return result

        logger.error(f"所有转写方式均失败 for video: {video_id}")
        return None


def get_transcriber(transcriber_type: str = "auto", **kwargs) -> TranscriberBase:
    """便捷函数：获取转写器"""
    return TranscriberFactory.create(transcriber_type, **kwargs)
