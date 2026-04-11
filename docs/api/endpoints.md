# API 端点

## 基础信息

- **Base URL**: `http://localhost:8000`
- **WebSocket**: `ws://localhost:8000/ws`

## 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/qrcode` | 获取登录二维码 |
| GET | `/api/auth/qrcode/status/{qrkey}` | 查询二维码状态 |
| POST | `/api/auth/sessdata` | SESSDATA 登录 |
| POST | `/api/auth/password` | 密码登录 |
| POST | `/api/auth/sms/login` | 手机验证码登录 |
| GET | `/api/auth/status` | 获取登录状态 |
| GET | `/api/auth/accounts` | 获取账号列表 |
| POST | `/api/auth/accounts/switch` | 切换账号 |
| POST | `/api/auth/accounts/refresh` | 刷新账号 |
| DELETE | `/api/auth/accounts/{id}` | 删除账号 |
| POST | `/api/auth/logout` | 登出 |

## 视频接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/favorites/folders` | 获取收藏夹列表 |
| GET | `/api/favorites/folders/{id}` | 获取收藏夹详情 |
| GET | `/api/watchlater` | 获取稍后再看 |
| GET | `/api/video/{id}` | 获取视频详情 |

## 下载接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/queue` | 获取下载队列 |
| POST | `/api/queue/add` | 添加任务 |
| POST | `/api/queue/{id}/control` | 控制任务 |
| DELETE | `/api/queue/{id}` | 删除任务 |
| GET | `/api/queue/schedulers` | 获取调度器 |
| POST | `/api/queue/schedulers` | 创建调度器 |
| POST | `/api/queue/schedulers/{id}/start` | 启动调度器 |

## 设置接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings` | 获取设置 |
| PUT | `/api/settings` | 更新设置 |
| POST | `/api/settings/backup/test` | 测试备份连接 |

---

[返回上级](./README.md)