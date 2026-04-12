# 后端实现

## 项目结构

```
apps/api/src/
├── routers/          # API 路由
│   ├── auth.py          # 认证
│   ├── favorites.py    # 收藏夹
│   ├── watchlater.py  # 稍后再看
│   ├── settings.py   # 设置
│   └── queue.py     # 下载队列
├── services/         # 业务逻辑
│   ├── bilibili.py           # Bilibili API
│   ├── download_service.py  # 下载服务
│   ├── settings_service.py # 设置服务
│   ├── scheduler_service.py # 调度服务
│   ├── cookie_manager.py # Cookie 管理
│   └── headers_manager.py # 请求头管理
├── models/           # SQLAlchemy 模型
│   ├── user.py       # 用户
│   ├── cookie.py   # Cookie
│   ├── download.py # 下载任务
│   └── setting.py # 设置
├── schemas/          # Pydantic 模型
└── utils/           # 工具函数
```

## API 路由

### 认证路由 (`/api/auth`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/init` | 初始化指纹 |
| GET | `/qrcode` | 获取二维码 |
| GET | `/qrcode/status/{key}` | 查询二维码状态 |
| POST | `/sessdata` | SESSDATA 登录 |
| GET | `/status` | 获取登录状态 |
| POST | `/logout` | 登出 |
| GET | `/accounts` | 账号列表 |
| POST | `/accounts/switch` | 切换账号 |
| POST | `/accounts/refresh` | 刷新账号 |

### 视频源路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/favorites` | 收藏夹列表 |
| GET | `/api/favorites/folders` | 收藏夹文件夹 |
| GET | `/api/watchlater` | 稍后再看 |

### 下载路由 (`/api/queue`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 获取队列 |
| POST | `/add` | 添加任务 |
| DELETE | `/{id}` | 删除任务 |
| POST | `/{id}/control` | 控制任务 |

### 设置路由 (`/api/settings`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 获取设置 |
| PUT | `/` | 更新设置 |
| GET | `/tool-status` | 工具状态 |

## 核心服务

### BilibiliService

负责与 Bilibili API 交互：

```python
class BilibiliService:
    async def init(self):
        """初始化指纹系统"""
        
    async def get_qrcode(self):
        """获取登录二维码"""
        
    async def login_by_sessdata(self, sessdata: str):
        """SESSDATA 登录"""
        
    async def get_favorites(self, pn: int, ps: int):
        """获取收藏夹"""
        
    async def get_watchlater(self, pn: int, ps: int):
        """获取稍后再看"""
        
    async def get_video_info(self, bvid: str):
        """获取视频信息"""
```

### DownloadService

负责下载任务管理：

```python
class DownloadService:
    def add_task(self, media_id: str, quality: int):
        """添加下载任务"""
        
    async def start_download(self, task_id: str):
        """开始下载"""
        
    async def cancel_download(self, task_id: str):
        """取消下载"""
```

### SettingsService

负责设置管理：

```python
class SettingsService:
    def get_settings(self) -> Settings:
        """获取所有设置"""
        
    def update_settings(self, settings_dict: dict) -> bool:
        """更新设置"""
        
    def reset_settings(self, category: str) -> bool:
        """重置设置"""
```

### SchedulerService

负责定时任务：

```python
class SchedulerService:
    async def start_auto_download(self, settings):
        """启动自动下载"""
        
    async def scan_favorites(self):
        """扫描收藏夹"""
        
    async def scan_watchlater(self):
        """扫描稍后再看"""
```

## 中间件

### HeadersManager

请求头管理：

```python
class HeadersManager:
    def __init__(self):
        self.headers = {}
        self.cookie_manager = CookieManager()
        
    async def sync_cookies_from_db(self, user_id: int):
        """从数据库同步 cookies"""
        
    def get_headers(self):
        """获取请求头"""
```

## 数据库模型

### User

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    mid = Column(Integer, unique=True)
    username = Column(String(100))
    sessdata = Column(Text)
    is_active = Column(Boolean)
```

### Cookie

```python
class Cookie(Base):
    __tablename__ = "cookies"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    name = Column(String(100))
    value = Column(Text)
```

## WebSocket

实时下载进度推送：

```python
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    while True:
        data = await websocket.receive_text()
        progress = json.loads(data)
        await websocket.send_json(progress)
```

## 启动配置

```python
# main.py
app = FastAPI()

app.include_router(auth.router)
app.include_router(favorites.router)
app.include_router(settings.router)
app.include_router(queue.router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## 关联文档

- [web/implementation.md](../web/implementation.md) - 前端实现
- [database/models.md](../database/models.md) - 数据模型

---

[返回上级](../README.md)