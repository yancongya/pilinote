from typing import Iterable, List, Optional, Set


TIMECODED_NOTE_FORMATS = frozenset({"screenshot", "timestamps"})


def detect_transcript_language(text: str) -> str:
    """Heuristically classify transcript text as zh, en, mixed, or unknown."""
    if not text:
        return "unknown"

    sample = text[:20000]
    cjk_count = sum(1 for character in sample if "\u4e00" <= character <= "\u9fff")
    latin_count = sum(1 for character in sample if "a" <= character.lower() <= "z")
    total_letters = cjk_count + latin_count
    if total_letters < 50:
        return "unknown"

    cjk_ratio = cjk_count / total_letters
    latin_ratio = latin_count / total_letters
    if cjk_ratio >= 0.75:
        return "zh"
    if latin_ratio >= 0.75:
        return "en"
    return "mixed"


def build_language_policy_block(language: str) -> str:
    if language == "zh":
        return (
            "## 语言与术语策略\n"
            "- 检测到字幕主要为中文（zh）。\n"
            "- 笔记必须输出中文；专业名词/品牌/快捷键等可保留英文原文。\n"
            "- 遇到英文术语：保留英文 + 给出简短中文解释（同一术语全文保持一致）。"
        )
    if language == "en":
        return (
            "## 语言与术语策略\n"
            "- 检测到字幕主要为英文（en）。\n"
            "- 笔记必须输出中文为主，但要保留关键英文术语原文。\n"
            "- 处理顺序：\n"
            "  1) 先在正文最前生成 `## 术语对照表`（8-20 条）：`- English term: 中文解释`（必要时补充缩写全称）。\n"
            "  2) 再用中文按章节整理内容；术语首次出现时沿用对照表的翻译与写法。\n"
            "- 不要让整篇笔记在中英文之间摇摆。"
        )
    if language == "mixed":
        return (
            "## 语言与术语策略\n"
            "- 检测到字幕为中英混合（mixed）。\n"
            "- 笔记以中文为主，英文术语保留原文；首次出现时给出中文解释。\n"
            "- 先生成 `## 术语对照表`（8-20 条），统一关键术语的中文翻译。\n"
            "- 对同一术语/概念保持全篇一致的翻译与写法。"
        )
    return (
        "## 语言与术语策略\n"
        "- 无法可靠判断字幕语言（unknown）。\n"
        "- 笔记仍必须输出中文为主；英文术语可保留并附中文解释。"
    )


def normalize_note_formats(
    formats: Optional[Iterable[str]],
    supported_formats: Set[str],
    default_formats: Iterable[str],
) -> List[str]:
    defaults = list(default_formats)
    if not formats:
        return defaults
    normalized = [format_name for format_name in formats if format_name in supported_formats]
    return normalized or defaults


def wants_timecoded_transcript(formats: Iterable[str]) -> bool:
    return any(format_name in TIMECODED_NOTE_FORMATS for format_name in formats)


def prepare_prompt_extras(
    transcript: str,
    extras: Optional[str],
    series_memory: str = "",
) -> tuple[str, str]:
    merged_extras = extras
    if series_memory:
        merged_extras = (
            f"## 系列记忆（来自历史分析，请遵循）\n"
            f"{series_memory}\n\n{extras or ''}"
        ).strip()

    transcript_language = detect_transcript_language(transcript)
    language_block = build_language_policy_block(transcript_language)
    return transcript_language, f"{language_block}\n\n{merged_extras or ''}".strip()
