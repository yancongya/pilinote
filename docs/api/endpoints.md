# API 端点

## 基础信息

- **Base URL**: `http://localhost:8000`
- **WebSocket**: `ws://localhost:8000/ws`

## 认证接口

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| POST | `/api/auth/init` | - | 初始化指纹系统 |
| POST | `/api/auth/refresh/cookies` | - | 检查并刷新 Cookie |
| GET | `/api/auth/captcha/params` | - | 获取极验验证码参数 |
| POST | `/api/auth/captcha/validate` | - | 验证极验验证码 |
| POST | `/api/auth/sms/send` | - | 发送手机验证码 |
| GET | `/api/auth/qrcode` | - | 获取登录二维码 |
| GET | `/api/auth/qrcode/status/{qrcode_key}` | - | 查询二维码状态 |
| POST | `/api/auth/sessdata` | - | SESSDATA 登录 |
| POST | `/api/auth/password` | - | 密码登录 |
| POST | `/api/auth/sms/login` | - | 手机验证码登录 |
| GET | `/api/auth/user-info` | sessdata | 获取用户信息 |
| GET | `/api/auth/proxy/avatar` | url | 代理获取头像 |
| POST | `/api/auth/refresh-cookie` | - | 刷新 Cookie |
| POST | `/api/auth/logout` | - | 登出 |
| GET | `/api/auth/status` | - | 获取登录状态 |
| GET | `/api/auth/accounts` | - | 获取账号列表 |
| GET | `/api/auth/accounts/{id}/credentials` | - | 获取验证数据 |
| POST | `/api/auth/accounts/switch` | `?account_id=1` | 切换账号 |
| POST | `/api/auth/accounts/refresh` | `?account_id=1` | 刷新账号（支持路径参数：`/api/auth/accounts/{account_id}/refresh`） |
| DELETE | `/api/auth/accounts/{id}` | - | 删除账号 |
| GET | `/api/auth/accounts/refresh/status` | - | 获取刷新服务状态 |
| POST | `/api/auth/accounts/refresh/start` | `?interval=3600` | 启动刷新服务 |
| POST | `/api/auth/accounts/refresh/stop` | - | 停止刷新服务 |

## 视频接口

### 收藏夹接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/favorites/folders` | 获取收藏夹列表 |
| GET | `/api/favorites/folders/{folder_id}` | 获取收藏夹详情 |
| GET | `/api/favorites/collected` | 获取订阅的收藏夹 |

**收藏夹列表**：`GET /api/favorites/folders`
- 参数：
  - `page`: 页码（默认 1）
  - `page_size`: 每页数量（默认 20，最大 100）

**收藏夹详情**：`GET /api/favorites/folders/{folder_id}`
- 参数：
  - `page`: 页码（默认 1）
  - `page_size`: 每页数量（默认 20，最大 100）
  - `keyword`: 搜索关键词（默认空）
  - `order`: 排序方式（mtime=收藏时间, pubtime=发布时间, view=播放量, cweight=收藏权重）
  - `type`: 类型筛选（0=全部, 2=视频, 21=音频, 12=文章）
  - `tid`: 分区 ID（默认 0）

**订阅收藏夹**：`GET /api/favorites/collected`
- 参数：
  - `sessdata`: 用户 SESSDATA
  - `up_mid`: 用户 mid
  - `page`: 页码（默认 1）
  - `page_size`: 每页数量（默认 20，最大 100）

### 其他视频接口

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| GET | `/api/watch-later/list` | `?pn=1&ps=20` | 获取稍后再看列表（支持分页） |
| GET | `/api/video/{id}` | - | 获取视频详情 |

## 媒体接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/media/{media_type}/{media_id}` | 获取媒体信息（统一接口） |
| GET | `/api/media/favorites/{fid}` | 获取收藏夹媒体信息 |
| GET | `/api/media/watch-later` | 获取稍后再看媒体信息 |

### 媒体类型支持

| 类型 | 参数示例 | 说明 |
|------|----------|------|
| video | `BV1xx411c7mD` | 普通视频 |
| opus | `123456789` | 图文专栏 |
| bangumi | `ep123456` | 番剧 |
| lesson | `https://www.bilibili.com/cheese/play/ss292774372` | 课程（需完整URL） |
| music | `au123456` | 音乐（暂未实现） |

## 下载解析接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/download/parse` | 解析下载URL（支持视频、图文、课程、番剧等） |

### 解析请求示例

```json
// 图文解析
{ "url": "cv123456789" }

// 视频解析
{ "url": "BV1xx411c7mD" }

// 视频URL解析
{ "url": "https://www.bilibili.com/video/BV1xx411c7mD" }

// 课程解析（推荐使用完整URL）
{ "url": "https://www.bilibili.com/cheese/play/ss292774372" }

// 课程解析（支持带参数）
{ "url": "https://www.bilibili.com/cheese/play/ss292774372?csource=common_myclass_purchasedlecture_null" }

// 番剧解析
{ "url": "https://www.bilibili.com/bangumi/play/ss42099" }
```

### 课程链接注意事项

- **推荐使用完整URL**：`https://www.bilibili.com/cheese/play/ss{id}`
- **支持带参数的链接**：系统会自动去除 URL 参数
- **纯ID不推荐**：`ss292774372` 默认识别为番剧，无法区分课程
- **需要购买**：课程为付费内容，需要购买后才能下载
- **需要登录**：必须提供有效的 SESSDATA

## 下载接口

### 下载队列管理（新系统）

**注意**：旧的下载API (`/api/download/*`) 已废弃，请使用新的下载队列系统。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/queue/tasks` | 获取下载任务列表 |
| POST | `/api/queue/tasks` | 创建下载任务 |
| GET | `/api/queue/tasks/{task_id}` | 获取单个任务详情 |
| POST | `/api/queue/tasks/{task_id}/start` | 开始任务 |
| POST | `/api/queue/tasks/{task_id}/pause` | 暂停任务 |
| POST | `/api/queue/tasks/{task_id}/resume` | 恢复任务 |
| POST | `/api/queue/tasks/{task_id}/cancel` | 取消任务 |
| POST | `/api/queue/tasks/{task_id}/retry` | 重试任务 |
| DELETE | `/api/queue/tasks/{task_id}` | 删除任务 |
| POST | `/api/queue/tasks/batch/start` | 批量开始任务 |
| GET | `/api/queue/schedulers` | 获取调度器列表 |
| POST | `/api/queue/schedulers` | 创建调度器 |
| POST | `/api/queue/schedulers/{id}/start` | 启动调度器 |
| POST | `/api/queue/schedulers/{id}/pause` | 暂停调度器 |
| POST | `/api/queue/schedulers/{id}/stop` | 停止调度器 |
| DELETE | `/api/queue/schedulers/{id}` | 删除调度器 |

### 下载列表管理（历史记录）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/downloads` | 获取下载列表 |
| GET | `/api/downloads/{download_id}` | 获取单个下载详情 |
| DELETE | `/api/downloads/{download_id}` | 删除下载记录 |
| DELETE | `/api/downloads/by-bvid/{bvid}` | 通过BVID删除下载记录 |
| POST | `/api/downloads/batch/start` | 批量开始下载 |
| POST | `/api/downloads/{download_id}/start` | 开始下载 |
| POST | `/api/downloads/{download_id}/pause` | 暂停下载 |
| POST | `/api/downloads/{download_id}/resume` | 恢复下载 |
| POST | `/api/downloads/{download_id}/cancel` | 取消下载 |

### 下载解析接口（已废弃）

**注意**：以下端点已迁移至新的队列系统，但为了向后兼容性保留。建议使用新的媒体API: `/api/media/{media_type}/{media_id}`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/download/parse` | 解析下载URL（支持视频、图文、课程、番剧等） |

### 任务创建（POST /api/queue/tasks）

创建新的下载任务。

**请求参数**：

| 字段 | 类型 | 必填 | 说明 | 约束 |
|------|------|------|------|------|
| `media_type` | string | 是 | 媒体类型 | 枚举值：`video`, `bangumi`, `music`, `music_list`, `lesson`, `watch_later`, `favorite`, `opus`, `opus_list`, `user_video`, `user_opus`, `user_audio` |
| `media_id` | string | 是 | 媒体ID（如视频BV号、番剧ID等） | 长度：1-50字符 |
| `title` | string | 否 | 任务标题 | 长度：最多200字符 |
| `cover` | string | 否 | 封面图片URL | 长度：最多500字符 |
| `desc` | string | 否 | 任务描述 | 长度：最多2000字符 |
| `meta` | object | 否 | 元数据（包含cid、page等额外信息） | 必须是字典类型 |

**请求示例**：

```json
{
  "media_type": "video",
  "media_id": "BV1xx411c7mD",
  "title": "示例视频",
  "cover": "https://example.com/cover.jpg",
  "desc": "这是一个示例视频",
  "meta": {
    "cid": 123456,
    "page": 1,
    "part_title": "第1集"
  }
}
```

**响应示例**：

```json
{
  "success": true,
  "message": "任务提交成功",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "media_type": "video",
    "media_id": "BV1xx411c7mD",
    "title": "示例视频",
    "state": 0,
    "status": {},
    "created_at": 1234567890
  }
}
```

**错误响应**：

- `400`：参数验证失败
  - `media_id 不能为空`
  - `不支持的 media_type: xxx`
  - `meta 必须是字典类型`
- `422`：Pydantic 验证错误
  - `Field required`（缺少必填字段）
  - `String should have at least 1 character`（字符串太短）
  - `String should have at most X characters`（字符串太长）

### 下载列表管理

#### 获取下载列表（GET /api/downloads）

获取所有下载记录，支持状态筛选。

**查询参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `status` | string | 否 | - | 状态筛选：`pending`, `downloading`, `completed`, `failed`, `paused`, `cancelled` |

**响应示例**：

```json
{
  "success": true,
  "data": {
    "downloads": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "bvid": "BV1xx411c7mD",
        "title": "示例视频",
        "status": "downloading",
        "progress": 45.5,
        "download_speed": 1024000,
        "eta": 120,
        "stage": "downloading",
        "downloaded_bytes": 536870912,
        "total_bytes": 1178599424,
        "retry_count": 0,
        "max_retries": 3,
        "error_message": null,
        "thumbnail_url": "https://example.com/cover.jpg",
        "duration": 300,
        "uploader": "UP主名称",
        "file_path": "/downloads/video.mp4",
        "created_at": "2024-01-01T00:00:00Z",
        "started_at": "2024-01-01T00:01:00Z",
        "completed_at": null,
        "aid": 123456789,
        "cid": 987654321,
        "quality": 80,
        "audio_bitrate": 192,
        "codec": "h264"
      }
    ]
  }
}
```

#### 批量开始下载（POST /api/downloads/batch/start）

批量开始多个下载任务。

**请求体**：

```json
{
  "download_ids": ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440001"]
}
```

**响应示例**：

```json
{
  "success": true,
  "message": "成功开始 2 个下载任务",
  "data": {
    "started_count": 2
  }
}
```

#### 任务控制方法

**开始下载**：
```
POST /api/downloads/{download_id}/start
```

**暂停下载**：
```
POST /api/downloads/{download_id}/pause
```

**恢复下载**：
```
POST /api/downloads/{download_id}/resume
```

**取消下载**：
```
POST /api/downloads/{download_id}/cancel
```

### 下载状态说明

| 状态 | 说明 |
|------|------|
| `pending` | 待处理 |
| `downloading` | 下载中 |
| `completed` | 已完成 |
| `failed` | 失败 |
| `paused` | 暂停 |
| `cancelled` | 取消 |

### 下载阶段说明

| 阶段 | 说明 |
|------|------|
| `preparing` | 准备中 |
| `downloading` | 下载中 |
| `moving` | 文件移动中 |
| `post_processing` | 后处理中 |
| `completed` | 已完成 |

### WebSocket 实时进度

**端点**：`ws://localhost:8000/ws/downloads`

**事件类型**：

| 事件类型 | 说明 |
|----------|------|
| `download_progress` | 下载进度更新 |
| `download_status` | 下载状态更新 |
| `download_stage` | 下载阶段更新 |
| `download_bytes` | 下载字节数更新 |
| `download_error` | 下载错误 |

**进度更新事件示例**：

```json
{
  "type": "download_progress",
  "download_id": "550e8400-e29b-41d4-a716-446655440000",
  "progress": 45.5,
  "speed": 1024000,
  "eta": 120
}
```

**错误事件示例**：

```json
{
  "type": "download_error",
  "download_id": "550e8400-e29b-41d4-a716-446655440000",
  "error": "网络连接失败",
  "error_type": "network",
  "error_code": "NETWORK_ERROR"
}
```

### 调度器创建（POST /api/queue/schedulers）

创建新的调度器（用于合集下载）。

**请求参数**：

| 字段 | 类型 | 必填 | 说明 | 约束 |
|------|------|------|------|------|
| `title` | string | 是 | 调度器标题（用于合集下载时的文件夹名称） | 长度：1-200字符，不能为空 |
| `folder` | string | 是 | 输出文件夹路径（绝对路径或相对路径） | 长度：1-500字符，不能为空 |
| `task_ids` | array | 否 | 任务ID列表（可选，如果不提供则从backlog队列获取） | 如果提供，必须是非空数组，每个ID必须是有效的UUID格式 |

**请求示例**：

```json
{
  "title": "我的视频合集",
  "folder": "/downloads/my_videos",
  "task_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ]
}
```

**响应示例**：

```json
{
  "success": true,
  "message": "调度器创建成功",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "title": "我的视频合集",
    "list": ["550e8400-e29b-41d4-a716-446655440000"],
    "count": 1,
    "queue_type": 0,
    "state": 0,
    "folder": "/downloads/my_videos",
    "created_at": 1234567890,
    "updated_at": 1234567890
  }
}
```

**错误响应**：

- `400`：参数验证失败
  - `title 不能为空`
  - `folder 不能为空`
  - `task_ids 不能为空列表`
  - `以下任务ID不存在: xxx`
  - `task_id must be a valid UUID format: xxx`
- `422`：Pydantic 验证错误
  - `Field required`（缺少必填字段）
  - `String should have at least 1 character`（字符串太短）
  - `String should have at most X characters`（字符串太长）
  - `Value error, task_ids cannot be an empty list`（task_ids为空数组）
  - `Value error, task_id must be a valid UUID format: xxx`（UUID格式错误）

### 参数验证规则总结

#### 通用验证规则

1. **字符串长度限制**：
   - `media_id`：1-50 字符
   - `title`：最多 200 字符
   - `cover`：最多 500 字符
   - `desc`：最多 2000 字符
   - `folder`：1-500 字符

2. **必填字段验证**：
   - `media_type` 和 `media_id` 在任务创建时必填
   - `title` 和 `folder` 在调度器创建时必填

3. **枚举值验证**：
   - `media_type` 必须是预定义的媒体类型之一
   - `state` 必须是有效的任务状态值（0-6）

4. **UUID 格式验证**：
   - `task_ids` 中的每个ID必须是有效的UUID格式（8-4-4-4-12格式）

5. **类型验证**：
   - `meta` 必须是字典类型（object）
   - `task_ids` 必须是数组类型

#### 错误码说明

| HTTP状态码 | 说明 | 处理建议 |
|------------|------|----------|
| 200 | 成功 | 正常处理 |
| 400 | 参数验证失败 | 检查请求参数格式和值 |
| 404 | 资源不存在 | 检查任务ID或调度器ID |
| 422 | Pydantic验证错误 | 检查字段类型、长度、必填性 |
| 500 | 服务器内部错误 | 检查服务器日志，联系管理员 |

#### 最佳实践

1. **前端验证**：在发送请求前，在前端进行基本验证（如必填字段、长度限制）
2. **错误处理**：捕获并显示具体的错误消息，避免暴露服务器细节
3. **用户体验**：提供清晰的字段说明和示例，帮助用户正确填写
4. **日志记录**：服务器端记录验证失败的详细信息，便于调试

## 并发控制接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/concurrency/stats` | 获取并发统计 |
| GET | `/api/concurrency/stats/{resource_type}` | 获取特定资源统计 |
| GET | `/api/concurrency/resource-usage` | 获取系统资源使用 |
| POST | `/api/concurrency/update-max-concurrent` | 更新最大并发数 |
| POST | `/api/concurrency/dynamic-adjustment` | 启用/禁用动态调整 |
| GET | `/api/concurrency/config` | 获取并发配置 |
| GET | `/api/concurrency/health` | 健康检查 |

### 获取并发统计

获取所有资源类型的并发统计信息。

**响应示例**：

```json
{
  "video_download": {
    "max_concurrent": 3,
    "current_concurrent": 2,
    "available_slots": 1,
    "active_tasks": ["task-1", "task-2"],
    "total_requests": 150,
    "successful_acquisitions": 145,
    "failed_acquisitions": 5,
    "avg_wait_time": 1.2,
    "peak_concurrent": 3
  },
  "pagination_download": {
    "max_concurrent": 5,
    "current_concurrent": 3,
    "available_slots": 2,
    "active_tasks": ["task-3", "task-4", "task-5"],
    "total_requests": 80,
    "successful_acquisitions": 78,
    "failed_acquisitions": 2,
    "avg_wait_time": 0.8,
    "peak_concurrent": 5
  }
}
```

### 获取特定资源统计

获取指定资源类型的并发统计信息。

**路径参数**：
- `resource_type`: 资源类型（video_download, pagination_download, api_request, media_processing）

**响应示例**：

```json
{
  "max_concurrent": 3,
  "current_concurrent": 2,
  "available_slots": 1,
  "active_tasks": ["task-1", "task-2"],
  "total_requests": 150,
  "successful_acquisitions": 145,
  "failed_acquisitions": 5,
  "avg_wait_time": 1.2,
  "peak_concurrent": 3
}
```

### 获取系统资源使用

获取当前系统资源使用情况。

**响应示例**：

```json
{
  "cpu_percent": 45.2,
  "memory_percent": 62.8,
  "disk_io_percent": 12.5,
  "network_io": {
    "bytes_sent": 1024000,
    "bytes_recv": 2048000,
    "packets_sent": 1000,
    "packets_recv": 2000
  },
  "timestamp": 1776000000
}
```

### 更新最大并发数

动态更新指定资源类型的最大并发数。

**请求参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `resource_type` | string | 是 | 资源类型 |
| `max_concurrent` | integer | 是 | 最大并发数 |

**请求示例**：

```json
{
  "resource_type": "video_download",
  "max_concurrent": 5
}
```

**响应示例**：

```json
{
  "success": true,
  "message": "最大并发数已更新",
  "resource_type": "video_download",
  "old_max": 3,
  "new_max": 5
}
```

### 启用/禁用动态调整

启用或禁用基于系统资源的动态并发调整功能。

**请求参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `enabled` | boolean | 是 | 是否启用动态调整 |
| `check_interval` | integer | 否 | 检查间隔（秒），默认5 |

**请求示例**：

```json
{
  "enabled": true,
  "check_interval": 5
}
```

**响应示例**：

```json
{
  "success": true,
  "message": "动态调整已启用",
  "enabled": true,
  "check_interval": 5
}
```

### 获取并发配置

获取所有资源类型的并发配置信息。

**响应示例**：

```json
{
  "video_download": {
    "max_concurrent": 3,
    "timeout": 3600,
    "dynamic_adjustment": true
  },
  "pagination_download": {
    "max_concurrent": 5,
    "timeout": 300,
    "dynamic_adjustment": true
  },
  "api_request": {
    "max_concurrent": 10,
    "timeout": 30,
    "dynamic_adjustment": true
  },
  "media_processing": {
    "max_concurrent": 2,
    "timeout": 1800,
    "dynamic_adjustment": true
  }
}
```

### 健康检查

获取并发控制系统的健康状态。

**响应示例**：

```json
{
  "status": "healthy",
  "uptime": 86400,
  "total_resources": 4,
  "active_tasks": 5,
  "system_load": {
    "cpu_percent": 45.2,
    "memory_percent": 62.8,
    "disk_io_percent": 12.5
  }
}
```

## 设置接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings` | 获取所有设置 |
| PUT | `/api/settings` | 更新设置 |
| POST | `/api/settings/reset` | 重置设置 |
| GET | `/api/settings/list` | 获取设置列表 |
| GET | `/api/settings/export` | 导出设置 |
| POST | `/api/settings/import` | 导入设置 |
| GET | `/api/settings/tool-status` | 获取工具状态 |
| GET | `/api/settings/storage-info` | 获取存储信息 |
| GET | `/api/settings/cache-info` | 获取缓存信息 |
| POST | `/api/settings/clear-cache/{type}` | 清理缓存 |
| POST | `/api/settings/open-cache/{type}` | 打开缓存目录 |
| GET | `/api/settings/database/info` | 获取数据库信息 |
| GET | `/api/settings/database/export` | 导出数据库 |
| POST | `/api/settings/database/import` | 导入数据库 |
| POST | `/api/settings/ftp/test` | 测试FTP连接 |
| POST | `/api/settings/backup/download` | 备份下载目录 |
| POST | `/api/settings/backup/database` | 备份数据库 |
| POST | `/api/settings/cleanup/trigger` | 手动触发清理 |
| GET | `/api/settings/cleanup/status` | 获取清理状态 |

---

## 本地视频库接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/library/statistics` | 获取视频库统计信息 |
| POST | `/api/library/scan` | 扫描视频库 |
| POST | `/api/library/import` | 导入新文件 |
| POST | `/api/library/cleanup` | 清理丢失文件 |
| POST | `/api/library/sync` | 完整同步 |
| GET | `/api/library/image` | 获取本地图片 |

### 获取视频库统计信息

获取本地视频库的统计信息，包括文件数量、总大小、数据库记录等。

**响应示例**：

```json
{
  "success": true,
  "data": {
    "exists": true,
    "path": "/Users/tanyancong/工作/开发/pilinote/downloads",
    "file_count": 112,
    "total_size": 5368709120,
    "total_size_mb": 5120.0,
    "total_size_gb": 5.0,
    "video_files_by_type": {
      ".mp4": 100,
      ".flv": 10,
      ".mkv": 2
    },
    "database_stats": {
      "total_downloads": 120,
      "completed_downloads": 110
    }
  }
}
```

### 扫描视频库

扫描本地视频库并同步状态，返回新文件、已存在文件和文件丢失的记录。

**响应示例**：

```json
{
  "success": true,
  "data": {
    "total_files": 112,
    "folder_count": 45,
    "new_files_count": 2,
    "existing_files_count": 108,
    "missing_count": 2,
    "total_size": 5368709120,
    "folders": [
      {"name": "【Blender教程】", "title": "Blender教程系列", "path": "/Users/tanyancong/工作/开发/pilinote/downloads/【Blender教程】", "file_count": 10, "size": 1073741824, "metadata_size": 1048576, "total_size": 1074790400, "cover": "cover.jpg", "cover_path": "/Users/tanyancong/工作/开发/pilinote/downloads/【Blender教程】/cover.jpg", "avatar": "avatar.jpg", "avatar_path": "/Users/tanyancong/工作/开发/pilinote/downloads/【Blender教程】/avatar.jpg", "studio": "UP主名称", "nfo_data": {"title": "Blender教程系列", "plot": "详细的Blender教程", "studio": "UP主名称", "premiered": "2024-01-01", "statistics": {"play": 10000, "like": 500, "coin": 200}}, "created_time": 1704067200}
    ],
    "folder_videos": {
      "【Blender教程】": {
        "files": [
          {
            "path": "/Users/tanyancong/工作/开发/pilinote/downloads/【Blender教程】/01_基础操作.mp4",
            "title": "01_基础操作",
            "size": 107374182,
            "size_mb": 102.4,
            "modified_time": 1704067200,
            "modified_date": "2024-01-01 00:00:00"
          }
        ],
        "total_size": 1073741824,
        "metadata_size": 1048576
      }
    },
    "new_files": [
      {
        "path": "/Users/tanyancong/工作/开发/pilinote/downloads/new_video.mp4",
        "title": "新视频",
        "size": 104857600,
        "size_mb": 100.0,
        "modified_time": 1704067200,
        "modified_date": "2024-01-01 00:00:00"
      }
    ],
    "missing_files": [
      {
        "id": "task-123",
        "bvid": "BV1xx411c7mD",
        "title": "已删除的视频",
        "file_path": "/Users/tanyancong/工作/开发/pilinote/downloads/已删除的视频.mp4",
        "file_size": 104857600,
        "status": "completed"
      }
    ]
  },
  "message": "扫描完成：发现 112 个文件，其中 2 个新文件，2 个文件丢失"
}
```

### 导入新文件

将新发现的视频文件导入到数据库。

**查询参数**：
- `import_all`: 是否导入所有新文件（默认 false）

**请求体**：

```json
{
  "file_paths": [
    "/path/to/video1.mp4",
    "/path/to/video2.mp4"
  ]
}
```

**响应示例**：

```json
{
  "success": true,
  "message": "成功导入 2 个视频文件",
  "imported_count": 2,
  "imported_files": [
    "/Users/tanyancong/工作/开发/pilinote/downloads/new_video1.mp4",
    "/Users/tanyancong/工作/开发/pilinote/downloads/new_video2.mp4"
  ]
}
```

### 清理丢失文件

清理文件丢失的下载记录。

**查询参数**：
- `auto_cleanup`: 是否自动清理所有文件丢失的记录（默认 false）

**请求体**：

```json
{
  "download_ids": [
    "task-123",
    "task-456"
  ]
}
```

**响应示例**：

```json
{
  "success": true,
  "message": "成功清理 2 个文件丢失的记录",
  "cleaned_count": 2
}
```

### 完整同步

完整同步本地视频库，包括扫描、导入新文件和清理丢失记录。

**查询参数**：
- `auto_import`: 是否自动导入新文件（默认 false）
- `auto_cleanup`: 是否自动清理文件丢失的记录（默认 false）

**响应示例**：

```json
{
  "success": true,
  "message": "同步完成：扫描 112 个文件",
  "data": {
    "scan_result": {
      "total_files": 112,
      "folder_count": 45,
      "new_files_count": 2,
      "existing_files_count": 108,
      "missing_count": 2
    },
    "imported_count": 2,
    "cleaned_count": 2,
    "auto_import": true,
    "auto_cleanup": true
  }
}
```

### 获取本地图片

获取本地图片文件（封面、头像等），通过API代理避免浏览器的file://协议限制。

**查询参数**：
- `file_path`: 本地图片文件的绝对路径（必填）

**响应**：
- 成功：返回图片文件的二进制数据，Content-Type为图片类型
- 失败：返回错误消息

**支持的文件类型**：.jpg, .jpeg, .png, .gif, .webp

### 更新单个NFO文件

更新单个NFO文件的元数据，从B站API获取最新的统计数据和评论数据并更新到NFO文件中。

**请求体**：

```json
{
  "nfo_path": "/path/to/video.nfo"
}
```

**响应示例**：

```json
{
  "success": true,
  "data": {
    "nfo_path": "/Users/tanyancong/工作/开发/pilinote/downloads/video.nfo",
    "updated": true,
    "changes": {
      "statistics": {
        "play": 10000,
        "like": 500,
        "coin": 200,
        "favorite": 100,
        "share": 50,
        "danmaku": 100,
        "reply": 80
      },
      "rating": 8.5,
      "tags": ["弹幕:100", "评论:80", "分享:50"],
      "comments": [
        {
          "type": "top",
          "author": "置顶用户",
          "content": "这是置顶评论的内容",
          "like": 5000,
          "reply": 100,
          "time": 1672531200
        },
        {
          "type": "hot",
          "author": "热门用户1",
          "content": "这是第一条热门评论的内容",
          "like": 3000,
          "reply": 50,
          "time": 1672531300
        }
      ]
    }
  },
  "message": "NFO文件更新成功"
}
```

### 批量更新NFO文件

批量更新指定目录下的NFO文件，从B站API获取最新的统计数据和评论数据并更新到NFO文件中。

**请求体**：

```json
{
  "directory": "/path/to/downloads",
  "limit": 10,
  "offset": 0
}
```

**请求参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `directory` | string | 是 | - | 要扫描的目录路径 |
| `limit` | int | 否 | 10 | 最大更新数量 |
| `offset` | int | 否 | 0 | 偏移量（用于分批处理） |

**响应示例**：

```json
{
  "success": true,
  "data": {
    "total": 10,
    "success_count": 8,
    "failed_count": 2,
    "results": [
      {
        "nfo_path": "/Users/tanyancong/工作/开发/pilinote/downloads/video1.nfo",
        "success": true,
        "updated": true,
        "changes": {
          "statistics": {
            "play": 10000,
            "like": 500,
            "coin": 200,
            "favorite": 100,
            "share": 50,
            "danmaku": 100,
            "reply": 80
          },
          "rating": 8.5,
          "tags": ["弹幕:100", "评论:80", "分享:50"],
          "comments": [
            {
              "type": "top",
              "author": "置顶用户",
              "content": "这是置顶评论的内容",
              "like": 5000,
              "reply": 100,
              "time": 1672531200
            }
          ]
        }
      },
      {
        "nfo_path": "/Users/tanyancong/工作/开发/pilinote/downloads/video2.nfo",
        "success": false,
        "error": "BVID解析失败"
      }
    ]
  },
  "message": "批量更新完成：成功8个，失败2个"
}
```

**使用场景**：

1. **批量更新统计数据**：定期批量更新所有视频的播放量、点赞数等统计数据
2. **同步最新数据**：从B站API获取最新的互动数据，保持NFO文件的时效性
3. **数据补全**：为缺少统计数据的老视频补全NFO信息
4. **评论数据更新**：同步最新的评论数据到NFO文件中

### 文件命名规范

视频库采用统一的文件命名规范，确保跨系统兼容性和易于管理：

**封面图片**：
- 统一命名为 `cover.jpg`
- 存放在视频文件夹根目录
- 自动从 NFO 文件或下载时获取

**UP主头像**：
- 优先使用 `avatar.jpg`
- 如果不存在则查找 `avatar.png`
- 存放在视频文件夹根目录

**NFO文件**：
- 使用文件夹名称命名
- 格式：`{文件夹名}.nfo`
- 包含视频元数据和统计信息

**视频文件**：
- 保持原始下载文件名
- 支持多种格式：mp4, flv, mkv, webm, avi, mov, wmv, m4v

### 时间管理

**创建时间**：
- 来源：文件夹的创建时间（`st_ctime`）
- 用于系列视频的创建时间显示
- 用于排序和过滤

**修改时间**：
- 来源：视频文件的修改时间（`st_mtime`）
- 格式：ISO 8601 标准格式（`YYYY-MM-DD HH:MM:SS`）
- 用于文件同步和版本控制

---

## WebSocket 接口

| 路径 | 说明 |
|------|------|
| `/ws/queue` | WebSocket 连接，用于实时下载进度 |

---

## 视频库状态管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/video-library/check-batch` | 批量检查视频是否在视频库中 |
| GET | `/api/video-library/refresh` | 刷新视频库缓存 |
| GET | `/api/video-library/status` | 获取视频库状态 |

### 批量检查视频

**端点**：`POST /api/video-library/check-batch`

**描述**：批量检查指定BVID列表中的视频是否已在视频库中

**请求体**：
```json
{
  "bvids": ["BV1xx411c7mD", "BV1yy411c7mE"]
}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "downloaded": ["BV1xx411c7mD"],
    "not_downloaded": ["BV1yy411c7mE"],
    "total": 2
  }
}
```

### 刷新视频库缓存

**端点**：`GET /api/video-library/refresh`

**描述**：刷新视频库缓存，同步最新的文件状态

**响应示例**：
```json
{
  "success": true,
  "data": {
    "refreshed_at": 1713264000,
    "video_count": 112
  }
}
```

### 获取视频库状态

**端点**：`GET /api/video-library/status`

**描述**：获取视频库的当前状态信息

**响应示例**：
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "cache_valid": true,
    "last_refresh": 1713264000,
    "cache_ttl": 600
  }
}
```

---

[返回上级](./README.md)