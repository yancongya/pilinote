# AiNote 数据模型

## 概述

AI 笔记数据模型，存储用户生成的 AI 笔记内容。

## 模型定义

**文件**: `apps/api/src/models/ai_note.py`

```python
class AiNote(Base):
    __tablename__ = "ai_notes"
```

## 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 笔记 ID (UUID) |
| task_id | String | 关联的任务 ID |
| video_id | String | 关联的视频 ID (downloads.id) |
| content | Text | 生成的笔记内容 (Markdown) |
| summary | Text | AI 总结摘要 |
| mindmap_json | JSON | 思维导图数据 |
| style | String(50) | 使用的风格 |
| formats | JSON | 启用的格式 |
| status | Enum | pending/processing/completed/failed |
| model_provider | String(50) | LLM 提供商 |
| model_name | String(100) | 模型名称 |
| error | Text | 错误信息 |
| meta | JSON | 额外元数据 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |
| completed_at | DateTime | 完成时间 |

## 关联

- 关联 `downloads` 表的 `video_id`
- 状态枚举: `pending` → `processing` → `completed` / `failed`

## Schema

对应 Pydantic Schema: `apps/api/src/schemas/ai_note.py`
- `AiNoteCreate` - 创建请求
- `AiNoteResponse` - 响应模型
- `AiNoteUpdate` - 更新模型