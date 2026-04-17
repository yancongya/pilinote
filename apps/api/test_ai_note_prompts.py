import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.llm.prompts import (
    PromptBuilder,
    NOTE_STYLES,
    NOTE_FORMATS,
    DEFAULT_STYLE,
    DEFAULT_FORMATS,
)


def test_prompt_builder_import():
    """测试 PromptBuilder 可以正常导入"""
    assert PromptBuilder is not None
    print("✓ PromptBuilder 导入成功")


def test_note_styles_constant():
    """测试 NOTE_STYLES 常量"""
    assert len(NOTE_STYLES) == 9
    assert NOTE_STYLES[0]["value"] == "minimal"
    assert NOTE_STYLES[8]["value"] == "meeting_minutes"
    print(f"✓ NOTE_STYLES 包含 {len(NOTE_STYLES)} 种风格")


def test_note_formats_constant():
    """测试 NOTE_FORMATS 常量"""
    assert len(NOTE_FORMATS) == 4
    assert NOTE_FORMATS[0]["value"] == "toc"
    assert NOTE_FORMATS[3]["value"] == "summary"
    print(f"✓ NOTE_FORMATS 包含 {len(NOTE_FORMATS)} 种格式")


def test_build_prompt_with_all_formats():
    """测试完整格式的 Prompt 构建"""
    prompt = PromptBuilder.build(
        video_title="测试视频标题",
        segment_text="这是视频的转写内容，包含了一些关键信息。",
        tags="测试,标签",
        formats=["toc", "link", "screenshot", "summary"],
        style="detailed",
    )

    assert "测试视频标题" in prompt
    assert "这是视频的转写内容" in prompt
    assert "目录" in prompt
    assert "原片跳转" in prompt
    assert "原片截图" in prompt
    assert "AI总结" in prompt
    assert "详细记录" in prompt
    print("✓ 完整格式 Prompt 构建成功")


def test_build_prompt_minimal_style():
    """测试精简风格"""
    prompt = PromptBuilder.build(
        video_title="测试", segment_text="内容", style="minimal"
    )
    assert "精简信息" in prompt
    print("✓ 精简风格 Prompt 构建成功")


def test_build_prompt_xiaohongshu_style():
    """测试小红书风格"""
    prompt = PromptBuilder.build(
        video_title="测试", segment_text="内容", style="xiaohongshu"
    )
    assert "小红书风格" in prompt
    assert "爆款关键词" in prompt
    print("✓ 小红书风格 Prompt 构建成功")


def test_build_prompt_with_extras():
    """测试额外提示词"""
    prompt = PromptBuilder.build(
        video_title="测试", segment_text="内容", extras="请特别注意技术细节"
    )
    assert "请特别注意技术细节" in prompt
    print("✓ 额外提示词 Prompt 构建成功")


def test_build_for_transcribe_only():
    """测试仅转写 Prompt"""
    prompt = PromptBuilder.build_for_transcribe_only("测试视频", "zh")
    assert "测试视频" in prompt
    assert "中文" in prompt
    print("✓ 仅转写 Prompt 构建成功")


def test_build_for_summary_only():
    """测试仅总结 Prompt"""
    prompt = PromptBuilder.build_for_summary_only(
        "这是一段很长的内容需要概括", max_length=100
    )
    assert "100" in prompt
    assert "这是一段很长的内容需要概括" in prompt
    print("✓ 仅总结 Prompt 构建成功")


if __name__ == "__main__":
    print("=" * 50)
    print("开始运行 AI 笔记 Prompt 测试")
    print("=" * 50)

    test_prompt_builder_import()
    test_note_styles_constant()
    test_note_formats_constant()
    test_build_prompt_with_all_formats()
    test_build_prompt_minimal_style()
    test_build_prompt_xiaohongshu_style()
    test_build_prompt_with_extras()
    test_build_for_transcribe_only()
    test_build_for_summary_only()

    print("=" * 50)
    print("所有测试通过! ✓")
    print("=" * 50)
