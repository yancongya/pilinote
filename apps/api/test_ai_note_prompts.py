import importlib.util
import os
import sys
import types
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
PROMPT_DIR = BASE_DIR / "src" / "llm" / "prompts"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载模块: {path}")
    module = importlib.util.module_from_spec(spec)
    module.__package__ = name.rsplit(".", 1)[0]
    spec.loader.exec_module(module)
    return module


src_pkg = types.ModuleType("src")
src_pkg.__path__ = [str(BASE_DIR / "src")]
sys.modules.setdefault("src", src_pkg)

llm_pkg = types.ModuleType("src.llm")
llm_pkg.__path__ = [str(BASE_DIR / "src" / "llm")]
sys.modules.setdefault("src.llm", llm_pkg)

prompts_pkg = types.ModuleType("src.llm.prompts")
prompts_pkg.__path__ = [str(PROMPT_DIR)]
sys.modules.setdefault("src.llm.prompts", prompts_pkg)

constants = load_module("src.llm.prompts.constants", PROMPT_DIR / "constants.py")
styles = load_module("src.llm.prompts.styles", PROMPT_DIR / "styles.py")
formats = load_module("src.llm.prompts.formats", PROMPT_DIR / "formats.py")
builder = load_module("src.llm.prompts.builder", PROMPT_DIR / "builder.py")

PromptBuilder = builder.PromptBuilder
NOTE_STYLES = constants.NOTE_STYLES
NOTE_FORMATS = constants.NOTE_FORMATS


def test_prompt_builder_import():
    assert PromptBuilder is not None
    print("✓ PromptBuilder 导入成功")


def test_note_styles_constant():
    assert len(NOTE_STYLES) == 9
    assert NOTE_STYLES[0]["value"] == "minimal"
    assert NOTE_STYLES[8]["value"] == "meeting_minutes"
    print(f"✓ NOTE_STYLES 包含 {len(NOTE_STYLES)} 种风格")


def test_note_formats_constant():
    assert len(NOTE_FORMATS) == 4
    assert NOTE_FORMATS[0]["value"] == "toc"
    assert NOTE_FORMATS[3]["value"] == "summary"
    print(f"✓ NOTE_FORMATS 包含 {len(NOTE_FORMATS)} 种格式")


def test_build_prompt_with_all_formats():
    prompt = PromptBuilder.build(
        t0_text="当前视频标题为：测试视频标题\n视频简介为：简介内容",
        t1_text="这是视频的转写内容，包含了一些关键信息。",
        level="detailed",
        style="detailed",
        formats=["toc", "link", "screenshot", "summary"],
        extras="请特别注意技术细节",
    )

    assert "T0 视频信息" in prompt
    assert "当前视频标题为：测试视频标题" in prompt
    assert "T1 视频文本" in prompt
    assert "这是视频的转写内容" in prompt
    assert "T2 详细程度" in prompt
    assert "T3 笔记风格" in prompt
    assert "高级功能预留" in prompt
    assert "目录" in prompt
    assert "原片跳转" in prompt
    assert "原片截图" in prompt
    assert "AI 总结" in prompt
    assert "完整、结构化" in prompt or "详细版本" in prompt
    print("✓ 完整格式 Prompt 构建成功")


def test_build_prompt_minimal_style():
    prompt = PromptBuilder.build(
        t0_text="当前视频标题为：测试",
        t1_text="内容",
        level="simple",
        style="minimal",
    )
    assert "简单版本" in prompt or "核心观点" in prompt
    print("✓ 精简风格 Prompt 构建成功")


def test_build_prompt_xiaohongshu_style():
    prompt = PromptBuilder.build(
        t0_text="当前视频标题为：测试",
        t1_text="内容",
        style="xiaohongshu",
    )
    assert "T3 笔记风格" in prompt
    assert "适合分享" in prompt or "标题感" in prompt
    print("✓ 小红书风格 Prompt 构建成功")


def test_build_prompt_with_extras():
    prompt = PromptBuilder.build(
        t0_text="当前视频标题为：测试",
        t1_text="内容",
        extras="请特别注意技术细节",
    )
    assert "请特别注意技术细节" in prompt
    print("✓ 额外提示词 Prompt 构建成功")


def test_build_for_transcribe_only():
    prompt = PromptBuilder.build_for_transcribe_only("测试视频", "zh")
    assert "测试视频" in prompt
    assert "中文" in prompt
    print("✓ 仅转写 Prompt 构建成功")


def test_build_for_summary_only():
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
