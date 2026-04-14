# 数据库架构文档

## 数据模型

PiliNote 使用 SQLite 作为数据库，采用 SQLAlchemy ORM 进行数据管理。

### 数据库模型列表

#### 1. User 模型
用户表，存储用户认证信息和账号数据。

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    mid = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    avatar = Column(String(255), nullable=True)
    sessdata = Column(Text, nullable=True)
    is_active = Column(Boolean, default=False)
    created_at = Column(Integer, default=lambda: int(time.time()))
    last_login = Column(Integer, nullable=True)
    
    # 关系
    downloads = relationship("Download", back_populates="user")
    cookies = relationship("Cookie", back_populates="user")
```

**字段说明**：
- `mid`: B站用户ID，唯一标识
- `sessdata`: B站登录凭证
- `is_active`: 是否为当前活跃用户
- `created_at`: 账号创建时间（Unix 时间戳）
- `last_login`: 最后登录时间

#### 2. Cookie 模型
Cookie 表，存储用户的 B站 Cookie。

```python
class Cookie(Base):
    __tablename__ = "cookies"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(50), nullable=False)
    value = Column(Text, nullable=False)
    domain = Column(String(100), nullable=False)
    path = Column(String(100), default="/")
    expires = Column(Integer, nullable=True)
    created_at = Column(Integer, default=lambda: int(time.time()))
    
    # 关系
    user = relationship("User", back_populates="cookies")
```

#### 3. Task 模型
任务表，存储下载任务信息。

```python
class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(String(50), primary_key=True, index=True)
    media_type = Column(String(20), nullable=False)
    media_id = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    cover = Column(String(255), nullable=True)
    state = Column(Integer, default=0)  # TaskState 枚举
    progress = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)
    scheduler_id = Column(String(50), ForeignKey("schedulers.id"), nullable=True, index=True)
    created_at = Column(Integer, default=lambda: int(time.time()), index=True)
    updated_at = Column(Integer, default=lambda: int(time.time()))
    
    # 关系
    scheduler = relationship("Scheduler", back_populates="tasks")
```

**状态枚举**：
```python
class TaskState(IntEnum):
    BACKLOG = 0    # 待处理
    PENDING = 1    # 等待中
    DOING = 2      # 执行中
    COMPLETED = 3  # 已完成
    PAUSED = 4     # 已暂停
    FAILED = 5     # 失败
    CANCELLED = 6  # 已取消
```

#### 4. Scheduler 模型
调度器表，管理多P视频批量下载。

```python
class Scheduler(Base):
    __tablename__ = "schedulers"
    
    id = Column(String(50), primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    state = Column(Integer, default=0)  # SchedulerState 枚举
    queue_type = Column(Integer, default=1)
    folder = Column(String(500), nullable=True)
    created_at = Column(Integer, default=lambda: int(time.time()), index=True)
    updated_at = Column(Integer, default=lambda: int(time.time()))
    
    # 关系
    tasks = relationship("Task", back_populates="scheduler")
```

**状态枚举**：
```python
class SchedulerState(IntEnum):
    IDLE = 0       # 待处理
    RUNNING = 1    # 运行中
    PAUSED = 2     # 已暂停
    COMPLETED = 3  # 已完成
    FAILED = 4     # 失败
    CANCELLED = 5  # 已取消
```

#### 5. Download 模型
下载记录表，存储下载完成的信息。

```python
class Download(Base):
    __tablename__ = "downloads"
    
    id = Column(Integer, primary_key=True, index=True)
    bvid = Column(String(20), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    thumbnail_url = Column(String(255), nullable=True)
    uploader = Column(String(100), nullable=True)
    uploader_mid = Column(BigInteger, nullable=True)
    pub_date = Column(String(20), nullable=True)
    duration = Column(Integer, nullable=True)
    
    # 统计数据
    play_count = Column(Integer, nullable=True)
    like_count = Column(Integer, nullable=True)
    coin_count = Column(Integer, nullable=True)
    favorite_count = Column(Integer, nullable=True)
    share_count = Column(Integer, nullable=True)
    danmaku_count = Column(Integer, nullable=True)
    reply_count = Column(Integer, nullable=True)
    
    # 文件路径
    file_path = Column(String(1000), nullable=True)
    
    # 配置
    enable_nfo = Column(Boolean, default=True)
    enable_cover = Column(Boolean, default=True)
    enable_avatar = Column(Boolean, default=True)
    
    # 元数据
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(Integer, default=lambda: int(time.time()), index=True)
    
    # 关系
    user = relationship("User", back_populates="downloads")
```

#### 6. Setting 模型
设置表，存储应用配置。

```python
class Setting(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, index=True, nullable=False)
    value = Column(Text, nullable=False)
    value_type = Column(String(20), default="string")
    description = Column(String(255), nullable=True)
    created_at = Column(Integer, default=lambda: int(time.time()))
    updated_at = Column(Integer, default=lambda: int(time.time()))
```

#### 7. Queue 模型
队列表，存储队列数据（持久化队列状态）。

```python
class Queue(Base):
    __tablename__ = "queues"
    
    id = Column(Integer, primary_key=True, index=True)
    queue_type = Column(Integer, unique=True, index=True, nullable=False)
    value = Column(Text, nullable=True)  # JSON 格式的任务 ID 列表
    updated_at = Column(Integer, default=lambda: int(time.time()))
```

## 关系图

```
User (用户)
  ├─ downloads (下载记录)
  ├─ cookies (Cookie)
  
Task (任务)
  ├─ scheduler (调度器) - Many to One
  └─ downloads (下载记录)
  
Scheduler (调度器)
  ├─ tasks (任务) - One to Many
  
Download (下载记录)
  └─ user (用户) - Many to One
  
Setting (设置) - 独立表
Queue (队列) - 独立表
```

## 索引设计

### 主要索引
```sql
-- 用户表
CREATE INDEX idx_users_mid ON users(mid);
CREATE INDEX idx_users_is_active ON users(is_active);

-- 任务表
CREATE INDEX idx_tasks_media_id ON tasks(media_id);
CREATE INDEX idx_tasks_state ON tasks(state);
CREATE INDEX idx_tasks_scheduler_id ON tasks(scheduler_id);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);

-- 调度器表
CREATE INDEX idx_schedulers_state ON schedulers(state);
CREATE INDEX idx_schedulers_created_at ON schedulers(created_at);

-- 下载记录表
CREATE UNIQUE INDEX idx_downloads_bvid ON downloads(bvid);
CREATE INDEX idx_downloads_title ON downloads(title);
CREATE INDEX idx_downloads_created_at ON downloads(created_at);

-- 设置表
CREATE UNIQUE INDEX idx_settings_key ON settings(key);

-- 队列表
CREATE UNIQUE INDEX idx_queues_queue_type ON queues(queue_type);
```

### 索引优化策略
- **高频查询字段**：添加索引加速查询
- **唯一约束**：确保数据唯一性
- **复合索引**：针对多字段查询优化

## 数据持久化策略

### 1. 队列持久化
```python
async def _save_queue_to_db(self, queue_type: QueueType):
    """保存队列状态到数据库"""
    items = list(self.queues[queue_type]._queue)
    queue_obj = db.query(Queue).filter_by(queue_type=queue_type).first()
    
    if queue_obj:
        queue_obj.value = json.dumps(items)
        queue_obj.updated_at = int(datetime.now().timestamp())
    else:
        queue_obj = Queue(
            queue_type=queue_type,
            value=json.dumps(items),
            updated_at=int(datetime.now().timestamp())
        )
        db.add(queue_obj)
    
    db.commit()
```

### 2. 事务管理
```python
with SessionLocal() as db:
    try:
        # 执行数据库操作
        download = Download(**download_data)
        db.add(download)
        db.commit()
        db.refresh(download)
        
        return download
    except Exception as e:
        db.rollback()
        raise
```

### 3. 数据一致性检查
```python
async def _ensure_backlog_consistency(self):
    """确保所有 BACKLOG 任务都在 backlog 队列中"""
    backlog_task_ids = [
        task_id for task_id, task in self.tasks.items()
        if task.state == TaskState.BACKLOG
    ]
    
    queue_items = list(self.queues[QueueType.BACKLOG]._queue)
    existing_ids = set(queue_items)
    
    added_count = 0
    for task_id in backlog_task_ids:
        if task_id not in existing_ids:
            await self.queues[QueueType.BACKLOG].put(task_id)
            added_count += 1
    
    if added_count > 0:
        await self._save_queue_to_db(QueueType.BACKLOG)
```

## 数据迁移

### 迁移脚本
```python
# migrate_add_scheduler_id.py
def migrate():
    """添加 scheduler_id 字段到 tasks 表"""
    engine = create_engine('sqlite:///pilinote.db')
    Base.metadata.create_all(engine)
    
    with SessionLocal() as db:
        # 添加列（SQLite 不支持 ALTER TABLE ADD COLUMN 直接操作）
        db.execute("""
            ALTER TABLE tasks ADD COLUMN scheduler_id VARCHAR(50);
            CREATE INDEX idx_tasks_scheduler_id ON tasks(scheduler_id);
        """)
        db.commit()
```

### 迁移历史
- `migrate_add_download_fields.py` - 添加下载字段
- `migrate_add_error_detail.py` - 添加错误详情字段
- `migrate_add_fields.py` - 添加其他字段
- `migrate_add_last_refresh_time.py` - 添加最后刷新时间
- `migrate_add_task_tables.py` - 添加任务表
- `migrate_add_scheduler_id.py` - 添加调度器ID

## 数据完整性

### 外键约束
```python
# Task.scheduler_id
scheduler_id = Column(
    String(50), 
    ForeignKey("schedulers.id"), 
    nullable=True
)

# Download.user_id
user_id = Column(
    Integer, 
    ForeignKey("users.id"), 
    nullable=True
)
```

### 唯一约束
```python
# User.mid
mid = Column(String(20), unique=True, index=True)

# Download.bvid
bvid = Column(String(20), unique=True, index=True)

# Setting.key
key = Column(String(50), unique=True, index=True)
```

### 非空约束
```python
# User.mid, User.name
mid = Column(String(20), nullable=False)
name = Column(String(100), nullable=False)

# Task.id, Task.media_type, Task.media_id
id = Column(String(50), nullable=False)
media_type = Column(String(20), nullable=False)
media_id = Column(String(50), nullable=False)
```

## 性能优化

### 1. 查询优化
```python
# 使用索引查询
task = db.query(Task).filter(Task.id == task_id).first()

# 使用 join 减少查询次数
result = db.query(Task).join(Scheduler).filter(
    Scheduler.id == scheduler_id
).all()
```

### 2. 批量操作
```python
# 批量插入
db.bulk_insert_mappings(Task, task_list)
db.commit()

# 批量更新
db.bulk_update_mappings(Task, task_list)
db.commit()
```

### 3. 连接池管理
```python
# SQLAlchemy 连接池配置
engine = create_engine(
    'sqlite:///pilinote.db',
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=3600
)
```

## 备份和恢复

### 数据库备份
```bash
# SQLite 数据库备份
cp pilinote.db pilinote.db.backup
```

### 数据库恢复
```bash
# 恢复数据库
cp pilinote.db.backup pilinote.db
```

## 相关文档

- [项目概述](../01-overview/project-overview.md)
- [前端架构](./frontend-architecture.md)
- [后端架构](./backend-architecture.md)
- [系统架构](./system.md)

---

**文档版本**: 1.0.0
**最后更新**: 2026-04-15
**维护层级**: PiliNote Team