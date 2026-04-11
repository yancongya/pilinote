# Cookies 管理

---
关联文档:
  - login-flow.md       # 登录流程
  - database/models.md  # User 模型
  - wbi-sign.md        # WBI 签名
  - ../video-sources/favorites.md   # 验证 Cookie 有效
  - ../video-sources/watchlater.md # 验证 Cookie 有效
涉及文件:
  - apps/api/src/models/user.py
  - apps/api/src/services/headers_manager.py
  - apps/api/src/services/cookie_manager.py
  - apps/api/src/services/account_refresh_service.py
依赖服务:
  - HeadersManager
  - CookieManager
  - AccountRefreshService
---

## 存储结构

### 数据库表: users

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    mid = Column(Integer, unique=True)      # Bilibili 用户 ID
    username = Column(String(100))        # 用户名
    avatar = Column(String(500))         # 头像 URL
    sessdata = Column(Text)             # 登录凭证
    bili_jct = Column(Text)            # CSRF token
    dedeuserid = Column(Integer)         # 用户 ID
    access_token = Column(Text)           # 访问令牌
    is_active = Column(Boolean)         # 是否活跃账号
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    last_refresh_time = Column(DateTime) # 上次刷新时间
```

## 加载流程

### 启动时加载

```
1. 服务器启动
2. HeadersManager 初始化
3. 从数据库加载所有活跃账号的 cookies
4. 加载到内存供请求使用
```

**关键文件**：
- `apps/api/src/services/headers_manager.py` - 请求头管理
- `apps/api/src/services/cookie_manager.py` - Cookie 管理

### 请求时加载

```
1. 前端请求 /api/favorites
2. 后端调用 sync_cookies_from_db()
3. 从数据库获取当前活跃账号的 cookies
4. 设置到请求头
5. 发起 Bilibili API 请求
```

## 刷新机制

### 自动刷新

```
1. AccountRefreshService 定时运行
2. 检查所有活跃账号的 last_refresh_time
3. 调用 Bilibili API 刷新 cookies
4. 更新数据库
```

**关键文件**：
- `apps/api/src/services/account_refresh_service.py` - 账号刷新服务
- `apps/api/src/routers/auth.py` - `/api/auth/accounts/refresh/start`

### 手动刷新

```
1. 前端调用 refreshAccount(accountId)
2. 后端调用刷新接口
3. 更新数据库
```

### 刷新流程详解

```
POST /api/auth/accounts/refresh
    ↓
1. 查找目标账号 (User)
    ↓
2. 初始化 BilibiliService
    ↓
3. 设置 SESSDATA 到 HeadersManager
    ↓
4. 调用 check_and_refresh_cookies() 刷新
    ↓
5. 访问 www.bilibili.com 获取 cookies
    ↓
6. 访问 nav 接口获取用户信息
    ↓
7. 更新 User 表 (bili_jct, dedeuserid 等)
    ↓
8. CookieManager.save_to_db() 保存到 Cookie 表
    ↓
9. 返回刷新结果
```

---

## Cookie 表结构

### 数据库表: cookies

```python
class Cookie(Base):
    __tablename__ = "cookies"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(100))      # Cookie 名称
    value = Column(Text)          # Cookie 值
    domain = Column(String(100))   # 域名
    path = Column(String(100))    # 路径
    expires = Column(DateTime)   # 过期时间
```

---

## HeadersManager 结构

```
HeadersManager
├── CookieManager          # Cookie 管理
│   ├── load_from_db()   # 从数据库加载
│   ├── save_to_db()    # 保存到数据库
│   └── get_cookies()   # 获取所有 Cookie
│
├── get_headers()        # 获取请求头
└── refresh()           # 刷新请求头
```

---

[返回上级](./README.md)