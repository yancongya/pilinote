# 部署方案

## 部署方式

### 1. Web部署
- 前后端分离
- 独立数据库
- 反向代理

### 2. Docker部署
- Docker Compose编排
- 容器化服务
- 数据持久化
- 一键部署

### 3. 桌面端部署
- Electron打包
- 跨平台支持
- 内嵌后端服务

## 服务组件
- **前端**: React应用
- **后端**: FastAPI服务
- **数据库**: SQLite/PostgreSQL
- **缓存**: Redis
- **队列**: Celery Worker
- **代理**: Caddy/Nginx

## 开发环境配置

### 后端API服务器启动

**重要**: 必须使用虚拟环境启动API服务器，否则会出现依赖缺失导致的功能异常。

```bash
# 进入API目录
cd apps/api

# 创建虚拟环境（如果不存在）
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动API服务器（必须使用虚拟环境的python）
./venv/bin/python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**常见问题**:
- 如果直接使用 `python3 -m uvicorn...` 启动，会使用系统Python，缺少项目依赖
- 系统Python缺少 `yt_dlp` 等依赖，会导致稍后再看、收藏夹等功能异常
- 错误示例: `ModuleNotFoundError: No module named 'yt_dlp'`

### 前端开发服务器启动

```bash
# 进入Web目录
cd apps/web

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

## 配置管理
- 环境变量
- 配置文件
- Docker volumes

## 参考实现
- `reference/hermes/docker-compose.yml`
- `reference/vidbee/docker-compose.yml`
- `reference/hermes/Caddyfile`