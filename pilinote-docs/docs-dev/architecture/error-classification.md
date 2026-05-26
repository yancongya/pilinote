# 细粒度错误分类系统

## 概述

PiliNote实现了完整的细粒度错误分类系统，将原本粗粒度的FAILED状态细分为25种具体错误类型，每个错误类型都有对应的错误码、严重程度、恢复建议和上下文信息。该系统大幅提升了错误诊断能力、用户体验和问题解决效率。

## 设计目标

- **精确定位**: 将模糊的失败状态细分为具体的错误类型
- **标准化**: 统一的错误码和错误信息格式
- **可恢复**: 标识错误是否可恢复，指导重试策略
- **用户友好**: 提供清晰的错误描述和解决建议
- **向后兼容**: 保留原有的error_message字段，平滑升级

## 系统架构

### 错误分类层次

```
错误分类系统
├── 错误类型 (ErrorType) - 25种
│   ├── 网络错误 (6种)
│   ├── API错误 (5种)
│   ├── 文件系统错误 (4种)
│   ├── 工具错误 (3种)
│   ├── 数据错误 (3种)
│   ├── 业务逻辑错误 (4种)
│   └── 资源错误 (4种)
├── 错误严重程度 (ErrorSeverity) - 5级
│   ├── CRITICAL - 严重错误
│   ├── HIGH - 高优先级错误
│   ├── MEDIUM - 中等优先级错误
│   ├── LOW - 低优先级错误
│   └── INFO - 信息性错误
└── 错误异常类 (20+个专用异常类)
```

## 错误类型定义

### 1. 网络错误

| 错误类型 | 错误码 | 严重程度 | 可恢复 | 描述 |
|---------|--------|---------|--------|------|
| `NETWORK_CONNECTION` | PNL_NET_CONN_001 | HIGH | ✅ | 网络连接失败 |
| `NETWORK_TIMEOUT` | PNL_NET_TIMEOUT_001 | HIGH | ✅ | 网络连接超时 |
| `NETWORK_RATE_LIMIT` | PNL_NET_RATE_001 | MEDIUM | ✅ | 网络请求频率限制 |
| `NETWORK_DNS` | PNL_NET_DNS_001 | HIGH | ✅ | DNS解析失败 |
| `NETWORK_PROXY` | PNL_NET_PROXY_001 | MEDIUM | ✅ | 代理连接失败 |
| `NETWORK_SSL` | PNL_NET_SSL_001 | HIGH | ❌ | SSL/TLS证书错误 |

**示例**:
```json
{
  "error_type": "network_timeout",
  "error_code": "PNL_NET_TIMEOUT_001",
  "message": "网络连接超时",
  "severity": "high",
  "recoverable": true,
  "suggestion": "请检查网络连接或稍后重试"
}
```

### 2. API错误

| 错误类型 | 错误码 | 严重程度 | 可恢复 | 描述 |
|---------|--------|---------|--------|------|
| `API_AUTH` | PNL_API_AUTH_001 | HIGH | ✅ | API认证失败 |
| `API_BANNED` | PNL_API_BAN_001 | CRITICAL | ❌ | API账户被封禁 |
| `API_NOT_FOUND` | PNL_API_404_001 | HIGH | ❌ | API资源不存在 |
| `API_INVALID_RESPONSE` | PNL_API_RESP_001 | MEDIUM | ✅ | API响应格式无效 |
| `API_COOKIE_EXPIRED` | PNL_API_COOKIE_001 | MEDIUM | ✅ | Cookie已过期 |

**示例**:
```json
{
  "error_type": "api_auth",
  "error_code": "PNL_API_AUTH_001",
  "message": "API认证失败",
  "severity": "high",
  "recoverable": true,
  "suggestion": "请检查登录凭证或重新登录"
}
```

### 3. 文件系统错误

| 错误类型 | 错误码 | 严重程度 | 可恢复 | 描述 |
|---------|--------|---------|--------|------|
| `FS_DISK_SPACE` | PNL_FS_DISK_001 | CRITICAL | ✅ | 磁盘空间不足 |
| `FS_PERMISSION` | PNL_FS_PERM_001 | CRITICAL | ❌ | 文件权限不足 |
| `FS_NOT_FOUND` | PNL_FS_NOTFOUND_001 | HIGH | ❌ | 文件不存在 |
| `FS_IO_ERROR` | PNL_FS_IO_001 | HIGH | ✅ | 文件读写失败 |

**示例**:
```json
{
  "error_type": "fs_disk_space",
  "error_code": "PNL_FS_DISK_001",
  "message": "磁盘空间不足",
  "severity": "critical",
  "recoverable": true,
  "suggestion": "请清理磁盘空间或更改下载路径"
}
```

### 4. 工具错误

| 错误类型 | 错误码 | 严重程度 | 可恢复 | 描述 |
|---------|--------|---------|--------|------|
| `TOOL_NOT_FOUND` | PNL_TOOL_NOTFOUND_001 | CRITICAL | ❌ | 工具未找到 |
| `TOOL_EXECUTION` | PNL_TOOL_EXEC_001 | HIGH | ✅ | 工具执行失败 |
| `TOOL_TIMEOUT` | PNL_TOOL_TIMEOUT_001 | MEDIUM | ✅ | 工具执行超时 |

**示例**:
```json
{
  "error_type": "tool_not_found",
  "error_code": "PNL_TOOL_NOTFOUND_001",
  "message": "FFmpeg未找到",
  "severity": "critical",
  "recoverable": false,
  "suggestion": "请安装FFmpeg并添加到系统PATH"
}
```

### 5. 数据错误

| 错误类型 | 错误码 | 严重程度 | 可恢复 | 描述 |
|---------|--------|---------|--------|------|
| `DATA_VALIDATION` | PNL_DATA_VAL_001 | MEDIUM | ❌ | 数据验证失败 |
| `DATA_PARSING` | PNL_DATA_PARSE_001 | MEDIUM | ✅ | 数据解析失败 |
| `DATA_MISSING` | PNL_DATA_MISSING_001 | HIGH | ❌ | 数据缺失 |

**示例**:
```json
{
  "error_type": "data_validation",
  "error_code": "PNL_DATA_VAL_001",
  "message": "数据验证失败",
  "severity": "medium",
  "recoverable": false,
  "suggestion": "请检查输入数据格式"
}
```

### 6. 业务逻辑错误

| 错误类型 | 错误码 | 严重程度 | 可恢复 | 描述 |
|---------|--------|---------|--------|------|
| `BIZ_VIDEO_DELETED` | PNL_BIZ_VID_DEL_001 | HIGH | ❌ | 视频已删除 |
| `BIZ_VIDEO_PRIVATE` | PNL_BIZ_VID_PRIV_001 | HIGH | ❌ | 视频为私密 |
| `BIZ_REGION_RESTRICTED` | PNL_BIZ_REGION_001 | MEDIUM | ❌ | 地区限制 |
| `BIZ_COPYRIGHT_RESTRICTED` | PNL_BIZ_COPY_001 | MEDIUM | ❌ | 版权限制 |

**示例**:
```json
{
  "error_type": "biz_video_deleted",
  "error_code": "PNL_BIZ_VID_DEL_001",
  "message": "视频已删除",
  "severity": "high",
  "recoverable": false,
  "suggestion": "该视频已被UP主删除，无法下载"
}
```

### 7. 资源错误

| 错误类型 | 错误码 | 严重程度 | 可恢复 | 描述 |
|---------|--------|---------|--------|------|
| `RESOURCE_TIMEOUT` | PNL_RES_TIMEOUT_001 | MEDIUM | ✅ | 资源超时 |
| `RESOURCE_BUSY` | PNL_RES_BUSY_001 | MEDIUM | ✅ | 资源忙碌 |
| `RESOURCE_LIMIT_EXCEEDED` | PNL_RES_LIMIT_001 | HIGH | ✅ | 资源限制超限 |
| `RESOURCE_UNAVAILABLE` | PNL_RES_UNAVAIL_001 | HIGH | ✅ | 资源不可用 |

**示例**:
```json
{
  "error_type": "resource_timeout",
  "error_code": "PNL_RES_TIMEOUT_001",
  "message": "资源请求超时",
  "severity": "medium",
  "recoverable": true,
  "suggestion": "请稍后重试"
}
```

## 错误严重程度定义

| 严重程度 | 含义 | 处理建议 |
|---------|------|----------|
| `CRITICAL` | 严重错误，系统无法继续运行 | 立即停止相关操作，通知管理员 |
| `HIGH` | 高优先级错误，影响主要功能 | 记录错误日志，尝试恢复或提示用户 |
| `MEDIUM` | 中等优先级错误，影响部分功能 | 记录警告日志，尝试自动恢复 |
| `LOW` | 低优先级错误，不影响主要功能 | 记录信息日志，可忽略 |
| `INFO` | 信息性错误，仅供参考 | 记录调试日志 |

## 错误详情结构

```typescript
interface ErrorDetail {
  error_type: string;           // 错误类型（枚举值）
  error_code: string;           // 错误码（格式：PNL_类型_编号）
  message: string;              // 错误消息（用户友好的描述）
  severity: string;             // 严重程度（CRITICAL/HIGH/MEDIUM/LOW/INFO）
  recoverable: boolean;         // 是否可恢复
  suggestion: string;           // 解决建议
  details: {                    // 详细信息
    original_error?: string;    // 原始错误信息
    context?: Record<string, any>; // 上下文信息
    retry_count?: number;       // 重试次数
    last_attempt?: number;      // 最后尝试时间戳
  };
  stack_trace?: string;         // 堆栈跟踪（调试用）
  timestamp: number;            // 错误发生时间戳
}
```

## 错误处理流程

### 1. 错误捕获和分类

```python
from src.utils.error_handler import ErrorHandler
from src.models.exceptions import PiliNoteError

error_handler = ErrorHandler()

try:
    # 执行可能出错的操作
    await download_video(video_url)
except Exception as e:
    # 自动分类和转换异常
    pili_error = error_handler.handle_error(e)
    
    # 保存错误详情
    await task.update(error_detail=pili_error.to_dict())
```

### 2. 错误详情保存

```python
# 在Task模型中保存错误详情
task = await Task.get(task_id)
task.error_detail = {
    "error_type": "network_timeout",
    "error_code": "PNL_NET_TIMEOUT_001",
    "message": "网络连接超时",
    "severity": "high",
    "recoverable": True,
    "suggestion": "请检查网络连接或稍后重试",
    "details": {
        "original_error": str(e),
        "context": {"video_url": video_url}
    },
    "timestamp": time.time()
}
await task.save()
```

### 3. 错误信息展示

```typescript
// 前端展示错误详情
function showError(error: ErrorDetail) {
  return `
    <div class="error-message ${error.severity}">
      <div class="error-icon">${getErrorIcon(error.error_type)}</div>
      <div class="error-content">
        <h3 class="error-title">${error.message}</h3>
        <div class="error-code">错误码: ${error.error_code}</div>
        <div class="error-suggestion">${error.suggestion}</div>
        ${error.recoverable ? '<button onclick="retry()">重试</button>' : ''}
      </div>
    </div>
  `;
}
```

## 错误恢复策略

### 基于可恢复性的重试策略

```python
async def execute_with_retry(task_id: str):
    task = await Task.get(task_id)
    error_detail = task.error_detail
    
    if not error_detail or not error_detail.get('recoverable'):
        # 不可恢复的错误，直接失败
        await task.update(state=TaskState.FAILED)
        return
    
    # 可恢复的错误，根据严重程度决定是否重试
    severity = error_detail.get('severity')
    
    if severity in ['LOW', 'MEDIUM']:
        # 低优先级错误，自动重试
        await retry_task(task_id)
    elif severity == 'HIGH':
        # 高优先级错误，需要用户确认
        notify_user(f"任务遇到错误: {error_detail['message']}", task_id)
    else:
        # CRITICAL错误，不重试
        await task.update(state=TaskState.FAILED)
```

### 基于错误类型的差异化处理

```python
async def handle_error_by_type(error_detail: ErrorDetail):
    error_type = error_detail['error_type']
    
    if error_type.startswith('network_'):
        # 网络错误：检查网络连接，延迟重试
        await check_network_connection()
        await asyncio.sleep(5)
        
    elif error_type == 'fs_disk_space':
        # 磁盘空间不足：清理临时文件
        await cleanup_temp_files()
        
    elif error_type == 'api_cookie_expired':
        # Cookie过期：自动刷新Cookie
        await refresh_cookies()
        
    elif error_type == 'tool_not_found':
        # 工具未找到：提示用户安装
        notify_user(f"请安装{error_detail['suggestion']}")
```

## 数据库迁移

### 新增字段

```sql
-- 为tasks表添加error_detail字段
ALTER TABLE tasks ADD COLUMN error_detail JSON;

-- 为downloads表添加error_detail字段  
ALTER TABLE downloads ADD COLUMN error_detail JSON;

-- 保留原有的error_message字段以保持向后兼容
```

### 字段说明

- `error_message` (TEXT): 原有的错误信息字段（向后兼容）
- `error_detail` (JSON): 新的结构化错误详情字段

## API响应示例

### 错误响应格式

```json
{
  "success": false,
  "error": {
    "error_type": "network_timeout",
    "error_code": "PNL_NET_TIMEOUT_001",
    "message": "网络连接超时",
    "severity": "high",
    "recoverable": true,
    "suggestion": "请检查网络连接或稍后重试",
    "details": {
      "original_error": "Connection timeout after 30 seconds",
      "context": {
        "video_url": "https://example.com/video",
        "attempt": 1
      }
    },
    "timestamp": 1776000000
  }
}
```

### 任务状态响应

```json
{
  "success": true,
  "data": {
    "id": "task-123",
    "state": 5,  // FAILED
    "error_message": "网络连接超时",  // 向后兼容
    "error_detail": {  // 新的详细错误信息
      "error_type": "network_timeout",
      "error_code": "PNL_NET_TIMEOUT_001",
      "message": "网络连接超时",
      "severity": "high",
      "recoverable": true,
      "suggestion": "请检查网络连接或稍后重试",
      "details": {...},
      "timestamp": 1776000000
    }
  }
}
```

## 测试覆盖

### 错误分类测试

```python
# 测试网络错误分类
def test_network_error_classification():
    error = ConnectionError("Connection timeout")
    pili_error = error_handler.handle_error(error)
    assert pili_error.error_type == "network_timeout"
    assert pili_error.error_code == "PNL_NET_TIMEOUT_001"
    assert pili_error.recoverable == True

# 测试API错误分类
def test_api_error_classification():
    error = HTTPException(status_code=401, detail="Unauthorized")
    pili_error = error_handler.handle_error(error)
    assert pili_error.error_type == "api_auth"
    assert pili_error.error_code == "PNL_API_AUTH_001"

# 测试文件系统错误分类
def test_fs_error_classification():
    error = OSError("No space left on device")
    pili_error = error_handler.handle_error(error)
    assert pili_error.error_type == "fs_disk_space"
    assert pili_error.error_code == "PNL_FS_DISK_001"
```

## 最佳实践

### 1. 错误处理最佳实践

```python
# ✅ 好的做法：使用错误处理器
try:
    await download_video(video_url)
except Exception as e:
    pili_error = error_handler.handle_error(e)
    await save_error_detail(pili_error)

# ❌ 不好的做法：只保存简单的错误消息
try:
    await download_video(video_url)
except Exception as e:
    await save_error_message(str(e))
```

### 2. 错误展示最佳实践

```typescript
// ✅ 好的做法：展示详细的错误信息和建议
<div className="error-card high-severity">
  <div className="error-header">
    <Icon name="network-warning" />
    <h3>网络连接超时</h3>
  </div>
  <div className="error-body">
    <p>错误码: PNL_NET_TIMEOUT_001</p>
    <p>请检查网络连接或稍后重试</p>
    <Button onClick={handleRetry}>重试</Button>
  </div>
</div>

// ❌ 不好的做法：只展示简单的错误消息
<div className="error">下载失败</div>
```

### 3. 错误恢复最佳实践

```python
# ✅ 好的做法：基于错误可恢复性决定重试策略
if error_detail.recoverable:
    await retry_task(task_id)
else:
    await notify_user(error_detail.suggestion)

# ❌ 不好的做法：所有错误都重试
await retry_task(task_id)
```

## 故障排查

### 常见问题

**问题1: 错误分类不准确**

- **原因**: 错误消息格式不符合预期
- **解决**: 检查错误消息格式，更新错误分类规则

**问题2: 错误详情保存失败**

- **原因**: 数据库字段类型不匹配
- **解决**: 确保error_detail字段为JSON类型

**问题3: 前端无法显示错误详情**

- **原因**: 前端代码未更新以支持新的错误格式
- **解决**: 更新前端代码以处理error_detail字段

## 相关文件

- `/Users/tanyancong/工作/开发/pilinote/apps/api/src/models/exceptions.py` - 错误类型和异常类定义
- `/Users/tanyancong/工作/开发/pilinote/apps/api/src/utils/error_handler.py` - 错误处理器实现
- `/Users/tanyancong/工作/开发/pilinote/apps/api/test_error_classification.py` - 错误分类测试套件
- `/Users/tanyancong/工作/开发/pilinote/apps/api/migrate_add_error_detail.py` - 数据库迁移脚本

## 依赖项

- **必需**: typing, json, logging, enum
- **可选**: 无

## 版本历史

- **v1.0.0** (2026-04-14): 初始版本，实现25种错误类型和细粒度错误分类系统