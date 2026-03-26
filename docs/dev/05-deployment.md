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

## 配置管理
- 环境变量
- 配置文件
- Docker volumes

## 参考实现
- `reference/hermes/docker-compose.yml`
- `reference/vidbee/docker-compose.yml`
- `reference/hermes/Caddyfile`