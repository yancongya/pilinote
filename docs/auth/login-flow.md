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

[返回上级](./README.md)