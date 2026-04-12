# 自动下载设置

## 配置项

### 基本设置

| 键 | 说明 | 默认值 | 范围 |
|----|------|-------|-------|
| enabled | 启用自动下载 | false | true/false |
| trigger_type | 触发方式 | interval | interval/cron |
| scan_interval | 扫描间隔(分钟) | 60 | 15+ |
| cron_expression | Cron 表达式 | - | 标准cron |

### 并发控制

| 键 | 说明 | 默认值 | 范围 |
|----|------|-------|-------|
| concurrent_limit.video | 视频并发数 | 3 | 1-5 |
| concurrent_limit.page | 分页并发数 | 3 | 1-5 |

### 收藏夹扫描

| 键 | 说明 | 默认值 | 范围 |
|----|------|-------|-------|
| custom_scan.enabled | 启用自定义扫描 | false | true/false |
| custom_scan.folder_list | 收藏夹列表 | [] | - |

#### 文件夹配置 (FolderScanConfig)

| 键 | 说明 | 默认值 | 范围 |
|----|------|-------|-------|
| folder_name | 收藏夹名称 | - | - |
| max_videos | 最大扫描视频数 | 0 | 0-999 |

### 稍后再看

| 键 | 说明 | 默认值 | 范围 |
|----|------|-------|-------|
| watch_later_max | 稍后再看最大扫描数 | 0 | 0-999 |

### 自动开始

| 键 | 说明 | 默认值 |
|----|------|-------|
| auto_start_after_scan | 扫描完成后自动开始下载 | false |
| storage_threshold_gb | 存储空间阈值(GB) | 20 |

## 详细说明

### 触发方式
- **interval**: 按固定间隔扫描（scan_interval）
- **cron**: 按 Cron 表达式定时扫描

### 收藏夹扫描说明
- max_videos = 0 表示不扫描该收藏夹
- 设置大于 0 的数值后才进行扫描

### 稍后再看扫描说明
- watch_later_max = 0 表示不扫描稍后再看
- 仅获取最新的 N 个视频进行比对

### 存储空间阈值
- 当剩余存储空间小于此值时，不触发自动下载

## API

### 获取设置

```
GET /api/settings
```

### 更新设置

```
PUT /api/settings
Body: {
    "auto_download": {
        "enabled": false,
        "trigger_type": "interval",
        "scan_interval": 60,
        "cron_expression": "",
        "concurrent_limit": { "video": 3, "page": 3 },
        "custom_scan": { "enabled": false, "folder_list": [] },
        "watch_later_max": 0,
        "auto_start_after_scan": false,
        "storage_threshold_gb": 20
    }
}
```

### 查看清理状态

```
GET /api/settings/cleanup/status
```

### 手动触发清理

```
POST /api/settings/cleanup/trigger
```

---

## 关键文件

- 前端: `apps/web/src/pages/settings/AutoDownloadSettings.tsx`
- 后端: `apps/api/src/schemas/settings.py` (AutoDownloadSettings, ConcurrentLimit, CustomScanConfig, FolderScanConfig)
- 服务: `apps/api/src/services/scheduler_service.py`

---

[返回上级](./README.md)