# 技术栈方案

## 后端技术栈
- **语言**: Python 3.11+
- **Web框架**: FastAPI 0.104+
- **下载引擎**: yt-dlp
- **ORM**: SQLAlchemy 2.0+
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **任务队列**: Celery 5.3+ + Redis 7.0+
- **数据验证**: Pydantic v2
- **HTTP客户端**: httpx / aiohttp

## 前端技术栈
- **框架**: React 18+
- **构建工具**: Vite 5.0+
- **语言**: TypeScript 5.0+
- **样式**: Tailwind CSS 3.4+ / shadcn/ui
- **状态管理**: TanStack Query / Zustand
- **路由**: React Router v6
- **实时通信**: Socket.io-client / EventSource
- **动画库**: @formkit/auto-animate

## 桌面端技术栈
- **框架**: Electron 28+
- **构建工具**: electron-builder
- **支持平台**: Windows, macOS, Linux

## 部署技术栈
- **容器化**: Docker + Docker Compose
- **反向代理**: Caddy / Nginx
- **进程管理**: Systemd / Supervisor

## 参考项目
- **认证实现**: `reference/pilipala/`
- **自托管架构**: `reference/hermes/`
- **Electron应用**: `reference/vidbee/`
- **B站下载器**: `reference/bilibili-downloader/`