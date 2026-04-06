# bili-sync 工作流深度解析：收藏夹视频与任务调度

## 目录

1. [整体架构](#整体架构)
2. [工作流执行流程](#工作流执行流程)
3. [收藏夹视频获取机制](#收藏夹视频获取机制)
4. [视频添加到下载列表](#视频添加到下载列表)
5. [Tokio Cron Scheduler 任务调度](#tokio-cron-scheduler-任务调度)
6. [定时任务 vs 手动触发](#定时任务-vs-手动触发)
7. [关键代码示例](#关键代码示例)
8. [与 PiliNote 的对比与借鉴](#与-pilinote-的对比与借鉴)

---

## 整体架构

### 三层结构

```
Video Source（视频源）
    ↓
Video（视频）
    ↓
Page（分页）
```

### 数据流

```
定时任务触发
    ↓
遍历所有启用的视频源（包括收藏夹）
    ↓
1. 扫描视频源 → 获取新视频列表 → 写入数据库
    ↓
2. 填充视频详情 → 获取标签、分页信息 → 创建 Page 记录
    ↓
3. 筛选待下载视频 → 并发下载（封面、视频、NFO、弹幕）
    ↓
更新下载状态 → 发送通知
```

---

## 工作流执行流程

### 主入口：download_video()

**位置**：`crates/bili_sync/src/workflow.rs`

```rust
pub async fn download_video(
    connection: &DatabaseConnection,
    bili_client: &BiliClient,
    config: &Config,
) -> Result<()> {
    // 1. 获取所有启用的视频源
    let video_sources = get_enabled_video_sources(connection).await?;
    
    // 2. 初始化模板引擎
    let template = create_template(&config.file_path)?;
    
    // 3. 遍历每个视频源
    for video_source in video_sources {
        process_video_source(
            video_source,
            bili_client,
            connection,
            &template,
            config,
        ).await?;
    }
    
    Ok(())
}
```

### 核心流程：process_video_source()

这是处理单个视频源的核心函数，包含三个关键步骤：

```rust
pub async fn process_video_source(
    video_source: VideoSourceEnum,
    bili_client: &BiliClient,
    connection: &DatabaseConnection,
    template: &handlebars::Handlebars<'_>,
    config: &Config,
) -> Result<()> {
    // 步骤 0：预创建视频源目录
    video_source.create_dir_all().await?;
    
    // ===== 步骤 1：扫描视频源 =====
    let (video_source, video_streams) = video_source
        .refresh(bili_client, &config.credential, connection)
        .await?;
    
    // 将视频流写入数据库
    refresh_video_source(&video_source, video_streams, connection).await?;
    
    // ===== 步骤 2：填充视频详情 =====
    fetch_video_details(bili_client, &video_source, connection, config).await?;
    
    // ===== 步骤 3：下载未处理的视频 =====
    if !ARGS.scan_only {
        let download_notify_info =
            download_unprocessed_videos(
                bili_client,
                &video_source,
                connection,
                template,
                config
            ).await?;
        
        // 发送通知（如果配置了）
        if download_notify_info.should_notify() {
            notify(config, bili_client, download_notify_info);
        }
    }
    
    Ok(())
}
```

---

## 收藏夹视频获取机制

### 1. 收藏夹适配器

**位置**：`crates/bili_sync/src/adapter/favorite.rs`

收藏夹实现了 `VideoSource` trait：

```rust
impl VideoSource for favorite::Model {
    // 定义筛选条件：通过 favorite_id 关联
    fn filter_expr(&self) -> SimpleExpr {
        video::Column::FavoriteId.eq(self.id)
    }

    async fn refresh<'a>(
        self,
        bili_client: &'a BiliClient,
        credential: &'a Credential,
        connection: &'a DatabaseConnection,
    ) -> Result<(
        VideoSourceEnum,
        Pin<Box<dyn Stream<Item = Result<VideoInfo>> + Send + 'a>>,
    )> {
        // 创建收藏夹 API 客户端
        let favorite = FavoriteList::new(
            bili_client,
            self.f_id.to_string(),
            credential
        );
        
        // 获取收藏夹信息（可能更新名称）
        let favorite_info = favorite.get_info().await?;
        
        // 更新数据库中的收藏夹信息
        let updated_model = self.clone();
        
        // 返回更新后的模型和视频流
        Ok((
            updated_model.into(),
            Box::pin(favorite.into_video_stream())
        ))
    }
}
```

### 2. 收藏夹 API 封装

**位置**：`crates/bili_sync/src/bilibili/favorite_list.rs`

```rust
pub struct FavoriteList<'a> {
    client: &'a BiliClient,
    fid: String,
    credential: &'a Credential,
}

impl<'a> FavoriteList<'a> {
    /// 获取收藏夹信息
    pub async fn get_info(&self) -> Result<serde_json::Value> {
        let url = format!(
            "https://api.bilibili.com/x/v3/fav/folder/info?media_id={}",
            self.fid
        );
        
        let response = self.client
            .get(&url)
            .header("Cookie", self.credential.to_cookie_str())
            .send()
            .await?;
        
        Ok(response.json().await?)
    }

    /// 获取收藏夹视频列表（分页）
    pub async fn get_videos(&self, page: i32) -> Result<serde_json::Value> {
        let url = format!(
            "https://api.bilibili.com/x/v3/fav/resource/list?media_id={}&pn={}&ps=20&keyword=&order=mtime&type=0&tid=0",
            self.fid, page
        );
        
        let response = self.client
            .get(&url)
            .header("Cookie", self.credential.to_cookie_str())
            .send()
            .await?;
        
        Ok(response.json().await?)
    }

    /// 将收藏夹转换为视频流
    pub fn into_video_stream(self) -> impl Stream<Item = Result<VideoInfo>> + 'a {
        try_stream! {
            let mut page = 1;
            loop {
                // 获取当前页的视频
                let mut videos = self.get_videos(page).await?;
                let medias = &mut videos["data"]["medias"];
                
                // 检查是否有视频
                if medias.as_array().is_none_or(|v| v.is_empty()) {
                    if page == 1 {
                        break;  // 空收藏夹
                    }
                    Err(anyhow!("no medias found in favorite {} page {}", self.fid, page))?;
                }
                
                // 解析视频信息
                let videos_info: Vec<VideoInfo> = serde_json::from_value(medias.take())?;
                
                for video_info in videos_info {
                    yield video_info;  // 流式返回每个视频
                }
                
                // 检查是否有下一页
                let has_more = &videos["data"]["has_more"];
                if let Some(v) = has_more.as_bool() {
                    if v {
                        page += 1;
                        continue;  // 继续下一页
                    }
                }
                break;  // 没有更多页
            }
        }
    }
}
```

### 3. 关键特性

#### 流式处理
- 使用 `async_stream::try_stream!` 宏创建异步流
- 惰性求值，只在需要时才请求下一页
- 内存友好，不会一次性加载所有视频

#### 分页请求
- 每页 20 个视频
- 通过 `has_more` 字段判断是否还有下一页
- 自动处理分页逻辑

#### 排序方式
- `order=mtime` - 按修改时间排序（收藏时间）
- 新收藏的视频在前

#### 停止条件
1. 返回的视频列表为空
2. `has_more` 为 false

---

## 视频添加到下载列表

### 1. 写入数据库

**位置**：`crates/bili_sync/src/utils/model.rs`

```rust
pub async fn refresh_video_source(
    video_source: &VideoSourceEnum,
    mut video_streams: Pin<Box<dyn Stream<Item = Result<VideoInfo>> + Send>>,
    connection: &DatabaseConnection,
) -> Result<()> {
    let mut videos_info = Vec::new();
    
    // 收集所有视频信息
    while let Some(video_info) = video_streams.next().await {
        let video_info = video_info?;
        videos_info.push(video_info);
    }
    
    // 批量写入数据库
    create_videos(videos_info, video_source, connection).await?;
    
    Ok(())
}

pub async fn create_videos(
    videos_info: Vec<VideoInfo>,
    video_source: &VideoSourceEnum,
    connection: &DatabaseConnection,
) -> Result<()> {
    // 转换为数据库模型
    let video_models = videos_info
        .into_iter()
        .map(|v| {
            let mut model = v.into_simple_model();
            video_source.set_relation_id(&mut model);  // 设置关联 ID
            model
        })
        .collect::<Vec<_>>();
    
    // 使用 ON CONFLICT DO NOTHING 避免重复插入
    video::Entity::insert_many(video_models)
        .on_conflict(
            OnConflict::new()
                .do_nothing()
                .to_owned()
        )
        .do_nothing()
        .exec(connection)
        .await?;
    
    Ok(())
}
```

### 2. 填充视频详情

```rust
pub async fn fetch_video_details(
    bili_client: &BiliClient,
    video_source: &VideoSourceEnum,
    connection: &DatabaseConnection,
    config: &Config,
) -> Result<()> {
    // 筛选未填充的视频
    let videos = video::Entity::find()
        .filter(
            video::Column::VideoSourceFilter(video_source.filter_expr())
                .and(video::Column::Fetched.eq(false))  // 未获取详情
        )
        .all(connection)
        .await?;
    
    // 并发获取视频详情
    let tasks = videos.into_iter().map(|video| {
        let bili_client = bili_client.clone();
        async move {
            let video_detail = bili_client
                .fetch_video_detail(&video.bvid, &config.credential)
                .await?;
            
            // 更新视频信息（标签等）
            update_video_info(connection, video.id, &video_detail).await?;
            
            // 创建分页记录
            create_pages(connection, video.id, &video_detail.pages).await?;
            
            // 评估是否应该下载
            evaluate_should_download(connection, video.id, &video_detail).await?;
            
            Ok(())
        }
    });
    
    // 等待所有任务完成
    join_all(tasks).await.into_iter().collect::<Result<Vec<_>>>()?;
    
    Ok(())
}
```

### 3. 筛选待下载视频

```rust
pub async fn filter_unhandled_video_pages(
    additional_expr: SimpleExpr,
    connection: &DatabaseConnection,
) -> Result<Vec<(video::Model, Vec<page::Model>)>> {
    video::Entity::find()
        .filter(
            video::Column::Valid
                .eq(true)                              // 视频有效
                .and(video::Column::DownloadStatus.lt(STATUS_COMPLETED))  // 未下载完成
                .and(video::Column::Category.eq(2))    // 类别为 2（视频）
                .and(video::Column::SinglePage.is_not_null())  // 已填充分页
                .and(video::Column::ShouldDownload.eq(true))  // 应该下载
                .and(additional_expr),                  // 额外的筛选条件（如 favorite_id）
        )
        .find_with_related(page::Entity)               // 关联查询分页
        .all(connection)
        .await
}
```

**筛选条件解析**：

| 条件 | 说明 |
|------|------|
| `valid = true` | 视未被删除或设为无效 |
| `download_status < STATUS_COMPLETED` | 未完全下载（可能部分完成） |
| `category = 2` | 视频类型（1=音频，2=视频） |
| `single_page IS NOT NULL` | 已填充分页信息 |
| `should_download = true` | 符合下载条件（质量、编码等） |
| `favorite_id = ?` | 属于指定的收藏夹 |

### 4. 下载状态管理

**状态位掩码**：

```rust
const STATUS_COVER: i32 = 1 << 0;      // 封面
const STATUS_VIDEO: i32 = 1 << 1;      // 视频
const STATUS_NFO: i32 = 1 << 2;        // NFO
const STATUS_DANMAKU: i32 = 1 << 3;    // 弹幕
const STATUS_COMPLETED: i32 = STATUS_COVER | STATUS_VIDEO | STATUS_NFO | STATUS_DANMAKU;
```

**状态判断**：

```rust
// 检查是否需要下载视频
if (status & STATUS_VIDEO) == 0 {
    download_video().await?;
}

// 标记视频下载完成
status |= STATUS_VIDEO;
```

**失败重试**：

```rust
// 失败计数存储在 status 的高位
const FAILED_BIT_OFFSET = 16;

fn increment_failed_count(status: i32) -> i32 {
    let failed_count = (status >> FAILED_BIT_OFFSET) & 0xFFFF;
    status + (1 << FAILED_BIT_OFFSET)
}

fn should_retry(status: i32, max_retries: i32) -> bool {
    let failed_count = (status >> FAILED_BIT_OFFSET) & 0xFFFF;
    failed_count < max_retries
}
```

---

## Tokio Cron Scheduler 任务调度

### 1. 调度器初始化

**位置**：`crates/bili_sync/src/task/video_downloader.rs`

```rust
impl DownloadTaskManager {
    pub async fn new(
        connection: DatabaseConnection,
        bili_client: Arc<BiliClient>,
    ) -> Result<Self> {
        // 创建调度器
        let sched = Arc::new(tokio::sync::Mutex::new(JobScheduler::new().await?));
        
        // 获取初始配置
        let initial_config = Config::get().snapshot();
        
        // 创建任务上下文
        let cx = Arc::new(TaskContext {
            connection,
            bili_client,
            config: initial_config.clone(),
            running: Arc::new(Mutex::new(false)),
            status_tx: broadcast::channel(10).0,
        });
        
        // ===== 添加凭据刷新任务 =====
        // 每天凌晨 1 点执行
        sched.lock().await.add(Job::new_async_tz(
            "0 0 1 * * *",  // Cron 表达式：秒 分 时 日 月 周
            chrono::Local,
            DownloadTaskManager::check_and_refresh_credential_task(cx.clone()),
        )?).await?;
        
        // ===== 添加视频下载任务 =====
        let job_run = DownloadTaskManager::download_video_task(cx.clone());
        let job = match &initial_config.interval {
            Trigger::Interval(interval) => {
                // 间隔模式：每 N 秒执行一次
                Job::new_repeated_async(
                    Duration::from_secs(*interval),
                    job_run
                )?
            }
            Trigger::Cron(cron) => {
                // Cron 模式：按 Cron 表达式执行
                Job::new_async_tz(
                    cron,
                    chrono::Local,
                    job_run
                )?
            }
        };
        
        sched.lock().await.add(job).await?;
        
        // ===== 启动配置变更监听 =====
        // 当配置更新时，动态调整任务调度
        let (config_rx, _) = Config::subscribe();
        let sched_clone = Arc::clone(&sched);
        tokio::spawn(async move {
            while rx.changed().await.is_ok() {
                let new_config = rx.borrow().clone();
                
                // 移除旧任务
                if let Some(old_video_task_id) = *video_task_id {
                    sched_clone.lock().await.remove(&old_video_task_id).await?;
                }
                
                // 创建新任务
                let job = match &new_config.interval {
                    Trigger::Interval(interval) => {
                        Job::new_repeated_async(
                            Duration::from_secs(*interval),
                            job_run.clone()
                        )?
                    }
                    Trigger::Cron(cron) => {
                        Job::new_async_tz(
                            cron,
                            chrono::Local,
                            job_run.clone()
                        )?
                    }
                };
                
                // 添加新任务
                *video_task_id = sched_clone.lock().await.add(job).await?;
            }
        });
        
        Ok(Self { sched, cx, shutdown_rx })
    }
}
```

### 2. 触发模式配置

**位置**：`crates/bili_sync/src/config/item.rs`

```rust
#[derive(Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum Trigger {
    /// 间隔模式：每 N 秒执行一次
    Interval(u64),
    
    /// Cron 模式：按 Cron 表达式执行
    Cron(String),
}

impl Default for Trigger {
    fn default() -> Self {
        Trigger::Interval(1200)  // 默认 20 分钟
    }
}
```

**配置示例**：

```toml
# 间隔模式：每 1 小时执行一次
interval = 3600

# Cron 模式：每天凌晨 2 点执行
interval = "0 0 2 * * *"

# Cron 模式：每 30 分钟执行一次
interval = "0 */30 * * * *"

# Cron 模式：工作日上午 9 点执行
interval = "0 0 9 * * 1-5"
```

### 3. 任务执行逻辑

```rust
fn download_video_task(
    cx: Arc<TaskContext>,
) -> impl FnMut(uuid::Uuid, JobScheduler) -> Pin<Box<dyn Future<Output = ()> + Send>> {
    move |uuid, mut l| {
        let cx = cx.clone();
        Box::pin(async move {
            // ===== 防并发保护 =====
            let Ok(_lock) = cx.running.try_lock() else {
                warn!("上一次视频下载任务尚未结束，跳过本次执行..");
                return;
            };
            
            // ===== 更新状态为运行中 =====
            let last_status = cx.status_tx.borrow().clone();
            let _ = cx.status_tx.send(TaskStatus {
                is_running: true,
                last_run: Some(chrono::Local::now()),
                last_finish: None,
                next_run: None,
            });
            
            info!("开始执行本轮视频下载任务..");
            
            // ===== 执行下载逻辑 =====
            let mut config = Config::get().snapshot();
            match download_video(&cx.connection, &cx.bili_client, &mut config).await {
                Ok(_) => {
                    info!("本轮视频下载任务执行完毕");
                }
                Err(e) => {
                    error_and_notify(
                        &config,
                        &cx.bili_client,
                        format!("本轮视频下载任务执行遇到错误：{:#}", e)
                    );
                }
            }
            
            // ===== 获取下次运行时间 =====
            let next_run = l.next_tick_for_job(uuid).await
                .ok()
                .flatten()
                .map(|dt| dt.with_timezone(&chrono::Local));
            
            // ===== 更新状态为完成 =====
            let _ = cx.status_tx.send(TaskStatus {
                is_running: false,
                last_run: last_status.last_run,
                last_finish: Some(chrono::Local::now()),
                next_run,
            });
        })
    }
}
```

---

## 定时任务 vs 手动触发

### 定时任务

**创建方式**：

```rust
// 间隔模式
Job::new_repeated_async(
    Duration::from_secs(interval),
    job_run
)

// Cron 模式
Job::new_async_tz(
    cron_expression,
    chrono::Local,
    job_run
)
```

**特点**：
- 持续运行，直到程序退出或配置更新
- 自动触发，无需人工干预
- 支持复杂的 Cron 表达式

### 手动触发

**实现方式**：

```rust
pub async fn download_once(&self) -> Result<()> {
    self.sched.lock().await.add(Job::new_one_shot_async(
        Duration::from_secs(0),  // 立即执行
        DownloadTaskManager::download_video_task(self.cx.clone()),
    )?).await?;
    Ok(())
}
```

**特点**：
- 立即执行，无需等待
- 执行一次后自动清理
- 共享相同的执行逻辑和防并发保护

### 对比表格

| 特性 | 定时任务 | 手动触发 |
|------|----------|----------|
| **创建方式** | `new_repeated_async` / `new_async_tz` | `new_one_shot_async(Duration::from_secs(0))` |
| **触发时机** | 按间隔或 Cron 表达式 | 立即执行 |
| **生命周期** | 持续运行直到程序退出或配置更新 | 执行一次后自动清理 |
| **防并发** | 通过 `running` Mutex 保护 | 共享相同的保护机制 |
| **执行逻辑** | 相同的 `download_video_task` | 相同的 `download_video_task` |
| **状态更新** | 更新 `next_run` 时间 | 不更新 `next_run` |
| **适用场景** | 定期同步、自动备份 | 立即下载、测试调试 |

---

## 关键代码示例

### 完整的收藏夹处理流程

```rust
// 1. 获取收藏夹视频流
let favorite = FavoriteList::new(
    &bili_client,
    "12345678".to_string(),  // media_id
    &credential
);

let video_stream = favorite.into_video_stream();

// 2. 写入数据库
let videos_info: Vec<VideoInfo> = video_stream
    .try_collect()
    .await?;

video::Entity::insert_many(
    videos_info
        .into_iter()
        .map(|v| {
            let mut model = v.into_simple_model();
            model.favorite_id = Some(1);  // 关联收藏夹 ID
            model
        })
        .collect()
)
.on_conflict(OnConflict::new().do_nothing().to_owned())
.do_nothing()
.exec(connection)
.await?;

// 3. 获取视频详情
let videos = video::Entity::find()
    .filter(
        video::Column::FavoriteId.eq(1)
            .and(video::Column::Fetched.eq(false))
    )
    .all(connection)
    .await?;

for video in videos {
    let detail = bili_client
        .fetch_video_detail(&video.bvid, &credential)
        .await?;
    
    // 更新视频信息
    video::Entity::update(video.clone())
        .col_expr(video::Column::Fetched, Expr::value(true))
        .col_expr(video::Column::Tags, Expr::value(detail.tags))
        .exec(connection)
        .await?;
    
    // 创建分页
    page::Entity::insert_many(
        detail.pages
            .into_iter()
            .map(|p| page::ActiveModel {
                video_id: Set(video.id),
                cid: Set(p.cid),
                title: Set(p.part),
                ..Default::default()
            })
            .collect()
    )
    .exec(connection)
    .await?;
}

// 4. 下载视频
let videos_to_download = video::Entity::find()
    .filter(
        video::Column::FavoriteId.eq(1)
            .and(video::Column::DownloadStatus.lt(STATUS_COMPLETED))
            .and(video::Column::ShouldDownload.eq(true))
    )
    .find_with_related(page::Entity)
    .all(connection)
    .await?;

for (video, pages) in videos_to_download {
    for page in pages {
        download_video_page(&video, &page).await?;
    }
}
```

### Cron 表达式示例

```rust
// 每分钟执行
"0 * * * * *"

// 每小时执行
"0 0 * * * *"

// 每天凌晨 2 点执行
"0 0 2 * * *"

// 每 30 分钟执行
"0 */30 * * * *"

// 工作日上午 9 点执行（周一到周五）
"0 0 9 * * 1-5"

// 每月 1 号凌晨 3 点执行
"0 0 3 1 * *"

// 每周日凌晨 4 点执行
"0 0 4 * * 0"
```

---

## 与 PiliNote 的对比与借鉴

### bili-sync 的优势

1. **流式处理**：使用 Stream 惰性处理视频列表，内存效率高
2. **位掩码状态管理**：使用位掩码记录下载状态，支持部分重试
3. **动态任务调度**：支持配置变更时动态调整调度策略
4. **防并发保护**：通过 Mutex 防止任务并发执行
5. **完整的错误处理**：包括风控检测、失败重试、通知机制

### 对 PiliNote 的借鉴

#### 1. 任务调度架构

```python
# PiliNote 可以借鉴的架构
from apscheduler.schedulers.asyncio import AsyncIOScheduler

class TaskScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.running = False
        self.lock = asyncio.Lock()
    
    async def start(self):
        self.scheduler.start()
    
    async def add_interval_task(self, interval_seconds, task_func):
        self.scheduler.add_job(
            task_func,
            'interval',
            seconds=interval_seconds,
            id='download_task'
        )
    
    async def add_cron_task(self, cron_expression, task_func):
        self.scheduler.add_job(
            task_func,
            'cron',
            **parse_cron(cron_expression),
            id='download_task'
        )
    
    async def trigger_once(self, task_func):
        async with self.lock:
            if self.running:
                return
            self.running = True
            try:
                await task_func()
            finally:
                self.running = False
```

#### 2. 收藏夹扫描流程

```python
# PiliNote 可以借鉴的流程
async def process_favorite(favorite_id: int):
    # 1. 获取收藏夹视频流
    async for video_info in get_favorite_videos_stream(favorite_id):
        # 2. 写入数据库（避免重复）
        await upsert_video(video_info, favorite_id)
    
    # 3. 填充视频详情
    videos = await get_unfilled_videos(favorite_id)
    for video in videos:
        detail = await fetch_video_detail(video.bvid)
        await update_video_info(video.id, detail)
        await create_pages(video.id, detail.pages)
    
    # 4. 下载视频
    videos_to_download = await get_videos_to_download(favorite_id)
    for video in videos_to_download:
        await download_video(video)
```

#### 3. 状态管理

```python
# PiliNote 可以借鉴的状态管理
class DownloadStatus:
    COVER = 1 << 0
    VIDEO = 1 << 1
    AUDIO = 1 << 2
    SUBTITLE = 1 << 3
    DANMAKU = 1 << 4
    COMPLETED = COVER | VIDEO | AUDIO | SUBTITLE | DANMAKU
    
    @staticmethod
    def is_completed(status: int) -> bool:
        return status == DownloadStatus.COMPLETED
    
    @staticmethod
    def needs_download(status: int, part: int) -> bool:
        return (status & part) == 0
    
    @staticmethod
    def mark_completed(status: int, part: int) -> int:
        return status | part
```

### 实现建议

1. **采用 APScheduler**：Python 的任务调度库，支持 Interval 和 Cron
2. **使用异步生成器**：实现流式处理，避免一次性加载所有数据
3. **位掩码状态**：使用位运算管理下载状态
4. **动态配置**：支持配置变更时动态调整任务
5. **防并发**：使用 asyncio.Lock 防止任务并发执行

---

## 总结

bili-sync 的任务调度和收藏夹处理机制具有以下特点：

1. **模块化设计**：清晰的分层架构，易于维护和扩展
2. **流式处理**：使用 Stream 惰性处理，内存效率高
3. **灵活调度**：支持 Interval 和 Cron 两种模式
4. **动态配置**：支持运行时调整调度策略
5. **防并发**：通过 Mutex 保护，防止任务冲突
6. **完整状态管理**：位掩码记录状态，支持部分重试
7. **错误恢复**：包括失败重试、风控处理、通知机制

这些设计理念和实现方式对 PiliNote 项目具有重要的参考价值，特别是在任务调度、收藏夹扫描和状态管理方面。