# 存储设置

存储设置模块负责管理系统存储相关的配置，包括下载路径、临时文件、工具路径、缓存管理和数据库操作。

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
| webdav.url | WebDAV 服务器地址 | - |
| webdav.username | WebDAV 用户名 | - |
| webdav.password | WebDAV 密码 | - |
| webdav.remote_path | WebDAV 远程路径 | /pilinote |
| webdav.verify_ssl | 验证 SSL 证书 | false |

---

## 数据流

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                          前端 (StorageSettings.tsx)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  路径设置   │  │  工具路径  │  │  缓存管理  │  │  数据库   │  │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  │
│        │             │             │             │            │        │
│        └─────────────┴─────┬─────┴─────────────┘            │
│                           │                                │
│                    ┌──────▼──────┐                        │
│                    │ SettingsStore │ (Zustand)             │
│                    │ fetchSettings│                      │
│                    │ updateSettings│                     │
│                    └──────┬──────┘                        │
└───────────────────────────│───────────────────────────────│────────
                          │ API 调用                      │
                    ┌──────▼──────────────────────┐
                    │     GET/PUT /api/settings   │
                    └──────┬──────────────────────┘
                          │
┌─────────────────────────▼─────────────────────────────────────┐
│                      后端 (FastAPI)                             │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────────────────────┐   │
│  │ routers/settings  │───│ SettingsService                   │   │
│  │  /api/settings  │  │  get_settings()                  │   │
│  │  /api/settings/*│  │  update_settings()              │   │
│  └────────┬─────────┘  │  get_tool_status()              │   │
│           │            │  init_default_settings()       │   │
│           │            └──────────────┬─────────────────┘   │
│           │                         │                       │
│           │            ┌────────────▼────────────┐           │
│           │            │    数据库 (SQLite)     │           │
│           │            │    settings 表        │           │
│           │            │    - key (PK)        │           │
│           │            │    - value           │           │
│           │            │    - category        │           │
│           │            │    - default_value  │           │
│           │            └──────────────────────┘           │
│           │                                                  │
│  ┌────────▼─────────────────────────────────────────────────┐   │
│  │ 其他服务                                               │   │
│  │ - BackupService (FTP 备份)                            │   │
│  │ - ToolInitializer (工具初始化)                       │   │
│  │ - FTPAdapter (FTP 连接)                            │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────
```

---

## 前端实现

### 状态管理 (stores/settings.ts)

```typescript
interface SettingsStore {
  settings: Settings | null
  loading: boolean
  error: string | null
  
  // Actions
  fetchSettings: () => Promise<void>
  updateSettings: (update: Partial<Settings>) => Promise<void>
}
```

### 组件结构

StorageSettings.tsx 包含以下功能模块：

| 模块 | 功能 | 关键方法 |
|------|------|---------|
| 路径设置 | 下载/临时路径配置，支持手动输入和拖拽 | `handleDrop`, `handleEditPath` |
| 工具路径 | ffmpeg/aria2c 路径配置，自动检测 | `handleResetToolPath`, `getToolStatus` |
| 缓存管理 | 日志/临时/WebView 缓存清理 | `handleClearCache`, `loadCacheData` |
| 数据库操作 | 导出/导入数据库 | `handleExportDatabase`, `handleImportDatabase` |

### 本地修改暂存

前端使用 `localSettings` 暂存本地修改，通过 `saveSettings()` 批量提交：

```typescript
// 暂存修改
const [localSettings, setLocalSettings] = useState<Record<string, any>>({})

// 提交修改
await updateSettings({
  storage: {
    ...(settings?.storage || {}),
    ...updates
  }
})

// 重新获取以确认保存成功
await useSettingsStore.getState().fetchSettings()
```

---

## 后端实现

### 数据库模型 (models/setting.py)

```python
class Setting(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True)
    key = Column(String(100), unique=True, index=True)  # 如 "storage.download_path"
    value = Column(Text)  # 存储值（字符串形式）
    type = Column(String(20))  # string, integer, boolean, json
    category = Column(String(50), index=True)  # download, storage, general
    description = Column(Text)
    default_value = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
```

### 服务层 (services/settings_service.py)

#### 获取设置

```python
def get_settings(self) -> Settings:
    """获取所有设置分组"""
    all_settings = self.get_all_settings()  # Dict[key, Setting]
    
    # 构建 storage 设置
    storage_settings_dict = {
        'download_path': self._get_setting_value(all_settings, 'storage.download_path', './downloads'),
        'temp_path': self._get_setting_value(all_settings, 'storage.temp_path', './temp'),
        'auto_cleanup': self._get_setting_value(all_settings, 'storage.auto_cleanup', True),
        'keep_failed': self._get_setting_value(all_settings, 'storage.keep_failed', False),
        'sidecar': {...},  # JSON 格式
        'ftp': {...},
        'webdav': {...},
    }
    
    return Settings(
        download=download_settings,
        storage=storage_settings,
        general=general_settings,
        auto_download=auto_download_settings
    )
```

#### 更新设置

```python
def update_settings(self, settings_dict: Dict[str, Any]) -> bool:
    """批量更新设置"""
    for category, category_dict in settings_dict.items():
        if isinstance(category_dict, dict):
            for sub_key, value in category_dict.items():
                if isinstance(value, dict):
                    # 二级嵌套：storage.sidecar, storage.ftp
                    for nested_key, nested_value in value.items():
                        self._update_single_setting(
                            f'{category}.{sub_key}.{nested_key}',
                            nested_value
                        )
                else:
                    # 一级字段：storage.download_path
                    self._update_single_setting(
                        f'{category}.{sub_key}',
                        value
                    )
```

#### 工具状态检测

```python
def get_tool_status(self) -> Dict[str, Dict[str, Any]]:
    """获取工具安装状态"""
    import shutil
    
    # 优先使用项目内工具
    ffmpeg_path = self._get_project_tool_path('ffmpeg') or shutil.which('ffmpeg')
    status['ffmpeg'] = {
        'installed': ffmpeg_path is not None,
        'path': ffmpeg_path or '未安装',
        'bundled': self._get_project_tool_path('ffmpeg') is not None
    }
```

---

## API 详情

### 获取所有设置

```
GET /api/settings
```

| 响应字段 | 类型 | 说明 |
|---------|------|------|
| download | object | 下载设置 |
| storage | object | 存储设置 |
| general | object | 通用设置 |
| auto_download | object | 自动下载设置 |

### 更新存储设置

```
PUT /api/settings
Content-Type: application/json

Body: {
    "storage": {
        "download_path": "/path/to/downloads",
        "temp_path": "/path/to/temp",
        "auto_cleanup": true,
        "keep_failed": false,
        "sidecar": {
            "ffmpeg": "/usr/local/bin/ffmpeg",
            "aria2c": "/usr/local/bin/aria2c"
        }
    }
}
```

| 错误码 | 说明 |
|--------|------|
| 400 | 设置更新失败 |
| 500 | 服务器内部错误 |

### 获取工具状态

```
GET /api/settings/tool-status
```

响应示例：
```json
{
    "success": true,
    "data": {
        "ffmpeg": {
            "installed": true,
            "path": "/usr/local/bin/ffmpeg",
            "bundled": false
        },
        "aria2c": {
            "installed": true,
            "path": "/usr/local/bin/aria2c",
            "bundled": true
        }
    }
}
```

### 查看存储信息

```
GET /api/settings/storage-info
```

响应示例：
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

响应示例：
```json
{
    "success": true,
    "data": {
        "log": {
            "exists": true,
            "path": "/path/to/logs",
            "size": 5242880,
            "size_formatted": "5.0 MB",
            "file_count": 10
        },
        "temp": {
            "exists": true,
            "path": "/path/to/temp",
            "size": 1048576,
            "size_formatted": "1.0 MB",
            "file_count": 5
        },
        "webview": {
            "exists": true,
            "path": "/path/to/webview_cache",
            "size": 2097152,
            "size_formatted": "2.0 MB",
            "file_count": 20
        }
    }
}
```

### 清理缓存

```
POST /api/settings/clear-cache/{cache_type}
```

| cache_type | 说明 |
|------------|------|
| log | 日志文件 |
| temp | 临时文件 |
| webview | WebView 缓存 |
| all | 所有缓存 |

响应示例：
```json
{
    "success": true,
    "message": "已清理 log 缓存",
    "deleted_size": 5242880,
    "deleted_size_formatted": "5.0 MB"
}
```

### 打开缓存目录

```
POST /api/settings/open-cache/{cache_type}
```

| cache_type | 说明 |
|------------|------|
| log | 日志目录 |
| temp | 临时目录 |
| webview | WebView 缓存目录 |
| downloads | 下载目录 |

响应示例：
```json
{
    "success": true,
    "message": "���打开缓存目录",
    "path": "/path/to/dir"
}
```

### 获取数据库信息

```
GET /api/settings/database/info
```

响应示例：
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

### 导出数据库

```
GET /api/settings/database/export
```

返回文件下载（SQLite 格式），文件名格式：`pilinote_backup_YYYYMMDD_HHMMSS.db`

### 导入数据库

```
POST /api/settings/database/import
Content-Type: multipart/form-data

Body: {
    "file": <database file>
}
```

| 错误码 | 说明 |
|--------|------|
| 400 | 文件格式无效 |
| 500 | 导入失败 |

### 测试 FTP 连接

```
POST /api/settings/ftp/test
Content-Type: application/json

Body: {
    "host": "ftp.example.com",
    "username": "user",
    "password": "password",
    "use_tls": false
}
```

响应示例：
```json
{
    "success": true,
    "message": "连接成功"
}
```

错误响应：
```json
{
    "detail": "FTP 连接测试失败: ..."
}
```

---

## 交互流程

### 路径修改流程

```
1. 用户点击编辑按钮
   ↓
2. 打开 Modal 窗口
   ↓
3. 用户输入路径（支持相对路径/绝对路径）
   ↓
4. 点击保存 → 更新 localSettings
   ↓
5. 点击"保存设置" → 调用 updateSettings API
   ↓
6. 重新获取设置 → 确认保存成功
```

### 工具路径重置流程

```
1. 用户点击重置按钮
   ↓
2. 调用 GET /api/settings/tool-status
   ↓
3. 获取工具实际安装路径
   ↓
4. 更新 sidecar 设置 → 自动保存
   ↓
5. 显示成功提示
```

### 缓存清理流程

```
1. 用户点击清理按钮（log/temp/webview）
   ↓
2. 弹出确认对话框
   ↓
3. 用户确认 → POST /api/settings/clear-cache/{type}
   ↓
4. 返回清理结果
   ↓
5. 刷新缓存数据
```

---

## 关键文件

### 前端

| 文件 | 说明 |
|------|------|
| `apps/web/src/stores/settings.ts` | 状态管理 |
| `apps/web/src/pages/settings/StorageSettings.tsx` | 存储设置页面 |
| `apps/web/src/components/Modal.tsx` | 路径编辑弹窗 |
| `apps/web/src/components/ConfirmModal.tsx` | 确认弹窗 |

### 后端

| 文件 | 说明 |
|------|------|
| `apps/api/src/routers/settings.py` | API 路由 |
| `apps/api/src/services/settings_service.py` | 设置服务 |
| `apps/api/src/models/setting.py` | 数据库模型 |
| `apps/api/src/schemas/settings.py` | Pydantic 模型 |
| `apps/api/src/services/tool_initializer.py` | 工具初始化 |
| `apps/api/src/utils/ftp_adapter.py` | FTP 适配器 |

---

## 关联文档

- [download.md](download.md) - 下载设置
- [general.md](general.md) - 通用设置
- [auto-download.md](auto-download.md) - 自动下载设置
- [backup.md](backup.md) - 备份设置
- [API 端点](../api/endpoints.md) - 完整 API 列表

---

[返回上级](./README.md)