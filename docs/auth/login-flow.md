# 登录流程

---
关联文档:
  - cookies.md         # Cookie 管理
  - database/models.md  # User 模型
  - wbi-sign.md        # WBI 签名
涉及文件:
  - apps/api/src/routers/auth.py
  - apps/api/src/services/bilibili.py
  - apps/api/src/services/headers_manager.py
  - apps/api/src/services/cookie_manager.py
依赖服务:
  - BilibiliService
  - HeadersManager
  - CookieManager
---

## 支持的登录方式

### 1. 二维码登录

**流程**：
```
1. 前端调用 getQrcode() 获取二维码和 qrcode_key
2. 用户扫码
3. 前端轮询 queryQrcodeStatus(qrcodeKey) 查询状态
4. 后端验证成功，返回用户信息和 Cookie
5. 保存到数据库
```

**关键文件**：
- 前端: `apps/web/src/services/api.ts` - `getQrcode()`, `queryQrcodeStatus()`
- 后端: `apps/api/src/routers/auth.py` - `/api/auth/qrcode`
- 服务: `apps/api/src/services/bilibili.py` - `get_qrcode()`, `check_qrcode()`

### 2. SESSDATA 登录

**流程**：
```
1. 用户从浏览器开发者工具获取 SESSDATA
2. 前端调用 loginBySessdata(sessdata)
3. 后端验证 SESSDATA 有效性
4. 保存用户信息和 Cookie
```

**关键文件**：
- 前端: `apps/web/src/services/api.ts` - `loginBySessdata()`
- 后端: `apps/api/src/routers/auth.py` - `/api/auth/sessdata`

### 3. 密码登录

**流程**：
```
1. 获取极验验证码参数
2. 用户完成验证
3. 提交账号密码
4. 后端登录并返回 Cookie
```

**关键文件**：
- 前端: `apps/web/src/components/GeetestCaptcha.tsx`
- 后端: `apps/api/src/services/geetest_service.py`

### 4. 手机验证码登录

**流程**：
```
1. 获取极验验证码
2. 发送手机验证码
3. 提交验证码登录
```

---

## API 端点详情

### 认证相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/init` | 初始化指纹系统 |
| POST | `/api/auth/refresh/cookies` | 检查并刷新 Cookie |
| GET | `/api/auth/qrcode` | 获取登录二维码 |
| GET | `/api/auth/qrcode/status/{qrcode_key}` | 查询二维码状态 |
| POST | `/api/auth/sessdata` | SESSDATA 登录 |
| GET | `/api/auth/user-info` | 获取用户信息 |
| POST | `/api/auth/logout` | 退出登录 |

### 账号管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/accounts` | 获取账号列表 |
| GET | `/api/auth/status` | 获取登录状态 |
| POST | `/api/auth/accounts/switch` | 切换账号 |
| DELETE | `/api/auth/accounts/{id}` | 删除账号 |
| POST | `/api/auth/accounts/refresh` | 刷新账号 |
| GET | `/api/auth/accounts/refresh/status` | 获取刷新服务状态 |
| POST | `/api/auth/accounts/refresh/start` | 启动刷新服务 |
| POST | `/api/auth/accounts/refresh/stop` | 停止刷新服务 |

---

## 完整登录链路

```
┌─────────────────────────────────────────────────────────────┐
│                   用户登录入口                         │
├─────────────────────────────────────────────────────────────┤
│ 1. 二维码登录 / SESSDATA 登录 / 验证码登录            │
│    ↓                                              │
│ 2. BilibiliService 处理登录逻辑                        │
│    ↓                                              │
│ 3. 获取 SESSDATA 和用户信息                         │
│    ↓                                              │
│ 4. 保存到 User 表 (mid, username, sessdata)          │
│    ↓                                              │
│ 5. CookieManager.save_to_db() 保存完整 Cookie      │
│    ↓                                              │
│ 6. HeadersManager.sync_cookies_from_db() 同步到内存    │
│    ↓                                              │
│ 7. 后续请求使用：HeadersManager.get_headers()       │
└─────────────────────────────────────────────────────────────┘
```

---

## 错误码

| code | 说明 |
|------|------|
| 0 | 成功 |
| -1 | 系统错误 |
| -2 | 系统错误 |
| -3 | 二维码已失效 |
| -4 | 二维码扫码超时 |
| -5 | 用户取消 |
| -6 | 二维码缺失 |
| -7 | 已登录 |
| -8 | SESSDATA 无效 |
| -9 | 账号或密码错误 |
| -10 | 账号未注册 |

---

[返回上级](./README.md)