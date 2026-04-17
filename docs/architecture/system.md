# 系统架构

## 项目概述

PiliNote 是一个 Bilibili 视频下载管理应用，采用前后端分离架构。

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React + TypeScript + Vite | SPA 应用 |
| 后端 | FastAPI + Python | REST API |
| 数据库 | SQLite | 本地存储 |
| 下载 | aria2 | 多线程下载 |

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户浏览器                               │
│                                                              │
│  ┌─────────────────┐    ┌─────────────────┐                  │
│  │   React SPA    │    │  WebSocket     │                  │
│  │  (Front-end) │◀───▶│  实时进度    │                  │
│  └───────┬────────┘    └───────┬────────┘                  │
│          │                   │                             │
└─────────│───────────────────│─────────────────────────────
          │ HTTP/WebSocket │
┌─────────▼───────────────────▼─────────────────────────────┐
│                    后端 (FastAPI)                 │
│  ┌──────────────────────────────────────────────┐ │
│  │              API Routes                  │ │
│  │  /api/auth/*   /api/settings/*   /api/queue/*  │ │
│  └──────────────────┬───────────────────┘ │
│                    │                                  │
│  ┌─────────────────▼───────────────────┐  │
│  │         Services Layer             │  │
│  │  BilibiliService  DownloadService  │  │
│  │  SettingsService  SchedulerService │  │
│  └──────────────────┬───────────────────┘  │
│                    │                                  │
└─────────────────────▼──────────────────────────────
                    │
       ┌─────────────┬─────────────┐
       │            │            │
  ┌────▼────┐ ┌──▼────┐ ┌──▼────┐
  │ SQLite  │ │ File  │ │Bili API│
  │  DB    │ │System│ │       │
  └────────┘ └──────┘ └───────┘
```

## 模块结构

### 前端 (apps/web/src/)

```
src/
├── components/        # 通用组件
│   ├── MainLayout.tsx
│   ├── ConfirmModal.tsx
│   └── Toast.tsx
├── pages/          # 页面组件
│   ├── HomePage.tsx
│   ├── Favorites.tsx
│   ├── WatchLater.tsx
│   ├── Download.tsx
│   └── settings/
├── stores/         # Zustand 状态管理
│   ├── auth.ts
│   ├── download.ts
│   └── settings.ts
├── hooks/          # 自定义 Hooks
└── services/      # API 服务
```

### 后端 (apps/api/src/)

```
src/
├── routers/        # API 路由
│   ├── auth.py
│   ├── favorites.py
│   ├── watchlater.py
│   ├── settings.py
│   ├── queue.py
│   └── note.py         # AI 笔记路由 (Phase 1)
├── services/      # 业务逻辑
│   ├── bilibili.py
│   ├── download_service.py
│   ├── settings_service.py
│   ├── scheduler_service.py
│   └── llm/           # LLM 模块 (Phase 1)
│       ├── prompts/   # Prompt 构建器
│       └── __init__.py
├── models/        # 数据模型
│   ├── user.py
│   ├── cookie.py
│   ├── download.py
│   ├── ai_note.py     # AI 笔记模型 (Phase 1)
│   └── setting.py
├── schemas/       # Pydantic 模型
│   └── ai_note.py     # AI 笔记 Schema (Phase 1)
├── llm/           # LLM 客户端 (Phase 1)
│   ├── providers.py
│   ├── openai_client.py
│   ├── claude_client.py
│   ├── deepseek_client.py
│   └── factory.py
└── utils/        # 工具函数
```

## 数据流

### 1. 用户认证流程

```
登录请求 → /api/auth/sessdata → BilibiliService 
→ 验证 → User模型存储 → Cookie模型存储 → 返回Token
```

### 2. 下载流程

```
添加任务 → /api/queue/add → DownloadService 
→ 创建任务 → 队列管理 → 下载执行 → 进度推送(WebSocket) → 完成存储
```

### 3. 设置流程

```
前端修改 → /api/settings PUT → SettingsService 
→ Setting模型 → 数据库存储 → 返回确认
```

### 4. AI 笔记流程 (Phase 2)

```
媒体库点击视频 → /api/note/analyze → 创建 AiNote 记录
→ 转写服务 (B站字幕优先 + Whisper) → LLM 生成笔记 → 存储 Markdown
→ 前端轮询 /api/note/status/{note_id} → 展示 Markdown + 思维导图
```

## 部署架构

### 开发环境

```
前端: http://localhost:5173 (Vite)
后端: http://localhost:8000 (FastAPI)
```

### 生产环境

```
Nginx + Gunicorn (后端)
静态文件 (前端构建)
```

---

## 关联文档

- [base/tech-stack.md](../base/tech-stack.md) - 技术选型详情
- [database/models.md](../database/models.md) - 数据模型

---

[返回上级](../README.md)