from typing import List, Optional
from .base import build_base_prompt
from .formats import get_all_format_templates
from .styles import get_style_template
from .constants import DEFAULT_FORMATS, DEFAULT_STYLE


class PromptBuilder:
    """Prompt 构建器"""

    @staticmethod
    def build(
        video_title: str,
        segment_text: str,
        tags: str = "",
        formats: Optional[List[str]] = None,
        style: str = DEFAULT_STYLE,
        extras: Optional[str] = None,
        system_prompt: Optional[str] = None,
    ) -> str:
        """
        构建完整的 Prompt

        Args:
            video_title: 视频标题
            segment_text: 视频转写内容
            tags: 视频标签
            formats: 启用的格式列表
            style: 笔记风格
            extras: 额外提示词
            system_prompt: 自定义系统提示词

        Returns:
            完整的 prompt 字符串
        """
        # 使用自定义系统提示或默认基础提示
        if system_prompt:
            prompt = system_prompt
        else:
            prompt = build_base_prompt(video_title, segment_text, tags)

        # 添加格式模板
        if formats:
            prompt += "\n" + get_all_format_templates(formats)

        # 添加风格模板
        if style:
            prompt += "\n" + get_style_template(style)

        # 添加额外内容
        if extras:
            prompt += f"\n{extras}"

        return prompt

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
