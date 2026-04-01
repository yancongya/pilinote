# PiliNote API 文档

## 概述

PiliNote API 提供统一的B站视频下载管理接口。

## 基础信息

- **Base URL**: `http://localhost:8000`
- **API Version**: 1.0.0
- **Content-Type**: `application/json`

## 统一媒体接口

### 获取媒体信息

```
GET /api/media/{media_type}/{media_id}
```

**参数**:
- `media_type`: 媒体类型（video/bangumi/music/lesson/favorite/watchlater）
- `media_id`: 媒体ID

**支持的媒体类型**:
- `video`: 普通视频（bvid）
- `bangumi`: 番剧（ssid/epid）- 暂未实现
- `music`: 音乐（au）- 暂未实现
- `lesson`: 课程（ssid）
- `favorite`: 收藏夹（fid）
- `watch_later`: 稍后再看（无需ID）

**示例**:
```bash
# 获取视频信息
curl http://localhost:8000/api/media/video/BV1xx411c7mD

# 获取课程信息
curl http://localhost:8000/api/media/lesson/12345

# 获取收藏夹信息
curl http://localhost:8000/api/media/favorite/123456

# 获取稍后再看
curl http://localhost:8000/api/media/watch_later
```

**响应**:
```json
{
  "type": "video",
  "id": "BV1xx411c7mD",
  "title": "视频标题",
  "cover": "https://...",
  "desc": "视频描述",
  "nfo": {
    "title": "视频标题",
    "plot": "视频描述",
    "studio": "UP主名称",
    "premiered": "2024-01-01",
    "runtime": 600,
    "thumb": "https://..."
  },
  "stats": {
    "play": 10000,
    "danmaku": 500,
    "reply": 100,
    "like": 1000,
    "coin": 500,
    "favorite": 200,
    "share": 50
  },
  "list": [...]
}
```

### 获取收藏夹信息

```
GET /api/media/favorites/{fid}
```

**参数**:
- `fid`: 收藏夹ID
- `mid`: 用户MID（可选）

**示例**:
```bash
curl http://localhost:8000/api/media/favorites/123456
```

### 获取稍后再看

```
GET /api/media/watchlater
```

**示例**:
```bash
curl http://localhost:8000/api/media/watchlater
```

## 队列管理接口

### 提交任务

```
POST /api/queue/tasks
```

**请求体**:
```json
{
  "media_type": "video",
  "media_id": "BV1xx411c7mD",
  "title": "视频标题"
}
```

### 创建调度器

```
POST /api/queue/schedulers
```

**请求体**:
```json
{
  "title": "下载任务",
  "folder": "/path/to/output"
}
```

### 启动调度器

```
POST /api/queue/schedulers/{scheduler_id}/start
```

### 暂停调度器

```
POST /api/queue/schedulers/{scheduler_id}/pause
```

### 恢复调度器

```
POST /api/queue/schedulers/{scheduler_id}/resume
```

### 取消调度器

```
POST /api/queue/schedulers/{scheduler_id}/cancel
```

## 缓存管理接口

### 获取缓存统计

```
GET /api/cache/stats
```

**响应**:
```json
{
  "total": 100,
  "expired": 10,
  "memory_cache_size": 50,
  "database_cache_size": 90
}
```

### 清理过期缓存

```
POST /api/cache/cleanup
```

### 清空所有缓存

```
POST /api/cache/clear
```

### 使指定视频缓存失效

```
POST /api/cache/invalidate/video/{bvid}
```

### 使指定收藏夹缓存失效

```
POST /api/cache/invalidate/favorites/{fid}/{mid}
```

### 使稍后再看缓存失效

```
POST /api/cache/invalidate/watchlater
```

## 旧接口（已废弃）

以下接口已废弃，请使用统一的媒体接口：

- `GET /api/video/{video_id}` → 使用 `GET /api/media/video/{video_id}`
- `GET /api/favorites/folders/{folder_id}` → 使用 `GET /api/media/favorites/{folder_id}`
- `GET /api/watchlater/list` → 使用 `GET /api/media/watchlater`

## 错误码

- `400`: 请求参数错误
- `404`: 资源不存在
- `500`: 服务器内部错误
- `501`: 功能暂未实现

## 认证接口

### 扫码登录

```
POST /api/auth/qrcode
```

**响应**:
```json
{
  "success": true,
  "data": {
    "qrcode_key": "...",
    "qrcode_url": "..."
  }
}
```

### 查询登录状态

```
POST /api/auth/qrcode/status
```

**请求体**:
```json
{
  "qrcode_key": "..."
}
```

### SESSDATA登录

```
POST /api/auth/sessdata
```

**请求体**:
```json
{
  "sessdata": "..."
}
```

## 下载接口

### 解析链接

```
POST /api/download/parse
```

**请求体**:
```json
{
  "url": "https://www.bilibili.com/video/BV1xx411c7mD"
}
```

### 提交下载任务

```
POST /api/download/submit
```

**请求体**:
```json
{
  "media_type": "video",
  "media_id": "BV1xx411c7mD",
  "config": {
    "output_path": "/path/to/output",
    "download_subtitle": true,
    "download_danmaku": true,
    "download_thumb": true
  }
}
```

## 设置接口

### 获取设置

```
GET /api/settings
```

### 更新设置

```
PUT /api/settings
```

**请求体**:
```json
{
  "output_path": "/path/to/output",
  "download_subtitle": true,
  "download_danmaku": true,
  "download_thumb": true
}
```

## 开发指南

### 启动服务

```bash
cd apps/api
python main.py
```

### 查看API文档

服务启动后，访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 测试API

使用curl或Postman测试API接口。

### 数据模型

所有API响应都使用统一的数据模型：

```python
class MediaInfo(BaseModel):
    type: MediaType
    id: str
    title: str
    cover: str
    desc: str
    nfo: MediaNfo
    stats: MediaStats
    list: List[MediaItem]
```

## 更新日志

### v1.0.0 (2024-04-01)

- ✅ 统一的媒体信息接口
- ✅ 统一的数据结构
- ✅ 队列管理系统
- ✅ 任务系统
- ✅ 缓存系统
- ✅ 处理器系统

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 发起Pull Request

## 许可证

MIT License