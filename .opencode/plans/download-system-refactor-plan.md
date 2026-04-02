# PiliNote下载系统重构计划

## 1. 重构背景

### 1.1 当前问题
- **系统混乱**：新旧下载系统并存（download_service + queue系统）
- **重复叠加**：下载任务容易重复执行，缺乏统一调度
- **资源获取不全**：只下载视频，缺少字幕、弹幕、封面等配套资源
- **文件组织简单**：缺乏灵活的文件命名和组织系统
- **实时性差**：使用轮询而非WebSocket，进度更新不及时

### 1.2 重构目标
- **统一系统**：整合新旧系统，以队列系统为基础
- **完整资源**：参考BiliTools，实现完整的资源刮削和下载
- **智能调度**：实现系列视频的智能调度和并发控制
- **实时进度**：实现实时WebSocket进度推送
- **灵活组织**：实现模板化文件命名和组织系统

## 2. 参考BiliTools架构分析

### 2.1 核心架构特点
```
BiliTools架构：
┌─────────────────┐    ┌─────────────────┐
│   Vue前端       │    │   Tauri后端      │
│  (Pinia Store)  │◄──►│   (Rust)         │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  四级队列系统    │    │  任务调度器      │
│  backlog        │    │  Scheduler      │
│  pending        │    │  JoinSet        │
│  doing          │    │  Semaphore      │
│  complete       │    │                 │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  模块化处理器    │    │  下载引擎        │
│  VideoHandler   │    │  Aria2c         │
│  SubtitleHandler│    │  FFmpeg         │
│  DanmakuHandler │    │                 │
│  ThumbHandler   │    │                 │
│  NfoHandler     │    │                 │
└─────────────────┘    └─────────────────┘
```

### 2.2 关键组件
1. **四级队列系统**：backlog → pending → doing → complete
2. **调度器模式**：处理系列视频的批量下载
3. **并发控制**：信号量控制最大并发数
4. **处理器注册表**：模块化的子任务处理器
5. **实时进度**：事件系统推送进度更新

## 3. PiliNote新架构设计

### 3.1 系统架构
```
PiliNote新架构：
┌─────────────────┐    ┌─────────────────┐
│   React前端     │    │   FastAPI后端    │
│  (Zustand Store)│◄──►│   (Python)      │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  统一队列系统    │    │  任务调度器      │
│  QueueManager   │    │  SchedulerService│
│  四级队列        │    │  信号量控制      │
│  持久化到DB     │    │  并发执行        │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  处理器注册表    │    │  下载引擎        │
│  VideoHandler   │    │  DownloadEngine │
│  SubtitleHandler│    │  yt-dlp + aria2c│
│  DanmakuHandler │    │  FFmpeg         │
│  ThumbHandler   │    │                 │
│  NfoHandler     │    │                 │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  文件组织系统    │    │  WebSocket      │
│  模板化命名      │    │  实时进度推送    │
│  自动分类        │    │  事件系统        │
└─────────────────┘    └─────────────────┘
```

### 3.2 数据模型设计

#### Task模型（扩展现有）
```python
class Task(Base):
    """任务模型"""
    __tablename__ = 'tasks'
    
    id = Column(String(50), primary_key=True)
    media_type = Column(String(20), nullable=False)  # video, bangumi, favorite等
    media_id = Column(String(50), nullable=False)    # bvid/epid等
    title = Column(String(500))
    cover = Column(String(500))
    desc = Column(String(2000))
    
    # 元数据
    meta = Column(JSON, nullable=False, default={})      # 完整视频信息
    prepare = Column(JSON, nullable=False, default={})   # 准备数据（URL等）
    status = Column(JSON, nullable=False, default={})    # 子任务进度
    state = Column(Integer, nullable=False, default=0)   # TaskState
    
    # 新增字段
    scheduler_id = Column(String(50))  # 所属调度器
    folder = Column(String(500))       # 输出目录
    naming_template = Column(String(200))  # 命名模板
    
    # 时间戳
    created_at = Column(Integer, nullable=False)
    updated_at = Column(Integer, nullable=False)
```

#### SubTask模型（新增）
```python
class SubTask(Base):
    """子任务模型"""
    __tablename__ = 'subtasks'
    
    id = Column(String(50), primary_key=True)
    task_id = Column(String(50), nullable=False, index=True)
    type = Column(String(20), nullable=False)  # video, subtitle, danmaku等
    state = Column(Integer, nullable=False, default=0)
    progress = Column(Integer, default=0)  # 0-100
    
    # 处理参数
    params = Column(JSON, nullable=False, default={})
    
    # 输出信息
    output_path = Column(String(500))
    file_size = Column(Integer)
    
    # 时间戳
    created_at = Column(Integer, nullable=False)
    updated_at = Column(Integer, nullable=False)
```

#### Scheduler模型（扩展现有）
```python
class Scheduler(Base):
    """调度器模型"""
    __tablename__ = 'schedulers'
    
    id = Column(String(50), primary_key=True)
    title = Column(String(500), nullable=False)
    
    # 任务列表
    list = Column(JSON, nullable=False, default=[])  # 任务ID列表
    count = Column(Integer, nullable=False, default=0)
    
    # 队列和状态
    queue_type = Column(Integer, nullable=False, default=0)
    state = Column(Integer, nullable=False, default=0)
    
    # 输出目录
    folder = Column(String(500), nullable=False)
    
    # 配置
    max_concurrent = Column(Integer, default=3)  # 最大并发数
    auto_rename = Column(Integer, default=1)     # 自动重命名
    
    # 时间戳
    created_at = Column(Integer, nullable=False)
    updated_at = Column(Integer, nullable=False)
```

## 4. 实施步骤

### 4.1 阶段一：核心架构重构（1-2天）
1. **完善队列系统**：
   - 扩展QueueManager，实现真正的队列持久化
   - 实现队列状态监听和事件推送
   - 添加队列统计和监控功能

2. **完善调度器服务**：
   - 实现SchedulerService的完整dispatch逻辑
   - 添加并发控制和任务调度
   - 实现暂停、恢复、取消功能

3. **完善任务处理器**：
   - 实现VideoHandler的实际下载逻辑
   - 实现SubtitleHandler、DanmakuHandler等
   - 添加进度汇报机制

### 4.2 阶段二：下载引擎集成（2-3天）
1. **重构DownloadEngine**：
   - 支持aria2c + yt-dlp双引擎
   - 实现真正的进度回调
   - 添加断点续传支持

2. **资源获取模块**：
   - 实现字幕获取和转换
   - 实现弹幕获取和格式转换
   - 实现封面和头像下载
   - 实现NFO元数据生成

3. **文件组织系统**：
   - 实现模板化命名系统
   - 支持系列视频自动分组
   - 实现文件分类和整理

### 4.3 阶段三：前端重构（2-3天）
1. **统一状态管理**：
   - 重写下载store，参考BiliTools
   - 实现任务状态同步
   - 添加实时进度更新

2. **WebSocket集成**：
   - 实现WebSocket连接管理
   - 实现实时进度推送
   - 添加连接状态监控

3. **UI组件更新**：
   - 更新下载列表组件
   - 实现任务详情面板
   - 添加批量操作功能

### 4.4 阶段四：API路由整合（1天）
1. **统一API接口**：
   - 重构下载API路由
   - 移除重复接口
   - 添加新的队列管理接口

2. **WebSocket端点**：
   - 实现WebSocket路由
   - 添加认证机制
   - 实现事件订阅

### 4.5 阶段五：测试和清理（1-2天）
1. **功能测试**：
   - 测试单视频下载流程
   - 测试系列视频下载流程
   - 测试资源获取和整理

2. **性能测试**：
   - 测试并发下载性能
   - 测试大文件下载稳定性
   - 测试内存和CPU使用

3. **代码清理**：
   - 移除旧的download_service代码
   - 清理未使用的依赖
   - 更新文档和注释

## 5. 技术细节

### 5.1 事件系统设计
```python
class EventType(str, Enum):
    TASK_CREATED = "task_created"
    TASK_STARTED = "task_started"
    TASK_PROGRESS = "task_progress"
    TASK_COMPLETED = "task_completed"
    TASK_FAILED = "task_failed"
    TASK_CANCELLED = "task_cancelled"
    
    SCHEDULER_CREATED = "scheduler_created"
    SCHEDULER_STARTED = "scheduler_started"
    SCHEDULER_COMPLETED = "scheduler_completed"
    
    QUEUE_UPDATED = "queue_updated"

class EventManager:
    """事件管理器"""
    
    def __init__(self):
        self.subscribers = defaultdict(list)
    
    async def publish(self, event_type: EventType, data: dict):
        """发布事件"""
        for callback in self.subscribers.get(event_type, []):
            await callback(data)
    
    def subscribe(self, event_type: EventType, callback):
        """订阅事件"""
        self.subscribers[event_type].append(callback)
```

### 5.2 命名模板系统
```python
class NamingTemplate:
    """命名模板系统"""
    
    TEMPLATES = {
        "series": {
            "default": "{uploader}/{series_title}",
            "detailed": "{uploader}/{series_title} ({year})",
        },
        "item": {
            "default": "P{index:02d} {title}",
            "simple": "{title}",
        },
        "file": {
            "default": "{series_title} - P{index:02d} - {title}",
            "simple": "{title}",
        }
    }
    
    def render(self, template_name: str, context: dict) -> str:
        """渲染模板"""
        template = self.get_template(template_name)
        return template.format(**context)
```

### 5.3 进度汇报机制
```python
class ProgressReporter:
    """进度汇报器"""
    
    def __init__(self, task_id: str, subtask_id: str):
        self.task_id = task_id
        self.subtask_id = subtask_id
        self.total = 0
        self.current = 0
    
    async def update(self, current: int, total: int = None):
        """更新进度"""
        if total:
            self.total = total
        self.current = current
        
        # 发送事件
        await event_manager.publish(
            EventType.TASK_PROGRESS,
            {
                "task_id": self.task_id,
                "subtask_id": self.subtask_id,
                "current": current,
                "total": self.total,
                "progress": (current / self.total * 100) if self.total > 0 else 0
            }
        )
```

## 6. 风险评估和缓解

### 6.1 风险点
1. **数据迁移风险**：旧数据迁移到新系统
2. **兼容性风险**：前端API变更可能影响现有功能
3. **性能风险**：WebSocket连接数可能影响服务器性能
4. **稳定性风险**：新系统可能存在未知bug

### 6.2 缓解措施
1. **分阶段实施**：逐步替换，保留回退能力
2. **充分测试**：每个阶段都进行充分测试
3. **监控预警**：添加性能监控和错误预警
4. **文档完善**：保持文档更新，便于维护

## 7. 预期效果

### 7.1 功能提升
- **完整资源下载**：视频、字幕、弹幕、封面、头像、NFO
- **智能调度**：系列视频自动分组和并发控制
- **实时进度**：WebSocket实时推送进度更新
- **灵活组织**：模板化命名和自动分类

### 7.2 性能提升
- **并发控制**：避免重复下载，优化资源使用
- **断点续传**：支持大文件断点续传
- **内存优化**：流式处理，避免大文件内存占用

### 7.3 用户体验提升
- **实时反馈**：即时看到下载进度和状态
- **批量操作**：支持批量下载、暂停、取消
- **详细信息**：丰富的任务详情和统计信息

## 8. 总结

通过这次重构，PiliNote将拥有一个统一、高效、功能完整的下载系统，能够：
1. **正确处理单个视频和系列视频的下载**
2. **完整获取和整理配套资源**
3. **提供实时的进度反馈**
4. **支持灵活的文件组织和命名**

重构完成后，PiliNote将成为一个功能完善的B站视频下载管理工具，用户体验将得到显著提升。