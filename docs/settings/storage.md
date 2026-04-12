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

### 更新设置

```
PUT /api/settings
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

### 获取工具状态

```
GET /api/settings/tool-status
```

返回：ffmpeg 和 aria2c 的安装状态

### 查看存储信息

```
GET /api/settings/storage-info
```

### 打开缓存目录

```
POST /api/settings/open-cache/{cache_type}
```

cache_type: log, temp, webview, downloads

---

## 关键文件

- 前端: `apps/web/src/pages/settings/StorageSettings.tsx`
- 后端: `apps/api/src/routers/settings.py`
- 服务: `apps/api/src/services/settings_service.py`

---

[返回上级](./README.md)