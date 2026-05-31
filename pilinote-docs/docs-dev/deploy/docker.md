# Docker 热更新调试

PiliNote 目前保留 Docker 作为本地调试环境，不再维护根目录 `Dockerfile` 和生产镜像构建流程。文档项目 `pilinote-docs` 不参与 Docker 打包，也不包含在 Docker 调试环境中。

## 架构

开发环境使用 `docker-compose.dev.yml` 启动两个服务：

| 服务 | 镜像 | 端口 | 作用 |
|---|---|---|---|
| `api` | `python:3.11-slim` | `8000` | FastAPI 后端，安装 `ffmpeg`/`aria2`，源码 bind mount，`uvicorn --reload` 热重载 |
| `web` | `node:22-slim` | `5173` | Vite 前端，固定 `pnpm@10`，源码 bind mount，HMR 热更新 |

文档站仍按普通本地开发方式运行：

```bash
cd pilinote-docs
pnpm dev
```

源码通过 `.:/workspace` 挂载到容器内。修改本地代码后：

- 后端 Python 文件由 Uvicorn reload 自动重启。
- 前端 React/TypeScript 文件由 Vite HMR 更新页面。
- 运行时数据写入 Docker volume `pilinote_runtime`。

## 启动

在项目根目录执行：

```bash
docker compose -f docker-compose.dev.yml up
```

首次启动会在容器内安装 Python 和前端依赖，时间会稍长。后续启动会复用镜像层与 volume。

访问地址：

| 地址 | 说明 |
|---|---|
| `http://localhost:5173` | 前端开发服务 |
| `http://localhost:8000/health` | 后端健康检查 |

## 端口冲突

如果本机 `8000` 或 `5173` 已被其它服务占用，可以叠加 `docker-compose.local.yml` 使用备用端口：

```bash
docker compose -f docker-compose.dev.yml -f docker-compose.local.yml up
```

备用访问地址：

| 地址 | 说明 |
|---|---|
| `http://localhost:5175` | 前端开发服务 |
| `http://localhost:8001/health` | 后端健康检查 |

`docker-compose.local.yml` 只覆盖宿主机端口和前端 API 地址；容器内仍然使用 `api:8000` 与 `web:5173`。

## 常用命令

```bash
# 后台启动
docker compose -f docker-compose.dev.yml up -d

# 后台启动，使用备用端口
docker compose -f docker-compose.dev.yml -f docker-compose.local.yml up -d

# 查看日志
docker compose -f docker-compose.dev.yml logs -f

# 只重启后端
docker compose -f docker-compose.dev.yml restart api

# 只重启前端
docker compose -f docker-compose.dev.yml restart web

# 停止服务
docker compose -f docker-compose.dev.yml down
```

如需清空调试环境的运行时数据：

```bash
docker compose -f docker-compose.dev.yml down -v
```

## 数据路径

容器内运行时目录为 `/workspace/runtime`，对应 named volume `pilinote_runtime`。

| 环境变量 | 容器内路径 | 说明 |
|---|---|---|
| `PILINOTE_RUNTIME_DIR` | `/workspace/runtime` | 运行时根目录 |
| `PILINOTE_LOG_DIR` | `/workspace/runtime/logs` | 日志目录 |
| `PILINOTE_DOWNLOAD_PATH` | `/workspace/runtime/downloads` | 下载目录 |
| `PILINOTE_TEMP_PATH` | `/workspace/runtime/temp` | 临时文件目录 |
| `DATABASE_URL` | `sqlite:////workspace/runtime/data/pilinote.db` | SQLite 数据库 |

## 调试注意事项

- Docker 调试模式面向开发，不用于生产部署。
- 前端接口地址通过 `VITE_API_BASE_URL=http://127.0.0.1:8000` 指向宿主机映射端口。
- 后端容器使用 `--reload --reload-dir /workspace/apps/api` 监听源码变化。
- 后端启动时会安装 `ffmpeg` 和 `aria2`，用于视频处理和下载调试。
- 前端容器使用 Node 22，并通过 Corepack 固定激活 `pnpm@10`；`CI=true` 用于避免非交互安装时卡在确认提示。
- 如果新增系统依赖，需要更新 `docker-compose.dev.yml` 的启动命令或改为维护专门的开发镜像。
