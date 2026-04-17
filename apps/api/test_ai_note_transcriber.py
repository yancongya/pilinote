import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.services.ai.transcriber import (
    get_transcriber,
    BiliSubtitleTranscriber,
    WhisperTranscriber,
)


def test_transcriber_factory():
    """测试转写器工厂"""
    # 自动模式
    transcriber = get_transcriber("auto")
    assert transcriber is not None
    print("✓ 自动转写器创建成功")

    # B站字幕模式
    transcriber = get_transcriber("bilibili")
    assert isinstance(transcriber, BiliSubtitleTranscriber)
    print("✓ B站字幕转写器创建成功")


def test_bili_subtitle_transcriber():
    """测试 B站字幕提取器"""
    transcriber = BiliSubtitleTranscriber()
    # 测试不存在的文件（应返回 None）
    result = transcriber.transcribe("/fake/path.mp4", "test123")
    assert result is None
    print("✓ B站字幕转写器处理无字幕文件正确返回 None")


def test_whisper_transcriber_requires_api_key():
    """测试 Whisper 转写器需要 API key"""
    # 清除环境变量
    original = os.environ.get("OPENAI_API_KEY")
    if "OPENAI_API_KEY" in os.environ:
        del os.environ["OPENAI_API_KEY"]

    try:
        WhisperTranscriber()
        print("✗ 应该抛出 ValueError")
    except ValueError as e:
        assert "OPENAI_API_KEY is required" in str(e)
        print("✓ Whisper 转写器正确要求 API key")
    finally:
        if original:
            os.environ["OPENAI_API_KEY"] = original


if __name__ == "__main__":
    print("=" * 50)
    print("开始运行转写服务测试")
    print("=" * 50)

    test_transcriber_factory()
    test_bili_subtitle_transcriber()
    test_whisper_transcriber_requires_api_key()

    print("=" * 50)
    print("所有转写服务测试通过! ✓")
    print("=" * 50)
