from typing import Any, Dict, List, Optional

from .constants import DEFAULT_FORMATS, DEFAULT_STYLE
from ...services.prompt_template_service import get_prompt_template_service


class PromptBuilder:
    """Prompt 构建器"""

    @staticmethod
    def _get_templates() -> Dict[str, Any]:
        return get_prompt_template_service().get_templates()

    @staticmethod
    def _render_section(template: str, content: str) -> str:
        return template.replace("{content}", (content or "").strip() or "无")

    @staticmethod
    def build(
        t0_text: str,
        t1_text: str,
        level: str = "detailed",
        style: str = DEFAULT_STYLE,
        formats: Optional[List[str]] = None,
        extras: Optional[str] = None,
        system_prompt: Optional[str] = None,
    ) -> str:
        """Build a layered prompt for AI note generation."""
        templates = PromptBuilder._get_templates()
        layers = templates.get("layers", {})
        base = templates.get("base", {})
        prompt_parts = []

        if system_prompt:
            prompt_parts.append((system_prompt or "").strip())
        else:
            prompt_parts.append(base.get("system") or "你是一位专业的视频内容分析师，请基于以下分层输入生成结构化 Markdown 笔记。")

        prompt_parts.append(PromptBuilder._render_section(layers.get("t0", "## T0 视频信息\n{content}"), t0_text))
        prompt_parts.append(PromptBuilder._render_section(layers.get("t1", "## T1 视频文本\n{content}"), t1_text))

        if level == "simple":
            t2_template = layers.get("t2", {}).get(
                "simple",
                "## T2 详细程度\n请输出简单版本：只保留核心观点、关键结论和必要结构，压缩背景和重复信息。",
            )
        else:
            t2_template = layers.get("t2", {}).get(
                "detailed",
                "## T2 详细程度\n请输出详细版本：保留上下文、因果关系、关键细节、例子和章节组织，并补足必要分析。",
            )
        prompt_parts.append(t2_template)

        t3_template = layers.get("t3", {}).get(
            style,
            "保持清晰、结构化、可读，仅作为表达风格，不要引入新的事实或信息。",
        )
        prompt_parts.append("## T3 笔记风格\n" + t3_template)

        if formats:
            format_templates = layers.get("formats", {})
            selected_formats = [
                format_templates.get(format_name, "")
                for format_name in formats
                if format_templates.get(format_name)
            ]
            if selected_formats:
                prompt_parts.append("## 高级功能预留\n" + "\n".join(selected_formats))

        if extras:
            extras_template = layers.get("extras", "## 额外要求\n{content}")
            prompt_parts.append(PromptBuilder._render_section(extras_template, extras))

        final_requirements = base.get("final") or [
            "仅输出 Markdown 正文。",
            "不要解释你做了什么。",
            "不要输出调试信息。",
            "确保内容与输入信息一致。",
        ]
        prompt_parts.append("## 最终要求\n" + "\n".join(f"- {line}" for line in final_requirements))

        return "\n\n".join(prompt_parts).strip()

    @staticmethod
    def build_for_transcribe_only(video_title: str, language: str = "zh") -> str:
        """构建仅转写的 Prompt"""
        lang_map = {
            "zh": "中文",
            "en": "英文",
            "ja": "日文",
            "ko": "韩文",
        }
        lang_name = lang_map.get(language, "中文")

        return f"""请转写以下视频的字幕内容，输出语言为{lang_name}。

视频标题: {video_title}

请保持字幕格式，每行包含时间戳和对应的文字内容。"""

    @staticmethod
    def build_for_summary_only(content: str, max_length: int = 500) -> str:
        """构建仅总结的 Prompt"""
        return f"""请用不超过 {max_length} 字概括以下内容要点：

{content}

要求：
1. 提取关键信息
2. 保持语义完整
3. 使用简洁的语言"""
