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
| AI 分析服务 | `src/services/ai/note_service.py` | 核心分析服务：读取本地视频 → 转写 → LLM 生成 |
| Prompt 管理器 | `src/services/ai/prompt_builder.py` | 根据风格构建 prompt |
| LLM 客户端 | `src/services/ai/llm_client.py` | 多提供商支持 |
| 转写服务 | `src/services/ai/transcriber.py` | 音频转文字 |
| API 路由 | `src/routers/note.py` | 分析触发、状态查询、获取结果 |

### 触发方式
- 媒体库视频详情页：点击 "AI 分析" 按钮
- 需要视频已下载到本地（有文件路径）

### 前端模块

| 模块 | 路径 | 功能描述 |
|------|------|----------|
| 笔记面板 | `src/components/ai/NotePanel.tsx` | 视频详情页的 AI 分析面板 |
| 风格选择器 | `src/components/ai/StyleSelector.tsx` | 选择笔记风格 |
| Markdown 预览 | `src/components/ai/MarkdownViewer.tsx` | 渲染生成的笔记 |
| 思维导图 | `src/components/ai/MindMap.tsx` | markmap 展示导图 |

## API 设计

### 触发分析

```
POST /api/note/analyze
```

请求参数：
- `video_id`: 视频 ID（媒体库中已下载的视频）
- `style`: 笔记风格 (minimal/detailed/academic/tutorial/...)
- `formats`: 格式列表 ['toc', 'link', 'summary']

### 查询状态

```
GET /api/note/status/{note_id}
```

返回：
- `task_status`: pending → processing → completed / failed
- `progress`: 处理进度百分比

### 获取结果

```
GET /api/note/{note_id}
```

返回：
- `markdown`: 完整笔记
- `summary`: AI 总结
- `style`: 使用的风格

## 数据模型

### 使用场景
媒体库点击视频 → 触发 AI 分析 → 生成笔记

### 表结构

#### 1. ai_notes 表（新建）
存储 AI 生成的笔记

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String(UUID) | 笔记 ID |
| task_id | String | 关联的任务 ID |
| video_id | String | 关联的视频 ID (downloads.id) |
| content | Text | 生成的笔记内容 |
| style | String | 使用的风格 |
| formats | JSON | 启用的格式 |
| status | Enum | pending/processing/completed/failed |
| model_provider | String | LLM 提供商 |
| model_name | String | 模型名称 |
| meta | JSON | 元数据 |
| error | Text | 错误信息 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### 2. downloads 表（扩展）
在现有 downloads 表添加 AI 相关字段

| 字段 | 类型 | 说明 |
|------|------|------|
| ai_note_id | String | 关联的 AI 笔记 |
| ai_summary | Text | AI 总结摘要 |
| ai_markdown | Text | 完整 Markdown |
| ai_style | String | 使用的风格 |
| ai_status | String | pending/processing/completed/failed |
| ai_error | Text | 错误信息 |
| transcript | Text | 字幕转写文本 |
| transcript_lang | String | 转写语言 |

### 工作流程

1. 用户在媒体库点击视频的 "AI 分析" 按钮
2. 创建 `ai_notes` 记录，状态设为 `pending`
3. 后台处理：读取本地视频 → 转写 → LLM 生成
4. 前端轮询状态，更新 UI
5. 完成后将 markdown 存入 `ai_notes.markdown`

> 注意：视频文件需要已下载到本地才能进行分析

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

> 参考：`.planning/ROADMAP.md`