# BiliTools 下载管理深度分析

本文档聚焦于 BiliTools 项目的下载管理核心机制，包括任务生命周期、队列系统、并发控制、状态转换等关键实现。

## 目录
1. [下载任务生命周期](#1-下载任务生命周期)
2. [队列系统架构](#2-队列系统架构)
3. [调度器和并发控制](#3-调度器和并发控制)
4. [状态转换和事件系统](#4-状态转换和事件系统)
5. [前后端通信机制](#5-前后端通信机制)
6. [错误处理和重试机制](#6-错误处理和重试机制)
7. [进度跟踪和同步](#7-进度跟踪和同步)
8. [关键实现文件](#8-关键实现文件)

---

## 1. 下载任务生命周期

### 1.1 任务创建和提交

**前端提交流程** (`src/services/queue.ts`):

```typescript
// 1. 构建任务视图
const view: backend.TaskView = {
  meta: {
    id,                                    // 随机8位字符串
    ts: Math.floor(Date.now() / 1000),    // 时间戳
    seq: queue.backlog.length,            // 序列号
    item: detach(info.list[idx]),         // 媒体信息
    type: detach(info.type),              // 媒体类型
  },
  prepare: {
    select: detach(select),               // 用户选择（清晰度、格式等）
    subtasks,                             // 子任务列表
    nfo: detach(info.nfo),               // 元数据
    folder: String(),                     // 输出目录（后端填充）
  },
  hot: {
    state: 'backlog',                     // 初始状态
    status,                               // 子任务状态
  },
};

// 2. 提交到后端
const result = await backend.commands.submitTask(id, view);
```

**后端接收** (`src-tauri/src/services/queue/manager.rs`):

```rust
pub async fn submit_task(id: String, value: TaskView) -> TauriResult<()> {
    MANAGER.submit_backlog(id, value).await?;
    Ok(())
}

async fn submit_backlog(&self, id: String, value: TaskView) -> Result<()> {
    // 1. 持久化到数据库
    tasks::upsert(&id, &value).await?;
    
    // 2. 创建内存任务对象
    let task = Task::new(value);
    task.init().await?;
    
    // 3. 添加到内存管理器
    let mut tasks = self.tasks.write().await;
    tasks.insert(id.clone(), task);
    
    // 4. 添加到backlog队列
    let mut queue = self.get_queue(&to).write().await;
    queue.push_back(id.clone());
    
    // 5. 通知前端队列更新
    frontend::queue(&to, &queue)?;
    
    // 6. 持久化队列状态
    queue::upsert(to, &queue).await?;
}
```

### 1.2 任务执行流程

**调度器触发** (`src-tauri/src/services/queue/manager.rs`):

```rust
pub async fn process_scheduler(sid: String) -> TauriResult<()> {
    let scheduler = MANAGER.get_scheduler(&sid).await?;
    
    // 1. 执行调度器
    if scheduler.dispatch().await.is_ok() {
        // 2. 发送完成通知
        if config::read().notify {
            notify_rust::Notification::new()
                .body(&format!("(#{sid}) {folder}\nDownload complete~"))
                .show()?;
        }
    }
    Ok(())
}
```

**任务执行** (`src-tauri/src/services/queue/scheduler.rs`):

```rust
pub async fn dispatch(self: Arc<Self>) -> TauriResult<()> {
    let mut set = JoinSet::new();
    
    for id in self.list.read().await.clone() {
        let task = MANAGER.get_task(&id).await?;
        
        // 1. 获取信号量许可（控制并发）
        let sem = RUNTIME.semaphore.read().await.clone();
        let permit = sem.acquire_owned().await;
        
        // 2. 提交任务到JoinSet
        set.spawn(async move {
            let _permit = permit;  // 保持许可活跃
            
            // 3. 状态转换
            task.state(TaskState::Active).await?;
            MANAGER.move_scheduler(&self.sid, QueueType::Doing).await?;
            
            // 4. 执行任务
            let res = task.process(&self.sid).await;
            
            // 5. 更新状态
            match &res {
                Ok(_) => task.state(TaskState::Completed).await,
                _ => task.state(TaskState::Failed).await,
            }?;
            
            res
        });
    }
    
    // 6. 等待所有任务完成
    let mut ok = true;
    while let Some(res) = set.join_next().await {
        match res {
            Ok(Ok(_)) => (),
            Ok(Err(_)) => ok = false,
            Err(e) => ok = false,
        }
    }
    
    // 7. 更新调度器状态
    if ok {
        MANAGER.move_scheduler(&self.sid, QueueType::Complete).await?;
        self.state(SchedulerState::Completed).await?;
    } else {
        self.state(SchedulerState::Failed).await?;
    }
    
    Ok(())
}
```

---

## 2. 队列系统架构

### 2.1 四级队列设计

**队列类型** (`src-tauri/src/services/queue/atomics.rs`):

```rust
pub enum QueueType {
    Backlog,    // 待处理：用户提交的任务
    Pending,    // 已规划：调度器已创建但未开始
    Doing,      // 执行中：正在下载的任务
    Complete,   // 已完成：成功或失败的任务
}
```

**队列状态转移**:
```
┌─────────────────────────────────────────────────────────┐
│                     任务生命周期                          │
├─────────────────────────────────────────────────────────┤
│  用户提交                                                │
│     ↓                                                   │
│  ┌─────────┐     调度器      ┌─────────┐                 │
│  │ Backlog │ ────────────→  │ Pending │                 │
│  └─────────┘                └─────────┘                 │
│     ↑                           ↓                       │
│  重试/恢复                   开始执行                    │
│     │                           ↓                       │
│     │                       ┌─────────┐                 │
│     │                       │  Doing  │                 │
│     │                       └─────────┘                 │
│     │                           ↓                       │
│     │                    ┌──────────────┐               │
│     └─────────────────── │   Complete   │               │
│                          │ (成功/失败)   │               │
│                          └──────────────┘               │
└─────────────────────────────────────────────────────────┘
```

### 2.2 队列管理器实现

**内存数据结构** (`src-tauri/src/services/queue/manager.rs`):

```rust
pub struct Manager {
    pub schedulers: RwLock<HashMap<String, Arc<Scheduler>>>,  // 调度器
    pub tasks: RwLock<HashMap<String, Arc<Task>>>,           // 任务
    pub backlog: RwLock<VecDeque<String>>,                   // 待处理队列
    pub pending: RwLock<VecDeque<String>>,                   // 已规划队列
    pub doing: RwLock<VecDeque<String>>,                     // 执行中队列
    pub complete: RwLock<VecDeque<String>>,                  // 已完成队列
}
```

**队列操作方法**:
```rust
// 获取指定队列
pub fn get_queue(&self, queue: &QueueType) -> &RwLock<VecDeque<String>> {
    match queue {
        QueueType::Backlog => &self.backlog,
        QueueType::Pending => &self.pending,
        QueueType::Doing => &self.doing,
        QueueType::Complete => &self.complete,
    }
}

// 移动调度器到指定队列
pub async fn move_scheduler(&self, sid: &str, to: QueueType) -> Result<()> {
    let scheduler = self.get_scheduler(sid).await?;
    let from = scheduler.queue.get();
    
    if from == to {
        return Ok(());
    }
    
    // 从原队列移除
    let mut from_queue = self.get_queue(&from).write().await;
    from_queue.retain(|v| v != sid);
    
    // 添加到目标队列
    let mut to_queue = self.get_queue(&to).write().await;
    to_queue.push_back(sid.to_string());
    
    // 更新调度器队列类型
    scheduler.queue(to).await?;
    
    Ok(())
}
```

### 2.3 持久化机制

**数据库表结构** (`src-tauri/src/storage/`):

```rust
// tasks 表
pub struct TaskRow {
    pub id: String,
    pub ts: u64,
    pub seq: usize,
    pub item: serde_json::Value,     // MediaItem
    pub media_type: String,
    pub select: serde_json::Value,   // PopupSelect
    pub subtasks: serde_json::Value, // Vec<SubTask>
    pub nfo: serde_json::Value,      // MediaNfo
    pub folder: String,
    pub status: serde_json::Value,   // HashMap<String, SubTaskStatus>
    pub state: u8,                   // TaskState
}

// queue 表
pub struct QueueRow {
    pub queue_type: u8,  // QueueType
    pub list: String,    // JSON数组
}
```

---

## 3. 调度器和并发控制

### 3.1 调度器设计

**调度器结构** (`src-tauri/src/services/queue/scheduler.rs`):

```rust
pub struct Scheduler {
    pub sid: String,                         // 调度器ID
    pub ts: i64,                            // 创建时间
    pub list: RwLock<Vec<String>>,          // 任务ID列表
    pub queue: Atomic<QueueType>,           // 所在队列
    pub state: Atomic<SchedulerState>,      // 状态
    pub folder: PathBuf,                    // 输出目录
}
```

**调度器创建** (`src-tauri/src/services/queue/manager.rs`):

```rust
async fn plan_scheduler(&self, sid: String, top_folder: PathBuf) -> Result<Arc<Scheduler>> {
    // 1. 从backlog获取所有待处理任务
    let mut from = self.get_queue(&QueueType::Backlog).write().await;
    let list = from.clone();
    from.clear();
    
    // 2. 创建调度器
    let scheduler = Scheduler::new(sid.clone(), list.into(), top_folder);
    
    // 3. 添加到pending队列
    let mut to = self.get_queue(&QueueType::Pending).write().await;
    to.push_back(sid.clone());
    
    // 4. 更新调度器状态
    scheduler.queue(QueueType::Pending).await?;
    
    Ok(scheduler)
}
```

### 3.2 并发控制机制

**信号量控制** (`src-tauri/src/services/queue/runtime.rs`):

```rust
pub struct Runtime {
    pub semaphore: RwLock<Arc<Semaphore>>,  // 并发信号量
    pub max_conc: usize,                    // 最大并发数
    pub ctrl: Ctrl,                         // 控制句柄
}

impl Runtime {
    fn new() -> Self {
        let max_conc = config::read().max_conc;  // 从配置读取
        Self {
            semaphore: RwLock::new(Arc::new(Semaphore::new(max_conc))),
            max_conc,
            ctrl: Ctrl::new(),
        }
    }
    
    // 动态调整并发数
    pub async fn new_conc(&self, value: usize) {
        if value == self.max_conc {
            return;
        }
        
        let mut sem = self.semaphore.write().await;
        if value > self.max_conc {
            sem.add_permits(value - self.max_conc);  // 增加许可
        } else {
            *sem = Arc::new(Semaphore::new(value));  // 重置信号量
        }
    }
}
```

**任务控制句柄**:
```rust
pub struct CtrlHandle {
    pub tx: Sender<CtrlEvent>,           // 控制事件通道
    pub cancel: CancellationToken,       // 取消令牌
    pub paused: AtomicBool,              // 暂停状态
    pub cleaners: RwLock<Vec<CleanFn>>,  // 清理函数列表
    pub epoch: AtomicUsize,              // 代次（用于重试）
}

impl CtrlHandle {
    pub async fn reg_cleaner<Fut>(&self, fut: Fut)
    where
        Fut: Future<Output = TauriResult<()>> + Send + Sync + 'static,
    {
        let cleaner = Box::new(move || Box::pin(fut) as CleanFnFut) as CleanFn;
        self.cleaners.write().await.push(cleaner);
    }
    
    pub async fn clean_all(&self) {
        let cleaners = { self.cleaners.write().await.split_off(0) };
        let mut set = JoinSet::new();
        for c in cleaners {
            set.spawn(async move { let _ = c().await; });
        }
        set.join_all().await;
    }
}
```

---

## 4. 状态转换和事件系统

### 4.1 任务状态定义

**任务状态** (`src-tauri/src/services/queue/atomics.rs`):

```rust
pub enum TaskState {
    Backlog,     // 0: 待处理
    Pending,     // 1: 已规划
    Active,      // 2: 执行中
    Completed,   // 3: 已完成
    Paused,      // 4: 已暂停
    Failed,      // 5: 失败
    Cancelled,   // 6: 已取消
}

pub enum SchedulerState {
    Idle,        // 0: 空闲
    Running,     // 1: 运行中
    Paused,      // 2: 已暂停
    Completed,   // 3: 已完成
    Failed,      // 4: 失败
    Cancelled,   // 5: 已取消
}
```

### 4.2 状态转换逻辑

**任务状态转换** (`src-tauri/src/services/queue/task.rs`):

```rust
impl Task {
    pub async fn state(&self, state: TaskState) -> Result<()> {
        // 1. 更新内存状态
        self.state.set(state);
        
        // 2. 通知前端状态更新
        frontend::task_updated(&self.id, Some(&state), None, None)?;
        
        // 3. 持久化到数据库
        tasks::update_state(&self.id, state as u8).await?;
        Ok(())
    }
    
    pub async fn cancel(&self, sid: &str) -> Result<()> {
        // 1. 设置状态为取消
        self.state.set(TaskState::Cancelled);
        
        // 2. 从调度器移除
        MANAGER.remove(sid, Some(&self.id)).await?;
        
        // 3. 清理资源
        RUNTIME.ctrl.get_handle(&self.id).await?.clean_all().await;
        
        // 4. 通知前端取消
        frontend::task_updated(&self.id, None, None, Some(true))?;
        
        // 5. 删除数据库记录
        tasks::delete(&self.id).await?;
        Ok(())
    }
    
    pub async fn retry(self: Arc<Self>, sid: &str) -> Result<()> {
        // 1. 清理旧资源
        RUNTIME.ctrl.get_handle(&self.id).await?.clean_all().await;
        
        // 2. 重新注册控制句柄
        RUNTIME.ctrl.reg(self.id.clone()).await;
        
        // 3. 重置状态为Pending
        self.state(TaskState::Pending).await?;
        
        // 4. 重新执行任务
        let fut = async move {
            self.state(TaskState::Active).await?;
            self.process(&sid).await?;
            self.state(TaskState::Completed).await?;
            Ok::<(), TauriError>(())
        };
        
        tauri::async_runtime::spawn(async move {
            let _ = fut.await.map_err(|e| process_err(e, "Task Retry"));
        });
        
        Ok(())
    }
}
```

---

## 5. 前后端通信机制

### 5.1 事件系统设计

**后端事件** (`src-tauri/src/services/queue/frontend.rs`):

```rust
pub enum QueueEvent<'a> {
    TaskUpdated {
        id: &'a str,
        state: Option<&'a TaskState>,
        prepare: Option<&'a TaskPrepare>,
        cancelled: Option<bool>,
    },
    SchedulerUpdated {
        id: &'a str,
        state: Option<&'a SchedulerState>,
        queue: Option<&'a QueueType>,
        list: Option<&'a Vec<String>>,
        cancelled: Option<bool>,
    },
    Progress {
        task: &'a str,
        subtask: &'a str,
        content: &'a u64,
        chunk: &'a u64,
    },
    Queue {
        name: &'a QueueType,
        value: &'a VecDeque<String>,
    },
    Request {
        task: &'a str,
        subtask: Option<&'a str>,
        action: &'a RequestAction,
        endpoint: &'a str,
    },
    Error {
        task: &'a str,
        subtask: Option<&'a str>,
        message: &'a str,
        code: Option<isize>,
    },
}
```

### 5.2 请求/响应模式

**后端请求前端数据** (`src-tauri/src/services/queue/frontend.rs`):

```rust
pub async fn request<T: DeserializeOwned + Send + 'static>(
    task: &str,
    subtask: Option<&str>,
    action: &RequestAction,
) -> TauriResult<T> {
    let (tx, rx) = oneshot::channel();
    let app = get_app_handle();
    let endpoint = format!("{task}_{}_{ts}", action.as_string());
    
    // 1. 注册一次性监听器
    app.once(endpoint, move |event| {
        let _ = tx.send(
            serde_json::from_str::<Option<T>>(event.payload())
                .context("Failed to deserialize frontend response"),
        );
    });
    
    // 2. 发送请求事件
    QueueEvent::Request {
        task,
        subtask,
        action,
        endpoint: &endpoint,
    }.emit(app)?;
    
    // 3. 等待响应
    let res = rx.await.context("No response from frontend")??;
    Ok(res.ok_or(anyhow!("Error occurred from frontend"))?)
}
```

**前端事件处理** (`src/services/queue.ts`):

```typescript
export async function handleEvent(event: backend.QueueEvent) {
  const { type } = event;
  const queue = useQueueStore();
  
  switch (type) {
    case 'taskUpdated':
      // 更新任务状态
      if (event.state) {
        queue.tasks[event.id].state = event.state;
      }
      if (event.cancelled) {
        delete queue.tasks[event.id];
      }
      break;
      
    case 'progress':
      // 更新进度
      const status = queue.tasks?.[event.task]?.status?.[event.subtask];
      if (status) {
        status.content = event.content;
        status.chunk = event.chunk;
      }
      break;
      
    case 'request':
      // 处理后端请求
      const task = queue.tasks[event.task];
      const subtask = task.subtasks.find(v => v.id === event.subtask);
      let result = await handleTask(task, event.action, subtask);
      
      // 发送响应
      const app = getCurrentWindow();
      app.emit(event.endpoint, result);
      break;
      
    case 'queue':
      // 更新队列
      queue[event.name] = event.value;
      break;
  }
}
```

---

## 6. 错误处理和重试机制

### 6.1 错误类型和处理

**后端错误处理** (`src-tauri/src/errors.rs`):

```rust
pub struct TauriError {
    pub code: Option<isize>,
    pub message: String,
    pub stack: String,
}

impl TauriError {
    pub fn new(message: impl Into<String>, code: Option<isize>) -> Self {
        Self {
            code,
            message: message.into(),
            stack: String::new(),
        }
    }
}
```

**错误通知前端**:
```rust
pub fn error(
    task: &str,
    subtask: Option<&str>,
    error: &TauriError,
) -> TauriResult<()> {
    let app = get_app_handle();
    QueueEvent::Error {
        task,
        subtask,
        message: &error.message,
        code: error.code.map(|c| c.as_isize()),
    }.emit(app)?;
    Ok(())
}
```

### 6.2 重试机制

**任务重试** (`src-tauri/src/services/queue/task.rs`):

```rust
pub async fn retry(self: Arc<Self>, sid: &str) -> Result<()> {
    // 1. 清理旧资源
    RUNTIME.ctrl.get_handle(&self.id).await?.clean_all().await;
    
    // 2. 重新注册控制句柄
    RUNTIME.ctrl.reg(self.id.clone()).await;
    
    // 3. 重置状态
    self.state(TaskState::Pending).await?;
    
    // 4. 重新执行
    let fut = async move {
        self.state(TaskState::Active).await?;
        self.process(&sid).await?;
        self.state(TaskState::Completed).await?;
        Ok::<(), TauriError>(())
    };
    
    tauri::async_runtime::spawn(async move {
        let _ = fut.await.map_err(|e| process_err(e, "Task Retry"));
    });
    
    Ok(())
}
```

**子任务重试**:
```rust
// 在调度器中重试失败的任务
scheduler.try_join(id, &sub_id, async {
    match task_type {
        TaskType::Video | TaskType::Audio => {
            handle_media(&req, ctrl, &video_urls, &audio_urls, &video_path, &audio_path).await
        }
        // ... 其他任务类型
    }
}).await?;
```

---

## 7. 进度跟踪和同步

### 7.1 进度汇报机制

**子任务进度汇报** (`src-tauri/src/services/queue/task.rs`):

```rust
impl SubTask {
    pub async fn send(&self, content: u64, chunk: u64) -> Result<()> {
        // 1. 通知前端进度
        frontend::progress(&task.id, &self.id, &content, &chunk)?;
        
        // 2. 更新内存状态
        let mut status = task.status.write().await;
        status.insert(self.id.to_string(), SubTaskStatus { chunk, content });
        
        // 3. 持久化到数据库
        tasks::update_status(&task.id, &status).await?;
        
        Ok(())
    }
}
```

**下载进度监控** (`src-tauri/src/services/aria2c.rs`):

```rust
pub async fn download(req: &SubTaskReq, ctrl: Arc<CtrlHandle>, urls: &Vec<String>) -> TauriResult<PathBuf> {
    // 添加下载任务
    ARIA2_RPC.request::<Value>("addUri", vec![
        json!(urls),
        json!({"dir": req.temp, "out": name, "gid": gid}),
    ]).await?;
    
    // 监控进度
    loop {
        let data = ARIA2_RPC.request::<Aria2TellStatus>("tellStatus", vec![json!(gid)]).await?;
        
        let content = data.total_length.parse::<u64>()?;
        let chunk = data.completed_length.parse::<u64>()?;
        
        match data.status.as_str() {
            "active" => {
                if chunk > 0 {
                    sub.send(content, chunk).await?;  // 汇报进度
                }
            },
            "complete" => {
                sub.send(content, content).await?;    // 汇报完成
                break;
            },
            _ => (),
        }
        
        sleep(Duration::from_secs(1)).await;  // 每秒汇报一次
    }
    
    Ok(output)
}
```

### 7.2 前端进度计算

**进度计算** (`src/components/DownPage/Task.vue`):

```typescript
function getProgress(task: Types.Task) {
  const subtasks = task.subtasks;
  let chunk = 0;
  
  // 计算所有子任务的平均进度
  for (const v of Object.values(queue.tasks[task.id].status)) {
    chunk += v.chunk / v.content || 0;
  }
  
  return (chunk / subtasks.length || 0) * 100;
}
```

**进度显示组件**:
```vue
<template>
  <div class="flex w-full gap-2 items-center">
    <ProgressBar :progress="getProgress(task)" />
    <span class="w-14">{{ getProgress(task).toFixed(2) }}%</span>
  </div>
</template>
```

---

## 8. 关键实现文件

### 8.1 后端核心文件

| 文件路径 | 功能描述 |
|----------|----------|
| `src-tauri/src/services/queue/manager.rs` | 队列管理器，负责任务和调度器的创建、移动、删除 |
| `src-tauri/src/services/queue/scheduler.rs` | 调度器实现，负责并行执行多个任务 |
| `src-tauri/src/services/queue/task.rs` | 任务定义，状态转换，重试逻辑 |
| `src-tauri/src/services/queue/handlers.rs` | 任务处理器，执行具体下载逻辑 |
| `src-tauri/src/services/queue/runtime.rs` | 运行时控制，并发管理，任务控制句柄 |
| `src-tauri/src/services/queue/frontend.rs` | 前后端通信，事件系统 |
| `src-tauri/src/services/queue/atomics.rs` | 原子操作，状态枚举定义 |
| `src-tauri/src/services/aria2c.rs` | Aria2c下载引擎集成 |
| `src-tauri/src/commands.rs` | Tauri命令实现 |

### 8.2 前端核心文件

| 文件路径 | 功能描述 |
|----------|----------|
| `src/services/queue.ts` | 队列管理，任务提交，事件处理 |
| `src/services/backend.ts` | Tauri命令绑定（自动生成） |
| `src/store/queue.ts` | Pinia队列状态管理 |
| `src/components/DownPage/Task.vue` | 任务展示组件 |
| `src/components/DownPage/Queue.vue` | 队列展示组件 |
| `src/types/shared.d.ts` | 共享类型定义 |

### 8.3 关键数据结构

**任务视图**:
```rust
pub struct TaskView {
    pub meta: TaskMeta,          // 元数据
    pub prepare: TaskPrepare,    // 准备数据
    pub hot: TaskHotData,        // 热数据
}

pub struct TaskMeta {
    pub id: String,
    pub ts: u64,
    pub seq: usize,
    pub item: MediaItem,
    pub media_type: String,
}

pub struct TaskPrepare {
    pub select: PopupSelect,     // 用户选择
    pub subtasks: Vec<SubTask>,  // 子任务列表
    pub nfo: MediaNfo,           // 元数据
    pub folder: PathBuf,         // 输出目录
}

pub struct TaskHotData {
    pub status: HashMap<String, SubTaskStatus>,  // 子任务状态
    pub state: TaskState,                        // 任务状态
}
```

---

## 总结

BiliTools 的下载管理系统具有以下特点：

1. **清晰的分层架构**：前端负责UI和用户交互，后端负责业务逻辑和下载执行
2. **灵活的队列系统**：四级队列设计，支持任务的生命周期管理
3. **强大的并发控制**：信号量机制控制最大并发数，可动态调整
4. **完善的状态管理**：原子操作确保状态一致性，实时同步到前端
5. **可靠的错误处理**：支持重试、暂停、恢复等操作
6. **实时的进度反馈**：每秒更新下载进度，前端实时显示

这些设计模式和技术选型可以为 PiliNote 的下载管理功能提供重要参考。