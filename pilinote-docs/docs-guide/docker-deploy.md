# Docker 热更新调试

PiliNote 当前只保留 Docker 本地调试方式：前后端源码挂载到容器内，后端自动重启，前端 HMR 热更新。文档项目 `pilinote-docs` 不参与 Docker 打包，也不包含在 Docker 调试环境中。

## 前置条件

- 安装 [Docker](https://docs.docker.com/get-docker/)

## 启动

在项目根目录执行：

```bash
docker compose -f docker-compose.dev.yml up
```

打开浏览器访问：

| 地址 | 说明 |
|---|---|
| `http://localhost:5173` | PiliNote 前端开发页 |
| `http://localhost:8000/health` | 后端健康检查 |

如果 `8000` 或 `5173` 已被占用，可以使用备用端口：

```bash
docker compose -f docker-compose.dev.yml -f docker-compose.local.yml up
```

备用地址：

| 地址 | 说明 |
|---|---|
| `http://localhost:5175` | PiliNote 前端开发页 |
| `http://localhost:8001/health` | 后端健康检查 |

## 工作方式

`docker-compose.dev.yml` 会启动两个服务：

| 服务 | 端口 | 热更新方式 |
|---|---|---|
| `api` | `8000` | `uvicorn --reload`，并安装 `ffmpeg`/`aria2` |
| `web` | `5173` | Vite HMR，Node 22 + `pnpm@10` |

项目源码会挂载到容器的 `/workspace`。修改本地文件后，容器内服务会直接读取最新代码。

文档站单独本地运行：

```bash
cd pilinote-docs
pnpm dev
```

## 常用命令

```bash
# 后台启动
docker compose -f docker-compose.dev.yml up -d

# 后台启动，使用备用端口
docker compose -f docker-compose.dev.yml -f docker-compose.local.yml up -d

# 查看日志
docker compose -f docker-compose.dev.yml logs -f

# 停止服务
docker compose -f docker-compose.dev.yml down

# 停止并清空 Docker 调试数据
docker compose -f docker-compose.dev.yml down -v
```

## 数据目录

Docker 调试数据保存在 named volume `pilinote_runtime`，容器内路径为 `/workspace/runtime`。

| 内容 | 路径 |
|---|---|
| 数据库 | `/workspace/runtime/data/pilinote.db` |
| 视频下载 | `/workspace/runtime/downloads/` |
| 日志 | `/workspace/runtime/logs/` |
| 临时文件 | `/workspace/runtime/temp/` |

此方式用于开发调试，不再包含 `docker build` 或生产镜像部署步骤。

## NAS 远程调试

如果希望在 NAS 上运行 Docker，同时本地编辑后自动同步到 NAS：

1. 复制配置模板：

```bash
cp .env.nas.example .env.nas
```

2. 编辑 `.env.nas`，填写 NAS 的 SSH 和目录信息：

```bash
NAS_HOST=192.168.1.100
NAS_USER=admin
NAS_SSH_PORT=22
NAS_PROJECT_DIR=/volume1/docker/pilinote/app
NAS_RUNTIME_DIR=/volume1/docker/pilinote/runtime
NAS_WEB_ORIGIN=http://192.168.1.100:5173
NAS_API_BASE_URL=http://192.168.1.100:8000
NAS_WS_BASE_URL=ws://192.168.1.100:8000
```

3. 首次同步并启动 NAS Docker：

```bash
scripts/nas-sync-once.sh
scripts/nas-up.sh
```

4. 开启本地实时同步：

```bash
scripts/nas-watch-sync.sh
```

访问：

| 地址 | 说明 |
|---|---|
| `http://NAS_HOST:5173` | NAS 上的前端开发服务 |
| `http://NAS_HOST:8000/health` | NAS 上的后端健康检查 |

常用命令：

```bash
# 查看 NAS 远程日志
scripts/nas-logs.sh

# 只看后端日志
scripts/nas-logs.sh api

# 只看前端日志
scripts/nas-logs.sh web
```

NAS 同步不会包含 `pilinote-docs/`、`reference/`、`node_modules/`、本地下载目录、运行时目录、数据库、日志和构建产物。下载文件、数据库和日志保存在 NAS 的 `NAS_RUNTIME_DIR`。
