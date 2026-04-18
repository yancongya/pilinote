# AI 笔记生成功能设计

> 当前实现已收口到 `prompt管理` 的卡片化 prompt 源与本地 AI runtime cache。  
> 旧的 `ai_note.style.style` 仅作为迁移后的兼容字段，不再参与运行时风格选择。

## 概述

基于参考项目 BiliNote 的分析，设计 PiliNote 的 AI 笔记生成功能。该功能允许用户通过 `prompt管理` 中的卡片配置 T0/T1/T2/T3 和 `formats`，针对不同类型的视频进行 AI 总结，生成 Markdown 文件和思维导图。

## 功能架构

```
媒体库卡片 → [✨ AI按钮] → 设置弹窗(风格/格式/LLM) → 开始分析 → 卡片状态更新
                                                                          ↓
详情页 → 垂直显示笔记结果 ←───────────────────────────── 获取结果
```

## 简化逻辑

**核心改进**：直接使用本地文件路径进行分析，不需要通过 bvid 查找数据库记录；查询笔记状态使用 query 形式的 lookup 接口，不再依赖 404 分支。

1. 媒体库卡片通过 `task.meta.folder_path` 获取本地视频路径
2. 直接将文件路径传给后端 API
3. 后端直接读取本地文件进行转写和分析

## UI 设计

### 1. 媒体库卡片 - AI 按钮

**位置**：卡片右下角（覆盖在封面上）

**状态**：
- 默认：灰色/半透明背景 + ✨图标
- 进行中：蓝色边框 + 旋转加载动画
- 已完成：渐变紫色背景 + ✨图标高亮

### 2. 设置弹窗

**当前结构**：
1. **prompt管理**：T0/T1/T2/T3 + formats 卡片管理
2. **LLM / 本地 ASR**：提供商、模型和本地模型状态管理
3. **风格选择**：来自 prompt 卡片的风格源，不再依赖旧的 `ai_note.style.style`

### 3. 详情页

**布局**：垂直排列
- 视频信息在上方
- AI 笔记结果在下方（无分析则不显示）

## 核心特性

### 1. 笔记格式支持

| 格式 | 说明 |
|------|------|
| 目录 | 自动生成基于 ## 级标题的目录 |
| 原片跳转 | 为每个主要章节添加时间戳 (*Content-[mm:ss]) |
| 原片截图 | 插入视频关键帧截图 (*Screenshot-[mm:ss]) |
| AI 总结 | 在笔记末尾加入 AI 生成的总结 |

### 2. 笔记风格（Prompt 卡片）

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

### 3. LLM 提供商

| 提供商 | 模型 |
|--------|------|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo |
| Claude | claude-sonnet-4, claude-opus-4, claude-haiku-3 |
| DeepSeek | deepseek-chat, deepseek-coder |

## 技术方案

### 后端模块

| 模块 | 路径 | 功能描述 |
|------|------|----------|
| AI 分析服务 | `src/services/ai/note_service.py` | 核心分析服务：读取本地视频 → 转写 → LLM 生成 |
| Prompt 管理器 | `src/llm/prompts/` | 根据风格构建 prompt |
| LLM 客户端 | `src/llm/` | 多提供商支持（OpenAI/Claude/DeepSeek） |
| 转写服务 | `src/services/ai/transcriber.py` | 音频转文字（本地 faster-whisper） |
| 截图服务 | `src/services/ai/screenshot.py` | 视频关键帧截图 |
| API 路由 | `src/routers/note.py` | 分析触发、状态查询、获取结果 |

### 前端组件

| 组件 | 路径 | 功能描述 |
|------|------|----------|
| AiNoteButton | `src/components/ai/AiNoteButton.tsx` | 媒体库卡片 AI 按钮 |
| AiNoteModal | `src/components/ai/AiNoteModal.tsx` | 设置弹窗（读取 prompt 卡片与 runtime state） |
| MarkdownViewer | `src/components/ai/MarkdownViewer.tsx` | 渲染生成的笔记 |
| MindMapViewer | `src/components/ai/MindMapViewer.tsx` | 思维导图展示 |

### 触发方式

- **媒体库卡片**：点击右下角 AI 按钮 → 弹窗设置 → 开始分析
- **文件路径**：使用 `task.meta.folder_path` 直接获取本地路径

## API 设计

### 触发分析

```
POST /api/note/analyze
```

请求参数：
- `video_id`: 视频 ID（支持文件路径/bvid/downloads.id）
- `style`: 笔记风格 (minimal/detailed/academic/tutorial/...)
- `formats`: 格式列表 ['toc', 'link', 'screenshot', 'summary']
- `model_provider`: LLM 提供商 (openai/claude/deepseek)
- `model_name`: 模型名称

简化逻辑：
1. 如果 `video_id` 是有效的本地文件路径 → 直接使用
2. 否则尝试通过 bvid 或 downloads.id 查找

### 查询状态

```
GET /api/note/status/{note_id}
```

返回：
- `status`: pending → processing → completed / failed
- `progress`: 处理进度百分比

### 获取结果

```
GET /api/note/{note_id}
```

返回：
- `content`: 完整笔记 (Markdown)
- `summary`: AI 总结
- `style`: 使用的风格

### 根据视频获取笔记

```
GET /api/note/by-video?video_id=...
```

返回：指定视频的笔记（如果有），无笔记时返回 `found=false` 的正常响应。

## 数据模型

### 1. ai_notes 表（新建）

存储 AI 生成的笔记

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String(UUID) | 笔记 ID |
| video_id | String | 关联的视频 ID (downloads.id 或文件路径) |
| content | Text | 生成的笔记内容 (Markdown) |
| summary | Text | AI 总结摘要 |
| style | String | 使用的风格 |
| formats | JSON | 启用的格式 |
| status | Enum | pending/processing/completed/failed |
| model_provider | String | LLM 提供商 |
| model_name | String | 模型名称 |
| error | Text | 错误信息 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |
| completed_at | TIMESTAMP | 完成时间 |

### 2. downloads 表（扩展）

在现有 downloads 表添加 AI 相关字段

| 字段 | 类型 | 说明 |
|------|------|------|
| ai_note_id | String | 关联的 AI 笔记 ID |
| ai_summary | Text | AI 总结摘要 |
| ai_markdown | Text | 完整 Markdown |
| ai_style | String | 使用的风格 |
| ai_status | Enum | pending/processing/completed/failed |
| ai_error | Text | 错误信息 |
| transcript | Text | 字幕转写文本 |
| transcript_lang | String | 转写语言 |

## 工作流程

```
1. 媒体库卡片加载 → 获取 task.meta.folder_path（本地路径）
2. 用户点击 AI 按钮 → 打开设置弹窗
3. 选择风格/格式/LLM → 点击"开始分析"
4. 后端接收文件路径 → 直接读取本地视频
5. 转写音频 → Whisper API
6. LLM 生成笔记 → 返回 note_id
7. 前端轮询状态 → 卡片按钮显示加载动画
8. 完成 → 按钮状态变为已完成
9. 详情页垂直显示笔记结果
```

## 依赖项

### Python

- openai
- anthropic (Claude)
- openai-whisper / faster-whisper
- ffmpeg-python

### 前端

- react-markdown
- remark-gfm
- markmap (思维导图)

## 文件变更

| 文件 | 修改 |
|------|------|
| `apps/api/src/routers/note.py` | 支持文件路径直接传入 |
| `apps/api/src/services/ai/note_service.py` | 支持文件路径参数 |
| `apps/api/migrate_add_ai_note_fields.py` | 新增数据库迁移脚本 |
| `apps/web/src/components/ai/AiNoteButton.tsx` | 新增卡片按钮组件 |
| `apps/web/src/components/ai/AiNoteModal.tsx` | 新增设置弹窗组件 |
| `apps/web/src/components/NewDownload/VideoLibrary.tsx` | 集成 AI 按钮 |

> 参考：`.planning/ROADMAP.md`
