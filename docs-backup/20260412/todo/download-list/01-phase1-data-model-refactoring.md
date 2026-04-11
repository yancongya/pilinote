# 阶段1：数据模型重构

## 概述

本阶段的目标是重构数据库模型，参考BiliTools的架构设计，创建支持任务、调度器、队列管理的数据表结构，解决当前项目中数据结构不一致、视频类型缺失、职责混乱等问题。

## 核心问题

### 当前问题

1. **Download模型字段不足**
   - 缺少`media_type`字段区分视频类型
   - 缺少`source_type`和`source_id`标识视频来源
   - 无法区分普通视频、番剧、课程等不同类型

2. **数据结构不一致**
   - `VideoInfo`和`MediaInfo`描述相同实体但字段不同
   - 统计信息字段命名不一致（play vs view）

3. **缺少任务管理表**
   - 没有独立的任务表
   - 没有调度器表
   - 没有队列表

## 解决方案

### 1. 新增数据库表

#### 1.1 tasks 表 - 任务管理

**文件**: `apps/api/src/models/task.py`

```python
from sqlalchemy import Column, String, Integer, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import uuid

Base = declarative_base()

class TaskState(int, Enum):
    """任务状态枚举"""
    BACKLOG = 0      # 待办
    PENDING = 1      # 待处理
    ACTIVE = 2       # 活跃
    COMPLETED = 3    # 已完成
    PAUSED = 4       # 已暂停
    FAILED = 5       # 失败
    CANCELLED = 6    # 已取消

class MediaType(str, Enum):
    """媒体类型枚举"""
    VIDEO = "video"
    BANGUMI = "bangumi"
    MUSIC = "music"
    MUSIC_LIST = "music_list"
    LESSON = "lesson"
    WATCH_LATER = "watch_later"
    FAVORITE = "favorite"
    OPUS = "opus"
    OPUS_LIST = "opus_list"
    USER_VIDEO = "user_video"
    USER_OPUS = "user_opus"
    USER_AUDIO = "user_audio"

class Task(Base):
    """任务模型"""
    __tablename__ = 'tasks'

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    media_type = Column(String(20), nullable=False)  # MediaType
    media_id = Column(String(50), nullable=False)     # bvid/epid/ssid等
    title = Column(String(500))
    cover = Column(String(500))
    desc = Column(String(2000))

    # 元数据
    meta = Column(JSON, nullable=False)  # 完整元数据（视频信息、UP主信息等）
    prepare = Column(JSON, nullable=False)  # 准备数据（视频URL、字幕URL等）
    status = Column(JSON, nullable=False)  # 进度状态
    state = Column(Integer, nullable=False, default=TaskState.BACKLOG)  # TaskState

    # 时间戳
    created_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))
    updated_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))

    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'media_type': self.media_type,
            'media_id': self.media_id,
            'title': self.title,
            'cover': self.cover,
            'desc': self.desc,
            'meta': self.meta,
            'prepare': self.prepare,
            'status': self.status,
            'state': self.state,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }
```

#### 1.2 schedulers 表 - 调度器管理

**文件**: `apps/api/src/models/scheduler.py`

```python
from sqlalchemy import Column, String, Integer, JSON, DateTime
from datetime import datetime
import uuid

class SchedulerState(int, Enum):
    """调度器状态枚举"""
    PENDING = 0      # 待处理
    ACTIVE = 1       # 活跃
    COMPLETED = 2    # 已完成
    PAUSED = 3       # 已暂停
    FAILED = 4       # 失败
    CANCELLED = 5    # 已取消

class Scheduler(Base):
    """调度器模型"""
    __tablename__ = 'schedulers'

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(500), nullable=False)

    # 任务列表
    list = Column(JSON, nullable=False)  # 任务ID列表
    count = Column(Integer, nullable=False, default=0)  # 任务数量

    # 队列和状态
    queue_type = Column(Integer, nullable=False)  # QueueType
    state = Column(Integer, nullable=False, default=SchedulerState.PENDING)  # SchedulerState

    # 输出目录
    folder = Column(String(500), nullable=False)

    # 时间戳
    created_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))
    updated_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))

    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'title': self.title,
            'list': self.list,
            'count': self.count,
            'queue_type': self.queue_type,
            'state': self.state,
            'folder': self.folder,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }
```

#### 1.3 queues 表 - 队列管理

**文件**: `apps/api/src/models/queue.py`

```python
from sqlalchemy import Column, String, Integer, JSON, DateTime
from datetime import datetime

class QueueType(int, Enum):
    """队列类型枚举"""
    BACKLOG = 0      # 待办队列
    PENDING = 1      # 待处理队列
    DOING = 2        # 执行中队列
    COMPLETE = 3     # 完成队列

class Queue(Base):
    """队列模型"""
    __tablename__ = 'queues'

    queue_type = Column(Integer, primary_key=True)  # QueueType
    value = Column(JSON, nullable=False)  # 任务ID列表（JSON数组）
    updated_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))

    def to_dict(self):
        """转换为字典"""
        return {
            'queue_type': self.queue_type,
            'value': self.value,
            'updated_at': self.updated_at
        }
```

### 2. 修改现有Download模型

**文件**: `apps/api/src/models/download.py`

```python
from sqlalchemy import Column, String, Integer, Boolean, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

class Download(Base):
    """下载模型（保持向后兼容）"""
    __tablename__ = 'downloads'

    id = Column(Integer, primary_key=True, autoincrement=True)
    bvid = Column(String(20), nullable=False, index=True)
    cid = Column(Integer, nullable=True)
    aid = Column(Integer, nullable=True)

    # 新增字段：视频类型和来源
    media_type = Column(String(20), nullable=True)  # MediaType
    source_type = Column(String(20), nullable=True)  # 来源类型：favorite/watchlater/direct
    source_id = Column(String(50), nullable=True)  # 来源ID：收藏夹ID等

    # 关联任务ID
    task_id = Column(String(50), nullable=True)  # 关联到tasks表

    # 原有字段保持不变
    title = Column(String(500), nullable=False)
    desc = Column(String(2000), nullable=True)
    pic = Column(String(500), nullable=True)
    uploader = Column(String(100), nullable=True)
    uploader_mid = Column(Integer, nullable=True)
    duration = Column(Integer, nullable=True)
    pubdate = Column(Integer, nullable=True)

    # 下载配置
    quality = Column(Integer, nullable=True)
    codec = Column(String(20), nullable=True)
    download_audio = Column(Boolean, default=False)
    download_subtitle = Column(Boolean, default=True)
    download_danmaku = Column(Boolean, default=False)
    download_cover = Column(Boolean, default=True)
    download_uploader_avatar = Column(Boolean, default=True)

    # 下载状态
    status = Column(String(20), default='pending')  # pending/downloading/completed/failed
    progress = Column(Integer, default=0)
    downloaded_bytes = Column(Integer, default=0)
    total_bytes = Column(Integer, default=0)
    speed = Column(Integer, default=0)
    error_message = Column(String(1000), nullable=True)

    # 文件路径
    output_path = Column(String(1000), nullable=True)
    temp_path = Column(String(1000), nullable=True)

    # 时间戳
    created_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))
    updated_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))
    completed_at = Column(Integer, nullable=True)

    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'bvid': self.bvid,
            'cid': self.cid,
            'aid': self.aid,
            'media_type': self.media_type,
            'source_type': self.source_type,
            'source_id': self.source_id,
            'task_id': self.task_id,
            'title': self.title,
            'desc': self.desc,
            'pic': self.pic,
            'uploader': self.uploader,
            'uploader_mid': self.uploader_mid,
            'duration': self.duration,
            'pubdate': self.pubdate,
            'quality': self.quality,
            'codec': self.codec,
            'download_audio': self.download_audio,
            'download_subtitle': self.download_subtitle,
            'download_danmaku': self.download_danmaku,
            'download_cover': self.download_cover,
            'download_uploader_avatar': self.download_uploader_avatar,
            'status': self.status,
            'progress': self.progress,
            'downloaded_bytes': self.downloaded_bytes,
            'total_bytes': self.total_bytes,
            'speed': self.speed,
            'error_message': self.error_message,
            'output_path': self.output_path,
            'temp_path': self.temp_path,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'completed_at': self.completed_at
        }
```

### 3. 统一数据结构Schema

**文件**: `apps/api/src/schemas/task.py`

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum

class MediaType(str, Enum):
    """媒体类型枚举"""
    VIDEO = "video"
    BANGUMI = "bangumi"
    MUSIC = "music"
    MUSIC_LIST = "music_list"
    LESSON = "lesson"
    WATCH_LATER = "watch_later"
    FAVORITE = "favorite"
    OPUS = "opus"
    OPUS_LIST = "opus_list"
    USER_VIDEO = "user_video"
    USER_OPUS = "user_opus"
    USER_AUDIO = "user_audio"

class TaskState(int, Enum):
    """任务状态枚举"""
    BACKLOG = 0
    PENDING = 1
    ACTIVE = 2
    COMPLETED = 3
    PAUSED = 4
    FAILED = 5
    CANCELLED = 6

class SubTaskType(str, Enum):
    """子任务类型枚举"""
    VIDEO = "video"
    AUDIO = "audio"
    AUDIO_VIDEO = "audio_video"
    SUBTITLES = "subtitles"
    DANMAKU = "danmaku"
    THUMB = "thumb"
    SINGLE_NFO = "single_nfo"
    ALBUM_NFO = "album_nfo"
    AI_SUMMARY = "ai_summary"
    OPUS_CONTENT = "opus_content"
    OPUS_IMAGES = "opus_images"

class SubTask(BaseModel):
    """子任务"""
    id: str
    type: SubTaskType
    state: TaskState
    progress: int = 0
    error_message: Optional[str] = None
    params: Dict[str, Any] = {}

class TaskCreate(BaseModel):
    """创建任务请求"""
    media_type: MediaType
    media_id: str
    title: Optional[str] = None
    cover: Optional[str] = None
    desc: Optional[str] = None

class TaskUpdate(BaseModel):
    """更新任务请求"""
    state: Optional[TaskState] = None
    status: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None
    prepare: Optional[Dict[str, Any]] = None

class TaskResponse(BaseModel):
    """任务响应"""
    id: str
    media_type: MediaType
    media_id: str
    title: Optional[str]
    cover: Optional[str]
    desc: Optional[str]
    meta: Dict[str, Any]
    prepare: Dict[str, Any]
    status: Dict[str, Any]
    state: TaskState
    subtasks: List[SubTask] = []
    created_at: int
    updated_at: int

class TaskListResponse(BaseModel):
    """任务列表响应"""
    total: int
    items: List[TaskResponse]
```

**文件**: `apps/api/src/schemas/scheduler.py`

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum

class SchedulerState(int, Enum):
    """调度器状态枚举"""
    PENDING = 0
    ACTIVE = 1
    COMPLETED = 2
    PAUSED = 3
    FAILED = 4
    CANCELLED = 5

class QueueType(int, Enum):
    """队列类型枚举"""
    BACKLOG = 0
    PENDING = 1
    DOING = 2
    COMPLETE = 3

class SchedulerCreate(BaseModel):
    """创建调度器请求"""
    title: str
    task_ids: List[str]
    folder: str

class SchedulerUpdate(BaseModel):
    """更新调度器请求"""
    state: Optional[SchedulerState] = None
    queue_type: Optional[QueueType] = None

class SchedulerResponse(BaseModel):
    """调度器响应"""
    id: str
    title: str
    list: List[str]
    count: int
    queue_type: QueueType
    state: SchedulerState
    folder: str
    created_at: int
    updated_at: int

class SchedulerListResponse(BaseModel):
    """调度器列表响应"""
    total: int
    items: List[SchedulerResponse]
```

**文件**: `apps/api/src/schemas/queue.py`

```python
from pydantic import BaseModel
from typing import List
from enum import Enum

class QueueType(int, Enum):
    """队列类型枚举"""
    BACKLOG = 0
    PENDING = 1
    DOING = 2
    COMPLETE = 3

class QueueResponse(BaseModel):
    """队列响应"""
    queue_type: QueueType
    value: List[str]
    updated_at: int
```

### 4. 数据库迁移脚本

**文件**: `apps/api/migrate_add_task_tables.py`

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import create_engine, text
from database import Base, engine, SessionLocal
from models.task import Task
from models.scheduler import Scheduler
from models.queue import Queue

def migrate():
    """创建新表"""
    print("开始迁移数据库...")

    # 创建新表
    Base.metadata.create_all(bind=engine)

    # 初始化队列数据
    db = SessionLocal()
    try:
        # 检查队列是否已初始化
        existing_queues = db.query(Queue).count()
        if existing_queues == 0:
            # 初始化四个队列
            from models.queue import QueueType
            for queue_type in [QueueType.BACKLOG, QueueType.PENDING, QueueType.DOING, QueueType.COMPLETE]:
                queue = Queue(queue_type=queue_type, value=[])
                db.add(queue)
            db.commit()
            print("✓ 队列初始化完成")
        else:
            print("✓ 队列已存在，跳过初始化")

    except Exception as e:
        db.rollback()
        print(f"✗ 迁移失败: {e}")
        raise
    finally:
        db.close()

    print("✓ 数据库迁移完成")

if __name__ == "__main__":
    migrate()
```

## 实施步骤

### 步骤1：创建模型文件

```bash
# 创建任务模型
touch apps/api/src/models/task.py

# 创建调度器模型
touch apps/api/src/models/scheduler.py

# 创建队列模型
touch apps/api/src/models/queue.py
```

### 步骤2：修改Download模型

编辑 `apps/api/src/models/download.py`，添加新字段。

### 步骤3：创建Schema文件

```bash
# 创建任务Schema
touch apps/api/src/schemas/task.py

# 创建调度器Schema
touch apps/api/src/schemas/scheduler.py

# 创建队列Schema
touch apps/api/src/schemas/queue.py
```

### 步骤4：运行迁移脚本

```bash
cd apps/api
python3 migrate_add_task_tables.py
```

### 步骤5：验证

```bash
# 检查数据库表
sqlite3 data/pilinote.db ".tables"

# 检查表结构
sqlite3 data/pilinote.db ".schema tasks"
sqlite3 data/pilinote.db ".schema schedulers"
sqlite3 data/pilinote.db ".schema queues"
```

## 注意事项

1. **向后兼容**
   - 保留原有Download模型的所有字段
   - 新增字段使用nullable=True，避免破坏现有数据

2. **数据迁移**
   - 现有的Download记录保持不变
   - 新的任务系统与Download系统并存
   - 后续可以逐步将Download数据迁移到Task系统

3. **索引优化**
   - Task表的media_id字段添加索引
   - Scheduler表的state字段添加索引
   - Queue表的queue_type是主键，自动索引

4. **数据一致性**
   - 所有时间戳使用Unix时间戳（秒）
   - JSON字段使用PostgreSQL的JSONB类型（如果使用PostgreSQL）
   - SQLite使用JSON类型

5. **测试要点**
   - 测试Task的CRUD操作
   - 测试Scheduler的CRUD操作
   - 测试Queue的CRUD操作
   - 测试枚举类型的序列化和反序列化

## 下一步

完成本阶段后，进入**阶段2：队列管理系统**，实现统一的队列管理器。