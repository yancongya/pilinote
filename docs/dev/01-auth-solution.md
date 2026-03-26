# 用户认证方案

## 认证方式
1. **扫码登录** (推荐)
   - API: `/x/passport-login/web/qrcode/generate`
   - API: `/x/passport-login/web/qrcode/poll`
   - 有效期: 180s

2. **SESSDATA** (快速开发)
   - 手动输入cookie
   - 自动提取: SESSDATA, bili_jct, buvid3

3. **密码登录** (完整方案)
   - API: `/x/passport-login/web/key`
   - RSA加密
   - API: `/x/passport-login/web/login`
   - 支持极验验证码

## Cookie管理
- 持久化存储
- 支持多账号
- 自动刷新token

## 参考实现
- `reference/pilipala/lib/http/login.dart`
- `reference/pilipala/lib/utils/login.dart`
- `reference/pilipala/lib/pages/login/controller.dart`

## 实际实现细节

### 后端实现 (FastAPI)

#### 1. 扫码登录流程
```python
# 获取二维码
GET /api/auth/qrcode
→ 调用 B站 API: /x/passport-login/web/qrcode/generate
→ 返回: {url, qrcode_key}

# 轮询状态
GET /api/auth/qrcode/status/{qrcode_key}
→ 调用 B站 API: /x/passport-login/web/qrcode/poll
→ 状态码: 86101(未扫码), 86090(已扫码), 0(成功), 86038(过期)
→ 成功时自动获取用户信息并保存到数据库
```

#### 2. 用户信息获取
```python
# 从扫码响应中提取SESSDATA
cookies = response.cookies
sessdata = cookies.get("SESSDATA")

# 调用用户信息API
GET /x/web-interface/nav
Cookie: SESSDATA={sessdata}
→ 返回用户详细信息: mid, username, avatar, level, vip_status
```

#### 3. 数据库存储
```python
# User模型
class User:
    mid: int (主键)
    username: str
    avatar: str
    level: int
    vip_status: bool
    sessdata: str
    created_at: datetime
    updated_at: datetime

# 自动创建/更新用户
existing_user = db.query(User).filter(User.mid == mid).first()
if existing_user:
    existing_user.sessdata = sessdata
    existing_user.updated_at = None
else:
    new_user = User(mid=mid, username=..., sessdata=sessdata)
    db.add(new_user)
```

### 前端实现 (React)

#### 1. API服务层
```typescript
// apps/web/src/services/api.ts
class ApiService {
  async getQrcode(): Promise<ApiResponse<QrcodeData>>
  async queryQrcodeStatus(qrcodeKey: string): Promise<ApiResponse<any>>
  async loginBySessdata(sessdata: string): Promise<ApiResponse<UserInfo>>
  async loginByPassword(request: PasswordRequest): Promise<ApiResponse<UserInfo>>
  async getUserInfo(sessdata: string): Promise<ApiResponse<UserInfo>>
}
```

#### 2. 状态管理
```typescript
// apps/web/src/stores/auth.ts
interface AuthStore {
  user: UserInfo | null
  isLoggedIn: boolean
  login: (user: UserInfo) => void
  logout: () => void
  updateUser: (user: UserInfo) => void
}
// 使用Zustand + localStorage持久化
```

#### 3. 扫码登录流程
```typescript
// 1. 获取二维码
const response = await apiService.getQrcode()
setQrcodeUrl(response.data.url)
setQrcodeKey(response.data.qrcode_key)

// 2. 轮询状态
setInterval(async () => {
  const response = await apiService.queryQrcodeStatus(qrcodeKey)
  if (response.data.code === 0) {
    // 登录成功
    authStore.login(response.data)
    navigate('/home')
  } else if (response.data.code === 86038) {
    // 二维码过期
    setQrcodeStatus('expired')
  }
}, 2000)
```

## 常见问题及解决方案

### 1. 二维码显示问题
**问题**: 二维码图片无法显示，显示为缺失图标

**原因**: B站API返回的`url`字段不是图片地址，而是H5页面链接
```json
{
  "url": "https://account.bilibili.com/h5/account-h5/auth/scan-web?...",
  "qrcode_key": "xxx"
}
```

**解决方案**: 使用`qrcode.react`库将URL转换为二维码图片
```typescript
import QRCodeSVG from 'qrcode.react'

<QRCodeSVG 
  value={qrcodeUrl} 
  size={200} 
  level="M" 
  includeMargin={false}
/>
```

### 2. 扫码后显示过期问题
**问题**: 扫码成功后显示"二维码已过期"，无法登录

**原因**: 前后端数据结构不匹配
- 后端返回: `{success: true, data: {mid, username, ...}}`
- 前端检查: `response.data.code === 0` (永远为false)

**解决方案**: 在后端返回数据中添加`code: 0`字段
```python
return {
    "success": True,
    "data": {
        "code": 0,  # 添加这个字段
        "mid": data.get("mid"),
        "username": data.get("username"),
        # ...
    }
}
```

### 3. SESSDATA提取问题
**问题**: 扫码成功后无法从响应中提取SESSDATA

**原因**: B站API返回的cookie可能不在`response.cookies`中

**解决方案**: 尝试多个地方获取SESSDATA
```python
# 方法1: 从响应cookies中获取
sessdata = response.cookies.get("SESSDATA")

# 方法2: 从响应数据中获取
sessdata = login_data.get("refresh_token", "")

# 方法3: 从重定向URL中提取
sessdata = extract_from_url(response.url)
```

### 4. CORS跨域问题
**问题**: 前端无法调用后端API，显示CORS错误

**解决方案**: 在FastAPI中配置CORS
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## API响应格式规范

### 统一响应格式
```typescript
interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
  code?: number  // 状态码：0=成功, 其他=失败
}
```

### 二维码状态码
```typescript
const STATUS_CODES = {
  86101: "未扫码",
  86090: "已扫码，请确认",
  0: "登录成功",
  86038: "二维码已过期"
}
```

### 用户信息格式
```typescript
interface UserInfo {
  code: 0  // 必须包含，用于前端判断登录成功
  mid: number
  username: string
  avatar: string
  level: number
  vip_status: boolean
  sessdata: string
}
```

## 技术栈总结

### 后端
- FastAPI 0.115.6
- SQLAlchemy 2.0.36
- SQLite (开发) / PostgreSQL (生产)
- httpx 0.28.1
- Pydantic 2.10.4

### 前端
- React 19
- Zustand (状态管理)
- qrcode.react (二维码生成)
- localStorage (持久化)

### 认证方式
- ✅ 扫码登录
- ✅ SESSDATA登录
- ✅ 密码登录 (基础实现)