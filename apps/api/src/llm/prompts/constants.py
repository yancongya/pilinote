from typing import List, Dict, Any

# 笔记风格定义
NOTE_STYLES = [
    {
        "label": "精简",
        "value": "minimal",
        "description": "仅记录最重要的内容，简洁明了",
    },
    {
        "label": "详细",
        "value": "detailed",
        "description": "包含完整的内容和每个部分的详细讨论",
    },
    {"label": "学术", "value": "academic", "description": "适合学术报告，正式且结构化"},
    {
        "label": "教程",
        "value": "tutorial",
        "description": "尽可能详细地记录教程，特别关注关键点和结论",
    },
    {
        "label": "小红书",
        "value": "xiaohongshu",
        "description": "爆款标题、emoji 表情、情感化表达",
    },
    {
        "label": "生活向",
        "value": "life_journal",
        "description": "记录个人生活感悟，情感化表达",
    },
    {
        "label": "任务导向",
        "value": "task_oriented",
        "description": "强调任务、目标，适合工作和待办事项",
    },
    {
        "label": "商业风格",
        "value": "business",
        "description": "适合商业报告、会议纪要，正式且精准",
    },
    {
        "label": "会议纪要",
        "value": "meeting_minutes",
        "description": "适合会议记录，重点突出决策和行动项",
    },
]

# 笔记格式定义
NOTE_FORMATS = [
    {"label": "目录", "value": "toc", "description": "自动生成基于 ## 级标题的目录"},
    {"label": "原片跳转", "value": "link", "description": "为每个主要章节添加时间戳"},
    {"label": "原片截图", "value": "screenshot", "description": "插入视频关键帧截图"},
    {
        "label": "AI总结",
        "value": "summary",
        "description": "在笔记末尾加入 AI 生成的总结",
    },
]

# 默认配置
DEFAULT_STYLE = "detailed"
DEFAULT_FORMATS = ["summary"]
DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_PROVIDER = "openai"

# 默认模型映射
DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "claude": "claude-3-haiku-20240307",
    "deepseek": "deepseek-chat",
}
