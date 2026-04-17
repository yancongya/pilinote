def get_toc_format() -> str:
    """目录格式模板"""
    return """
9. **目录**: 自动生成一个基于 `##` 级标题的目录。不需要插入原片跳转
"""


def get_link_format() -> str:
    """原片跳转时间戳模板"""
    return """
10. **原片跳转**: 为每个主要章节添加时间戳，使用格式 `*Content-[mm:ss]`。
重要：**始终**在章节标题前加上 `*Content` 前缀，例如：`AI 的发展史 *Content-[01:23]`。一定是标题在前 插入标记在后
"""


def get_screenshot_format() -> str:
    """截图标注模板"""
    return """
11. **原片截图**: 你收到的截图一般是一个网格，网格的每张图片就是一个时间点，左上角会包含时间mm:ss的格式，请你结合我发你的图片插入截图提示，请你帮助用户更好的理解视频内容，请你认真的分析每个图片和对应的转写文案，插入最合适的内容来备注用户理解，请一定按照这个格式 返回否则系统无法解析：
- 格式：`*Screenshot-[mm:ss]`
"""


def get_summary_format() -> str:
    """AI 总结模板"""
    return """
12. **AI总结**: 在笔记末尾加入简短的AI生成总结,并且二级标题 就是 AI 总结 例如 ## AI 总结。
"""


def get_format_template(format_type: str) -> str:
    """获取指定格式的模板"""
    format_map = {
        "toc": get_toc_format,
        "link": get_link_format,
        "screenshot": get_screenshot_format,
        "summary": get_summary_format,
    }
    return format_map.get(format_type, lambda: "")()


def get_all_format_templates(formats: list) -> str:
    """获取所有启用格式的模板"""
    if not formats:
        return ""
    return "\n".join([get_format_template(f) for f in formats])
