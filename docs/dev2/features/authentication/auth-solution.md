# 用户认证方案

## 认证方式
1. **扫码登录** (推荐)
   - API: `/x/passport-login/web/qrcode/generate`
   - API: `/x/passport-login/web/qrcode/poll`
   - 有效期: 180s
   - 状态: 无需验证码，用户体验最佳

2. **短信登录** (可选)
   - API: `/x/passport-login/web/sms/send`
   - API: `/x/passport-login/web/login/sms`
   - 集成Geetest验证码
   - 支持手机号验证码登录

3. **SESSDATA** (快速开发)
   - 手动输入cookie
   - 自动提取: SESSDATA, bili_jct, buvid3
   - 适合开发者快速测试

## Cookie管理
- 持久化存储
- 支持多账号
- 自动刷新token
- HeadersManager全局管理
- 设备指纹跟踪（buvid3, buvid4, bili_ticket）

## 参考实现
- `reference/pilipala/lib/http/login.dart`
- `reference/pilipala/lib/utils/login.dart`
- `reference/pilipala/lib/pages/login/controller.dart`
- `reference/BiliTools/src-tauri/src/services/login.rs`

## 实际实现细节

### 后端实现 (FastAPI)

#### 1. 扫码登录流程
```python
# 获取二维码
GET /api/auth/qrcode
→ 调用 B站 API: /x/passport-login/web/qrcode/generate
→ 使用HeadersManager获取带指纹的请求头
→ 返回: {url, qrcode_key}

# 轮询状态
GET /api/auth/qrcode/status/{qrcode_key}
→ 调用 B站 API: /x/passport-login/web/qrcode/poll
→ 状态码: 86101(未扫码), 86090(已扫码), 0(成功), 86038(过期)
→ 成功时自动获取用户信息并保存到数据库
→ 刷新HeadersManager中的cookies
```

#### 2. 短信登录流程
```python
# 获取验证码参数
GET /api/auth/captcha/params
→ 调用 B站 API: /x/passport-login/captcha
→ 返回: {type: "geetest", token, challenge, gt}

# 发送短信验证码
POST /api/auth/sms/send
Body: {cid, tel, token, challenge, validate, seccode}
→ 调用 B站 API: /x/passport-login/web/sms/send
→ 验证Geetest验证码
→ 返回: {captcha_key}

# 短信登录
POST /api/auth/sms/login
Body: {phone, code, captcha_key}
→ 调用 B站 API: /x/passport-login/web/login/sms
→ 返回用户信息
→ 更新HeadersManager中的cookies
```

#### 3. SESSDATA登录流程
```python
# SESSDATA登录
POST /api/auth/sessdata
Body: {sessdata}
→ 直接设置SESSDATA到HeadersManager
→ 调用用户信息API验证有效性
→ 返回用户信息
```

#### 4. HeadersManager集成
```python
# 所有登录流程都使用HeadersManager
service = BilibiliService()
await service.init()  # 初始化指纹和headers

# 自动管理cookies
await headers_manager.update_cookies(cookies_dict)
await headers_manager.update_cookie("SESSDATA", sessdata)

# 全局请求头包含设备指纹
headers = await headers_manager.get_headers()
# 包含: buvid3, buvid4, bili_ticket, _uuid, b_nut等
```

#### 5. 数据库存储
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
  // 扫码登录
  async getQrcode(): Promise<ApiResponse<QrcodeData>>
  async queryQrcodeStatus(qrcodeKey: string): Promise<ApiResponse<any>>
  
  // 短信登录
  async getCaptchaParams(): Promise<ApiResponse<any>>
  async sendSmsCodeWithCaptcha(params: SmsCaptchaParams): Promise<ApiResponse<any>>
  async loginBySms(request: SmsLoginRequest): Promise<ApiResponse<UserInfo>>
  
  // SESSDATA登录
  async loginBySessdata(sessdata: string): Promise<ApiResponse<UserInfo>>
  
  // 用户信息
  async getUserInfo(sessdata: string): Promise<ApiResponse<UserInfo>>
  
  // 指纹管理
  async initFingerprint(): Promise<ApiResponse<any>>
  async refreshCookies(): Promise<ApiResponse<any>>
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
    // 初始化指纹系统
    await apiService.initFingerprint()
    navigate('/home')
  } else if (response.data.code === 86038) {
    // 二维码过期
    setQrcodeStatus('expired')
  }
}, 2000)
```

#### 4. 短信登录流程
```typescript
// 1. 发送验证码
const handleSendSmsCode = async () => {
  // 获取验证码参数
  const captchaParams = await apiService.getCaptchaParams()
  setCaptchaData(captchaParams.data)
  setShowCaptcha(true) // 显示Geetest验证码
}

// 2. Geetest验证成功后发送短信
const handleSmsCaptchaSuccess = async (captchaResult) => {
  const response = await apiService.sendSmsCodeWithCaptcha({
    cid: countryCode,
    tel: phone,
    token: captchaData.token,
    ...captchaResult
  })
  setSmsCaptchaKey(response.data.captcha_key) // 保存captcha_key
  setSmsSent(true)
}

// 3. 使用验证码登录
const handleSmsLogin = async () => {
  const response = await apiService.loginBySms({
    phone,
    code: smsCode,
    captcha_key: smsCaptchaKey
  })
  if (response.success) {
    authStore.login(response.data)
    await apiService.initFingerprint()
    navigate('/home')
  }
}
```

#### 5. Geetest验证码组件
```typescript
// apps/web/src/components/GeetestCaptcha.tsx
const GeetestCaptcha = ({ onSuccess, onError }) => {
  useEffect(() => {
    // 加载Geetest脚本
    const script = document.createElement('script')
    script.src = 'https://static.geetest.com/static/js/gt.0.4.9.js'
    document.body.appendChild(script)
    
    script.onload = () => {
      window.initGeetest({
        gt: challenge,
        challenge: challenge,
        product: 'bind',
        // ...配置
      }, (captchaObj) => {
        captchaObj.onSuccess(() => {
          const result = captchaObj.getValidate()
          onSuccess({
            challenge,
            validate: result.geetest_validate,
            seccode: result.geetest_seccode
          })
        })
      })
    }
  }, [])
  
  return <div id="geetest-container" />
}
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

### 3. 短信验证码发送失败
**问题**: 短信发送返回400或验证码错误

**原因**: B站要求Geetest验证码，且参数格式必须正确

**解决方案**: 
1. 使用正确的参数格式
```python
params = {
    "cid": 86,
    "tel": phone,
    "code": code,
    "source": "main-fe-header",
    "captcha_key": captcha_key,
    "keep": "true"
}
# 使用params而非form data
response = await client.post(url, params=params)
```

2. 处理Geetest验证结果
```typescript
const response = await apiService.sendSmsCodeWithCaptcha({
  cid: countryCode,
  tel: phone,
  token: captchaData.token,
  challenge: captchaResult.challenge,
  validate: captchaResult.validate,  # 注意字段名映射
  seccode: captchaResult.seccode
})
```

### 4. Pydantic字段冲突
**问题**: `validate`字段与BaseModel的validate方法冲突

**解决方案**: 使用alias避免冲突
```python
class SmsCodeWithCaptchaRequest(BaseModel):
    geetest_validate: str = Field(..., alias="validate", description="Geetest验证结果")
    
    class Config:
        populate_by_name = True  # 支持别名
```

### 5. HeadersManager初始化
**问题**: 登录请求返回412 Precondition Failed

**原因**: 缺少设备指纹和正确的请求头

**解决方案**: 所有登录前初始化HeadersManager
```python
service = BilibiliService()
await service.init()  # 初始化指纹和cookies
result = await service.login_by_sms(...)
```

### 6. CORS跨域问题
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

### 短信登录参数
```typescript
interface SmsCaptchaParams {
  cid: string        // 国家代码
  tel: string       // 手机号
  token: string      // 验证码token
  challenge: string  // Geetest challenge
  validate: string   // Geetest validate
  seccode: string    // Geetest seccode
}

interface SmsLoginRequest {
  phone: string
  code: string
  captcha_key?: string  // 短信验证码的captcha_key
}
```

## 技术栈总结

### 后端
- FastAPI 0.115.6
- SQLAlchemy 2.0.36
- SQLite (开发) / PostgreSQL (生产)
- httpx 0.28.1 (异步HTTP客户端)
- Pydantic 2.10.4
- Geetest极验验证码
- HeadersManager (设备指纹管理)
- Brotli压缩支持

### 前端
- React 19
- Zustand (状态管理)
- qrcode.react (二维码生成)
- Geetest极验验证码SDK
- localStorage (持久化)
- Tailwind CSS (样式)

### 认证方式
- ✅ 扫码登录（推荐，无需验证码）
- ✅ 短信登录（集成Geetest验证码）
- ✅ SESSDATA登录（快速开发）
- ❌ 密码登录（已移除，用户体验不佳）

## 最新更新 (2026-03-30)

### 1. 移除密码登录功能
**原因**: 密码登录需要频繁的Geetest验证码，用户体验不佳

**修改内容**:
- 移除密码登录tab和界面
- 删除`handlePasswordLogin`和`handleCaptchaSuccess`函数
- 清理相关状态变量（username, password）
- 移除未使用的图标（User, Lock）

### 2. 完善短信登录实现
**实现细节**:
- 集成Geetest验证码组件
- 使用正确的API参数格式（params而非form）
- 保存并传递captcha_key用于登录
- 添加smsCaptchaKey状态管理

**API流程**:
```
1. GET /api/auth/captcha/params → 获取Geetest参数
2. POST /api/auth/sms/send → 发送短信（含Geetest验证）
3. POST /api/auth/sms/login → 使用验证码登录（含captcha_key）
```

### 3. HeadersManager深度集成
**功能增强**:
- 所有登录流程统一使用HeadersManager
- 自动管理设备指纹（buvid3, buvid4, bili_ticket）
- 自动刷新cookies
- 支持refresh_token机制

**使用示例**:
```python
service = BilibiliService()
await service.init()  # 自动初始化指纹

# 所有请求自动携带正确的headers
result = await service.login_by_sms(phone, code, captcha_key)
```

### 4. 错误处理优化
**改进内容**:
- 添加详细的调试日志
- 统一错误响应格式
- 提供用户友好的错误提示
- Geetest验证失败时的重试机制

### 5. UI/UX优化
**界面改进**:
- 简化登录选项（3个tab）
- Geetest验证码模态框
- 短信发送状态提示
- 加载状态指示器

**移动端适配**:
- 响应式布局
- 触摸友好的按钮尺寸
- 自适应表单高度

## 部署注意事项

### 生产环境配置
1. **环境变量**:
   - `BILIBILI_APP_KEY`: B站应用密钥
   - `BILIBILI_APP_SECRET`: B站应用密钥
   - `GEETEST_ID`: 极验ID
   - `GEETEST_KEY`: 极验密钥

2. **数据库**:
   - 生产环境使用PostgreSQL
   - 配置连接池
   - 定期备份

3. **安全性**:
   - 启用HTTPS
   - 配置CORS白名单
   - 限制请求频率
   - 日志脱敏

### 监控和日志
- 登录成功/失败统计
- 验证码触发频率
- API响应时间监控
- 异常告警机制

## UI/UX 设计规范

### 设计系统
PiliNote 采用 **Soft UI Evolution** 设计风格，详见 [UI/UX 设计系统](12-ui-ux-design.md)。

### 核心设计原则
1. **现代美学**: 结合 flat design 和 neumorphism 的优点
2. **可访问性优先**: 所有交互元素符合 WCAG AA 标准
3. **流畅交互**: 150-300ms 的微交互动画
4. **响应式设计**: 从 375px 移动端到 1440px+ 桌面端
5. **性能优化**: 使用 transform 和 opacity 实现高性能动画

### 配色方案
```
Primary:    #2563EB (专业蓝)
Secondary:  #3B82F6 (明亮蓝)
Accent:     #F97316 (橙色 CTA)
Background: #F8FAFC (优雅浅灰)
Text:       #1E293B (深灰黑)
```

### 登录页面设计

#### Tab 切换
- **布局**: 3个tab（扫码、短信、SESSDATA）
- **交互**: 点击切换，带平滑过渡动画
- **状态**: 悬停时轻微上浮，激活时有阴影
- **动画**: 200ms 淡入 + 横向位移

#### 输入框
- **高度**: 48px（符合触摸目标规范）
- **圆角**: 12px
- **焦点**: 蓝色边框 + 多层阴影
- **图标**: 左侧图标，焦点时变色

#### 按钮
- **主要按钮**: 渐变背景，光泽动画
- **高度**: 48px
- **交互**: 悬停上浮，按下缩放
- **禁用**: 灰度背景，无阴影

#### 错误提示
- **位置**: 内容区域底部
- **背景**: #FEE2E2 (浅红)
- **文字**: #DC2626 (深红)
- **动画**: 滑入动画（200ms）

### 响应式断点
```
Mobile:    < 640px  (小屏手机)
Tablet:    640px - 1024px  (平板)
Desktop:   > 1024px  (桌面端)
```

### 可访问性要求
- **对比度**: ≥ 4.5:1 (WCAG AA)
- **焦点状态**: 所有交互元素可见焦点
- **键盘导航**: 完整支持
- **屏幕阅读器**: 语义化标签和 aria 属性
- **减少运动**: 支持 prefers-reduced-motion

### 交互动画规范
- **时长**: 150-300ms（微交互）
- **缓动**: ease-out (进入), ease-in (退出)
- **属性**: 只使用 transform 和 opacity
- **反馈**: 所有操作有视觉反馈

### 最新UI优化 (2026-03-30)
- ✅ 实现 Soft UI Evolution 设计风格
- ✅ 优化 Tab 切换动画和交互
- ✅ 改进输入框焦点状态
- ✅ 升级按钮样式（渐变 + 光泽）
- ✅ 添加内容区域淡入动画
- ✅ 优化错误提示显示
- ✅ 完善移动端适配
- ✅ 增强可访问性支持

### 设计资源
- **完整设计系统**: [12-ui-ux-design.md](12-ui-ux-design.md)
- **字体**: Inter (Google Fonts)
- **图标**: Lucide React
- **颜色规范**: 符合 WCAG AA 标准