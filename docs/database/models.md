# 数据模型

## 核心模型

### User

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    mid = Column(Integer, unique=True)
    username = Column(String(100))
    avatar = Column(String(500))
    sessdata = Column(Text)
    bili_jct = Column(Text)
    dedeuserid = Column(Integer)
    is_active = Column(Boolean)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    last_refresh_time = Column(DateTime)
```

### Download

```python
class Download(Base):
    __tablename__ = "downloads"
    
    id = Column(String(36), primary_key=True)
    media_type = Column(String(20))  # video/audio
    media_id = Column(String(50))  # BV号或AV号
    title = Column(String(500))
    quality = Column(Integer)
    status = Column(String(20))  # pending/downloading/completed/failed
    progress = Column(Float)
    stage = Column(String(20))  # downloading/merging/completed
    file_path = Column(String(500))
    file_size = Column(Integer)
    total_bytes = Column(Integer)
    downloaded_bytes = Column(Integer)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    completed_at = Column(DateTime)
```

### Scheduler

```python
class Scheduler(Base):
    __tablename__ = "schedulers"
    
    id = Column(String(36), primary_key=True)
    name = Column(String(100))
    media_type = Column(String(20))
    media_id = Column(String(50))
    schedule_type = Column(String(20))  # interval/cron
    interval_minutes = Column(Integer)
    cron_expression = Column(String(50))
    status = Column(String(20))  # active/paused
    created_at = Column(DateTime)
```

### Setting

```python
class Setting(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    type = Column(String(20))  # string/integer/boolean/json/object
    category = Column(String(50), index=True)  # download/storage/general/auto_download
    description = Column(Text)
    default_value = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### Cookie

```python
class Cookie(Base):
    __tablename__ = "cookies"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(100))
    value = Column(Text)
    domain = Column(String(100))
    path = Column(String(100))
    expires = Column(DateTime)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
```

---

## 关联关系

```
User (1) ──────< Cookie (N)
     │
     └─────< Download (N)
     └─────< Scheduler (N)

Setting - 独立表，通过 key 区分配置项
```

---

## 设置存储机制

### settings 表结构

settings 表使用 `key-value` 模式存储配置，支持嵌套配置：

| key 示例 | value 示例 | type | category |
|---------|-----------|------|----------|
| download.video.default_quality | 64 | integer | download |
| download.video.codec | avc | string | download |
| download.max_concurrent | 3 | integer | download |
| download.metadata.enable_nfo | true | boolean | download |
| storage.download_path | ./downloads | string | storage |
| storage.temp_path | ./temp | string | storage |
| storage.sidecar | {"ffmpeg":"ffmpeg"} | object | storage |
| general.theme | auto | string | general |
| auto_download.enabled | false | boolean | auto_download |
| auto_download.custom_scan | {"enabled":false,"folder_list":[]} | object | auto_download |

### 嵌套值的存储方式

- **一级配置**: `category.key` (如 `storage.download_path`)
- **二级配置**: `category.parent.child` (如 `download.video.default_quality`)
- **JSON 对象**: `category.key` 值存储为 JSON 字符串 (如 `storage.sidecar`)

---

## 数据库初始化

### 表创建流程

```
1. create_missing_tables() 检查表是否存在
   ↓
2. 创建缺失的表
   ↓
3. settings 表创建后调用 init_default_settings()
   ↓
4. 插入默认配置
```

### 默认设置初始化

数据库初始化时创建以下默认设置：

```python
# 下载设置
download.default_quality = 80
download.max_concurrent = 3
download.speed_limit = 0
download.output_format = mp4

# 存储设置
storage.download_path = ./downloads
storage.temp_path = ./temp
storage.auto_cleanup = true
storage.keep_failed = false
storage.sidecar = {"ffmpeg": "ffmpeg", "aria2c": "aria2c"}

# 通用设置
general.theme = auto
general.language = zh-CN
general.auto_download = false
general.clipboard_monitor = false

# 自动下载设置
auto_download.enabled = false
auto_download.trigger_type = interval
auto_download.scan_interval = 60
```

---

## 常见问题

### 设置保存后刷新恢复默认值

可能原因：
1. **数据库写入失败**: 检查后端日志，确认 `update_settings()` 是否成功
2. **数据库连接问题**: 确认 SQLite 文件权限
3. **缓存问题**: 前端可能使用了缓存的设置

排查步骤：
1. 检查浏览器控制台网络请求，确认 PUT 请求成功
2. 检查后端日志，确认数据库写入成功
3. 手动查询数据库确认设置已保存

### 设置不同步

确认前后端设置一致：
```python
# 后端返回完整设置对象
PUT /api/settings
Body: { "storage": { "download_path": "/new/path" } }
Response: { "download": {...}, "storage": {...}, ... }
```

前端深度合并：
```typescript
const mergedSettings = {
  ...currentSettings,
  ...data,
  storage: { ...currentSettings.storage, ...data.storage },
  download: { ...currentSettings.download, ...data.download }
}
```

---

[返回上级](./README.md)