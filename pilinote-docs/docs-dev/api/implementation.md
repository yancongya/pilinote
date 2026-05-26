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
| GET | `/api/watch-later` | 稍后再看 |

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

### 字幕下载链路

字幕下载由下载服务和队列子任务共同完成，核心行为与 `Pilipala` 的字幕处理方式一致：

1. 通过播放器接口获取 `subtitle.subtitles`
2. 过滤出实际存在 `subtitle_url` 的条目
3. 仅保留中英双语字幕：
   - `ai-zh` / `zh-CN` / `zh-Hans` 统一按中文处理
   - `ai-en` / `en-US` 统一按英文处理
4. 将字幕 JSON 转成 `.srt`
5. 写入视频目录同级位置

### 字幕下载结果判定

- `downloaded > 0`：至少有一个字幕文件成功落盘
- `downloadable > 0`：存在可下载字幕
- `skipped_no_url > 0`：接口返回了字幕记录，但没有可下载地址

### 调试建议

如果字幕没有落盘，优先检查：

- 播放器接口是否返回 `subtitle.subtitles`
- 每个字幕条目是否有 `subtitle_url`
- 当前账号是否带有有效登录态
- 任务是否走到了字幕子任务处理器

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

### 本地鉴权测试说明

后端启动后会优先从 `apps/api/data/pilinote.db` 读取当前活跃账号的认证信息。开发联调时，测试需要登录态的接口可以直接复用这份数据，不需要重新扫码登录。

常用的验证路径：

- `GET /api/auth/status`
- `GET /api/favorites/folders`
- `GET /api/watch-later/list`
- `GET /api/history/list`

如果要在脚本里显式复用登录态，优先调用 `HeadersManager.sync_cookies_from_db(user_id)`，不要手写复制一份 Cookie 逻辑。

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

## 搜索和排序功能实现

### 稍后再看页搜索排序

**API端点**: `GET /api/watch-later/list`

**实现流程**:
1. 获取用户SESSDATA，调用B站API获取全部数据（ps=1000）
2. 使用统一转换器转换数据格式
3. 对全部数据进行搜索过滤（keyword）
4. 对全部数据进行排序（order + sort_direction）
5. 手动分页返回结果

**代码实现** (`apps/api/src/routers/watchlater.py`):
```python
# 获取全部数据
result = await service.get_watch_later(sessdata)
video_list = transformer.transform_watchlater_list(data)

# 搜索过滤
if keyword:
    video_list = [video for video in video_list if keyword.lower() in video.title.lower()]

# 排序处理
if order and order != "default":
    reverse = sort_direction == "desc"
    if order == "view":
        video_list = sorted(video_list, key=lambda x: x.view or 0, reverse=reverse)
    elif order == "pubtime":
        video_list = sorted(video_list, key=lambda x: x.pubtime or 0, reverse=reverse)
    elif order == "add_time":
        video_list = sorted(video_list, key=lambda x: x.add_time or 0, reverse=reverse)

# 分页处理
start_idx = (pn - 1) * ps
end_idx = start_idx + ps
paginated_list = video_list[start_idx:end_idx]
```

### 收藏页搜索排序

**API端点**: `GET /api/favorites/folders/{folder_id}`

**实现流程**:
1. 直接获取请求的页面数据（简单分页）
2. 优化错误提示，对B站API限制等情况提供友好提示
3. 使用统一转换器转换当前页数据
4. **并发获取视频详细信息**：为每个视频异步获取完整统计数据
5. **性能优化**：使用信号量限制并发数为3，平衡速度和系统负载
6. 直接返回请求页面的数据和总数
7. 支持搜索、排序等功能（由B站API原生支持）

**性能优化方案**:
- **并发限制**：使用 `asyncio.Semaphore(3)` 限制并发数为3
- **异步处理**：使用 `asyncio.gather()` 并发处理视频详情获取
- **智能缓存**：视频详情信息优先从缓存获取，减少B站API调用
- **异常隔离**：单个视频获取失败不影响其他视频的加载
- **速度提升**：10个视频从10次串行调用优化为4批次并发调用，速度提升约2.5倍

**代码实现** (`apps/api/src/routers/favorites.py`):
```python
# 直接获取请求的页面数据（简单分页）
result = await service.get_folder_detail(
    sessdata, 
    folder_id, 
    page=page, 
    page_size=page_size,
    keyword=keyword, 
    order=order, 
    type=type,
    tid=tid,
    sort_direction=sort_direction
)

if not result["success"]:
    # 优化错误提示，特别是针对B站API限制
    error_msg = result.get("message", "获取收藏夹详情失败")
    if "request was banned" in error_msg or "412" in error_msg:
        error_msg = "请求频率过高，请稍后再试"
    elif "400" in error_msg:
        error_msg = "B站API暂时限制访问，请稍后再试"
    raise HTTPException(status_code=200, detail={
        "success": False,
        "message": error_msg
    })

data = result["data"]
medias = data.get("medias", [])
info = data.get("info", {})

# 使用统一转换器转换当前页数据
video_list = transformer.transform_favorite_list(medias)

# 转换为字典格式（保持向后兼容）
list_data = [card.model_dump() for card in video_list]

# 异步获取视频详情，限制并发数为3以提高响应速度
import asyncio
cache_service = VideoCacheService()

async def enrich_video_data(video):
    """为单个视频补充评论数和分享数"""
    bvid = video.get("bvid", "")
    if not bvid:
        return video
    
    try:
        # 从缓存或API获取视频详情
        video_info = await cache_service.get_video_info(bvid, sessdata)
        if video_info.get("success") and video_info.get("data"):
            stat = video_info["data"].get("stat", {})
            # 补充评论数和分享数
            if stat.get("reply", 0) > 0:
                video["comment"] = stat["reply"]
                video["stats"]["comment"] = stat["reply"]
            if stat.get("share", 0) > 0:
                video["share"] = stat["share"]
                video["stats"]["share"] = stat["share"]
    except Exception as e:
        # 如果获取视频信息失败，使用默认值0，不影响其他视频
        logger.warning(f"获取视频详情失败: {bvid}, 错误: {e}")
    
    return video

# 使用并发限制，最多同时获取3个视频的详细信息
semaphore = asyncio.Semaphore(3)

async def enrich_with_semaphore(video):
    async with semaphore:
        return await enrich_video_data(video)

# 并发获取所有视频的详细信息
enriched_list = await asyncio.gather(
    *[enrich_with_semaphore(video) for video in list_data],
    return_exceptions=True
)

# 过滤掉异常结果
list_data = [video for video in enriched_list if isinstance(video, dict)]
```
list_data = [card.model_dump() for card in video_list]

return CardListResponse(
    success=True,
    data={
        "medias": list_data,
        "page": page,
        "page_size": page_size,
        "info": info
    },
    total=info.get("media_count", 0)
)
```

### 数据转换

**统一转换器** (`apps/api/src/services/media_data_transformer.py`):

**稍后再看视频转换**:
```python
def transform_watchlater_video(raw_video: Dict[str, Any]) -> CardData:
    return CardData(
        id=raw_video.get("id", 0),
        bvid=raw_video.get("bvid", ""),
        title=raw_video.get("title", ""),
        pubtime=raw_video.get("pubdate", raw_video.get("pubtime", 0)),  # 修复字段映射
        add_time=raw_video.get("add_time", 0),  # 添加时间
        # ... 其他字段
    )
```

**收藏夹视频转换**:
```python
def transform_favorite_video(raw_media: Dict[str, Any]) -> CardData:
    return CardData(
        id=raw_media.get("id", 0),
        bvid=raw_media.get("bvid", ""),
        title=raw_media.get("title", ""),
        pubtime=raw_media.get("pubtime", 0),
        add_time=raw_media.get("fav_time", 0),  # 收藏时间
        # ... 其他字段
    )
```

### 前端组件集成

**VideoListControls组件** (`apps/web/src/components/VideoListControls.tsx`):

```typescript
interface VideoListControlsProps {
  keyword: string
  order: string
  sortDirection: 'desc' | 'asc'
  onKeywordChange: (keyword: string) => void
  onOrderChange: (order: string) => void
  onSortDirectionChange: (direction: 'desc' | 'asc') => void
  sortOptions: { value: string; label: string }[]
}
```

**集成到页面**:
```typescript
// WatchLaterContent.tsx
const [keyword, setKeyword] = useState<string>('')
const [order, setOrder] = useState<string>('default')
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

<VideoListControls
  keyword={keyword}
  order={order}
  sortDirection={sortDirection}
  onKeywordChange={setKeyword}
  onOrderChange={setOrder}
  onSortDirectionChange={setSortDirection}
  sortOptions={[
    { value: 'default', label: '默认' },
    { value: 'view', label: '按播放量' },
    { value: 'pubtime', label: '按发布时间' },
    { value: 'add_time', label: '按添加时间' }
  ]}
/>
```

### 性能优化考虑

1. **稍后再看页**
   - 一次性获取全部数据（ps=1000）
   - 在内存中进行搜索和排序
   - 响应速度快

2. **收藏页**
   - 多次API调用获取全部数据
   - 可能遇到B站API频率限制
   - 需要优化（见下方"待优化项"）

### 已完成的优化

1. **✅ 缓存机制**
   - 实现多层缓存（内存+数据库）
   - 视频详情信息优先从缓存获取
   - 1小时TTL，大幅减少B站API调用

2. **✅ 性能优化**
   - 并发限制优化（限制并发数为3）
   - 异步处理提升响应速度（约2.5倍）
   - 异常隔离，单个失败不影响整体

3. **✅ 用户体验**
   - 优化错误提示，提供友好信息
   - 实现快速响应，避免长时间加载
   - 搜索和排序功能完善

### 待优化项

1. **API频率限制**
   - 添加请求间隔限制（如需要）
   - 进一步优化数据获取策略

2. **进一步性能优化**
   - 添加搜索防抖
   - 实现更细粒度的懒加载
   - 优化排序算法

3. **用户体验增强**
   - 添加加载状态提示
   - 添加搜索历史记录
   - 优化错误处理和重试机制

---

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
