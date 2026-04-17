# AI 笔记生成功能设计

## 概述

基于参考项目 BiliNote 的分析，设计 PiliNote 的 AI 笔记生成功能。该功能允许用户选择不同风格的 Prompt 来针对不同类型的视频进行 AI 总结，生成 Markdown 文件和思维导图。

## 功能架构

```
用户提交视频 → 下载视频 → 提取音频转写 → LLM 生成笔记 → 前端展示 Markdown + 思维导图
```

## 核心特性

### 1. 笔记格式支持

| 格式 | 说明 |
|------|------|
| 目录 | 自动生成基于 ## 级标题的目录 |
| 原片跳转 | 为每个主要章节添加时间戳 (*Content-[mm:ss]) |
| 原片截图 | 插入视频关键帧截图 (*Screenshot-[mm:ss]) |
| AI 总结 | 在笔记末尾加入 AI 生成的总结 |

### 2. 笔记风格（Prompt 模板）

| 风格 | 适用场景 |
|------|----------|
| 精简 (minimal) | 仅记录最重要的内容，简洁明了 |
| 详细 (detailed) | 包含完整的内容和每个部分的详细讨论 |
| 学术 (academic) | 适合学术报告，正式且结构化 |
| 教程 (tutorial) | 尽可能详细地记录教程，特别关注关键点和结论 |
| 小红书 (xiaohongshu) | 爆款标题、emoji 表情、情感化表达 |
| 生活向 (life_journal) | 记录个人生活感悟，情感化表达 |
| 任务导向 (task_oriented) | 强调任务、目标，适合工作和待办事项 |
| 商业风格 (business) | 适合商业报告、会议纪要，正式且精准 |
| 会议纪要 (meeting_minutes) | 适合会议记录，重点突出决策和行动项 |

### 3. 视频类型识别

根据视频的标签、标题、分类自动推荐合适的 Prompt 风格：
- 教程/技能类 → 推荐 "教程" 或 "详细" 风格
- 知识科普类 → 推荐 "学术" 风格
- 生活 Vlog → 推荐 "生活向" 风格
- 商业/职场类 → 推荐 "商业风格" 或 "会议纪要"
- 娱乐/社交媒体 → 推荐 "小红书" 风格

## 技术方案

### 后端模块

| 模块 | 路径 | 功能描述 |
|------|------|----------|
| AI 服务层 | `src/services/ai/note_service.py` | 核心笔记生成服务，串联各模块 |
| Prompt 管理器 | `src/services/ai/prompt_builder.py` | 根据视频类型构建不同风格的 prompt |
| LLM 客户端 | `src/services/ai/llm_client.py` | 多提供商支持（OpenAI/Claude/DeepSeek 等） |
| 转写服务 | `src/services/ai/transcriber.py` | 音频转文字（Whisper/Groq） |
| 截图服务 | `src/services/ai/screenshot.py` | FFmpeg 提取关键帧 |
| 数据模型 | `src/models/note.py` | 存储生成的笔记、任务状态、配置 |
| API 路由 | `src/routers/note.py` | 笔记生成、状态查询、导出 |

### 前端模块

| 模块 | 路径 | 功能描述 |
|------|------|----------|
| 笔记生成页面 | `src/pages/NotePage.tsx` | 主表单页面 |
| 模型选择器 | `src/components/ai/ModelSelector.tsx` | 选择 LLM 提供商和模型 |
| 格式/风格选择 | `src/components/ai/NoteOptions.tsx` | 选择笔记格式和风格 |
| Markdown 预览 | `src/components/ai/MarkdownViewer.tsx` | 渲染生成的笔记 |
| 思维导图组件 | `src/components/ai/MindMap.tsx` | 使用 markmap 展示导图 |
| 任务状态轮询 | `src/hooks/useNoteTask.ts` | 轮询后端任务状态 |

## API 设计

### 生成笔记

```
POST /api/note/generate
```

请求参数：
- `video_url`: 视频链接
- `platform`: 平台 (bilibili/youtube/douyin/kuaishou/local)
- `quality`: 下载质量
- `model_name`: LLM 模型名称
- `provider_id`: LLM 提供商 ID
- `format`: 笔记格式列表 ['toc', 'link', 'screenshot', 'summary']
- `style`: 笔记风格
- `extras`: 额外提示词

### 查询任务状态

```
GET /api/note/task_status/{task_id}
```

返回：
- `status`: pending/processing/success/failed
- `result`: 生成的笔记内容
- `message`: 状态消息

### 导出笔记

```
GET /api/note/export/{task_id}?format=markdown
```

## 数据模型

### NoteTask

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 任务 ID |
| video_url | string | 视频链接 |
| platform | string | 平台 |
| format | JSON | 格式配置 |
| style | string | 风格 |
| status | enum | 任务状态 |
| result | JSON | 生成结果 |
| created_at | timestamp | 创建时间 |
| completed_at | timestamp | 完成时间 |

### NoteConfig

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| user_id | int | 用户 ID |
| formats | JSON | 启用的格式 |
| default_style | string | 默认风格 |
| providers | JSON | LLM 提供商配置 |

## 依赖项

### Python

- openai
- anthropic (Claude)
- openai-whisper / faster-whisper
- ffmpeg-python
- aiohttp

### 前端

- react-markdown
- remark-gfm
- markmap (思维导图)
- react-syntax-highlighter

## 参考资料

- 参考项目: `reference/BiliNote`
- 后端 prompt 构建: `reference/BiliNote/backend/app/gpt/prompt_builder.py`
- 前端组件: `reference/BiliNote/BillNote_frontend/src/pages/HomePage/`