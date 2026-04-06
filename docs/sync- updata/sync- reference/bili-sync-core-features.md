# bili-sync 核心功能分析

## 1. 认证与凭据管理

### 功能概述

自动管理 B 站用户认证凭据，支持自动刷新，无需人工干预。

### 实现机制

**凭据组成**：
- `SESSDATA` - 会话令牌
- `bili_jct` - CSRF 令牌
- `DedeUserID` - 用户 ID

**自动刷新逻辑**：
- 每日第一次运行视频下载任务时检查认证状态
- 检测到凭据即将过期时自动刷新
- 使用 RSA 加密进行安全传输

**获取方式**：
参考 [bilibili-api 凭据获取文档](https://nemo2011.github.io/bilibili-api/#/get-credential)

**安全特性**：
- 使用匿名窗口获取，避免潜在冲突
- 凭据加密存储
- API Token 保护管理接口

### 关键代码位置

- `crates/bili_sync/src/bilibili/` - B 站 API 封装
- `crates/bili_sync/src/auth.rs` - 认证逻辑

## 2. 视频源管理

### 支持的视频源类型

#### 收藏夹 (Favorite)
- 支持用户创建的所有收藏夹
- 按收藏时间排序
- 自动获取收藏夹列表

#### 稍后再看 (Watch Later)
- 自动扫描稍后再看列表
- 按添加时间排序
- 支持自动清理已下载视频

#### 视频合集/列表 (Collection)
- 支持公开的合集和列表
- 按发布时间排序
- 支持合集持续更新

#### UP 主投稿 (Submission)
- 支持关注的 UP 主投稿
- 按投稿时间排序
- 支持指定 UP 主 ID

### 快捷订阅功能

Web UI 提供"快捷订阅"功能，一键订阅：
- 自己创建的收藏夹
- 关注的合集
- 关注的 UP 主

### 手动添加

支持手动添加视频源，需要提供：
- 收藏夹：media_id
- 合集：season_id 或 series_id
- UP 主：mid

### 关键特性

**增量扫描**：
- 使用 `latest_row_at` 记录最后处理时间
- 只扫描新增内容
- 避免全量扫描

**智能排序**：
- 收藏夹：按收藏时间
- 投稿：按投稿时间
- 合集：按发布时间

**去重机制**：
- 数据库唯一索引
- 避免重复下载
- 同一视频在不同源中独立处理

## 3. 智能下载系统

### 视频质量选择

**编码格式优先级**（可配置）：
1. AVC (H.264) - 兼容性最好，体积较大
2. HEVC (H.265) - 压缩率高，需要硬件支持
3. AV1 - 最新编码，压缩率最高

**质量范围**：
- 视频质量：16-116
- 音频质量：支持多种音频质量

**自动选择逻辑**：
- 在用户配置的质量范围内
- 按编码格式优先级排序
- 选择质量最高的可用流

### CDN 智能排序

**默认顺序**：baseUrl → backupUrl

**启用 CDN 排序后**，优先级从高到低：
1. 服务商 CDN：`upos-sz-mirrorxxxx.bilivideo.com`
2. 自建 CDN：`cn-xxxx-dx-v-xxxx.bilivideo.com`
3. MCDN：`xxxx.mcdn.bilivideo.com`
4. PCDN：`xxxx.v1d.szbdyd.com`

**优势**：
- 优先选择高质量 CDN
- 提高下载速度
- 增加成功率

### 分块下载

**实现机制**：
- 预分配文件空间
- 将文件分成 N 个块（默认 4 个）
- 每个块独立下载
- 并行下载所有块

**触发条件**：
- 文件大小 > 20MB（可配置）

**优势**：
- 提高大文件下载速度
- 充分利用带宽
- 支持断点续传

### 音视频合并

**流程**：
1. 下载视频流
2. 下载音频流
3. 使用 FFmpeg 合并
4. 删除临时文件

**支持的格式**：
- MP4 (视频 + 音频)
- M4S (流格式)

### 弹幕下载

**功能**：
- 下载视频弹幕
- 转换为 ASS 格式
- 可自定义样式

**弹幕样式配置**：
- 持续时间（秒）
- 字体、字体大小
- 宽度比例、水平间距
- 轨道大小
- 滚动/底部弹幕高度百分比
- 透明度、描边宽度
- 时间偏移、粗体显示

**输出**：
- `{page_name}.ass` 文件
- 与视频文件同目录

## 4. 文件命名系统

### 模板引擎

使用 Handlebars 模板引擎，支持动态变量和函数。

### Video Name 模板变量

| 变量 | 描述 | 示例 |
|------|------|------|
| `bvid` | 视频编号 | BV1xx411c7mD |
| `title` | 视频标题 | 示例视频标题 |
| `upper_name` | UP 主名称 | 示例UP主 |
| `upper_mid` | UP 主 ID | 12345678 |
| `pubtime` | 视频发布时间 | 2024-01-01 |
| `fav_time` | 视频收藏时间 | 2024-01-02 |

### Page Name 模板变量

支持所有 Video Name 变量，额外支持：

| 变量 | 描述 | 示例 |
|------|------|------|
| `ptitle` | 分 P 标题 | 第一集 |
| `pid` | 分 P 页号 | 1 |

### 模板函数

**truncate**：截断字符串
```
{{ truncate title 10 }}  # 截取 title 的前 10 个字符
```

### 路径分割符

支持使用路径分割符创建子目录：
```
{{ upper_mid }}/{{ title }}_{{ pubtime }}
```

**注意**：
- Windows 使用 `\`
- macOS/Linux 使用 `/`
- 推荐仅在 video_name 中使用

### 时间格式

可自定义时间格式，参考 [chrono strftime 文档](https://docs.rs/chrono/latest/chrono/format/strftime/index.html)

示例：
```
{{ pubtime|strftime "%Y-%m-%d" }}  # 2024-01-01
```

## 5. 媒体服务器集成

### 文件结构

#### 单页视频（电影格式）
```
{video_name}/
├── {page_name}.mp4
├── {page_name}.nfo
└── {page_name}-poster.jpg
```

#### 多页视频（电视剧格式）
```
{video_name}/
├── poster.jpg
├── Season 1/
│   ├── {page_name} - S01E01.mp4
│   ├── {page_name} - S01E01.nfo
│   ├── {page_name} - S01E01-thumb.jpg
│   └── ...
└── tvshow.nfo
```

### NFO 文件

**Video NFO** (`tvshow.nfo`)：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<tvshow>
  <title>视频标题</title>
  <plot>视频描述</plot>
  <premiered>发布时间</premiered>
  <studio>Bilibili</studio>
  <tag>标签1</tag>
  <tag>标签2</tag>
</tvshow>
```

**Page NFO** (`{page_name}.nfo`)：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<episodedetails>
  <title>分P标题</title>
  <plot>视频描述</plot>
  <aired>发布时间</aired>
  <season>1</season>
  <episode>1</episode>
</episodedetails>
```

### UP 主头像

**保存路径**：配置的"UP 主头像保存路径"

**文件命名**：`{mid}.jpg`

**Emby/Jellyfin 集成**：
- 需挂载到 `{media_server}/metadata/people/`
- 自动显示 UP 主头像

### 媒体库配置

**类型设置**：
- 必须选择"混合内容"
- 支持同时显示电影和电视剧

**目录结构**：
- 每个视频源对应一个文件夹
- 单页视频作为电影
- 多页视频作为电视剧

## 6. 并发控制与限流

### 多级并发

```
总并发度 = video_concurrency × page_concurrency
```

**默认配置**：
- Video 并发：3
- Page 并发：2
- 总并发：≈6（大多数视频只有单页）

### 漏桶算法（限流）

**配置参数**：
- 时间间隔（毫秒）
- 限制请求数

**实现**：
```
每 {interval} 毫秒最多允许 {limit} 个请求
```

**作用范围**：
- 主站 API 请求（视频列表、视频信息、流地址等）
- 不限制实际的视频、图片下载

**效果**：
- 避免触发 B 站风控
- 控制请求频率
- 平滑请求流量

## 7. 错误处理与重试

### 下载状态管理

**Status 字段位掩码**：
- 位 0：封面
- 位 1：视频
- 位 2：NFO
- 位 3：弹幕
- ...

**状态判断**：
```rust
if (status & VIDEO_BIT) == 0 {
    // 需要下载视频
}
```

### 重试机制

**失败计数**：
- 每个部分独立计数
- 记录在 status 字段中

**重试逻辑**：
```
for each part:
    if part_failed_count < threshold:
        retry_download()
    else:
        mark_as_failed()
```

**阈值配置**：
- 可在高级设置中调整
- 默认值：3 次

### 风控处理

**检测机制**：
- HTTP 状态码异常
- 响应内容特征

**处理策略**：
- 不视为单个视频失败
- 终止整个 video source 的下载
- 等待下次扫描时重试

**优势**：
- 避免大量失败重试
- 节省资源
- 自动恢复

## 8. Web UI 管理

### 主要功能

#### 设置页面
- 基本设置（绑定地址、同步间隔、命名模板）
- B 站认证（凭据配置）
- 视频质量（编码格式、质量范围）
- 弹幕渲染（样式配置）
- 高级设置（并发控制、限流）

#### 视频源管理
- 快捷订阅（收藏夹、合集、UP 主）
- 手动添加（指定参数）
- 源列表管理（启用/禁用/删除）
- 视频列表查看

#### 视频管理
- 视频列表展示
- 下载状态查看
- 手动触发下载
- 删除本地视频

#### 日志查看
- 实时日志输出
- 日志级别筛选
- 日志搜索

### API 认证

**Token 认证**：
- 首次启动自动生成
- 在配置页面输入
- 保护管理接口

**实现**：
```rust
// 每次请求携带 token
Authorization: Bearer {auth_token}
```

### WebSocket 支持

- 实时日志推送
- 下载进度更新
- 状态变更通知

## 9. 数据库管理

### 数据库引擎

- **Sea-ORM** - Rust ORM 框架
- **SQLite** - 轻量级数据库
- **自动迁移** - 数据库版本管理

### 主要表结构

**Video Source 表**：
- favorite
- watch_later
- collection
- submission

**Video 表**：
- bvid, title, cover, description, tags
- video source 外键
- status（下载状态）
- latest_row_at（最后处理时间）

**Page 表**：
- cid, title, cover
- video 外键
- status（下载状态）

**Config 表**：
- 配置项键值对
- 支持实时更新

### 数据库优化

**索引**：
- 唯一索引：(video_source_id, bvid)
- 外键索引
- 时间索引

**查询优化**：
- 批量查询
- 分页查询
- 条件筛选

**事务管理**：
- 确保数据一致性
- 错误回滚

## 10. 定时任务

### Tokio Cron Scheduler

**配置**：
- 同步间隔（秒）
- 支持复杂 cron 表达式

**执行流程**：
1. 定时触发
2. 扫描视频源
3. 填充详情
4. 下载视频
5. 清理日志

### 手动触发

- Web UI 提供手动触发按钮
- 立即执行下载任务
- 不影响定时任务

## 关键技术点总结

1. **异步优先**：全程基于 Tokio 异步运行时
2. **智能限流**：漏桶算法 + 风控检测
3. **自动重试**：失败计数 + 阈值控制
4. **类型安全**：Rust 强类型系统
5. **模块化设计**：清晰的模块划分
6. **用户友好**：Web UI + 智能默认
7. **可扩展性**：易于添加新功能
8. **性能优化**：并发 + 分块下载