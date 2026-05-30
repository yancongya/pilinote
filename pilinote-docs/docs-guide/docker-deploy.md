# Docker 部署

## 前置条件

- 安装 [Docker](https://docs.docker.com/get-docker/)

## 快速开始

在项目根目录执行：

```bash
# 构建镜像
docker build -t pilinote .

# 启动
docker run -d \
  --name pilinote \
  -p 8000:8000 \
  -v pilinote_data:/data \
  pilinote
```

打开浏览器访问 `http://localhost:8000`。

## 使用 docker-compose

```bash
docker compose up -d
```

## 数据目录

容器内的 `/data` 目录包含所有运行时数据，建议用 volume 持久化：

| 内容 | 路径 |
|---|---|
| 数据库 | `/data/data/pilinote.db` |
| 视频下载 | `/data/downloads/` |
| 日志 | `/data/logs/` |

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `SECRET_KEY` | `pilinote-secret-key` | JWT 签名密钥 |
| `DATABASE_URL` | `sqlite:////data/data/pilinote.db` | 数据库连接 |
| `PILINOTE_RUNTIME_DIR` | `/data` | 运行时数据根目录 |

## 开发模式 (热重载)

使用 `docker-compose.dev.yml`：

```bash
docker compose -f docker-compose.dev.yml up
```

此模式使用 bind mount 挂载源码，前后端各自热重载。
