# 存储设置

## 配置项

| 键 | 说明 | 默认值 |
|----|------|-------|
| download_path | 下载保存路径 | ./downloads |
| temp_path | 临时文件路径 | ./temp |
| auto_cleanup | 自动清理临时文件 | true |
| keep_failed | 保留失败任务 | false |
| sidecar.ffmpeg | ffmpeg 路径或命令 | ffmpeg |
| sidecar.aria2c | aria2c 路径或命令 | aria2c |
| ftp.host | FTP 服务器地址 | - |
| ftp.username | FTP 用户名 | - |
| ftp.password | FTP 密码 | - |
| ftp.remote_path | FTP 远程路径 | /pilinote |
| ftp.use_tls | 使用 TLS 加密 | false |

## 详细说明

### 路径设置
- **download_path**: 下载完成的视频保存目录
- **temp_path**: 临时文件存放目录（下载过程中使用）

### 清理设置
- **auto_cleanup**: 程序启动时自动清理 24 小时前的临时文件
- **keep_failed**: 是否保留下载失败的任务记录

### Sidecar 工具
- **ffmpeg**: ffmpeg 命令路径（用于合并音视频）
- **aria2c**: aria2c 命令路径（用于多线程下载）

### FTP 备份
- 支持将下载目录和数据库备份到 FTP 服务器

## API

### 获取设置

```
GET /api/settings
```

响应：
```json
{
    "download": { ... },
    "storage": {
        "download_path": "./downloads",
        "temp_path": "./temp",
        "auto_cleanup": true,
        "keep_failed": false,
        "sidecar": { "ffmpeg": "ffmpeg", "aria2c": "aria2c" },
        "ftp": { "host": "", "username": "", "password": "", "remote_path": "/pilinote", "use_tls": false }
    },
    "general": { ... },
    "auto_download": { ... }
}
```

### 更新设置

```
PUT /api/settings
Content-Type: application/json
Body: {
    "storage": {
        "download_path": "/path/to/downloads",
        "temp_path": "/path/to/temp",
        "auto_cleanup": true,
        "keep_failed": false,
        "sidecar": { "ffmpeg": "ffmpeg", "aria2c": "aria2c" },
        "ftp": { "host": "ftp.example.com", "username": "user", "password": "pass", "remote_path": "/pilinote", "use_tls": false }
    }
}
```

响应：
```json
{
    "download": { ... },
    "storage": { ... },
    "general": { ... },
    "auto_download": { ... }
}
```

错误响应（400）：
```json
{ "detail": "Failed to update settings: ..." }
```

### 获取工具状态

```
GET /api/settings/tool-status
```

响应：
```json
{
    "success": true,
    "data": {
        "ffmpeg": { "available": true, "version": "6.0" },
        "aria2c": { "available": true, "version": "1.37.0" }
    }
}
```

### 查看存储信息

```
GET /api/settings/storage-info
```

响应：
```json
{
    "success": true,
    "data": {
        "total_size": 1073741824,
        "total_size_formatted": "1.0 GB",
        "file_count": 128,
        "directory_count": 64,
        "total_downloads": 100,
        "completed_downloads": 95
    }
}
```

### 查看缓存信息

```
GET /api/settings/cache-info
```

响应：
```json
{
    "success": true,
    "data": {
        "log": { "exists": true, "path": "/path/to/logs", "size": 5242880, "size_formatted": "5.0 MB", "file_count": 10 },
        "temp": { "exists": true, "path": "/path/to/temp", "size": 1048576, "size_formatted": "1.0 MB", "file_count": 5 },
        "webview": { "exists": true, "path": "/path/to/webview_cache", "size": 2097152, "size_formatted": "2.0 MB", "file_count": 20 }
    }
}
```

### 清理缓存

```
POST /api/settings/clear-cache/{cache_type}
```

cache_type: log, temp, webview, all

响应：
```json
{ "success": true, "message": "已清理 log 缓存", "deleted_size": 5242880, "deleted_size_formatted": "5.0 MB" }
```

### 打开缓存目录

```
POST /api/settings/open-cache/{cache_type}
```

cache_type: log, temp, webview, downloads

响应：
```json
{ "success": true, "message": "已打开缓存目录", "path": "/path/to/dir" }
```

### 获取数据库信息

```
GET /api/settings/database/info
```

响应：
```json
{
    "success": true,
    "data": {
        "exists": true,
        "path": "/path/to/pilinote.db",
        "size": 2097152,
        "size_formatted": "2.0 MB"
    }
}
```

### 测试 FTP 连接

```
POST /api/settings/ftp/test
Body: {
    "host": "ftp.example.com",
    "username": "user",
    "password": "password",
    "use_tls": false
}
```

响应：
```json
{ "success": true, "message": "连接成功" }
```

���误响应：
```json
{ "detail": "FTP 连接测试失败: ..." }
```

---

## 关键文件

- 前端: `apps/web/src/pages/settings/StorageSettings.tsx`
- 后端: `apps/api/src/routers/settings.py`
- 服务: `apps/api/src/services/settings_service.py`

---

[返回上级](./README.md)