# AiNoteService AI 分析服务

## 概述

核心 AI 笔记分析服务，串联视频转写 → LLM 生成 → 结果存储。

## 文件位置

`apps/api/src/services/ai/note_service.py`

## 主要方法

### analyze_video()

```python
def analyze_video(
    self,
    video_id: str,
    style: str = "detailed",
    formats: Optional[List[str]] = None,
    model_provider: str = "openai",
    model_name: str = "gpt-4o-mini",
    extras: Optional[str] = None
) -> AiNote
```

**流程**:
1. 获取视频信息（从 downloads 表）
2. 检查文件存在性
3. 创建 AiNote 记录（pending）
4. 转写视频 → 获取 transcript
5. 调用 LLM 生成 Markdown
6. 提取 AI 总结
7. 保存结果并更新状态

### get_note()

获取笔记详情

### get_note_by_video()

根据视频 ID 获取笔记

### update_status()

更新笔记状态

## 状态流转

```
pending → processing → completed
                    ↘ failed
```

## 关联模块

- `transcriber.py` - 视频转写
- `prompts/` - Prompt 构建
- `llm/` - LLM 客户端