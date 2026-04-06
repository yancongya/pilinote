# bili-sync 技术要点总结

## Rust 生态系统应用

### 1. 异步编程

**Tokio 运行时**
```toml
tokio = { version = "1.49.0", features = ["full"] }
```

**特点**：
- 异步 I/O
- 多线程调度器
- 定时器支持
- 信号处理

**使用模式**：
```rust
async fn download_video(url: &str) -> Result<()> {
    let response = reqwest::get(url).await?;
    // 处理响应
    Ok(())
}
```

### 2. Web 框架

**Axum**
```toml
axum = { version = "0.8.8", features = ["macros", "ws"] }
```

**优势**：
- 基于 Tokio 构建
- 类型安全的路由
- WebSocket 支持
- 中间件生态

**示例**：
```rust
let app = Router::new()
    .route("/api/videos", get(get_videos))
    .route("/api/config", post(update_config))
    .layer(FromRefLayer::new(state));
```

### 3. 数据库 ORM

**Sea-ORM**
```toml
sea-orm = { version = "1.1.19", features = [
    "macros",
    "runtime-tokio",
    "sqlx-sqlite",
    "sqlite-use-returning-for-3_35",
] }
```

**特性**：
- 异步 ORM
- 自动迁移
- 类型安全查询
- 关系映射

**示例**：
```rust
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "video")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub bvid: String,
    pub title: String,
}
```

### 4. HTTP 客户端

**Reqwest**
```toml
reqwest = { version = "0.13.1", features = [
    "query",
    "form",
    "charset",
    "cookies",
    "gzip",
    "http2",
    "json",
    "rustls-no-provider",
    "stream",
], default-features = false }
```

**特性**：
- 异步请求
- Cookie 管理
- HTTP/2 支持
- 流式下载
- 自定义 TLS

**使用**：
```rust
let client = reqwest::Client::builder()
    .cookie_store(true)
    .use_rustls()
    .build()?;

let response = client
    .get("https://api.bilibili.com/x/video/playurl")
    .query(&[("bvid", "BV1xx411c7mD")])
    .send()
    .await?;
```

### 5. 序列化

**Serde**
```toml
serde = { version = "1.0.228", features = ["derive"] }
serde_json = "1.0.148"
```

**应用**：
- API 响应解析
- 配置文件处理
- 数据持久化

**示例**：
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct VideoInfo {
    pub bvid: String,
    pub title: String,
    pub pages: Vec<Page>,
}
```

## 并发与同步

### 1. 多级并发控制

**Semaphore 限制**：
```rust
let video_semaphore = Arc::new(Semaphore::new(3));
let page_semaphore = Arc::new(Semaphore::new(2));
```

**使用模式**：
```rust
async fn process_videos(videos: Vec<Video>) {
    let tasks = videos.into_iter().map(|video| {
        let semaphore = Arc::clone(&video_semaphore);
        tokio::spawn(async move {
            let _permit = semaphore.acquire().await;
            process_video(video).await
        })
    });
    join_all(tasks).await;
}
```

### 2. 漏桶算法（限流）

**Leaky Bucket**
```toml
leaky-bucket = "1.1.2"
```

**实现**：
```rust
use leaky_bucket::LeakyBucket;

let rate_limiter = LeakyBucket::builder()
    .max(5)  // 最大容量
    .refill_interval(Duration::from_millis(200))  // 每次补充间隔
    .tokens(5)  // 初始令牌数
    .build();

// 使用
rate_limiter.acquire(1).await;  // 获取 1 个令牌
make_api_request().await;
```

**配置示例**：
```
时间间隔: 1000ms
限制请求数: 5
```

表示每秒最多 5 个请求。

### 3. 并发数据结构

**DashMap**
```toml
dashmap = "6.1.0"
```

**特性**：
- 并发安全的 HashMap
- 高性能
- 细粒度锁

**使用**：
```rust
use dashmap::DashMap;

let cache: DashMap<String, VideoInfo> = DashMap::new();

// 并发插入
cache.insert("BV1xx411c7mD".to_string(), video_info);

// 并发读取
if let Some(info) = cache.get("BV1xx411c7mD") {
    // 使用 info
}
```

## 网络与 I/O

### 1. 流式下载

**使用 reqwest stream**：
```rust
async fn download_stream(url: &str, path: &Path) -> Result<()> {
    let response = reqwest::get(url).await?;
    let mut stream = response.bytes_stream();

    let mut file = File::create(path).await?;
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk).await?;
    }
    
    Ok(())
}
```

### 2. 分块下载

**实现**：
```rust
async fn download_chunked(url: &str, path: &Path, chunk_size: usize) -> Result<()> {
    let file_size = get_file_size(url).await?;
    let chunk_count = (file_size / chunk_size as u64) as usize + 1;

    let mut file = File::create(path).await?;
    file.set_len(file_size).await?;

    let tasks: Vec<_> = (0..chunk_count).map(|i| {
        let start = i * chunk_size;
        let end = std::cmp::min(start + chunk_size - 1, file_size as usize);
        let url = url.clone();
        let path = path.clone();

        tokio::spawn(async move {
            download_range(&url, &path, start, end).await
        })
    }).collect();

    join_all(tasks).await;
    Ok(())
}
```

**Range 请求**：
```rust
async fn download_range(url: &str, path: &Path, start: usize, end: usize) -> Result<()> {
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .header("Range", format!("bytes={}-{}", start, end))
        .send()
        .await?;

    let mut file = OpenOptions::new()
        .write(true)
        .open(path)?;

    file.seek(SeekFrom::Start(start as u64))?;
    file.write_all(&response.bytes().await?)?;

    Ok(())
}
```

## 加密与安全

### 1. RSA 加密

**RSA 库**
```toml
rsa = { version = "0.10.0-rc.9", features = ["sha2"] }
```

**使用**：
```rust
use rsa::{RsaPrivateKey, Pkcs1v15Encrypt};

// 生成密钥对
let private_key = RsaPrivateKey::new(&mut OsRng, 2048)?;

// 加密
let public_key = &private_key.to_public_key();
let encrypted = public_key.encrypt(&mut OsRng, Pkcs1v15Encrypt, data)?;

// 解密
let decrypted = private_key.decrypt(Pkcs1v15Encrypt, &encrypted)?;
```

### 2. TLS 配置

**Rustls**
```toml
rustls = { version = "0.23.36", default-features = false, features = ["ring"] }
```

**配置**：
```rust
let tls_config = ClientConfig::builder()
    .with_provider(Arc::new(rustls::crypto::ring::default_provider()))
    .with_protocol_versions(&[&TLS12, &TLS13])?
    .with_native_roots()?
    .with_no_client_auth()?;

let client = reqwest::Client::builder()
    .use_preconfigured_tls(tls_config)
    .build()?;
```

## 模板引擎

### Handlebars

```toml
handlebars = "6.4.0"
```

**使用**：
```rust
use handlebars::Handlebars;

let mut handlebars = Handlebars::new();
handlebars.register_template_string("video_name", "{{ upper_name }}/{{ title }}")?;

let data = serde_json::json!({
    "upper_name": "UP主名称",
    "title": "视频标题"
});

let result = handlebars.render("video_name", &data)?;
```

**自定义函数**：
```rust
handlebars.register_helper("truncate", Box::new(truncate_helper));

fn truncate_helper(
    h: &Helper,
    _: &Handlebars,
    ctx: &Context,
    _: &mut RenderContext,
    out: &mut dyn Output,
) -> Result<(), RenderError> {
    let param = h.param(0).unwrap();
    let length = h.param(1).unwrap().value().as_u64().unwrap() as usize;
    let text = param.value().as_str().unwrap();
    out.write(&text[..length.min(text.len())])?;
    Ok(())
}
```

## 日志与追踪

### Tracing

```toml
tracing = "0.1.44"
tracing-subscriber = { version = "0.3.22", features = ["chrono", "json"] }
```

**初始化**：
```rust
use tracing_subscriber::{fmt, EnvFilter};

tracing_subscriber::fmt()
    .with_env_filter(EnvFilter::from_default_env())
    .with_target(true)
    .with_thread_ids(true)
    .init();
```

**使用**：
```rust
use tracing::{info, warn, error, instrument};

#[instrument(skip(client))]
async fn download_video(client: &Client, url: &str) -> Result<()> {
    info!("开始下载视频: {}", url);
    
    match fetch_video(client, url).await {
        Ok(data) => {
            info!("视频下载成功: {} bytes", data.len());
            Ok(())
        }
        Err(e) => {
            error!("视频下载失败: {:?}", e);
            Err(e)
        }
    }
}
```

**结构化日志**：
```rust
info!(
    url = %url,
    size = data.len(),
    duration = ?start.elapsed(),
    "下载完成"
);
```

## 时间处理

### Chrono

```toml
chrono = { version = "0.4.42", features = ["serde"] }
```

**解析时间**：
```rust
use chrono::{DateTime, Utc};

let dt: DateTime<Utc> = "2024-01-01T00:00:00Z".parse()?;
```

**格式化时间**：
```rust
use chrono::NaiveDateTime;

let dt = NaiveDateTime::from_timestamp(1704067200, 0);
let formatted = dt.format("%Y-%m-%d %H:%M:%S").to_string();
```

**时区转换**：
```rust
use chrono::{Local, TimeZone};

let utc = Utc::now();
let local = Local.from_utc_datetime(&utc.naive_utc());
```

**strftime 格式**：
```
%Y - 四位年份
%m - 两位月份
%d - 两位日期
%H - 24小时制小时
%M - 分钟
%S - 秒
```

## 任务调度

### Tokio Cron Scheduler

```toml
tokio-cron-scheduler = "0.15.1"
```

**使用**：
```rust
use tokio_cron_scheduler::{Job, JobScheduler};

let mut scheduler = JobScheduler::new().await?;

// 添加定时任务
let job = Job::new_async("0 * * * * *", |_uuid, _l| {
    Box::pin(async move {
        // 每分钟执行一次
        run_download_task().await;
    })
})?;

scheduler.add(job).await?;

// 启动调度器
scheduler.start().await?;
```

**手动触发**：
```rust
scheduler.shutdown().await?;
```

## 错误处理

### Thiserror

```toml
thiserror = "2.0.17"
```

**自定义错误**：
```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DownloadError {
    #[error("网络请求失败: {0}")]
    Network(#[from] reqwest::Error),
    
    #[error("视频不存在: {bvid}")]
    VideoNotFound { bvid: String },
    
    #[error("认证失败: {0}")]
    Auth(String),
}
```

**使用**：
```rust
async fn download_video(bvid: &str) -> Result<(), DownloadError> {
    let info = fetch_video_info(bvid).await?;
    // ...
    Ok(())
}
```

### Anyhow

```toml
anyhow = { version = "1.0.100", features = ["backtrace"] }
```

**简化错误处理**：
```rust
use anyhow::{Context, Result};

async fn process_video(bvid: &str) -> Result<()> {
    let info = fetch_video_info(bvid)
        .await
        .context("获取视频信息失败")?;
    
    download_video(&info)
        .await
        .context("下载视频失败")?;
    
    Ok(())
}
```

## 文件系统操作

### 异步文件操作

**tokio::fs**：
```rust
use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncWriteExt, AsyncReadExt};

// 写入文件
let mut file = File::create("video.mp4").await?;
file.write_all(&data).await?;

// 读取文件
let mut file = File::open("video.mp4").await?;
let mut buffer = Vec::new();
file.read_to_end(&mut buffer).await?;
```

### 路径处理

**使用 dunce 规范化路径**：
```toml
dunce = "1.0.5"
```

```rust
use dunce::canonicalize;

let path = canonicalize("./relative/path")?;
```

## 配置管理

### 配置持久化

**数据库存储**：
```rust
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "config")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub key: String,
    pub value: String,
}
```

**实时更新**：
```rust
async fn update_config(key: &str, value: &str) -> Result<()> {
    Config::update(Config::ActiveModel {
        key: Set(key.to_string()),
        value: Set(value.to_string()),
        ..Default::default()
    }).exec(db).await?;
    
    // 通知配置变更
    notify_config_change(key, value).await;
    
    Ok(())
}
```

## 性能优化技巧

### 1. 连接池

**使用 reqwest 的连接池**：
```rust
let client = reqwest::Client::builder()
    .pool_max_idle_per_host(10)
    .pool_idle_timeout(Duration::from_secs(90))
    .build()?;
```

### 2. 缓存策略

**DashMap 缓存**：
```rust
use dashmap::DashMap;
use std::time::{Duration, Instant};

struct Cache<K, V> {
    data: DashMap<K, (V, Instant)>,
    ttl: Duration,
}

impl<K, V> Cache<K, V>
where
    K: Eq + Hash,
{
    fn get(&self, key: &K) -> Option<V> {
        self.data.get(key).and_then(|entry| {
            let (value, created) = entry.value();
            if created.elapsed() < self.ttl {
                Some(value.clone())
            } else {
                None
            }
        })
    }
}
```

### 3. 批量操作

**批量插入**：
```rust
let videos: Vec<video::ActiveModel> = video_data
    .into_iter()
    .map(|data| video::ActiveModel {
        bvid: Set(data.bvid),
        title: Set(data.title),
        ..Default::default()
    })
    .collect();

Video::insert_many(videos).exec(db).await?;
```

### 4. 零拷贝

**使用 bytes::Bytes**：
```rust
use bytes::Bytes;

async fn process_bytes(data: Bytes) -> Result<()> {
    // data 的所有权转移，无需拷贝
    parse_video(&data).await?;
    Ok(())
}
```

## 部署与容器化

### Dockerfile 最佳实践

**多阶段构建**：
```dockerfile
# 构建阶段
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

# 运行阶段
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ffmpeg
COPY --from=builder /app/target/release/bili-sync-rs /usr/local/bin/
CMD ["bili-sync-rs"]
```

**优化镜像大小**：
- 使用 slim 基础镜像
- 清理构建缓存
- 删除不必要的文件

### 配置管理

**环境变量**：
```rust
use std::env;

fn get_config() -> Config {
    Config {
        bind_address: env::var("BIND_ADDRESS").unwrap_or_else(|_| "0.0.0.0:12345".to_string()),
        sync_interval: env::var("SYNC_INTERVAL")
            .unwrap_or_else(|_| "3600".to_string())
            .parse()
            .unwrap(),
    }
}
```

## 测试策略

### 单元测试

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_bvid() {
        let bvid = "BV1xx411c7mD";
        let result = parse_bvid(bvid).unwrap();
        assert_eq!(result.aid, 12345678);
    }
}
```

### 集成测试

```rust
#[tokio::test]
async fn test_download_video() {
    let client = create_test_client().await;
    let result = download_video(&client, "BV1xx411c7mD").await;
    assert!(result.is_ok());
}
```

## 最佳实践总结

1. **异步优先**：全程使用 async/await
2. **错误处理**：使用 thiserror/anyhow
3. **并发安全**：使用 Arc + Mutex/RwLock/DashMap
4. **性能优化**：连接池、缓存、批量操作
5. **日志追踪**：使用 tracing 结构化日志
6. **类型安全**：充分利用 Rust 类型系统
7. **代码组织**：模块化、清晰的分层
8. **配置管理**：配置文件 + 环境变量
9. **测试覆盖**：单元测试 + 集成测试
10. **文档完善**：代码注释 + 文档字符串

这些技术点展示了 bili-sync 如何充分利用 Rust 生态系统构建高性能、可靠、易维护的下载管理工具。