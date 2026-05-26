# 全局并发控制系统

## 概述

PiliNote实现了统一的全局并发控制系统，用于管理系统中的各种并发资源，确保系统资源的合理分配和高效利用。该系统解决了之前多个独立Semaphore导致的并发冲突问题，提供了动态调整、监控和配置能力。

## 设计目标

- **统一管理**: 消除多个独立的并发控制机制，实现集中式管理
- **动态调整**: 根据系统资源使用情况自动调整并发限制
- **可监控**: 提供详细的并发统计和资源使用情况
- **可配置**: 支持运行时动态调整并发限制
- **高可用**: 支持可选依赖，确保核心功能可用性

## 系统架构

### 核心组件

```
ConcurrencyControlService (全局单例)
├── Resource Semaphores (4种资源类型)
│   ├── video_download (视频下载)
│   ├── pagination_download (分页下载)
│   ├── api_request (API请求)
│   └── media_processing (媒体处理)
├── Active Tasks Tracking (活跃任务跟踪)
├── Statistics Collection (统计信息收集)
└── Dynamic Adjustment (动态调整)
```

### 资源类型定义

| 资源类型 | 默认并发数 | 用途 | 超时时间 |
|---------|-----------|------|----------|
| `video_download` | 3 | 视频下载任务 | 3600秒 |
| `pagination_download` | 5 | 分页数据下载 | 300秒 |
| `api_request` | 10 | API请求 | 30秒 |
| `media_processing` | 2 | 媒体处理任务 | 1800秒 |

## 核心功能

### 1. 资源获取和释放

```python
# 获取资源
async with concurrency_control.acquire("video_download") as acquired:
    if acquired:
        # 执行下载任务
        await download_video()
    else:
        # 资源不足，处理等待或失败
        handle_resource_unavailable()

# 释放资源 (自动在with块结束时释放)
```

### 2. 动态并发调整

系统每5秒检查一次系统资源使用情况，并根据以下规则动态调整并发数：

**CPU使用率**:
- CPU使用率 > 80%: 降低并发数到当前的70%
- CPU使用率 > 90%: 降低并发数到当前的50%
- CPU使用率 < 30%: 提高并发数到当前的120%

**内存使用率**:
- 内存使用率 > 85%: 降低并发数到当前的60%
- 内存使用率 > 95%: 降低并发数到当前的40%

**磁盘IO**:
- 磁盘IO使用率 > 80%: 降低并发数到当前的80%

**调整规则**:
- 最小并发数不低于默认值的30%
- 最大并发数不超过默认值的200%
- 调整幅度每次不超过±20%

### 3. 统计信息收集

系统实时收集以下统计信息：

```typescript
interface ConcurrencyStats {
  resource_type: string;
  max_concurrent: number;
  current_concurrent: number;
  available_slots: number;
  active_tasks: string[];
  total_requests: number;
  successful_acquisitions: number;
  failed_acquisitions: number;
  avg_wait_time: number;
  peak_concurrent: number;
}
```

## API接口

### 获取并发统计

**端点**: `GET /api/concurrency/stats`

**响应示例**:
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

**端点**: `GET /api/concurrency/stats/{resource_type}`

**参数**:
- `resource_type`: 资源类型 (video_download, pagination_download, api_request, media_processing)

### 获取系统资源使用

**端点**: `GET /api/concurrency/resource-usage`

**响应示例**:
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

**端点**: `POST /api/concurrency/update-max-concurrent`

**请求体**:
```json
{
  "resource_type": "video_download",
  "max_concurrent": 5
}
```

**响应示例**:
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

**端点**: `POST /api/concurrency/dynamic-adjustment`

**请求体**:
```json
{
  "enabled": true,
  "check_interval": 5
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "动态调整已启用",
  "enabled": true,
  "check_interval": 5
}
```

### 获取并发配置

**端点**: `GET /api/concurrency/config`

**响应示例**:
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

**端点**: `GET /api/concurrency/health`

**响应示例**:
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

## 使用示例

### 在服务中使用并发控制

```python
from src.services.concurrency_control import concurrency_control

class DownloadService:
    async def download_video(self, video_url: str):
        # 获取视频下载资源
        async with concurrency_control.acquire("video_download") as acquired:
            if not acquired:
                raise Exception("下载资源不足，请稍后重试")
            
            try:
                # 执行下载
                await self._download_with_ytdlp(video_url)
            finally:
                # 资源会在with块结束时自动释放
                pass
```

### 在调度器中使用并发控制

```python
from src.services.concurrency_control import concurrency_control

class SchedulerService:
    async def execute_task(self, task_id: str):
        async with concurrency_control.acquire("video_download") as acquired:
            if acquired:
                await self._process_task(task_id)
            else:
                logger.warning(f"任务 {task_id} 无法获取下载资源")
                await self._handle_resource_unavailable(task_id)
```

## 配置说明

### 默认配置

```python
DEFAULT_CONCURRENCY_CONFIG = {
    "video_download": {
        "max_concurrent": 3,
        "timeout": 3600,
        "dynamic_adjustment": True
    },
    "pagination_download": {
        "max_concurrent": 5,
        "timeout": 300,
        "dynamic_adjustment": True
    },
    "api_request": {
        "max_concurrent": 10,
        "timeout": 30,
        "dynamic_adjustment": True
    },
    "media_processing": {
        "max_concurrent": 2,
        "timeout": 1800,
        "dynamic_adjustment": True
    }
}
```

### 动态调整配置

```python
DYNAMIC_ADJUSTMENT_CONFIG = {
    "enabled": True,
    "check_interval": 5,  # 检查间隔（秒）
    "min_multiplier": 0.3,  # 最小倍数
    "max_multiplier": 2.0,  # 最大倍数
    "max_adjustment": 0.2   # 最大调整幅度
}
```

## 性能优化

### 资源获取优化

1. **快速失败**: 当资源不足时立即返回，不进行等待
2. **超时控制**: 避免长时间等待导致系统阻塞
3. **异步获取**: 使用异步信号量，不阻塞事件循环

### 统计信息优化

1. **轻量级收集**: 只收集关键统计信息，避免性能影响
2. **异步更新**: 统计信息异步更新，不影响主流程
3. **缓存机制**: 常用统计信息缓存，减少计算开销

## 监控和告警

### 关键指标

- **资源利用率**: 当前并发数 / 最大并发数
- **等待时间**: 平均资源获取等待时间
- **失败率**: 资源获取失败次数 / 总请求次数
- **峰值并发**: 历史最大并发数

### 告警规则

- 资源利用率 > 90% 持续5分钟: 告警
- 资源获取失败率 > 10% 持续5分钟: 告警
- 平均等待时间 > 10秒: 告警

## 故障排查

### 常见问题

**问题1: 资源获取超时**

- **原因**: 资源竞争激烈，等待时间过长
- **解决**: 增加最大并发数或优化任务执行效率

**问题2: 系统资源利用率低**

- **原因**: 并发限制设置过低
- **解决**: 提高最大并发数或启用动态调整

**问题3: 动态调整不生效**

- **原因**: psutil未安装或系统资源监控失败
- **解决**: 安装psutil或检查系统资源监控日志

## 最佳实践

1. **合理设置并发数**: 根据系统资源和任务特性设置合适的并发数
2. **启用动态调整**: 让系统根据资源使用情况自动调整
3. **监控关键指标**: 定期检查并发统计和系统资源使用情况
4. **处理资源不足**: 在资源不足时提供友好的用户提示
5. **测试不同配置**: 在不同负载下测试并发配置，找到最优值

## 相关文件

- `/Users/tanyancong/工作/开发/pilinote/apps/api/src/services/concurrency_control.py` - 并发控制服务实现
- `/Users/tanyancong/工作/开发/pilinote/apps/api/src/routers/concurrency.py` - 并发控制API路由
- `/Users/tanyancong/工作/开发/pilinote/apps/api/test_concurrency_control.py` - 并发控制测试套件

## 依赖项

- **必需**: asyncio, typing, logging, json
- **可选**: psutil (用于系统资源监控，如未安装则提供基本功能)

## 版本历史

- **v1.0.0** (2026-04-14): 初始版本，实现全局并发控制和动态调整功能