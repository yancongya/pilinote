# PiliNote 下载功能重构详细规范 (v2.0)

## 1. 架构对比分析

### BiliTools vs PiliNote 当前架构

| 组件 | BiliTools | PiliNote 当前 | PiliNote 重构后 |
|------|-----------|---------------|-----------------|
| **后端语言** | Rust | Python (FastAPI) | Python (FastAPI) |
| **队列系统** | 四级队列 (backlog→pending→doing→complete) | asyncio.Queue | 四级队列 |
| **任务模型** | Task/Scheduler/SubTask | 单一Download模型 | Task/Scheduler/SubTask |
| **并发控制** | 信号量 (可动态调整) | 固定最大并发数 | 信号量 (可动态调整) |
| **实时通信** | Tauri事件系统 | 前端轮询 (2秒) | WebSocket |
| **状态管理** | Pinia + 原子操作 | Zustand + 数据库 | Zustand + WebSocket事件 |
| **文件组织** | 模板化命名 | 基础重命名 | 模板化命名 |
| **错误处理** | 完整的重试/恢复 | 基础重试 | 完整的重试/恢复 |

### 移植核心概念

1. **四级队列系统**
   - backlog: 用户提交的任务
   - pending: 已规划的调度器
   - doing: 执行中的调度器
   - complete: 已完成的调度器/任务

2. **调度器模式**
   - 单任务调度器: 处理单个视频下载
   - 系列调度器: 处理合集/系列视频批量下载

3. **任务生命周期**
   - 创建 → 提交到backlog → 规划调度器 → 执行 → 完成
   - 支持暂停、恢复、取消、重试

4. **事件驱动架构**
   - 后端通过WebSocket推送事件
   - 前端通过事件更新状态
   - 支持后端请求前端数据（如文件名生成）

## 2. 详细设计

### 2.1 数据模型详细设计

#### Task 模型字段
```python
# 基本信息
id: String(20)           # 主键 (task_id)
ts: Integer              # 创建时间戳
seq: Integer             # 在队列中的序列号
title: String            # 标题
cover: String            # 封面URL
desc: Text               # 描述
duration: Integer        # 时长(秒)
pubtime: Integer         # 发布时间戳
media_type: String       # 媒体类型 (video/bangumi/music等)
url: String              # 视频URL

# B站ID字段
aid: Integer             # 视频AID
sid: Integer             # 合集ID
fid: Integer             # 收藏夹ID
cid: Integer             # 视频分P ID
bvid: String(20)         # BV号
epid: Integer            # 番剧EPID
ssid: Integer            # 番剧SSID
opid: String(50)         # 专栏ID
rlid: Integer            # 专栏合集ID
index: Integer           # 在系列中的序号

# 用户选择 (JSON结构)
select: JSON             # 包含:
  # res: 清晰度 (16=360P, 32=480P, 64=720P, 80=1080P, 112=1080P+, 116=4K)
  # abr: 音频码率 (30216=64K, 30280=192K, 30250=FLAC等)
  # enc: 编码 (7=AVC, 12=HEVC, 13=AV1)
  # fmt: 格式 (dash/mp4/flv)
  # misc: { aiSummary: bool, subtitles: string|false }
  # nfo: { album: bool, single: bool }
  # danmaku: { live: bool, history: string|false }
  # thumb: string[] (封面类型)
  # media: { video: bool, audio: bool, audioVideo: bool }

# 输出目录
folder: String(500)      # 输出目录路径

# 关联
scheduler_id: String(20) # 调度器ID (外键)

# 状态
state: TaskState         # 任务状态

# 时间戳
created_at: DateTime
started_at: DateTime
completed_at: DateTime
updated_at: DateTime
```

#### Scheduler 模型字段
```python
id: String(20)           # 主键
ts: Integer              # 创建时间戳
list: JSON               # 任务ID列表 ["task1", "task2", ...]
queue: QueueType         # 所在队列
state: SchedulerState    # 调度器状态
folder: String(500)      # 顶层输出目录

# 时间戳
created_at: DateTime
started_at: DateTime
completed_at: DateTime
updated_at: DateTime
```

#### SubTask 模型字段
```python
id: String(20)           # 主键 (task_id + random_string)
task_id: String(20)      # 任务ID (外键)
type: SubTaskType        # 子任务类型
state: SubTaskState      # 子任务状态
content: Integer         # 总内容数 (用于进度计算)
chunk: Integer           # 已完成内容数
output_path: String(500) # 输出文件路径
error_message: String(1000) # 错误信息

# 时间戳
created_at: DateTime
started_at: DateTime
completed_at: DateTime
updated_at: DateTime
```

### 2.2 服务层详细设计

#### TaskManager 核心方法
```python
class TaskManager:
    async def submit_task(self, task_id: str, task_view: TaskView) -> Task:
        """提交任务到backlog队列"""
        # 1. 创建Task对象
        # 2. 创建SubTask对象
        # 3. 保存到数据库
        # 4. 添加到内存backlog队列
        # 5. 发送taskUpdated事件
        # 6. 发送queue更新事件
    
    async def plan_scheduler(self, sid: str, folder: str) -> Scheduler:
        """规划调度器"""
        # 1. 从backlog取出所有任务
        # 2. 更新任务状态为PENDING
        # 3. 创建Scheduler对象
        # 4. 保存到数据库
        # 5. 添加到pending队列
        # 6. 发送schedulerUpdated事件
        # 7. 发送queue更新事件
    
    async def move_scheduler(self, sid: str, to_queue: QueueType):
        """移动调度器到指定队列"""
        # 1. 从原队列移除
        # 2. 添加到目标队列
        # 3. 更新数据库
        # 4. 发送事件
```

#### Scheduler 核心方法
```python
class Scheduler:
    async def dispatch(self) -> bool:
        """调度器开始执行"""
        # 1. 移动到doing队列
        # 2. 更新状态为running
        # 3. 并行执行所有任务 (使用asyncio.gather)
        # 4. 等待所有任务完成
        # 5. 根据结果更新状态
        # 6. 移动到complete队列
    
    async def _process_task(self, task_id: str, permit) -> bool:
        """处理单个任务"""
        # 1. 更新任务状态为active
        # 2. 创建TaskExecutor
        # 3. 执行任务
        # 4. 更新任务状态
        # 5. 释放信号量
```

#### TaskExecutor 核心方法
```python
class TaskExecutor:
    async def execute(self) -> bool:
        """执行任务"""
        # 1. 请求前端准备数据 (通过WebSocket)
        # 2. 创建输出目录和临时目录
        # 3. 获取子任务列表
        # 4. 依次执行每个子任务
        # 5. 清理临时目录
    
    async def _execute_subtask(self, subtask: SubTaskData, prepare: TaskPrepareResp) -> bool:
        """执行子任务"""
        # 根据子任务类型调用不同的处理器:
        # - video/audio: 下载媒体
        # - audioVideo: 合并音视频
        # - thumb: 下载封面
        # - liveDanmaku/historyDanmaku: 下载弹幕
        # - albumNfo/singleNfo: 生成NFO
        # - subtitles: 下载字幕
        # - aiSummary: 获取AI总结
        # - opusContent/opusImages: 专栏内容
```

#### EventHandler 核心方法
```python
class EventHandler:
    async def connect(self, client_id: str, websocket: WebSocket):
        """建立WebSocket连接"""
    
    async def broadcast(self, event: BaseEvent):
        """广播事件到所有连接的客户端"""
    
    async def request(self, task_id: str, subtask_id: Optional[str], 
                      action: RequestAction) -> Optional[Any]:
        """后端请求前端数据"""
        # 1. 生成唯一endpoint
        # 2. 创建Future等待响应
        # 3. 发送RequestEvent
        # 4. 等待前端响应 (超时30秒)
        # 5. 返回结果
```

### 2.3 API 详细设计

#### REST API 端点

```python
# 任务管理
POST   /api/tasks/submit              # 提交任务
POST   /api/tasks/{id}/control        # 控制任务 (pause/resume/cancel/retry)
GET    /api/tasks/list                # 获取任务列表
GET    /api/tasks/{id}                # 获取任务详情
DELETE /api/tasks/{id}                # 删除任务

# 调度器管理
POST   /api/schedulers/{sid}/process  # 处理调度器
POST   /api/schedulers/{sid}/control  # 控制调度器
GET    /api/schedulers/{sid}          # 获取调度器详情

# WebSocket
WS     /ws/queue                      # 队列事件推送
```

#### 请求/响应格式

```json
// POST /api/tasks/submit
{
  "id": "task_123abc",
  "view": {
    "meta": {
      "id": "task_123abc",
      "ts": 1712068800,
      "seq": 0,
      "item": { "title": "...", "bvid": "BV..." },
      "type": "video"
    },
    "prepare": {
      "select": { "res": 80, "fmt": "dash", ... },
      "subtasks": [{ "id": "sub1", "type": "video" }, ...],
      "nfo": { ... },
      "folder": ""
    },
    "hot": {
      "state": "backlog",
      "status": {}
    }
  }
}

// Response
{
  "success": true,
  "message": "Task submitted successfully"
}
```

### 2.4 WebSocket 事件详细设计

#### 事件格式
```json
// 任务更新事件
{
  "type": "taskUpdated",
  "id": "task_123abc",
  "state": "active",
  "prepare": null,
  "cancelled": null
}

// 调度器更新事件
{
  "type": "schedulerUpdated",
  "id": "scheduler_xyz",
  "state": "running",
  "queue": "doing",
  "list": ["task_123", "task_456"],
  "cancelled": null
}

// 进度事件
{
  "type": "progress",
  "task": "task_123abc",
  "subtask": "sub1",
  "content": 1000000,
  "chunk": 500000
}

// 队列更新事件
{
  "type": "queue",
  "name": "backlog",
  "value": ["task_123", "task_456", "task_789"]
}

// 请求事件 (后端请求前端数据)
{
  "type": "request",
  "task": "task_123abc",
  "subtask": "sub1",
  "action": "getFilename",
  "endpoint": "task_123abc_1712068800_getFilename"
}

// 前端响应格式
{
  "type": "response",
  "endpoint": "task_123abc_1712068800_getFilename",
  "data": "video_title_1080p"
}
```

### 2.5 前端状态管理详细设计

#### Zustand Store 完整接口
```typescript
interface QueueState {
  // 数据状态
  tasks: Record<string, Task>
  schedulers: Record<string, Scheduler>
  backlog: string[]
  pending: string[]
  doing: string[]
  complete: string[]
  
  // WebSocket状态
  ws: WebSocket | null
  connected: boolean
  reconnectAttempts: number
  
  // WebSocket方法
  connectWebSocket: () => void
  disconnectWebSocket: () => void
  reconnect: () => void
  
  // 事件处理
  handleEvent: (event: QueueEvent) => void
  handleTaskUpdated: (event: TaskUpdatedEvent) => void
  handleSchedulerUpdated: (event: SchedulerUpdatedEvent) => void
  handleProgress: (event: ProgressEvent) => void
  handleQueueUpdate: (event: QueueEventUpdate) => void
  handleRequest: (event: RequestEvent) => void
  
  // 任务操作
  submitTask: (task: Task) => Promise<void>
  controlTask: (taskId: string, action: ControlAction) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  
  // 调度器操作
  processScheduler: (sid: string) => Promise<void>
  controlScheduler: (sid: string, action: ControlAction) => Promise<void>
  
  // 辅助方法
  getTaskProgress: (taskId: string) => number
  getSchedulerProgress: (sid: string) => number
  isTaskActive: (taskId: string) => boolean
}
```

### 2.6 并发控制详细设计

#### Runtime 类设计
```python
class Runtime:
    def __init__(self, max_concurrent: int = 3):
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.ctrl_handles: Dict[str, CtrlHandle] = {}
        self._lock = asyncio.Lock()
    
    async def set_max_concurrent(self, value: int):
        """动态调整最大并发数"""
        async with self._lock:
            if value > self.max_concurrent:
                # 增加许可
                for _ in range(value - self.max_concurrent):
                    self.semaphore.release()
            elif value < self.max_concurrent:
                # 重新创建信号量
                old_semaphore = self.semaphore
                self.semaphore = asyncio.Semaphore(value)
                # 等待旧的信号量释放所有许可
                # (简化处理，实际需要更复杂的逻辑)
            self.max_concurrent = value
    
    async def acquire_semaphore(self):
        """获取信号量许可"""
        await self.semaphore.acquire()
    
    def release_semaphore(self, permit):
        """释放信号量许可"""
        self.semaphore.release()
    
    async def reg_ctrl(self, task_id: str):
        """注册任务控制句柄"""
        self.ctrl_handles[task_id] = CtrlHandle(task_id)
    
    async def get_ctrl(self, task_id: str) -> Optional[CtrlHandle]:
        """获取任务控制句柄"""
        return self.ctrl_handles.get(task_id)
    
    async def send_ctrl_event(self, task_id: str, event: CtrlEvent):
        """发送控制事件"""
        ctrl = await self.get_ctrl(task_id)
        if ctrl:
            if event == CtrlEvent.PAUSE:
                await ctrl.pause()
            elif event == CtrlEvent.RESUME:
                await ctrl.resume()
            elif event == CtrlEvent.CANCEL:
                await ctrl.cancel()
```

#### CtrlHandle 设计
```python
class CtrlHandle:
    def __init__(self, task_id: str):
        self.task_id = task_id
        self.cancel_event = asyncio.Event()
        self.pause_event = asyncio.Event()
        self.pause_event.set()  # 默认不暂停
        self.cleaners: List[Callable[[], Awaitable]] = []
    
    async def cancel(self):
        """取消任务"""
        self.cancel_event.set()
        self.pause_event.set()  # 确保任务能退出暂停状态
        await self.run_cleaners()
    
    async def pause(self):
        """暂停任务"""
        self.pause_event.clear()
    
    async def resume(self):
        """恢复任务"""
        self.pause_event.set()
    
    async def wait_if_paused(self):
        """如果暂停则等待"""
        await self.pause_event.wait()
    
    def is_cancelled(self) -> bool:
        """检查是否已取消"""
        return self.cancel_event.is_set()
    
    def reg_cleaner(self, cleaner: Callable[[], Awaitable]):
        """注册清理函数"""
        self.cleaners.append(cleaner)
    
    async def run_cleaners(self):
        """运行所有清理函数"""
        for cleaner in self.cleaners:
            try:
                await cleaner()
            except Exception as e:
                logger.error(f"Cleaner error: {e}")
```

### 2.7 文件组织详细设计

#### 命名模板系统
```python
# 默认模板配置
DEFAULT_TEMPLATES = {
    "series": "{container} - {showtitle} ({downtime:YYYY-MM-DD_HH-mm-ss})",
    "item": "({index}) {mediaType} - {title}",
    "file": "{taskType} - {title}",
}

# 可用变量
VARIABLES = {
    "showtitle": "显示标题",
    "title": "标题",
    "container": "容器类型 (视频/番剧等)",
    "mediaType": "媒体类型",
    "taskType": "任务类型 (Video/Audio等)",
    "index": "序号",
    "pubtime": "发布时间 (支持格式化)",
    "downtime": "下载时间 (支持格式化)",
    "upper": "UP主名称",
    "upperid": "UP主ID",
    "aid": "视频AID",
    "cid": "视频CID",
    "bvid": "BV号",
    "epid": "番剧EPID",
    "ssid": "番剧SSID",
    "res": "清晰度",
    "abr": "音频码率",
    "enc": "编码格式",
    "fmt": "流格式",
}

# 示例输出
# 系列目录: "视频 - 【番剧名】 (2026-04-02_15-30-00)"
# 项目目录: "(01) 视频 - 分P标题"
# 文件名: "Video - 视频标题"
```

### 2.8 错误处理详细设计

#### 错误分类
```python
class ErrorType(Enum):
    NETWORK = "network"      # 网络错误 (可重试)
    AUTH = "auth"            # 认证错误 (不可重试)
    FORMAT = "format"        # 格式错误 (不可重试)
    DISK = "disk"            # 磁盘错误 (不可重试)
    UNKNOWN = "unknown"      # 未知错误 (可重试)

class ErrorHandler:
    async def execute_with_retry(
        self,
        task_id: str,
        func: Callable[[], Awaitable[bool]],
        max_retries: int = 3,
        base_delay: int = 5,
        on_retry: Optional[Callable[[Exception, int], Awaitable[None]]] = None,
        on_failure: Optional[Callable[[Exception], Awaitable[None]]] = None,
    ) -> bool:
        """带指数退避的重试机制"""
        for attempt in range(max_retries):
            try:
                return await func()
            except asyncio.CancelledError:
                return False
            except Exception as e:
                error_info = self.classify_error(e)
                if not error_info["retryable"]:
                    if on_failure:
                        await on_failure(e)
                    return False
                
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)  # 指数退避
                    if on_retry:
                        await on_retry(e, attempt + 1)
                    await asyncio.sleep(delay)
                else:
                    if on_failure:
                        await on_failure(e)
                    return False
        return False
```

## 3. 实施步骤详细分解

### Phase 1: 基础架构 (2天)
**Day 1: 数据模型**
- [ ] 创建 Task 模型
- [ ] 创建 Scheduler 模型  
- [ ] 创建 SubTask 模型
- [ ] 创建状态枚举 (atomics.py)
- [ ] 编写数据库迁移脚本

**Day 2: 服务框架**
- [ ] 创建 TaskManager 类框架
- [ ] 创建 Scheduler 类框架
- [ ] 创建 TaskExecutor 类框架
- [ ] 创建 EventHandler 类框架
- [ ] 单元测试框架

### Phase 2: 队列和调度 (3天)
**Day 3: TaskManager 实现**
- [ ] 实现 submit_task()
- [ ] 实现 plan_scheduler()
- [ ] 实现 move_scheduler()
- [ ] 实现队列状态管理
- [ ] 数据库操作封装

**Day 4: Scheduler 实现**
- [ ] 实现 dispatch()
- [ ] 实现 _process_task()
- [ ] 实现任务并行执行
- [ ] 状态转换逻辑

**Day 5: Runtime 实现**
- [ ] 实现信号量控制
- [ ] 实现 CtrlHandle
- [ ] 实现控制事件处理
- [ ] 并发控制测试

### Phase 3: 任务执行 (3天)
**Day 6: TaskExecutor 基础**
- [ ] 实现 execute()
- [ ] 实现 _execute_subtask()
- [ ] 实现前端数据请求
- [ ] 目录管理逻辑

**Day 7: 媒体处理器**
- [ ] 实现 video.py (视频下载)
- [ ] 实现 audio.py (音频下载)
- [ ] 实现 audioVideo.py (音视频合并)
- [ ] 进度跟踪实现

**Day 8: 资源处理器**
- [ ] 实现 subtitle.py (字幕)
- [ ] 实现 danmaku.py (弹幕)
- [ ] 实现 nfo.py (NFO元数据)
- [ ] 实现 thumb.py (封面)

### Phase 4: API 和 WebSocket (2天)
**Day 9: REST API**
- [ ] 实现任务相关路由
- [ ] 实现调度器相关路由
- [ ] 请求/响应格式
- [ ] 错误处理

**Day 10: WebSocket**
- [ ] 实现 WebSocket 端点
- [ ] 实现事件广播
- [ ] 实现请求/响应机制
- [ ] 连接管理

### Phase 5: 前端重构 (3天)
**Day 11: 状态管理**
- [ ] 重构 Zustand Store
- [ ] 实现 WebSocket 客户端
- [ ] 实现事件处理
- [ ] 状态持久化

**Day 12: UI 组件**
- [ ] 重构任务列表组件
- [ ] 添加调度器列表组件
- [ ] 实现实时进度显示
- [ ] 控制按钮实现

**Day 13: 集成测试**
- [ ] 端到端测试
- [ ] WebSocket 连接测试
- [ ] 并发下载测试
- [ ] UI 响应测试

### Phase 6: 迁移和测试 (2天)
**Day 14: 数据迁移**
- [ ] 完善迁移脚本
- [ ] 数据备份机制
- [ ] 回滚方案
- [ ] 迁移测试

**Day 15: 最终测试**
- [ ] 性能测试
- [ ] 压力测试
- [ ] 错误场景测试
- [ ] 文档更新

## 4. 测试策略

### 单元测试
```python
# tests/test_task_manager.py
async def test_submit_task():
    manager = TaskManager()
    task_view = create_test_task_view()
    task = await manager.submit_task("test_id", task_view)
    assert task.state == TaskState.BACKLOG
    assert task.id == "test_id"

async def test_plan_scheduler():
    # 测试调度器规划
    pass

# tests/test_executor.py
async def test_execute_video_task():
    # 测试视频下载
    pass

async def test_execute_subtitle_task():
    # 测试字幕下载
    pass
```

### 集成测试
```python
# tests/integration/test_download_flow.py
async def test_complete_download_flow():
    """测试完整下载流程"""
    # 1. 提交任务
    # 2. 规划调度器
    # 3. 执行下载
    # 4. 验证文件
    pass

async def test_concurrent_downloads():
    """测试并发下载"""
    # 测试最大并发数限制
    pass

async def test_pause_resume():
    """测试暂停/恢复"""
    pass
```

### E2E 测试
```typescript
// e2e/download.spec.ts
test('complete download flow', async ({ page }) => {
  // 1. 添加下载任务
  // 2. 开始下载
  // 3. 查看进度
  // 4. 暂停/恢复
  // 5. 验证完成
});
```

## 5. 性能优化建议

### 数据库优化
1. **索引优化**
   - 为 state 字段创建索引
   - 为 scheduler_id 创建索引
   - 为 created_at 创建索引

2. **查询优化**
   - 使用批量查询替代循环查询
   - 使用 select 只查询需要的字段
   - 考虑使用读副本

### WebSocket 优化
1. **连接管理**
   - 实现连接池
   - 心跳检测
   - 自动重连

2. **事件优化**
   - 批量发送事件
   - 事件压缩
   - 优先级队列

### 并发优化
1. **信号量策略**
   - 根据任务类型设置不同并发数
   - 动态调整并发数
   - 考虑带宽限制

2. **任务调度**
   - 优先级调度
   - 依赖关系管理
   - 资源预留

## 6. 监控和日志

### 日志级别
```python
# 任务生命周期日志
logger.info(f"Task {task_id} submitted to backlog")
logger.info(f"Scheduler {sid} planned with {len(tasks)} tasks")
logger.info(f"Task {task_id} started")
logger.info(f"Task {task_id} completed")

# 错误日志
logger.error(f"Task {task_id} failed: {error}")
logger.error(f"Subtask {subtask_id} failed: {error}")

# 调试日志
logger.debug(f"WebSocket connected: {client_id}")
logger.debug(f"Queue updated: {queue_type} = {len(queue)}")
```

### 监控指标
1. **任务指标**
   - 任务提交率
   - 任务完成率
   - 任务失败率
   - 平均下载时间

2. **队列指标**
   - 队列长度
   - 队列处理速度
   - 等待时间

3. **系统指标**
   - WebSocket 连接数
   - 并发下载数
   - 内存使用
   - CPU 使用

## 7. 安全考虑

### 认证和授权
1. **WebSocket 认证**
   - 验证连接来源
   - 实现会话管理
   - 防止未授权访问

2. **API 安全**
   - 输入验证
   - 速率限制
   - CORS 配置

### 数据安全
1. **Cookie 管理**
   - 加密存储 SESSDATA
   - 定期刷新
   - 安全传输

2. **文件安全**
   - 路径遍历防护
   - 文件权限控制
   - 临时文件清理

## 8. 回滚计划

### 回滚步骤
1. **停止服务**
   - 停止 FastAPI 服务
   - 停止 WebSocket 连接

2. **数据库回滚**
   - 执行回滚脚本
   - 恢复旧数据

3. **代码回滚**
   - 切换到旧版本代码
   - 重新部署

4. **验证**
   - 功能测试
   - 性能测试

### 备份策略
1. **数据库备份**
   - 每日全量备份
   - 实时增量备份

2. **代码备份**
   - Git 标签
   - 发布包备份

---

**文档版本**: 2.0  
**最后更新**: 2026-04-02  
**作者**: PiliNote Development Team
