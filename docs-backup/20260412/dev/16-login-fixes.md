# 登录问题修复记录

## 问题概述

2026-04-01 修复了登录流程中的多个问题，包括短信验证码登录和二维码登录都失败的情况。

## 主要问题

### 1. Cookie 类型错误
**错误信息**: `'str' object has no attribute 'name'`

**原因**:
- 代码假设 `response.cookies` 总是返回对象列表（有 `.name` 和 `.value` 属性）
- 实际上 B站 API 有时返回字符串或元组格式

**影响文件**:
- `apps/api/src/services/bilibili.py`
- `apps/api/src/services/cookie_manager.py`

**解决方案**:
添加类型检查，兼容多种 cookie 格式：
```python
# bilibili.py
if hasattr(cookie, 'name') and hasattr(cookie, 'value'):
    cookie_name = cookie.name
    cookie_value = cookie.value
else:
    cookie_name = cookie[0] if isinstance(cookie, tuple) else cookie
    cookie_value = response.cookies[cookie_name]

# cookie_manager.py
if hasattr(cookie, 'name') and hasattr(cookie, 'value'):
    self.cookies[cookie.name] = cookie.value
```

---

### 2. 缺少 datetime 导入
**错误信息**: `NameError: name 'datetime' is not defined`

**原因**:
- `auth.py` 使用了 `datetime.now()` 但没有导入 `datetime` 模块

**影响文件**:
- `apps/api/src/routers/auth.py`

**解决方案**:
```python
from datetime import datetime
```

---

### 3. 用户信息类型错误
**错误信息**: `'str' object has no attribute 'get'`

**原因**:
- B站 API 返回的 `level_info` 和 `vip` 字段有时是字符串而不是对象
- 代码直接调用 `.get()` 方法导致崩溃

**影响文件**:
- `apps/api/src/services/bilibili.py`

**解决方案**:
```python
level_info = user_info.get("level_info")
level = level_info.get("current_level") if isinstance(level_info, dict) else None

vip_info = user_info.get("vip")
vip_status = vip_info.get("status") if isinstance(vip_info, dict) else 0
```

---

### 4. GeetestCaptcha 组件问题
**问题**: 组件内部获取参数而不是通过 props 接收

**影响文件**:
- `apps/web/src/components/GeetestCaptcha.tsx`

**解决方案**:
将 captchaParams 作为 props 传入：
```typescript
interface GeetestCaptchaProps {
  captchaParams: {
    token: string
    gt: string
    challenge: string
  }
  onSuccess: (captchaData: { challenge: string; validate: string; seccode: string }) => void
  onError?: (error: string) => void
}
```

---

### 5. 前端错误处理不完善
**问题**: API 错误没有正确提取错误详情

**影响文件**:
- `apps/web/src/services/api.ts`

**解决方案**:
改进错误处理逻辑，提取详细的错误信息：
```typescript
if (!response.ok) {
  if (data.detail) {
    if (typeof data.detail === 'string') {
      return { success: false, message: data.detail };
    }
    if (typeof data.detail === 'object') {
      return {
        success: false,
        message: data.detail.message || '请求失败',
        code: data.detail.code
      };
    }
  }
}
```

---

### 6. 短信验证码倒计时
**问题**: 没有显示验证码有效期倒计时

**影响文件**:
- `apps/web/src/pages/LoginPage.tsx`

**解决方案**:
添加倒计时功能：
```typescript
const [countdown, setCountdown] = useState(0)

// 在发送验证码成功后
setCountdown(60)
const timer = setInterval(() => {
  setCountdown(prev => {
    if (prev <= 1) {
      clearInterval(timer)
      return 0
    }
    return prev - 1
  })
}, 1000)
```

---

### 7. 登录后跳转问题
**问题**: 登录成功后没有自动跳转到主页

**用户反馈**: "登录成功...但是没有跳转主页，我刷新后回到登录页了"

**影响文件**:
- `apps/web/src/App.tsx`

**原因**:
- `handleLogin` 函数只在从 Settings 页面跳转时才导航
- 没有使用 `isAuthenticated` 状态来控制登录后的跳转

**解决方案**:
1. 修改 `handleLogin` 函数，添加默认跳转：
```typescript
const handleLogin = () => {
  navigate('/home')
}
```

2. 添加自动重定向逻辑：
```typescript
useEffect(() => {
  if (isAuthenticated && location.pathname === '/login') {
    navigate('/home', { replace: true })
  }
}, [isAuthenticated, location.pathname, navigate])
```

---

## 修复的文件列表

### 后端
- `apps/api/src/routers/auth.py` - 添加 datetime 导入，类型检查
- `apps/api/src/services/bilibili.py` - Cookie 处理类型检查，用户信息类型检查
- `apps/api/src/services/cookie_manager.py` - Cookie 加载类型检查

### 前端
- `apps/web/src/App.tsx` - 修复登录后跳转逻辑
- `apps/web/src/components/GeetestCaptcha.tsx` - 改为 props 接收参数
- `apps/web/src/pages/LoginPage.tsx` - 添加验证码倒计时
- `apps/web/src/services/api.ts` - 改进错误处理

---

## 经验教训

### 1. 类型安全
- Python 中不要假设 API 返回的数据类型
- 始终使用 `isinstance()` 进行类型检查
- 使用 `hasattr()` 检查对象属性是否存在

### 2. 错误处理
- 前端错误处理要提取详细的错误信息
- 支持多种错误格式（字符串、对象）
- 给用户显示友好的错误提示

### 3. 状态管理
- 登录成功后要正确更新认证状态
- 使用 `isAuthenticated` 状态控制路由访问
- 添加自动重定向逻辑改善用户体验

### 4. 组件设计
- 组件应该通过 props 接收参数，而不是内部获取
- 保持组件的纯粹性和可复用性

### 5. 用户体验
- 添加验证码倒计时，让用户知道何时可以重新发送
- 登录成功后自动跳转到主页
- 已登录用户访问登录页时自动重定向

---

## 测试建议

1. **短信验证码登录**
   - 发送验证码后检查倒计时
   - 输入验证码后检查登录成功
   - 检查登录后自动跳转到主页

2. **二维码登录**
   - 扫描二维码后检查登录状态
   - 确认登录后检查登录成功
   - 检查登录后自动跳转到主页

3. **账号切换**
   - 切换到其他账号
   - 检查用户信息更新
   - 检查自动跳转到主页

4. **错误处理**
   - 输入错误的验证码
   - 测试网络错误
   - 检查错误提示是否友好

---

## 相关文档

- [01-auth-solution.md](01-auth-solution.md) - 用户认证方案
- [11-auth-upgrade-plan.md](../todo/11-auth-upgrade-plan.md) - 认证升级计划
- [13-auth-upgrade-requirements.md](../todo/13-auth-upgrade-requirements.md) - 认证升级需求

---

## 更新记录

- 2026-04-01: 初始版本，记录登录问题修复