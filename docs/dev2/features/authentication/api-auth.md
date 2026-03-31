# 认证API文档

## 认证相关API

### 1. 扫码登录API

#### 获取二维码
```
GET /x/passport-login/web/qrcode/generate
```

**返回示例**:
```json
{
  "url": "https://account.bilibili.com/h5/account-h5/auth/scan-web?...",
  "qrcode_key": "xxx"
}
```

#### 轮询登录状态
```
GET /x/passport-login/web/qrcode/poll
```

**参数**:
- `qrcode_key`: 二维码密钥

**状态码**:
- `86101`: 未扫码
- `86090`: 已扫码，请确认
- `0`: 登录成功
- `86038`: 二维码已过期

### 2. 短信登录API

#### 获取加密key
```
GET /x/passport-login/web/key
```

#### 发送短信验证码
```
POST /x/passport-login/web/sms/send
```

**参数**:
- `cid`: 国家代码
- `tel`: 手机号
- `source`: 来源
- `token`: 验证码token

#### 短信登录
```
POST /x/passport-login/web/login/sms
```

**参数**:
- `phone`: 手机号
- `code`: 验证码
- `captcha_key`: 验证码key

### 3. 用户信息API

#### 获取用户信息
```
GET /x/web-interface/nav
```

**返回信息**:
- 用户ID (mid)
- 用户名
- 头像
- 等级
- VIP状态

## 认证流程

### 扫码登录流程
1. 前端调用 `/api/auth/qrcode` 获取二维码
2. 后端调用B站API `/x/passport-login/web/qrcode/generate`
3. 返回二维码URL和qrcode_key
4. 前端显示二维码，用户扫码
5. 前端轮询 `/api/auth/qrcode/status/{qrcode_key}`
6. 后端调用B站API `/x/passport-login/web/qrcode/poll`
7. 成功后返回用户信息

### 短信登录流程
1. 前端调用 `/api/auth/captcha/params` 获取Geetest参数
2. 前端显示Geetest验证码
3. 验证成功后调用 `/api/auth/sms/send` 发送短信
4. 用户输入验证码
5. 前端调用 `/api/auth/sms/login` 登录

### SESSDATA登录流程
1. 用户手动输入SESSDATA
2. 前端调用 `/api/auth/sessdata`
3. 后端验证SESSDATA有效性
4. 返回用户信息

## 后端API端点

### 认证模块 (`/api/auth`)

- `GET /api/auth/qrcode` - 获取登录二维码
- `GET /api/auth/qrcode/status/{qrcode_key}` - 查询二维码状态
- `POST /api/auth/sessdata` - SESSDATA登录
- `POST /api/auth/password` - 密码登录
- `POST /api/auth/sms/send` - 发送手机验证码
- `POST /api/auth/sms/login` - 手机验证码登录
- `GET /api/auth/user-info` - 获取用户信息
- `GET /api/auth/proxy/avatar` - 图片代理（解决防盗链）

## API响应格式

所有后端API都遵循统一的响应格式：
```json
{
  "success": true|false,
  "message": "错误信息（如果失败）",
  "data": {
    // 实际数据
  }
}
```

## Cookie管理

### 持久化存储
- SESSDATA、bili_jct、buvid3等关键Cookie
- 支持多账号管理
- 自动刷新token

### 设备指纹
- buvid3: 设备指纹
- buvid4: 设备指纹扩展
- bili_ticket: 票据
- _uuid: 设备UUID

## 安全考虑

### 验证码集成
- Geetest极验验证码
- 防止恶意请求
- 用户体验优化

### Cookie安全
- HTTPS传输
- HttpOnly标志
- Secure标志
- 同源策略

## 错误处理

### 常见错误码
- `86101`: 未扫码
- `86090`: 已扫码，请确认
- `86038`: 二维码已过期
- `412`: 请求频率过高
- `10000`: 账号密码错误

### 错误响应格式
```json
{
  "success": false,
  "message": "错误描述",
  "code": 86038
}
```

## 参考实现

### B站官方API
- 扫码登录: `/x/passport-login/web/qrcode/generate`
- 短信登录: `/x/passport-login/web/sms/send`
- 用户信息: `/x/web-interface/nav`

### 参考项目
- `reference/pilipala/lib/http/login.dart` - 登录实现
- `reference/pilipala/lib/http/user.dart` - 用户API
- `reference/BiliTools/src-tauri/src/services/login.rs` - BiliTools登录

## 测试工具

### 扫码登录测试
```bash
# 获取二维码
curl "http://localhost:8000/api/auth/qrcode"

# 查询状态（替换qrcode_key）
curl "http://localhost:8000/api/auth/qrcode/status/xxx"
```

### SESSDATA登录测试
```bash
curl -X POST "http://localhost:8000/api/auth/sessdata" \
  -H "Content-Type: application/json" \
  -d '{"sessdata": "your_sessdata_here"}'
```

## 更新日志

### 2026-03-30
- ✅ 实现扫码登录功能
- ✅ 实现短信登录功能（集成Geetest验证码）
- ✅ 实现SESSDATA登录功能
- ✅ 移除密码登录功能（用户体验不佳）
- ✅ 完善Cookie管理机制
- ✅ 添加设备指纹支持
- ✅ 优化错误处理和用户提示