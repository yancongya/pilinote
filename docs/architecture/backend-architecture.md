# 后端架构文档

## API 结构

PiliNote 后端采用 FastAPI 框架，提供 RESTful API 和 WebSocket 实时通信服务。

### 项目结构
```
apps/api/src/
├── routers/            # API 路由
│   ├── auth.py         # 认证路由
│   ├── media.py        # 媒体路由
│   ├── queue.py        # 队列路由
│   ├── auto_download.py # 自动下载路由
│   └── websocket.py    # WebSocket 路由
├── services/           # 业务逻辑
│   ├── queue/          # 队列服务
│   │   └── manager.py  # 队列管理器
│   ├── scan_service.py # 扫描服务
│   ├── download_service.py # 下载服务
│   ├── bilibili.py     # B站 API 服务
│   └── settings_service.py # 设置服务
├── models/             # 数据模型
│   ├── user.py         # 用户模型
│   ├── task.py         # 任务模型
│   ├── scheduler.py    # 调度器模型
│   ├── download.py     # 下载记录模型
│   └── setting.py      # 设置模型
├── schemas/            # Pydantic 模型
│   ├── user.py         # 用户 Schema
│   ├── task.py         # 任务 Schema
│   └── scheduler.py    # 调度器 Schema
├── dependencies/       # 依赖注入
│   ├── auth.py         # 认证依赖
│   └── database.py     # 数据库依赖
└── main.py             # 应用入口
```

## WebSocket 通信

### 连接管理器
```python
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)
```

### 事件类型
```python
# 任务事件
task_created = {"type": "taskCreated", "data": task_dict}
task_updated = {"type": "taskUpdated", "data": task_dict}
progress_update = {"type": "progress", "data": {"task_id": task_id, "progress": progress}}

# 调度器事件
scheduler_updated = {"type": "schedulerUpdated", "data": scheduler_dict}
scheduler_deleted = {"type": "schedulerDeleted", "data": {"scheduler_id": scheduler_id}}

# 队列事件
queue_updated = {"type": "queueUpdated", "data": queue_dict}
```

## 服务层

### 队列管理器 (queue/manager.py)

#### 四级队列系统
```python
class QueueType(IntEnum):
    BACKLOG = 0   # 待处理队列
    PENDING = 1   # 等待队列
    DOING = 2     # 执行队列
    COMPLETE = 3  # 完成队列
```

#### 并发控制
```python
# 最大并发下载任务数
MAX_CONCURRENT_DOWNLOADS = 3

# 信号量控制并发
semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)

async def process_task(task_id: str):
    async with semaphore:
        # 执行下载任务
        await download_service.process(task_id)
```

#### 任务生命周期
```
BACKLOG → PENDING → DOING → COMPLETED
  ↓         ↓        ↓         ↓
待处理   等待中    执行中    已完成
```

### 扫描服务 (scan_service.py)

#### 收藏夹扫描
```python
async def scan_favorites(user_mid: str, sessdata: str) -> ScanResult:
    """扫描用户收藏夹"""
    folders = await bilibili_service.get_favorites_list(user_mid, sessdata)
    
    total_videos = 0
    new_videos = []
    
    for folder in folders:
        videos = await bilibili_service.get_folder_detail(
            folder['media_id'], 
            sessdata
        )
        
        for video in videos:
            if is_new_video(video):
                new_videos.append(video)
        
        total_videos += len(videos)
    
    return ScanResult(
        total=total_videos,
        new=len(new_videos),
        videos=new_videos
    )
```

### 下载服务 (download_service.py)

#### NFO 文件生成
```python
def _generate_nfo_file(self, download: Download, video_dir: Path):
    """生成 NFO 文件"""
    root = ET.Element("movie")
    
    # 基本信息
    ET.SubElement(root, "title").text = download.title
    ET.SubElement(root, "plot").text = download.description or f"B站视频ID: {download.bvid}"
    ET.SubElement(root, "thumb").text = download.thumbnail_url or ""
    ET.SubElement(root, "premiered").text = download.pub_date
    ET.SubElement(root, "studio").text = download.uploader
    ET.SubElement(root, "director").text = download.uploader
    ET.SubElement(root, "runtime").text = str(download.duration)
    
    # B站统计数据
    stats = ET.SubElement(root, "bilibili_stat")
    ET.SubElement(stats, "play").text = str(download.play_count or 0)
    ET.SubElement(stats, "like").text = str(download.like_count or 0)
    ET.SubElement(stats, "coin").text = str(download.coin_count or 0)
    ET.SubElement(stats, "favorite").text = str(download.favorite_count or 0)
    
    tree = ET.ElementTree(root)
    tree.write(nfo_file, encoding="utf-8", xml_declaration=True)
```

### B站服务 (bilibili.py)

#### 视频信息获取
```python
async def get_video_info(self, bvid: str, sessdata: str = "") -> Dict:
    """获取视频信息（使用 HTML 解析方法）"""
    url = f"https://www.bilibili.com/video/{bvid}"
    headers = {
        "User-Agent": self.user_agent,
        "Cookie": f"SESSDATA={sessdata}" if sessdata else ""
    }
    
    response = await httpx.get(url, headers=headers)
    html = response.text
    
    # 从 __INITIAL_STATE__ 提取数据
    pattern = r'__INITIAL_STATE__\s*=\s*({.+?});'
    match = re.search(pattern, html)
    
    if match:
        initial_state = json.loads(match.group(1))
        video_data = initial_state.get('videoData', {})
        
        return {
            'title': video_data.get('title'),
            'desc': video_data.get('desc'),
            'pic': video_data.get('pic'),
            'owner': video_data.get('owner'),
            'stat': video_data.get('stat'),
            'pubdate': video_data.get('pubdate')
        }
```

## 数据库交互

### 数据库依赖
```python
def get_db():
    """数据库会话依赖"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### 事务管理
```python
async def create_download_task(download_data: DownloadCreate, db: Session):
    """创建下载任务（使用事务）"""
    try:
        # 创建任务记录
        download = Download(**download_data.dict())
        db.add(download)
        db.commit()
        db.refresh(download)
        
        return download
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
```

## API 路由设计

### 统一响应格式
```python
class ApiResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    data: Optional[Any] = None
    code: Optional[int] = None
```

### 媒体 API
```python
@router.get("/media/{media_type}/{media_id}")
async def get_media_info(
    media_type: str,
    media_id: str,
    db: Session = Depends(get_db)
):
    """获取媒体信息"""
    media_service = MediaService(db)
    media_info = await media_service.get_media(media_type, media_id)
    
    return ApiResponse(
        success=True,
        data=media_info
    )
```

### 队列 API
```python
@router.post("/queue/tasks")
async def submit_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db)
):
    """提交下载任务"""
    queue_manager = get_queue_manager()
    task = await queue_manager.submit_task(task_data)
    
    return ApiResponse(
        success=True,
        message="任务提交成功",
        data=task
    )

@router.get("/queue/tasks")
async def get_tasks():
    """获取任务列表"""
    queue_manager = get_queue_manager()
    tasks = queue_manager.get_all_tasks()
    
    return ApiResponse(
        success=True,
        data=tasks
    )
```

### 调度器 API
```python
@router.post("/queue/schedulers")
async def create_scheduler(
    scheduler_data: SchedulerCreate,
    db: Session = Depends(get_db)
):
    """创建调度器"""
    queue_manager = get_queue_manager()
    scheduler = await queue_manager.create_scheduler(scheduler_data)
    
    return ApiResponse(
        success=True,
        message="调度器创建成功",
        data=scheduler
    )

@router.post("/queue/schedulers/{scheduler_id}/start")
async def start_scheduler(scheduler_id: str):
    """启动调度器"""
    queue_manager = get_queue_manager()
    await queue_manager.start_scheduler(scheduler_id)
    
    return ApiResponse(
        success=True,
        message="调度器启动成功"
    )
```

## 错误处理

### 异常分类
```python
class PiliNoteException(Exception):
    """基础异常"""
    pass

class AuthenticationError(PiliNoteException):
    """认证错误"""
    pass

class TaskNotFoundError(PiliNoteException):
    """任务不存在错误"""
    pass

class DownloadError(PiliNoteException):
    """下载错误"""
    pass
```

### 错误处理器
```python
@app.exception_handler(PiliNoteException)
async def pilinote_exception_handler(request: Request, exc: PiliNoteException):
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "message": str(exc),
            "code": getattr(exc, "code", 400)
        }
    )
```

## 性能优化

### 1. 异步编程
- 使用 async/await 处理 I/O 操作
- 并发处理多个任务
- 异步 HTTP 客户端

### 2. 缓存系统
```python
class CacheService:
    def __init__(self):
        self.memory_cache: Dict[str, Any] = {}
        self.cache_ttl: Dict[str, float] = {}
    
    async def get(self, key: str) -> Optional[Any]:
        if key in self.memory_cache:
            if time.time() < self.cache_ttl[key]:
                return self.memory_cache[key]
        return None
    
    async def set(self, key: str, value: Any, ttl: int = 3600):
        self.memory_cache[key] = value
        self.cache_ttl[key] = time.time() + ttl
```

### 3. 数据库优化
- 使用索引加速查询
- 批量操作减少数据库访问
- 连接池管理

## 安全性

### 1. 认证机制
- SESSDATA 认证
- Token 认证
- 自动刷新机制

### 2. 数据验证
```python
class TaskCreate(BaseModel):
    media_type: str
    media_id: str
    title: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "media_type": "video",
                "media_id": "BV1xx411c7mD",
                "title": "视频标题"
            }
        }
```

### 3. 错误信息脱敏
- 不暴露敏感信息
- 记录详细错误日志
- 返回友好的错误信息

## 部署架构

### 开发环境
```bash
# 启动开发服务器
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### 生产环境
```bash
# 使用 Gunicorn 启动
gunicorn src.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## 相关文档

- [项目概述](../01-overview/project-overview.md)
- [前端架构](./frontend-architecture.md)
- [数据库架构](./database-architecture.md)
- [系统架构](./system.md)

---

**文档版本**: 1.0.0
**最后更新**: 2026-04-15
**维护者**: PiliNote Team