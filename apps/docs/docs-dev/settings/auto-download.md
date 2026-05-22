# 自动下载设置

自动下载设置模块管理系统自动下载功能，包括定时扫描收藏夹、稍后再看、存储阈值控制等。

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

---

## 数据流

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                    前端 (AutoDownloadSettings.tsx)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  基本设置  │  │  并发设置  │  │ 收藏夹配置 │  │  稍后再看 │         │
│  │ - 开关   │  │ - 视频并发 │  │ - 文件夹列表│  │ - 扫描数  │         │
│  │ - 间隔   │  │ - 分页并发 │  │ - 最大值  │  │           │         │
│  │ - 触发方式│  │           │  │           │  │           │         │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘         │
│        │             │             │             │               │
│        └─────────────┴─────┬──────┴─────────────┘               │
│                      ┌─────▼─────┐                              │
│                      │ SettingsStore │                         │
│                      └─────┬─────┘                              │
└──────────────────────────│──────────────────────────────────────────
                    ┌──────▼──────┐
                    │ GET/PUT /api/settings
                    └──────┬──────┘
                          │
┌─────────────────────────▼───────────────���──────────────────────────────┐
│                      后端 (FastAPI)                                  │
│                                                                    │
│  ┌──────────────┐  ┌────────────────────────────────┐               │
│  │settings.py │  │ SchedulerService               │               │
│  │/api/settings│  │  - start_scheduler()          │               │
│  │/cleanup/*  │  │  - stop_scheduler()           │               │
│  └────────────┘  │  - scan_favorites()           │               │
│                   │  - scan_watchlater()         │               │
│                   └────────────┬───────────────────┘               │
│                               │                                  │
│                    ┌───────────▼───────────┐                      │
│                    │  Scheduler (APScheduler) │                │
│                    │  - interval 任务        │                   │
│                    │  - cron 任务          │                   │
│                    └───────────────────────┘                      │
│                                                                    │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  BilibiliAPI                                             │   │
│  │  - get_favorite_folders()                               │   │
│  │  - get_favorite_videos()                               │   │
│  │  - get_watchlater()                                  │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────
```

---

## 前端实现

### 组件结构 (AutoDownloadSettings.tsx)

```
┌─────────────────────────────────────────────────────────────┐
│             AutoDownloadSettings                          │
├─────────────────────────────────────────────────────────────┤
│ 状态管理                                               │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ localSettings: {                                     │  │
│ │   enabled: boolean,                                  │  │
│ │   trigger_type: 'interval' | 'cron',             │  │
│ │   scan_interval: number,                           │  │
│ │   cron_expression: string,                       │  │
│ │   concurrent_limit: { video, page },          │  │
│ │   custom_scan: { enabled, folder_list },       │  │
│ │   watch_later_max: number,                    │  │
│ │   auto_start_after_scan: boolean,             │  │
│ │   storage_threshold_gb: number              │  │
│ │ }                                                  │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                         │
│ 功能模块：                                             │
│ 1. 基本设置：开关、触发方式、间隔/Cron                   │
│ 2. 并发设置：视频并发、分页并发                       │
│ 3. 收藏夹配置：添加/删除收藏夹、设置最大值            │
│ 4. 稍后再看：设置扫描数量                            │
│ 5. 存储阈值：设置空间阈值、是否自动开始              │
└───────────────────────────────────────────────────────────┘
```

### 收藏夹配置 UI

```typescript
// 添加收藏夹
const addFolder = (folderName: string, maxVideos: number) => {
  const currentList = custom_scan.folder_list || []
  const newList = [...currentList, { folder_name: folderName, max_videos: maxVideos }]
  handleLocalUpdate('custom_scan', {
    enabled: true,
    folder_list: newList
  })
}

// 删除收藏夹
const removeFolder = (index: number) => {
  const currentList = custom_scan.folder_list || []
  const newList = currentList.filter((_, i) => i !== index)
  handleLocalUpdate('custom_scan', {
    enabled: currentList.length > 1,
    folder_list: newList
  })
}
```

### Cron 表达式支持

```typescript
// 常用 Cron 表达式
const cronExamples = [
  { label: '每小时', value: '0 * * * *' },
  { label: '每6小时', value: '0 */6 * * *' },
  { label: '每天凌晨', value: '0 2 * * *' },
  { label: '每天早8点', value: '0 8 * * *' },
  { label: '每周一', value: '0 8 * * 1' }
]
```

---

## 后端实现

### Schema 定义 (schemas/settings.py)

```python
class ConcurrentLimit(BaseModel):
    """并发限制设置"""
    video: int = Field(default=3, ge=1, le=5)
    page: int = Field(default=3, ge=1, le=5)

class FolderScanConfig(BaseModel):
    """收藏夹扫描配置"""
    folder_name: str = Field(default="")
    max_videos: int = Field(default=0, ge=0, le=999)

class CustomScanConfig(BaseModel):
    """自定义扫描配置"""
    enabled: bool = Field(default=False)
    folder_list: List[FolderScanConfig] = Field(default_factory=list)

class AutoDownloadSettings(BaseModel):
    """自动下载设置"""
    enabled: bool = Field(default=False)
    trigger_type: str = Field(default="interval")  # interval/cron
    scan_interval: int = Field(default=60, ge=15)
    cron_expression: str = Field(default="")
    concurrent_limit: ConcurrentLimit = Field(default_factory=ConcurrentLimit)
    custom_scan: CustomScanConfig = Field(default_factory=CustomScanConfig)
    watch_later_max: int = Field(default=0, ge=0, le=999)
    auto_start_after_scan: bool = Field(default=False)
    storage_threshold_gb: int = Field(default=20, ge=1, le=1024)
```

### 调度服务 (services/scheduler_service.py)

```python
class SchedulerService:
    """定时任务服务"""
    
    def __init__(self):
        self.scheduler = APScheduler()
        self._running = False
    
    def start_auto_download(self, settings: AutoDownloadSettings):
        """启动自动下载"""
        if not settings.enabled:
            return
        
        if settings.trigger_type == 'interval':
            # 间隔触发
            self.scheduler.add_job(
                self.scan_and_download,
                'interval',
                minutes=settings.scan_interval,
                id='auto_download'
            )
        else:
            # Cron 触发
            self.scheduler.add_job(
                self.scan_and_download,
                'cron',
                cron_expression=settings.cron_expression,
                id='auto_download'
            )
    
    async def scan_and_download(self):
        """扫描并下载"""
        # 1. 检查存储空间
        if not self._check_storage_threshold():
            return
        
        # 2. 扫描收藏夹
        new_videos = await self.scan_favorites()
        
        # 3. 扫描稍后再看
        if settings.watch_later_max > 0:
            new_videos.extend(await self.scan_watchlater())
        
        # 4. 添加新视频到下载队列
        for video in new_videos:
            await self.add_to_queue(video)
        
        # 5. 自动开始下载
        if settings.auto_start_after_scan:
            await self.start_downloads()
```

### 存储空间检查

```python
def _check_storage_threshold(self) -> bool:
    """检查存储空间是否足够"""
    import shutil
    
    stat = shutil.disk_usage(settings.storage.download_path)
    free_gb = stat.free / (1024 ** 3)
    
    return free_gb >= settings.storage_threshold_gb
```

---

## 触发方式说明

### Interval 模式

按固定时间间隔触发，适用于持续监控：

| 间隔 | 说明 |
|------|------|
| 15 分钟 | 频繁检查 |
| 30 分钟 | 推荐 |
| 60 分钟 | 默认 |
| 120 分钟 | 较少检查 |

### Cron 模式

按 Cron 表达式定时触发，适用于固定时间：

| 表达式 | 说明 |
|--------|------|
| `0 * * * *` | 每小时 |
| `0 */6 * * *` | 每6小时 |
| `0 2 * * *` | 每天凌晨2点 |
| `0 8 * * *` | 每天早上8点 |
| `0 8 * * 1` | 每周一早上8点 |

---

## 收藏夹扫描流程

```
1. 获取用户收藏夹列表
   GET /api/favorites/folders
   ↓
2. 对每个配置的收藏夹进行扫描
   - folder_name: 收藏夹名称
   - max_videos: 最大扫描数量
   ↓
3. 获取收藏夹内视频
   GET /api/favorites/folders/{id}?pn=1&ps={max_videos}
   ↓
4. 与数据库比对，过滤已下载的视频
   ↓
5. 新视频添加到待下载队列
   ↓
6. 如果 auto_start_after_scan=true，自动开始下载
```

---

## 稍后再看扫描流程

```
1. 获取稍后再看列表
   GET /api/watch-later/list?pn=1&ps={watch_later_max}
   ↓
2. 与数据库比对，过滤已下载的视频
   ↓
3. 新视频添加到待下载队列
   ↓
4. 如果 auto_start_after_scan=true，自动开始下载
```

---

## API 详情

### 获取设置

```
GET /api/settings
```

响应：
```json
{
    "auto_download": {
        "enabled": false,
        "trigger_type": "interval",
        "scan_interval": 60,
        "cron_expression": "",
        "concurrent_limit": {
            "video": 3,
            "page": 3
        },
        "custom_scan": {
            "enabled": false,
            "folder_list": []
        },
        "watch_later_max": 0,
        "auto_start_after_scan": false,
        "storage_threshold_gb": 20
    }
}
```

### 更新设置

```
PUT /api/settings
Content-Type: application/json

Body: {
    "auto_download": {
        "enabled": true,
        "trigger_type": "interval",
        "scan_interval": 30,
        "cron_expression": "",
        "concurrent_limit": {
            "video": 2,
            "page": 2
        },
        "custom_scan": {
            "enabled": true,
            "folder_list": [
                { "folder_name": "必看", "max_videos": 50 },
                { "folder_name": "技术", "max_videos": 20 }
            ]
        },
        "watch_later_max": 10,
        "auto_start_after_scan": true,
        "storage_threshold_gb": 10
    }
}
```

### 查看清理状态

```
GET /api/settings/cleanup/status
```

响应：
```json
{
    "temp_path": "/path/to/temp",
    "exists": true,
    "total_count": 100,
    "old_count": 20,
    "recent_count": 80,
    "cutoff_time": "2026-04-11 10:00:00"
}
```

### 手动触发清理

```
POST /api/settings/cleanup/trigger
```

响应：
```json
{
    "success": true,
    "message": "清理任务已触发"
}
```

---

## 交互流程

### 配置自动下载流程

```
1. 开启自动下载开关
   ↓
2. 选择触发方式（interval/cron）
   ↓
3a. interval: 设置扫描间隔
   ↓
3b. cron: 输入 Cron 表达式
   ↓
4. 配置收藏夹扫描（可选）
   - 添加收藏夹 + 最大视频数
   ↓
5. 配置稍后再看扫描（可选）
   - 设置最大扫描数
   ↓
6. 设置并发限制
   - 视频并发数
   - 分页并发数
   ↓
7. 设置存储阈值
   - 阈值大小
   - 是否自动开始
   ↓
8. 点击保存
   ↓
9. 后端启动定时任务
```

---

## 关键文件

### 前端

| 文件 | 说明 |
|------|------|
| `apps/web/src/pages/settings/AutoDownloadSettings.tsx` | 自动下载设置页面 |
| `apps/web/src/stores/settings.ts` | 状态管理 |

### 后端

| 文件 | 说明 |
|------|------|
| `apps/api/src/routers/settings.py` | API 路由 |
| `apps/api/src/services/settings_service.py` | 设置服务 |
| `apps/api/src/services/scheduler_service.py` | 调度服务 |
| `apps/api/src/schemas/settings.py` | 数据模型 |

---

## 关联文档

- [storage.md](storage.md) - 存储设置
- [download.md](download.md) - 下载设置
- [general.md](general.md) - 通用设置
- [backup.md](backup.md) - 备份设置
- [API 端点](../api/endpoints.md) - 完整 API 列表

---

[返回上级](./README.md)