# PiliNote 自动下载升级方案

## 📋 方案概述

基于 bili-sync 的优秀设计，为 PiliNote 添加**定时扫描视频源并自动下载**的功能，实现收藏夹和稍后再看的自动化管理。

## 🎯 核心功能

1. **定时扫描视频源**: 定时检查收藏夹/稍后再看
2. **增量更新机制**: 只处理新视频，避免重复
3. **自动添加下载**: 自动将新视频添加到下载列表
4. **智能筛选**: 根据配置筛选要下载的视频
5. **重试机制**: 下载失败自动重试

## 🏗️ 架构设计

### 新增模块

```
apps/api/src/
├── services/
│   ├── video_source_scanner.py    # 视频源扫描服务（新增）
│   └── auto_download_service.py   # 自动下载服务（新增）
├── models/
│   └── video_source_scan.py       # 扫描记录模型（新增）
├── routers/
│   └── auto_download.py           # 自动下载 API（新增）
└── config/
    └── auto_download.py           # 自动下载配置（新增）
```

### 数据库设计

#### 扫描记录表（video_source_scans）

```python
class VideoSourceScan(Base):
    """视频源扫描记录"""
    __tablename__ = "video_source_scans"
    
    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # 视频源类型和ID
    source_type = Column(String(20), nullable=False, index=True)  # 'favorite', 'watchlater'
    source_id = Column(String(50), nullable=False, index=True)   # 收藏夹ID或用户ID
    
    # 扫描时间戳
    last_scan_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_video_time = Column(DateTime, nullable=True)  # 最新视频的时间戳
    
    # 统计信息
    total_videos = Column(Integer, default=0)
    new_videos = Column(Integer, default=0)
    added_to_queue = Column(Integer, default=0)
    
    # 状态
    status = Column(String(20), default="success")  # success, failed
    error_message = Column(Text, nullable=True)
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 唯一索引
    __table_args__ = (
        UniqueConstraint('source_type', 'source_id', name='uq_source'),
    )
```

### 服务层设计

#### 视频源扫描服务（video_source_scanner.py）

```python
class VideoSourceScanner:
    """视频源扫描服务"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def scan_favorite(
        self,
        media_id: str,
        user_id: str,
        sessdata: str
    ) -> ScanResult:
        """扫描收藏夹"""
        # 1. 获取上次扫描时间
        scan_record = self._get_scan_record('favorite', media_id)
        last_scan_time = scan_record.last_scan_time if scan_record else None
        
        # 2. 获取收藏夹视频列表
        service = BilibiliService()
        result = await service.get_favorite_videos(
            sessdata=sessdata,
            media_id=media_id,
            page=1,
            page_size=50
        )
        
        if not result["success"]:
            return ScanResult(success=False, error="获取收藏夹失败")
        
        # 3. 筛选新视频（增量更新）
        videos = result["data"]["list"]
        new_videos = []
        
        for video in videos:
            video_time = self._parse_video_time(video)
            
            # 如果是第一次扫描或视频时间晚于上次扫描时间
            if last_scan_time is None or video_time > last_scan_time:
                new_videos.append(video)
        
        # 4. 更新扫描记录
        if scan_record:
            scan_record.last_scan_time = datetime.utcnow()
            scan_record.last_video_time = self._get_latest_video_time(videos)
            scan_record.total_videos = len(videos)
            scan_record.new_videos = len(new_videos)
        else:
            scan_record = VideoSourceScan(
                source_type='favorite',
                source_id=media_id,
                last_scan_time=datetime.utcnow(),
                last_video_time=self._get_latest_video_time(videos),
                total_videos=len(videos),
                new_videos=len(new_videos)
            )
            self.db.add(scan_record)
        
        self.db.commit()
        
        return ScanResult(
            success=True,
            total=len(videos),
            new=len(new_videos),
            videos=new_videos
        )
    
    async def scan_watch_later(
        self,
        user_id: str,
        sessdata: str
    ) -> ScanResult:
        """扫描稍后再看"""
        # 类似逻辑，针对稍后再看
        pass
    
    def _get_scan_record(self, source_type: str, source_id: str) -> Optional[VideoSourceScan]:
        """获取扫描记录"""
        return self.db.query(VideoSourceScan).filter(
            VideoSourceScan.source_type == source_type,
            VideoSourceScan.source_id == source_id
        ).first()
    
    def _parse_video_time(self, video: dict) -> datetime:
        """解析视频时间"""
        # 收藏夹视频：使用 fav_time
        # 稍后再看：使用 add_at
        # 投稿视频：使用 pubtime
        pass
    
    def _get_latest_video_time(self, videos: List[dict]) -> Optional[datetime]:
        """获取最新视频时间"""
        if not videos:
            return None
        times = [self._parse_video_time(v) for v in videos if self._parse_video_time(v)]
        return max(times) if times else None
```

#### 自动下载服务（auto_download_service.py）

```python
class AutoDownloadService:
    """自动下载服务"""
    
    def __init__(self, db: Session, queue_manager: QueueManager):
        self.db = db
        self.queue_manager = queue_manager
    
    async def add_videos_to_queue(
        self,
        videos: List[dict],
        config: AutoDownloadConfig
    ) -> AddResult:
        """将视频添加到下载队列"""
        added_count = 0
        skipped_count = 0
        failed_count = 0
        
        for video in videos:
            # 1. 检查是否已存在
            existing = self.db.query(Task).filter(
                Task.media_id == video.get('bvid'),
                Task.media_type == 'video'
            ).first()
            
            if existing:
                skipped_count += 1
                continue
            
            # 2. 根据配置筛选视频
            if not self._should_download(video, config):
                skipped_count += 1
                continue
            
            # 3. 创建任务
            task = Task(
                id=str(uuid.uuid4()),
                media_type='video',
                media_id=video.get('bvid'),
                title=video.get('title'),
                cover=video.get('cover'),
                meta={
                    'quality': config.quality,
                    'codec': config.codec,
                    'audio_bitrate': config.audio_bitrate,
                    'output_format': config.output_format
                },
                state=TaskState.BACKLOG
            )
            
            self.db.add(task)
            added_count += 1
        
        self.db.commit()
        
        return AddResult(
            success=True,
            added=added_count,
            skipped=skipped_count,
            failed=failed_count
        )
    
    def _should_download(self, video: dict, config: AutoDownloadConfig) -> bool:
        """判断是否应该下载"""
        # 1. 检查视频时长
        duration = video.get('duration', 0)
        if config.min_duration and duration < config.min_duration:
            return False
        
        if config.max_duration and duration > config.max_duration:
            return False
        
        # 2. 检查UP主（如果配置了白名单）
        if config.allowed_uploaders:
            uploader = video.get('owner', {}).get('name', '')
            if uploader not in config.allowed_uploaders:
                return False
        
        # 3. 检查UP主（如果配置了黑名单）
        if config.blocked_uploaders:
            uploader = video.get('owner', {}).get('name', '')
            if uploader in config.blocked_uploaders:
                return False
        
        return True
```

### 配置设计

#### 自动下载配置（auto_download.py）

```python
class AutoDownloadConfig(BaseSettings):
    """自动下载配置"""
    
    # 是否启用
    enabled: bool = True
    
    # 扫描间隔（分钟）
    scan_interval_minutes: int = 30
    
    # Cron 表达式（优先级高于 scan_interval）
    scan_cron: Optional[str] = None
    
    # 视频质量
    quality: int = 64
    
    # 编码格式
    codec: str = 'avc'
    
    # 音频码率
    audio_bitrate: int = 192
    
    # 输出格式
    output_format: str = 'mp4'
    
    # 视频时长限制（秒）
    min_duration: Optional[int] = None
    max_duration: Optional[int] = None
    
    # UP主白名单
    allowed_uploaders: Optional[List[str]] = None
    
    # UP主黑名单
    blocked_uploaders: Optional[List[str]] = None
    
    # 要扫描的视频源
    scan_sources: List[dict] = [
        {'type': 'favorite', 'id': 'all'},  # 所有收藏夹
        {'type': 'watch_later', 'id': 'all'},  # 稍后再看
    ]
    
    # 最大重试次数
    max_retries: int = 3
    
    # 重试间隔（秒）
    retry_interval: int = 300
    
    class Config:
        env_file = ".env"
        case_sensitive = False
```

### 定时任务集成

#### 扩展 SchedulerService

```python
class SchedulerService:
    """定时任务服务"""
    
    def __init__(self, db: Session, queue_manager: QueueManager):
        self.db = db
        self.queue_manager = queue_manager
        self.scheduler = BackgroundScheduler()
        
        # 加载配置
        self.auto_download_config = AutoDownloadConfig()
    
    def start(self):
        """启动定时任务"""
        # Cookie 刷新（已有）
        self.scheduler.add_job(
            self.check_and_refresh_cookies,
            trigger=IntervalTrigger(minutes=30),
            id='refresh_cookies'
        )
        
        # 文件清理（已有）
        self.scheduler.add_job(
            self.cleanup_old_temp_files,
            trigger=IntervalTrigger(hours=1),
            id='cleanup_temp_files'
        )
        
        # 自动下载扫描（新增）
        if self.auto_download_config.enabled:
            if self.auto_download_config.scan_cron:
                # 使用 Cron 表达式
                self.scheduler.add_job(
                    self.scan_video_sources,
                    trigger=CronTrigger.from_crontab(self.auto_download_config.scan_cron),
                    id='auto_download_scan'
                )
            else:
                # 使用固定间隔
                self.scheduler.add_job(
                    self.scan_video_sources,
                    trigger=IntervalTrigger(minutes=self.auto_download_config.scan_interval_minutes),
                    id='auto_download_scan'
                )
        
        self.scheduler.start()
    
    async def scan_video_sources(self):
        """扫描视频源并自动下载"""
        scanner = VideoSourceScanner(self.db)
        auto_download = AutoDownloadService(self.db, self.queue_manager)
        
        for source in self.auto_download_config.scan_sources:
            source_type = source['type']
            source_id = source['id']
            
            try:
                # 扫描视频源
                if source_type == 'favorite':
                    if source_id == 'all':
                        # 扫描所有收藏夹
                        # 这里需要先获取用户的所有收藏夹列表
                        pass
                    else:
                        result = await scanner.scan_favorite(
                            media_id=source_id,
                            user_id=self.current_user_id,
                            sessdata=self.current_sessdata
                        )
                
                elif source_type == 'watch_later':
                    result = await scanner.scan_watch_later(
                        user_id=self.current_user_id,
                        sessdata=self.current_sessdata
                    )
                
                # 添加到下载队列
                if result.success and result.new_videos:
                    add_result = await auto_download.add_videos_to_queue(
                        videos=result.videos,
                        config=self.auto_download_config
                    )
                    
                    logger.info(
                        f"扫描 {source_type}:{source_id} 完成，"
                        f"新增 {result.new_videos} 个视频，"
                        f"添加到队列 {add_result.added} 个"
                    )
            
            except Exception as e:
                logger.error(f"扫描 {source_type}:{source_id} 失败: {e}")
```

### API 设计

#### 自动下载 API（auto_download.py）

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/auto-download", tags=["Auto Download"])

@router.get("/config")
async def get_config(
    db: Session = Depends(get_db)
):
    """获取自动下载配置"""
    config = AutoDownloadConfig()
    return {"success": True, "data": config.dict()}

@router.post("/config")
async def update_config(
    config: AutoDownloadConfig,
    db: Session = Depends(get_db)
):
    """更新自动下载配置"""
    # 保存配置到数据库或环境变量
    # 这里需要实现配置持久化
    return {"success": True, "message": "配置已更新"}

@router.get("/scan-records")
async def get_scan_records(
    source_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取扫描记录"""
    query = db.query(VideoSourceScan)
    
    if source_type:
        query = query.filter(VideoSourceScan.source_type == source_type)
    
    records = query.order_by(VideoSourceScan.last_scan_time.desc()).limit(50).all()
    
    return {
        "success": True,
        "data": [
            {
                "id": r.id,
                "source_type": r.source_type,
                "source_id": r.source_id,
                "last_scan_time": r.last_scan_time.isoformat(),
                "total_videos": r.total_videos,
                "new_videos": r.new_videos,
                "added_to_queue": r.added_to_queue,
                "status": r.status
            }
            for r in records
        ]
    }

@router.post("/scan/trigger")
async def trigger_scan(
    source_type: str,
    source_id: str = "all",
    db: Session = Depends(get_db)
):
    """手动触发扫描"""
    scanner = VideoSourceScanner(db)
    auto_download = AutoDownloadService(db, QueueManager())
    
    try:
        if source_type == 'favorite':
            result = await scanner.scan_favorite(
                media_id=source_id,
                user_id=current_user_id,
                sessdata=current_sessdata
            )
        
        elif source_type == 'watch_later':
            result = await scanner.scan_watch_later(
                user_id=current_user_id,
                sessdata=current_sessdata
            )
        
        else:
            raise HTTPException(status_code=400, detail="不支持的视频源类型")
        
        # 添加到下载队列
        if result.success and result.new_videos:
            add_result = await auto_download.add_videos_to_queue(
                videos=result.videos,
                config=AutoDownloadConfig()
            )
        
        return {
            "success": True,
            "data": {
                "total": result.total,
                "new": result.new,
                "added": add_result.added
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

## 📋 实施步骤

### 阶段 1：基础功能（1-2周）

1. ✅ 创建数据库模型（VideoSourceScan）
2. ✅ 实现视频源扫描服务
3. ✅ 实现自动下载服务
4. ✅ 集成到现有定时任务系统

### 阶段 2：配置管理（1周）

5. ✅ 实现配置系统
6. ✅ 添加配置 API
7. ✅ Web UI 配置界面

### 阶段 3：高级功能（1-2周）

8. ✅ 实现增量更新机制
9. ✅ 添加视频筛选规则
10. ✅ 实现重试机制

### 阶段 4：测试和优化（1周）

11. ✅ 单元测试
12. ✅ 集成测试
13. ✅ 性能优化
14. ✅ 错误处理完善

## 🎯 关键技术点

### 1. 增量更新

使用 `last_scan_time` 和 `last_video_time` 实现增量更新：

```python
# 只下载新视频
if last_scan_time is None or video_time > last_scan_time:
    new_videos.append(video)
```

### 2. 防止重复下载

检查任务是否已存在：

```python
existing = self.db.query(Task).filter(
    Task.media_id == video.get('bvid'),
    Task.media_type == 'video'
).first()

if existing:
    skip
```

### 3. 配置热更新

监听配置变更，动态调整定时任务：

```python
@router.post("/config")
async def update_config(config: AutoDownloadConfig):
    # 更新配置
    # 重启定时任务
    scheduler_service.restart_auto_download_job()
```

### 4. 错误处理

记录扫描失败，不影响其他视频源：

```python
try:
    result = await scanner.scan_favorite(...)
except Exception as e:
    logger.error(f"扫描失败: {e}")
    # 继续扫描其他视频源
```

## 📊 预期效果

### 功能对比

| 功能 | 升级前 | 升级后 |
|------|--------|--------|
| 定时扫描 | ❌ 不支持 | ✅ 支持 |
| 增量更新 | ❌ 不支持 | ✅ 支持 |
| 自动下载 | ❌ 不支持 | ✅ 支持 |
| 配置管理 | ❌ 不支持 | ✅ 支持 |
| 手动触发 | ❌ 不支持 | ✅ 支持 |
| 视频筛选 | ❌ 不支持 | ✅ 支持 |
| 重试机制 | ⚠️ 部分 | ✅ 完整 |

### 用户体验提升

1. **自动化**: 无需手动添加下载任务
2. **智能化**: 自动发现新视频
3. **便捷性**: 一键订阅收藏夹/稍后再看
4. **可配置**: 灵活的筛选规则
5. **可监控**: 扫描记录可视化

## 💡 建议

1. **优先级**: 先实现核心功能（定时扫描、自动下载），再添加高级功能
2. **兼容性**: 保持与现有系统的兼容，不要破坏现有功能
3. **可测试性**: 每个模块都要有单元测试
4. **可配置性**: 所有功能都要可配置，方便用户自定义
5. **可观察性**: 添加日志和监控，方便排查问题

## 🎓 总结

本方案结合了 bili-sync 的优秀设计和 PiliNote 的现有架构，可以实现你想要的定时扫描和自动下载功能。通过增量更新、智能筛选、自动重试等机制，大大提升了用户体验和系统智能化水平。

建议按照分阶段的方式实施，逐步完善功能，确保每个阶段都经过充分测试，避免影响现有功能的稳定性。