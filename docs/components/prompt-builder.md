# Prompt 构建器

## 概述

根据视频内容和用户选择的风格/格式，构建发送给 LLM 的 Prompt。

## 风格模板 (9 种)

| 风格 | 值 | 说明 |
|------|-----|------|
| 精简 | minimal | 仅记录最重要的内容 |
| 详细 | detailed | 完整内容，详细讨论 |
| 学术 | academic | 正式结构化 |
| 教程 | tutorial | 详细记录关键点和结论 |
| 小红书 | xiaohongshu | 爆款标题、emoji |
| 生活向 | life_journal | 情感化表达 |
| 任务导向 | task_oriented | 强调任务和目标 |
| 商业风格 | business | 正式精准 |
| 会议纪要 | meeting_minutes | 突出决策和行动项 |

## 格式模板 (4 种)

| 格式 | 值 | 说明 |
|------|-----|------|
| 目录 | toc | 自动生成 ## 级标题目录 |
| 原片跳转 | link | 添加时间戳 `*Content-[mm:ss]` |
| 原片截图 | screenshot | 插入截图标记 `*Screenshot-[mm:ss]` |
| AI 总结 | summary | 末尾添加 AI 总结 |

## 使用方式

```python
from src.llm.prompts import PromptBuilder

prompt = PromptBuilder.build(
    video_title="视频标题",
    segment_text="视频转写内容",
    tags="标签1,标签2",
    formats=["toc", "summary"],  # 启用的格式
    style="detailed",              # 风格
    extras="额外提示词"            # 可选
)
```

## 文件结构

| 文件 | 说明 |
|------|------|
| `constants.py` | 风格和格式常量 |
| `base.py` | 基础 Prompt 模板 |
| `formats.py` | 格式模板函数 |
| `styles.py` | 风格模板函数 |
| `builder.py` | PromptBuilder 类 |
| `__init__.py` | 统一导出 |