# Docker 部署

## 架构概述

PiliNote 采用**单容器**架构，一个镜像包含前后端：

```
┌─────────────────────────────────────┐
│         pilinote 容器                │
│                                     │
│  ┌─────────┐  ┌──────────────────┐  │
│  │ FastAPI  │  │ 前端静态文件       │  │
│  │  API     │  │ (build from SPA) │  │
│  │ :8000    │  │                  │  │
│  └────┬────┘  └──────┬───────────┘  │
│       │              │              │
│       └──────┬───────┘              │
│              │                      │
│     FastAPI StaticFiles mount       │
│     (SPA fallback with html=True)   │
└─────────────────────────────────────┘
         │
         ▼  Volume: /data
   ┌──────────┐
   │  SQLite  │
   │  DB      │
   │ 下载文件  │
   │ 日志      │
   │ temp     │
   └──────────┘
```

- FastAPI 同时提供 API 接口和前端静态文件服务
- 前端路由 SPA fallback 通过 `StaticFiles(html=True)` 实现
- 所有运行时数据持久化在 volume `/data` 下

## 构建

### 基础镜像

```dockerfile
# Stage 1: 前端构建 (node:22-slim)
FROM node:22-slim AS frontend-builder
# pnpm install + pnpm build → dist/

# Stage 2: 运行环境 (python:3.11-slim)
FROM python:3.11-slim
# 安装 ffmpeg + aria2, pip install -r requirements.txt
# COPY apps/api/ → /app/
# COPY dist/ → /app/frontend/
```

### 构建命令

```bash
docker build -t pilinote .
```

利用 Docker 缓存：未修改的前端代码和 Python 依赖层会被缓存，二次构建很快。

## 运行

### 快速启动 (SQLite)

```bash
docker run -d \
  --name pilinote \
  -p 8000:8000 \
  -v pilinote_data:/data \
  pilinote
```

### 自定义配置

```bash
docker run -d \
  --name pilinote \
  -p 8000:8000 \
  -v pilinote_data:/data \
  -e SECRET_KEY=your-secret-key \
  -e DATABASE_URL=sqlite:////data/data/pilinote.db \
  pilinote
```

### docker-compose

```yaml
# docker-compose.yml
services:
  pilinote:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - pilinote_data:/data
    environment:
      - SECRET_KEY=${SECRET_KEY:-pilinote-secret-key}
    restart: unless-stopped

volumes:
  pilinote_data:
```

## 生产部署建议

### 资源限制

```bash
docker run -d \
  --name pilinote \
  -p 8000:8000 \
  --memory="2g" \
  --cpus="2" \
  -v pilinote_data:/data \
  pilinote
```

### 反向代理 (Nginx)

如需通过 nginx 提供 HTTPS 或域名访问：

```nginx
server {
    listen 443 ssl;
    server_name pilinote.example.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 数据持久化

| 路径 | 用途 |
|---|---|
| `/data/data/pilinote.db` | SQLite 数据库 |
| `/data/downloads/` | 视频下载目录 |
| `/data/logs/` | 应用日志 |
| `/data/temp/` | 临时文件 |

## 开发模式

参见根目录 `docker-compose.dev.yml`，使用 bind mount + 热重载：

```bash
docker compose -f docker-compose.dev.yml up
```
