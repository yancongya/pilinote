# API 端点

## 基础信息

- **Base URL**: `http://localhost:8000`
- **WebSocket**: `ws://localhost:8000/ws`

## 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/status` | 登录状态 |
| POST | `/api/auth/logout` | 登出 |

## 视频接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/watchlater` | 稍后再看 |
| GET | `/api/favorites` | 收藏夹 |
| GET | `/api/favorites/{fid}` | 收藏夹详情 |

## 下载接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/queue` | 下载队列 |
| POST | `/api/queue/add` | 添加下载 |
| DELETE | `/api/queue/{id}` | 删除任务 |

## 设置接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings` | 获取设置 |
| PUT | `/api/settings` | 保存设置 |