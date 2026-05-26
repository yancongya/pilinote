# 账号设置

账号设置模块管理系统多账号支持，包括账号列表、切换、刷新等功能。

> **注意**: 此页面位于 `设置 > 账号` Tab

## 配置项

| 键 | 说明 | 默认值 |
|----|------|-------|
| 无 | 通过 API 管理 | - |

## 功能模块

### 1. 账号列表

显示所有已登录账号，支持多账号管理：

```typescript
interface Account {
  id: number        // 账号ID
  mid: number       // Bilibili 用户ID
  username: string // 用户名
  avatar: string   // 头像URL
  is_active: boolean  // 是否当前活跃账号
  created_at: string  // 创建时间
  last_refresh_time?: string  // 上次刷新时间
}
```

### 2. 账号操作

| 操作 | 说明 | API |
|------|------|-----|
| 查看凭据 | 获取账号详细 Cookie 信息 | GET /api/auth/accounts/{id}/credentials |
| 切换账号 | 切换当前活跃账号 | POST /api/auth/accounts/switch |
| 刷新账号 | 手动刷新Cookie | POST /api/auth/accounts/{id}/refresh |
| 删除账号 | 删除账号及其Cookie | DELETE /api/auth/accounts/{id} |

### 3. Cookie 查看

查看账号的详细 Cookie 信息：

```typescript
interface CredentialsData {
  mid: number                    // 用户ID
  username: string             // 用户名
  sessdata: string            // 登录凭证
  bili_jct?: string          // CSRF token
  dedeuserid?: string        // 用户ID
  access_token?: string     // 访问令牌
  cookies_count: number    // Cookie数量
  cookies: Record<string, string>  // Cookie详情
  wbi: {                     // WBI签名信息
    img_url?: string
    sub_url?: string
  }
}
```

### 4. WBI 签名

WBI (Wrapped Build Interface) 是 Bilibili 的签名机制：

- 用于加密请求参数
- 需要 img_url 和 sub_url 生成签名
- 签名有效期约 6 小时

### 5. 自动刷新服务

定时自动刷新账号 Cookie：

```
POST /api/auth/accounts/refresh/start?interval=3600
```

| 参数 | 说明 | 默认值 |
|------|------|-------|
| interval | 刷新间隔（秒）| 3600 |

## API 详情

### 获取账号列表

```
GET /api/auth/accounts
```

响应：
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": 1,
        "mid": 12345678,
        "username": "用户名",
        "avatar": "https://...",
        "is_active": true,
        "created_at": "2026-01-01T00:00:00",
        "last_refresh_time": "2026-04-12T00:00:00"
      }
    ],
    "total": 1
  }
}
```

### 获取凭据

```
GET /api/auth/accounts/{id}/credentials
```

响应：
```json
{
  "success": true,
  "data": {
    "mid": 12345678,
    "username": "用户名",
    "sessdata": "xxx",
    "cookies_count": 5
  }
}
```

### 切换账号

```
POST /api/auth/accounts/switch?account_id=1
```

响应：
```json
{
  "success": true,
  "message": "切换成功"
}
```

### 刷新账号

```
POST /api/auth/accounts/1/refresh
```

> 说明：后端同时支持查询参数和路径参数两种格式，但前端刷新按钮现在优先使用路径参数版本，和账号 ID 的关联更清晰。

### 刷新实现说明

账号刷新会先把目标账号的 Cookie 从数据库同步到内存，再刷新 `HeadersManager`，避免把当前活跃账号的 Cookie 错刷到别的账号上。

响应：
```json
{
  "success": true,
  "message": "刷新成功",
  "data": {
    "refreshed": true,
    "new_cookies": [...]
  }
}
```

### 删除账号

```
DELETE /api/auth/accounts/{id}
```

响应：
```json
{
  "success": true,
  "message": "账号已删除"
}
```

### 启动自动刷新

```
POST /api/auth/accounts/refresh/start?interval=3600
```

响应：
```json
{
  "success": true,
  "message": "刷新服务已启动"
}
```

### 获取刷新状态

```
GET /api/auth/accounts/refresh/status
```

响应：
```json
{
  "success": true,
  "data": {
    "running": true,
    "interval": 3600,
    "last_run": "2026-04-12T10:00:00"
  }
}
```

### 停止刷新

```
POST /api/auth/accounts/refresh/stop
```

## 数据存储

### users 表

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    mid = Column(Integer, unique=True)
    username = Column(String(100))
    avatar = Column(String(500))
    sessdata = Column(Text)
    bili_jct = Column(Text)
    dedeuserid = Column(Text)
    is_active = Column(Boolean)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    last_refresh_time = Column(DateTime)
```

### cookies 表

```python
class Cookie(Base):
    __tablename__ = "cookies"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(100))
    value = Column(Text)
    expires_at = Column(Integer)
```

## 关联文档

- [auth/multi-account.md](../auth/multi-account.md) - 多账号管理
- [auth/cookies.md](../auth/cookies.md) - Cookie 详情

---

[返回上级](./README.md)
