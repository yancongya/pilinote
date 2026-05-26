# Cookies 管理

Cookies 管理模块负责用户认证信息的持久化存储，支持多账号管理和自动刷新。

---
关联文档:
  - [login-flow.md](login-flow.md) - 登录流程
  - [multi-account.md](multi-account.md) - 多账号管理
  - [wbi-sign.md](wbi-sign.md) - WBI 签名
  - [../database/models.md](../database/models.md) - User 和 Cookie 模型
涉及文件:
  - `apps/api/src/models/user.py` - User 模型
  - `apps/api/src/models/cookie.py` - Cookie 模型
  - `apps/api/src/services/headers_manager.py` - Headers 管理
  - `apps/api/src/services/cookie_manager.py` - Cookie 管理
  - `apps/api/src/services/bilibili.py` - Bilibili 服务
  - `apps/api/src/services/account_refresh_service.py` - 账号刷新
依赖服务:
  - HeadersManager
  - CookieManager
  - AccountRefreshService
  - BilibiliService

---

## 数据流

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                         后端认证数据流                                                 │
│                                                                                     │
│  ┌──────────────┐     ┌───────────────┐     ┌──────────────┐     ┌───────────────┐     │
│  │  用户登录   │────▶│ BilibiliService│────▶│   Cookie    │────▶│   Database   │     │
│  │ (二维码/SMS)│     │               │     │   Manager   │     │              │     │
│  └──────────────┘     └───────────────┘     └──────┬──────┘     └───────┬─────┘     │
│                                                 │                   │            │
│                                                 │         ┌─────────┴────────┐   │
│                                                 │         │                  │   │
│                                          ┌──────▼──────┐◀─────cookies◀─────users  │
│                                          │  User 表   │                     │
│                                          │  mid      │                     │
│                                          │  username │                    │
│                                          │  avatar   │                    │
│                                          │  sessdata │                    │
│                                          │  is_active│                    │
│                                          └───────────┘                    │
└──────────────────────────────────────────────────────────────────────────────────────────
```

### 请求时的 Cookie 使用流程

```
前端请求
    │
    ▼
┌────────────────────────────┐
│ GET /api/favorites        │
│ GET /api/watch-later      │
└───────────┬──────────────┘
            │
            ▼
┌────────────────────────────────────────────┐
│ HeadersManager                              │
│ 1. sync_cookies_from_db(user_id)          │
│ 2. CookieManager.load_from_db(user_id)   │
│ 3. 设置 cookies 到 httpx.Client       │
└───────────┬────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────┐
│ Bilibili API (带 Cookie)                │
│ - Referer: https://www.bilibili.com    │
│ - Cookie: SESSDATA=xxx; bili_jct=xxx│
└────────────────────────────────────────────┘
```

### 使用已有认证信息测试 API

开发和联调时，优先复用当前项目数据库里的活跃账号认证信息，而不是手工重新登录。

#### 方式一：让后端自动带上登录态

如果后端从 `apps/api` 目录启动，默认会读取 `apps/api/data/pilinote.db`。`HeadersManager` 会在初始化时调用 `CookieManager.load_from_db(user_id)`，把当前活跃账号的 `SESSDATA`、`bili_jct` 等 cookie 注入请求头。

这样下面这些接口可以直接测试：

- `GET /api/auth/status`
- `GET /api/favorites/folders`
- `GET /api/watch-later/list`
- `GET /api/history/list`

#### 方式二：直接用 curl 复现认证请求

如果你想绕过后端服务层，直接测某个鉴权接口，可以先从数据库里取出 cookie，再手动拼接请求头：

```bash
cd apps/api

sqlite3 data/pilinote.db "select name || '=' || value
from cookies
where user_id = (select id from users where is_active = 1)
  and name in ('SESSDATA', 'bili_jct');"

curl -H 'Cookie: SESSDATA=...; bili_jct=...' \
  http://localhost:8000/api/auth/status
```

#### 方式三：在服务代码里复用

如果你写的是后端调试脚本或临时工具，优先直接调用：

```python
headers_manager = HeadersManager()
await headers_manager.sync_cookies_from_db(active_user_id)
headers = headers_manager.get_headers()
```

这样可以保证和正式下载、收藏夹、稍后再看、历史记录等流程使用同一套认证信息。

#### 与字幕下载联动

字幕下载也依赖同一套认证信息，尤其是官方 AI 字幕场景。当前实现会先通过活跃账号的登录态访问播放器接口，再读取 `subtitle.subtitles` 中的条目：

1. `CookieManager.load_from_db(user_id)` 从数据库读取 `SESSDATA`、`bili_jct`
2. `HeadersManager.sync_cookies_from_db(user_id)` 将 cookie 注入请求头
3. `BilibiliService` 调用播放器接口获取字幕元数据
4. `DownloadService` 过滤出带 `subtitle_url` 的条目
5. 字幕文件按 `<视频名>.<语言>.<来源>.srt` 落到视频目录

这条链路的结果是：

- 登录态有效时，可以正常下载官方 AI 双语字幕
- 只有字幕元数据但没有 `subtitle_url` 时，会提示“已检测到字幕，但不可下载”
- 如果登录态失效，播放器接口可能拿不到完整字幕列表，字幕下载会退化为无可下载条目

---

## 数据库存储

### users 表

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    mid = Column(Integer, unique=True, index=True, nullable=False)  # Bilibili 用户 ID
    username = Column(String(100), nullable=False)
    avatar = Column(String(500))
    sessdata = Column(Text, nullable=False)  # 登录凭证
    bili_jct = Column(Text)  # CSRF token
    dedeuserid = Column(Text)
    access_token = Column(Text)
    is_active = Column(Boolean, default=True)  # 当前活跃账号
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_refresh_time = Column(DateTime)  # 上次刷新时间
```

### cookies 表

```python
class Cookie(Base):
    __tablename__ = "cookies"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, index=True)  # 关联用户，支持多账号
    name = Column(String(100), index=True)  # Cookie 名称 (SESSDATA, bili_jct, refresh_token 等)
    value = Column(Text)  # Cookie 值
    domain = Column(String(200))  # 域名 (.bilibili.com)
    path = Column(String(200))  # 路径 (/)
    expires_at = Column(Integer)  # 过期时间戳
    created_at = Column(Integer, server_default=func.strftime('%s', 'now'))
    updated_at = Column(Integer, server_default=func.strftime('%s', 'now'), onupdate=func.strftime('%s', 'now'))
```

---

## CookieManager 服务

### 关键方法

```python
class CookieManager:
    """Cookie 管理器"""
    
    def __init__(self):
        self.refresh_token = None  # 刷新令牌
        self.expires_at = None  # 过期时间
        self.cookies = {}  # 内存中的 cookie
        self.client = httpx.Client()
    
    async def save_to_db(user_id: Optional[int] = None) -> Dict[str, Any]:
        """保存 cookie 到数据库"""
        # 1. 删除该用户的所有旧 cookie
        db.query(Cookie).filter(Cookie.user_id == user_id).delete()
        
        # 2. 保存新 cookie
        for name, value in self.cookies.items():
            cookie = Cookie(
                user_id=user_id,
                name=name,
                value=value,
                expires_at=int(self.expires_at.timestamp()) if self.expires_at else None
            )
            db.add(cookie)
        
        db.commit()
    
    async def load_from_db(user_id: Optional[int] = None) -> Dict[str, Any]:
        """从数据库加载 cookie"""
        # 查询 cookie
        cookies = db.query(Cookie).filter(Cookie.user_id == user_id).all()
        
        # 加载到内存
        for cookie in cookies:
            # 对 SESSDATA 和 bili_jct 进行 URL 解码
            if cookie.name in ["SESSDATA", "bili_jct"]:
                cookie_value = unquote(cookie.value)
            
            self.cookies[cookie.name] = cookie_value
        
        # 特殊处理 refresh_token
        if cookie.name == "refresh_token":
            self.refresh_token = cookie_value
            if cookie.expires_at:
                self.expires_at = datetime.fromtimestamp(cookie.expires_at)
    
    async def refresh_cookies(bili_csrf: str) -> Dict[str, Any]:
        """刷新 cookie"""
        # 1. 调用刷新 API
        # 2. 更新 cookie
        # 3. 确认刷新
        # 4. 保存到数据库
        ...
    
    async def clear_cookies() -> Dict[str, Any]:
        """清除所有 cookie"""
        # 清除内存和数据库中的 cookie
        ...
```

---

## 登录时的保存流程

### 二维码登录

```
POST /api/auth/qrcode/status/{qrcode_key}
    │
    ▼
1. 验证二维码登录成功
    │
    ▼
2. 检查/创建 User 记录
    db.query(User).filter(User.mid == mid).first()
    │
    ▼
3. 更新 User 表
    existing_user.sessdata = sessdata
    existing_user.username = username
    existing_user.is_active = True
    │
    ▼
4. (不保存 cookies 表，仅保存 sessdata)
```

### SESSDATA 登录

```
POST /api/auth/sessdata
Body: { "sessdata": "xxx" }
    │
    ▼
1. 调用 Bilibili API 验证 sessdata
    │
    ▼
2. 创建/更新 User 表
    │
    ▼
3. 保存 cookie 到数据库
    cookie_manager.save_to_db(user_id)
    │
    ▼
4. 同步 cookies 到 HeadersManager
    headers_manager.sync_cookies_from_db(user_id)
```

### 关键代码 (auth.py)

```python
@router.post("/sessdata", response_model=dict)
async def login_by_sessdata(request: SessdataLoginRequest, db: Session = Depends(get_db)):
    service = BilibiliService()
    
    # 验证登录
    result = await service.login_by_sessdata(request.sessdata)
    user_data = result["data"]
    mid = user_data["mid"]
    
    # 检查用户是否存在
    existing_user = db.query(User).filter(User.mid == mid).first()
    
    # 将所有用户设置为非活跃
    db.query(User).update({"is_active": False})
    
    if existing_user:
        # 更新现有用户
        existing_user.sessdata = user_data["sessdata"]
        existing_user.username = user_data["username"]
        existing_user.is_active = True
        user_id = existing_user.id
    else:
        # 创建新用户
        new_user = User(...)
        db.add(new_user)
        user_id = new_user.id
    
    # 保存所有 cookie 到数据库
    cookies_dict = service.headers_manager.cookie_manager.get_cookies()
    save_result = await service.headers_manager.cookie_manager.save_to_db(user_id)
    
    # 同步到 HeadersManager
    headers_manager = get_headers_manager()
    await headers_manager.sync_cookies_from_db(user_id)
```

---

## 获取登录状态

### API: GET /api/auth/status

```
GET /api/auth/status
```

响应：
```json
{
    "success": true,
    "data": {
        "is_logged_in": true,
        "message": "已登录",
        "user": {
            "id": 1,
            "mid": 12345678,
            "username": "用户名",
            "avatar": "https://..."
        }
    }
}
```

### 实现逻辑

```python
@router.get("/status")
async def get_login_status(db: Session = Depends(get_db)):
    # 1. 查找活跃用户
    active_user = db.query(User).filter(User.is_active == True).first()
    
    if not active_user:
        return { "is_logged_in": False, "message": "未登录" }
    
    # 2. 同步 cookies 到内存
    headers_manager = get_headers_manager()
    await headers_manager.sync_cookies_from_db(active_user.id)
    
    # 3. 检查 cookie 有效性
    cookies_dict = headers_manager.cookie_manager.get_cookies()
    has_sessdata = "SESSDATA" in cookies_dict
    
    if not has_sessdata:
        return { "is_logged_in": False, "message": "Cookie已失效", "user": {...} }
    
    # 4. 调用 Bilibili API 验证
    user_info = await service.get_user_info(cookies_dict["SESSDATA"])
    
    if not user_info.get("success"):
        return { "is_logged_in": False, "message": "登录已失效", "user": {...} }
    
    return { "is_logged_in": True, "message": "已登录", "user": {...} }
```

---

## 账号刷新端点

### POST /api/auth/accounts/refresh

刷新指定账号的 Cookie、SESSDATA、WBI 等数据，并更新用户信息。

**支持的参数格式**：

1. **查询参数**（推荐）：
```bash
POST /api/auth/accounts/refresh?account_id=1
```

2. **路径参数**（兼容）：
```bash
POST /api/auth/accounts/1/refresh
```

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `account_id` | int | 是 | 账号 ID（查询参数或路径参数） |

**响应**：
```json
{
  "success": true,
  "message": "账号刷新成功: 用户名",
  "data": {
    "mid": 100881808,
    "username": "用户名",
    "avatar": "https://...",
    "last_refresh_time": "2026-04-14T14:24:36.389728",
    "user_info": {
      "isLogin": true,
      "level_info": {...},
      ...
    }
  }
}
```

**功能说明**：
- 刷新账号的 cookie（包括 SESSDATA、bili_jct 等）
- 刷新 SESSDATA
- 刷新 WBI 签名
- 更新用户信息（用户名、头像等）
- 保存到数据库
- 更新刷新时间

---

## 自动刷新机制

### AccountRefreshService

```python
class AccountRefreshService:
    """账号刷新服务"""
    
    async def refresh_account(user_id: int):
        """刷新单个账号的 cookie"""
        # 1. 加载 cookies
        await cookie_manager.load_from_db(user_id)
        
        # 2. 检查是否需要刷新
        if cookie_manager.should_refresh():
            # 3. 刷新 cookie
            result = await cookie_manager.refresh_cookies(bili_csrf)
            
            # 4. 保存到数据库
            if result["success"]:
                await cookie_manager.save_to_db(user_id)
        
        # 5. 更新 User 表
        user = db.query(User).filter(User.id == user_id).first()
        user.last_refresh_time = datetime.now()
        db.commit()
```

### 启动刷新服务

```
POST /api/auth/accounts/refresh/start?interval=3600
```

---

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/status` | 获取登录状态 |
| POST | `/api/auth/refresh/cookies` | 刷新 cookie |
| POST | `/api/auth/refresh-cookie` | 刷新 cookie（旧）|
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/accounts` | 获取账号列表 |
| POST | `/api/auth/accounts/switch` | 切换账号 |
| POST | `/api/auth/accounts/refresh` | 刷新账号（支持查询参数和路径参数） |
| POST | `/api/auth/accounts/refresh/start` | 启动刷新服务 |
| POST | `/api/auth/accounts/refresh/stop` | 停止刷新服务 |
| GET | `/api/auth/accounts/refresh/status` | 获取刷新服务状态 |

---

## 关键文件

### 后端

| 文件 | 说明 |
|------|------|
| `apps/api/src/models/user.py` | User 模型 |
| `apps/api/src/models/cookie.py` | Cookie 模型 |
| `apps/api/src/services/cookie_manager.py` | Cookie 管理服务 |
| `apps/api/src/services/headers_manager.py` | Headers 管理 |
| `apps/api/src/services/bilibili.py` | Bilibili 服务 |
| `apps/api/src/services/account_refresh_service.py` | 账号刷新服务 |
| `apps/api/src/routers/auth.py` | 认证路由 |

---

[返回上级](./README.md)
