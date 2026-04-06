# 自动下载功能 API 接口文档

本文档说明自动下载功能的前后端 API 接口对接。

## 接口总览

### 基础信息

- **Base URL**: `/api/auto-download`
- **认证方式**: Bearer Token（通过 Cookie）
- **响应格式**: JSON

### 接口列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/config` | 获取自动下载配置 |
| POST | `/config` | 更新自动下载配置 |
| GET | `/scan-records` | 获取扫描记录 |
| POST | `/scan/trigger` | 手动触发扫描 |

---

## 接口详情

### 1. 获取配置

**接口**: `GET /api/auto-download/config`

**描述**: 获取当前的自动下载配置

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "scan_interval_minutes": 30,
    "scan_cron": null,
    "quality": 64,
    "codec": "avc",
    "audio_bitrate": 192,
    "output_format": "mp4",
    "min_duration": null,
    "max_duration": null,
    "allowed_uploaders": null,
    "blocked_uploaders": null,
    "max_retries": 3,
    "retry_interval": 300
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "配置加载失败"
}
```

**前端调用**:
```typescript
const getConfig = async () => {
  const response = await fetch('/api/auto-download/config');
  const result = await response.json();
  return result;
};
```

---

### 2. 更新配置

**接口**: `POST /api/auto-download/config`

**描述**: 更新自动下载配置

**请求参数**:
```json
{
  "enabled": true,
  "scan_interval_minutes": 30,
  "scan_cron": null,
  "quality": 64,
  "codec": "avc",
  "audio_bitrate": 192,
  "output_format": "mp4",
  "min_duration": null,
  "max_duration": null,
  "allowed_uploaders": null,
  "blocked_uploaders": null,
  "max_retries": 3,
  "retry_interval": 300
}
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| enabled | boolean | 是 | 是否启用自动下载 |
| scan_interval_minutes | number | 是 | 扫描间隔（分钟） |
| scan_cron | string | 否 | Cron 表达式（优先级高于 scan_interval） |
| quality | number | 是 | 视频质量（16-112） |
| codec | string | 是 | 编码格式（avc/hevc/av01） |
| audio_bitrate | number | 是 | 音频码率（kbps） |
| output_format | string | 是 | 输出格式（mp4/mkv） |
| min_duration | number | 否 | 最小时长（秒） |
| max_duration | number | 否 | 最大时长（秒） |
| allowed_uploaders | string[] | 否 | UP 主白名单 |
| blocked_uploaders | string[] | 否 | UP 主黑名单 |
| max_retries | number | 是 | 最大重试次数 |
| retry_interval | number | 是 | 重试间隔（秒） |

**响应示例**:
```json
{
  "success": true,
  "message": "配置已更新"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "配置保存失败：配置验证不通过"
}
```

**前端调用**:
```typescript
const updateConfig = async (config: AutoDownloadConfig) => {
  const response = await fetch('/api/auto-download/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  const result = await response.json();
  return result;
};
```

---

### 3. 获取扫描记录

**接口**: `GET /api/auto-download/scan-records`

**描述**: 获取扫描记录列表

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| source_type | string | 否 | 视频源类型（favorite/watch_later） |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "source_type": "favorite",
      "source_id": "12345678",
      "last_scan_time": "2024-04-06T08:00:00",
      "total_videos": 50,
      "new_videos": 5,
      "added_to_queue": 5,
      "status": "success"
    },
    {
      "id": "uuid-2",
      "source_type": "watch_later",
      "source_id": "all",
      "last_scan_time": "2024-04-06T07:30:00",
      "total_videos": 20,
      "new_videos": 2,
      "added_to_queue": 2,
      "status": "success"
    }
  ]
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 记录 ID |
| source_type | string | 视频源类型（favorite/watch_later） |
| source_id | string | 视频源 ID |
| last_scan_time | string | 最后扫描时间（ISO 8601 格式） |
| total_videos | number | 总视频数 |
| new_videos | number | 新视频数 |
| added_to_queue | number | 添加到队列数 |
| status | string | 状态（success/failed） |

**错误响应**:
```json
{
  "success": false,
  "error": "获取扫描记录失败"
}
```

**前端调用**:
```typescript
const getScanRecords = async (sourceType?: string) => {
  const url = sourceType 
    ? `/api/auto-download/scan-records?source_type=${sourceType}`
    : '/api/auto-download/scan-records';
  const response = await fetch(url);
  const result = await response.json();
  return result;
};
```

---

### 4. 手动触发扫描

**接口**: `POST /api/auto-download/scan/trigger`

**描述**: 手动触发视频源扫描

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| source_type | string | 是 | 视频源类型（favorite/watch_later） |
| source_id | string | 否 | 视频源 ID（默认为 "all"） |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": 50,
    "new": 5,
    "added": 5
  }
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| total | number | 扫描到的总视频数 |
| new | number | 新视频数 |
| added | number | 添加到队列的视频数 |

**错误响应**:
```json
{
  "success": false,
  "error": "扫描失败：获取收藏夹失败"
}
```

**前端调用**:
```typescript
const triggerScan = async (sourceType: string, sourceId: string = 'all') => {
  const url = `/api/auto-download/scan/trigger?source_type=${sourceType}&source_id=${sourceId}`;
  const response = await fetch(url, { method: 'POST' });
  const result = await response.json();
  return result;
};
```

---

## 数据类型定义

### AutoDownloadConfig

```typescript
interface AutoDownloadConfig {
  enabled: boolean;
  scan_interval_minutes: number;
  scan_cron?: string;
  quality: number;
  codec: string;
  audio_bitrate: number;
  output_format: string;
  min_duration?: number;
  max_duration?: number;
  allowed_uploaders?: string[];
  blocked_uploaders?: string[];
  max_retries: number;
  retry_interval: number;
}
```

### ScanRecord

```typescript
interface ScanRecord {
  id: string;
  source_type: string;
  source_id: string;
  last_scan_time: string;
  total_videos: number;
  new_videos: number;
  added_to_queue: number;
  status: string;
}
```

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 使用示例

### 完整的前端使用流程

```typescript
import { autoDownloadAPI, AutoDownloadConfig } from './services/api';

// 1. 加载配置
const loadConfig = async () => {
  const result = await autoDownloadAPI.getConfig();
  if (result.success) {
    console.log('当前配置:', result.data);
  }
};

// 2. 更新配置
const updateConfig = async (config: AutoDownloadConfig) => {
  const result = await autoDownloadAPI.updateConfig(config);
  if (result.success) {
    console.log('配置已保存');
  } else {
    console.error('配置保存失败:', result.error);
  }
};

// 3. 获取扫描记录
const loadScanRecords = async () => {
  const result = await autoDownloadAPI.getScanRecords('favorite');
  if (result.success) {
    console.log('扫描记录:', result.data);
  }
};

// 4. 手动触发扫描
const triggerScan = async () => {
  const result = await autoDownloadAPI.triggerScan('favorite', 'all');
  if (result.success) {
    console.log('扫描结果:', result.data);
  }
};

// 使用示例
(async () => {
  await loadConfig();
  await loadScanRecords();
  await triggerScan();
})();
```

---

## 注意事项

1. **认证**: 所有接口都需要认证，确保用户已登录
2. **错误处理**: 前端需要处理各种错误情况
3. **数据验证**: 前端需要验证用户输入的数据
4. **性能**: 避免频繁调用 API，适当使用缓存
5. **兼容性**: 确保后端 API 版本与前端版本匹配

---

## 测试

### Postman 测试

**测试环境**: `http://localhost:8000`

**测试步骤**:

1. **获取配置**
   ```
   GET /api/auto-download/config
   ```

2. **更新配置**
   ```
   POST /api/auto-download/config
   Content-Type: application/json
   
   {
     "enabled": true,
     "scan_interval_minutes": 30,
     "quality": 64,
     "codec": "avc",
     "audio_bitrate": 192,
     "output_format": "mp4",
     "max_retries": 3,
     "retry_interval": 300
   }
   ```

3. **获取扫描记录**
   ```
   GET /api/auto-download/scan-records?source_type=favorite
   ```

4. **手动触发扫描**
   ```
   POST /api/auto-download/scan/trigger?source_type=favorite&source_id=all
   ```

### 前端测试

```typescript
// 在浏览器控制台测试
import { autoDownloadAPI } from './services/api';

// 测试获取配置
autoDownloadAPI.getConfig().then(console.log);

// 测试获取扫描记录
autoDownloadAPI.getScanRecords().then(console.log);

// 测试手动触发扫描
autoDownloadAPI.triggerScan('favorite').then(console.log);
```

---

## 更新日志

- **2024-04-06**: 初始版本，定义 4 个核心接口