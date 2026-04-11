# API 端点

## 基础信息

- **Base URL**: `http://localhost:8000`
- **WebSocket**: `ws://localhost:8000/ws`

## 认证接口

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| POST | `/api/auth/init` | - | 初始化指纹系统 |
| POST | `/api/auth/refresh/cookies` | - | 检查并刷新 Cookie |
| GET | `/api/auth/captcha/params` | - | 获取极验验证码参数 |
| POST | `/api/auth/captcha/validate` | - | 验证极验验证码 |
| POST | `/api/auth/sms/send` | - | 发送手机验证码 |
| GET | `/api/auth/qrcode` | - | 获取登录二维码 |
| GET | `/api/auth/qrcode/status/{qrcode_key}` | - | 查询二维码状态 |
| POST | `/api/auth/sessdata` | - | SESSDATA 登录 |
| POST | `/api/auth/password` | - | 密码登录 |
| POST | `/api/auth/sms/login` | - | 手机验证码登录 |
| GET | `/api/auth/user-info` | sessdata | 获取用户信息 |
| GET | `/api/auth/proxy/avatar` | url | 代理获取头像 |
| POST | `/api/auth/refresh-cookie` | - | 刷新 Cookie |
| POST | `/api/auth/logout` | - | 登出 |
| GET | `/api/auth/status` | - | 获取登录状态 |
| GET | `/api/auth/accounts` | - | 获取账号列表 |
| GET | `/api/auth/accounts/{id}/credentials` | - | 获取验证数据 |
| POST | `/api/auth/accounts/switch` | `?account_id=1` | 切换账号 |
| POST | `/api/auth/accounts/refresh` | `?account_id=1` | 刷新账号 |
| DELETE | `/api/auth/accounts/{id}` | - | 删除账号 |
| GET | `/api/auth/accounts/refresh/status` | - | 获取刷新服务状态 |
| POST | `/api/auth/accounts/refresh/start` | `?interval=3600` | 启动刷新服务 |
| POST | `/api/auth/accounts/refresh/stop` | - | 停止刷新服务 |

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