def get_screenshot_format() -> str:
    """截图标注模板"""
    return """
9. **原片截图**：请在需要插入原片截图的位置输出时间戳标记，格式必须严格为 `*Screenshot-[HH:MM:SS]`，也兼容 `*Screenshot-[MM:SS]`。
- 示例：`*Screenshot-[00:01:23]`
- 不要直接输出 Markdown 图片链接，也不要在标记前后额外包裹 Markdown 强调符号。
"""


def get_summary_format() -> str:
    """AI 总结模板"""
    return """
10. **AI总结**: 在笔记末尾加入简短的AI生成总结，使用二级标题 `## AI 总结`。
"""


def get_format_template(format_type: str) -> str:
    """获取指定格式的模板"""
    format_map = {
        "screenshot": get_screenshot_format,
        "summary": get_summary_format,
    }
    return format_map.get(format_type, lambda: "")()


def get_all_format_templates(formats: list) -> str:
    """获取所有启用格式的模板"""
    if not formats:
        return ""
    return "\n".join([get_format_template(f) for f in formats])
