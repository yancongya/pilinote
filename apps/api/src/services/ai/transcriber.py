import os
import json
import logging
from abc import ABC, abstractmethod
from typing import Optional

from .asr_backends import AudioExtractor, ASRBackend, FFmpegAudioExtractor
from .faster_whisper_backend import FasterWhisperBackend
from .whisper_backend import OpenAIWhisperBackend

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


class ASRTranscriber(TranscriberBase):
    """通用 ASR 转写编排器。

    当前默认组合是 FFmpegAudioExtractor + FasterWhisperBackend。
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        audio_extractor: Optional[AudioExtractor] = None,
        asr_backend: Optional[ASRBackend] = None,
    ):
        self.audio_extractor = audio_extractor or FFmpegAudioExtractor()
        self.asr_backend = asr_backend or FasterWhisperBackend()

    def transcribe(self, video_path: str, video_id: str) -> Optional[str]:
        """使用当前默认 ASR 流程转写视频"""
        try:
            audio_path = self.audio_extractor.extract(video_path)
            if not audio_path:
                raise ValueError("未能提取音频")

            transcript = self.asr_backend.transcribe_audio(audio_path)
            if not transcript:
                raise ValueError("ASR 未返回转写内容")

            # 清理临时音频文件
            if audio_path != video_path and os.path.exists(audio_path):
                os.remove(audio_path)

            return transcript
        except Exception as e:
            logger.error(f"ASR 转写失败: {e}")
            return None

    def get_pipeline_name(self) -> str:
        return "ffmpeg + faster-whisper"


class TranscriberFactory:
    """转写服务工厂"""

    @staticmethod
    def create(transcriber_type: str = "auto", **kwargs) -> TranscriberBase:
        """创建转写器实例"""
        if transcriber_type == "bilibili" or transcriber_type == "subtitle":
            return BiliSubtitleTranscriber(**kwargs)
        elif transcriber_type in {"whisper", "asr"}:
            return ASRTranscriber(**kwargs)
        elif transcriber_type == "auto":
            # 自动选择：默认直接使用 ASR（当前实现为 OpenAI Whisper），避免误用错误字幕
            return ASRTranscriber(**kwargs)
        else:
            raise ValueError(f"Unknown transcriber type: {transcriber_type}")


class AutoTranscriber(TranscriberBase):
    """自动转写器 - 默认使用本地 ASR。"""

    def __init__(self, **kwargs):
        self.asr_transcriber = ASRTranscriber(**kwargs)

    def transcribe(self, video_path: str, video_id: str) -> Optional[str]:
        """自动转写：默认使用本地 ASR。"""
        result = self.asr_transcriber.transcribe(video_path, video_id)
        if result:
            logger.info(f"使用本地 ASR 转写成功 for video: {video_id}")
            return result
        logger.error(f"本地 ASR 转写失败 for video: {video_id}")
        return None

    def get_pipeline_name(self) -> str:
        return "ffmpeg + faster-whisper"


def get_transcriber(transcriber_type: str = "auto", **kwargs) -> TranscriberBase:
    """便捷函数：获取转写器"""
    return TranscriberFactory.create(transcriber_type, **kwargs)


# 保留旧名兼容，便于渐进迁移
WhisperTranscriber = ASRTranscriber
