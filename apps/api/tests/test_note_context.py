import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "src" / "services" / "ai" / "note_context.py"


def load_note_context():
    spec = importlib.util.spec_from_file_location("note_context", MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载模块: {MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


note_context = load_note_context()


def test_detects_transcript_languages_with_existing_thresholds():
    assert note_context.detect_transcript_language("") == "unknown"
    assert note_context.detect_transcript_language("中文太短") == "unknown"
    assert note_context.detect_transcript_language("中文" * 30) == "zh"
    assert note_context.detect_transcript_language("english text " * 10) == "en"
    assert note_context.detect_transcript_language(("中文" * 20) + ("english" * 10)) == "mixed"


def test_language_detection_requires_50_letters():
    assert note_context.detect_transcript_language("中" * 49) == "unknown"
    assert note_context.detect_transcript_language("中" * 50) == "zh"
    assert note_context.detect_transcript_language("a" * 49) == "unknown"
    assert note_context.detect_transcript_language("a" * 50) == "en"


def test_language_detection_uses_inclusive_75_percent_threshold():
    assert note_context.detect_transcript_language(("中" * 75) + ("a" * 25)) == "zh"
    assert note_context.detect_transcript_language(("中" * 74) + ("a" * 26)) == "mixed"
    assert note_context.detect_transcript_language(("a" * 75) + ("中" * 25)) == "en"
    assert note_context.detect_transcript_language(("a" * 74) + ("中" * 26)) == "mixed"


def test_language_detection_only_samples_first_20000_characters():
    transcript = ("中" * 20000) + ("a" * 20000)

    assert note_context.detect_transcript_language(transcript) == "zh"


def test_builds_language_policy_for_each_classification():
    expected_policies = {
        "zh": (
            "## 语言与术语策略\n"
            "- 检测到字幕主要为中文（zh）。\n"
            "- 笔记必须输出中文；专业名词/品牌/快捷键等可保留英文原文。\n"
            "- 遇到英文术语：保留英文 + 给出简短中文解释（同一术语全文保持一致）。"
        ),
        "en": (
            "## 语言与术语策略\n"
            "- 检测到字幕主要为英文（en）。\n"
            "- 笔记必须输出中文为主，但要保留关键英文术语原文。\n"
            "- 处理顺序：\n"
            "  1) 先在正文最前生成 `## 术语对照表`（8-20 条）：`- English term: 中文解释`（必要时补充缩写全称）。\n"
            "  2) 再用中文按章节整理内容；术语首次出现时沿用对照表的翻译与写法。\n"
            "- 不要让整篇笔记在中英文之间摇摆。"
        ),
        "mixed": (
            "## 语言与术语策略\n"
            "- 检测到字幕为中英混合（mixed）。\n"
            "- 笔记以中文为主，英文术语保留原文；首次出现时给出中文解释。\n"
            "- 先生成 `## 术语对照表`（8-20 条），统一关键术语的中文翻译。\n"
            "- 对同一术语/概念保持全篇一致的翻译与写法。"
        ),
        "unknown": (
            "## 语言与术语策略\n"
            "- 无法可靠判断字幕语言（unknown）。\n"
            "- 笔记仍必须输出中文为主；英文术语可保留并附中文解释。"
        ),
    }

    for language, expected in expected_policies.items():
        assert note_context.build_language_policy_block(language) == expected
    assert note_context.build_language_policy_block("unexpected") == expected_policies["unknown"]


def test_normalizes_formats_without_mutating_defaults():
    defaults = ["summary", "timestamps"]
    supported = {"summary", "timestamps", "screenshot"}

    assert note_context.normalize_note_formats(None, supported, defaults) == defaults
    assert note_context.normalize_note_formats([], supported, defaults) == defaults
    assert note_context.normalize_note_formats(
        ["screenshot", "invalid", "summary"], supported, defaults
    ) == ["screenshot", "summary"]
    assert note_context.normalize_note_formats(["invalid"], supported, defaults) == defaults
    assert note_context.normalize_note_formats(None, supported, defaults) is not defaults


def test_normalize_formats_preserves_supported_duplicates():
    assert note_context.normalize_note_formats(
        ["summary", "summary", "invalid", "timestamps", "timestamps"],
        {"summary", "timestamps"},
        ["summary"],
    ) == ["summary", "summary", "timestamps", "timestamps"]


def test_normalize_formats_returns_independent_default_lists():
    defaults = ["summary", "timestamps"]

    first = note_context.normalize_note_formats(None, {"summary", "timestamps"}, defaults)
    second = note_context.normalize_note_formats([], {"summary", "timestamps"}, defaults)
    first.append("screenshot")

    assert defaults == ["summary", "timestamps"]
    assert second == ["summary", "timestamps"]
    assert first is not second


def test_identifies_formats_that_need_timecoded_subtitles():
    assert note_context.wants_timecoded_transcript(["summary", "timestamps"])
    assert note_context.wants_timecoded_transcript(["screenshot"])
    assert not note_context.wants_timecoded_transcript(["summary"])


def test_prepares_prompt_extras_in_existing_order():
    language, extras = note_context.prepare_prompt_extras(
        transcript="中文" * 30,
        extras="用户补充",
        series_memory="前集记忆",
    )

    assert language == "zh"
    assert extras.startswith("## 语言与术语策略")
    assert extras.index("## 系列记忆") > extras.index("## 语言与术语策略")
    assert extras.endswith("用户补充")


def test_prepares_complete_prompt_extras_without_changing_text():
    language_block = note_context.build_language_policy_block("en")
    language, extras = note_context.prepare_prompt_extras(
        transcript="a" * 50,
        extras="  用户补充  ",
        series_memory="  前集记忆  ",
    )

    assert language == "en"
    assert extras == (
        f"{language_block}\n\n"
        "## 系列记忆（来自历史分析，请遵循）\n"
        "  前集记忆  \n\n  用户补充"
    )


def test_prepares_complete_prompt_extras_without_series_memory():
    language_block = note_context.build_language_policy_block("zh")
    language, extras = note_context.prepare_prompt_extras(
        transcript="中" * 50,
        extras="  用户补充  ",
        series_memory="",
    )

    assert language == "zh"
    assert extras == f"{language_block}\n\n  用户补充"


def test_prepares_prompt_extras_without_optional_content():
    language, extras = note_context.prepare_prompt_extras("", None)

    assert language == "unknown"
    assert extras == note_context.build_language_policy_block("unknown")
