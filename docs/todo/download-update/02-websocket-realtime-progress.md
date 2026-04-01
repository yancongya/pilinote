# WebSocket 实时进度推送方案

## 概述

本文档详细说明了如何实现 WebSocket 实时进度推送功能，让用户无需刷新页面即可查看下载进度。

## 功能描述

### 当前问题
- 下载进度更新需要前端轮询 API
- 刷新页面后丢失当前进度显示
- 频繁轮询增加服务器负载
- 用户体验不流畅

### 解决方案
- 使用 WebSocket 实时推送进度
- 连接断开时自动重连
- 心跳机制保持连接活跃
- 降低服务器负载

### 方案对比

| 方案 | 实时性 | 服务器负载 | 实现复杂度 | 用户体验 |
|------|--------|-----------|-----------|---------|
| 轮询 | ⭐⭐ 差 | ⭐⭐ 高 | ⭐ 简单 | ⭐⭐ 差 |
| WebSocket | ⭐⭐⭐⭐⭐ 优秀 | ⭐⭐⭐ 低 | ⭐⭐⭐ 中等 | ⭐⭐⭐⭐⭐ 优秀 |
| Server-Sent Events | ⭐⭐⭐⭐ 良好 | ⭐⭐⭐ 低 | ⭐⭐ 简单 | ⭐⭐⭐⭐ 良好 |

## 实施步骤

### 步骤1：创建 WebSocket 管理器

**文件**：`apps/api/src/services/websocket_manager.py`

**新增文件**：

```python
"""
WebSocket 连接管理器
"""
import json
import logging
from typing import Dict, List, Optional
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class WebSocketManager:
    """WebSocket 连接管理器"""
    
    def __init__(self):
        # 存储活跃的 WebSocket 连接
        # 结构: {download_id: [WebSocket, WebSocket, ...]}
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, download_id: str):
        """
        建立 WebSocket 连接
        
        Args:
            websocket: WebSocket 连接对象
            download_id: 下载任务ID
        """
        await websocket.accept()
        
        if download_id not in self.active_connections:
            self.active_connections[download_id] = []
        
        self.active_connections[download_id].append(websocket)
        logger.info(f"WebSocket connected for download {download_id}, total connections: {len(self.active_connections[download_id])}")
    
    def disconnect(self, websocket: WebSocket, download_id: str):
        """
        断开 WebSocket 连接
        
        Args:
            websocket: WebSocket 连接对象
            download_id: 下载任务ID
        """
        if download_id in self.active_connections:
            try:
                self.active_connections[download_id].remove(websocket)
                logger.info(f"WebSocket disconnected for download {download_id}, remaining connections: {len(self.active_connections[download_id])}")
                
                # 如果该下载任务没有活跃连接，清理字典
                if not self.active_connections[download_id]:
                    del self.active_connections[download_id]
                    logger.info(f"No active connections for download {download_id}, cleaned up")
            except ValueError:
                logger.warning(f"Failed to remove WebSocket connection for download {download_id}")
    
    async def send_progress_update(self, download_id: str, progress_data: dict):
        """
        发送进度更新到所有连接的客户端
        
        Args:
            download_id: 下载任务ID
            progress_data: 进度数据
        """
        if download_id not in self.active_connections:
            return
        
        # 准备消息
        message = {
            'type': 'progress',
            'download_id': download_id,
            'data': progress_data,
            'timestamp': int(time.time() * 1000)  # 毫秒时间戳
        }
        
        # 发送给所有连接的客户端
        disconnected_connections = []
        for connection in self.active_connections[download_id]:
            try:
                await connection.send_json(message)
                logger.debug(f"Sent progress update for download {download_id}: {progress_data.get('progress', 0):.1f}%")
            except Exception as e:
                logger.error(f"Failed to send progress update: {e}")
                disconnected_connections.append(connection)
        
        # 清理断开的连接
        for connection in disconnected_connections:
            self.disconnect(connection, download_id)
    
    async def send_status_update(self, download_id: str, status: str, error_message: Optional[str] = None):
        """
        发送状态更新
        
        Args:
            download_id: 下载任务ID
            status: 状态（pending/downloading/completed/failed/cancelled）
            error_message: 错误消息（可选）
        """
        message = {
            'type': 'status',
            'download_id': download_id,
            'data': {
                'status': status,
                'error_message': error_message
            },
            'timestamp': int(time.time() * 1000)
        }
        
        if download_id in self.active_connections:
            for connection in self.active_connections[download_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send status update: {e}")
    
    def get_connection_count(self, download_id: str) -> int:
        """
        获取指定下载任务的活跃连接数
        
        Args:
            download_id: 下载任务ID
            
        Returns:
            int: 活跃连接数
        """
        return len(self.active_connections.get(download_id, []))
    
    def get_total_connection_count(self) -> int:
        """
        获取总活跃连接数
        
        Returns:
            int: 总活跃连接数
        """
        total = 0
        for connections in self.active_connections.values():
            total += len(connections)
        return total


# 全局 WebSocket 管理器实例
websocket_manager = WebSocketManager()
```

**关键点**：
- 管理多个下载任务的 WebSocket 连接
- 自动清理断开的连接
- 支持进度和状态两种消息类型
- 包含时间戳便于调试

### 步骤2：添加 WebSocket 路由

**文件**：`apps/api/src/routers/websocket.py`

**新增文件**：

```python
"""
WebSocket 路由
"""
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from src.services.websocket_manager import websocket_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/download/{download_id}")
async def download_websocket(websocket: WebSocket, download_id: str):
    """
    下载进度 WebSocket 端点
    
    Args:
        websocket: WebSocket 连接对象
        download_id: 下载任务ID
    """
    await websocket_manager.connect(websocket, download_id)
    
    try:
        # 发送连接确认消息
        await websocket.send_json({
            'type': 'connected',
            'download_id': download_id,
            'message': 'WebSocket connection established'
        })
        
        # 保持连接活跃，接收客户端消息
        while True:
            data = await websocket.receive_text()
            
            try:
                # 解析客户端消息
                message = json.loads(data)
                message_type = message.get('type')
                
                if message_type == 'ping':
                    # 心跳响应
                    await websocket.send_json({
                        'type': 'pong',
                        'timestamp': int(time.time() * 1000)
                    })
                elif message_type == 'pause':
                    # 暂停下载（未来功能）
                    logger.info(f"Pause requested for download {download_id}")
                elif message_type == 'resume':
                    # 继续下载（未来功能）
                    logger.info(f"Resume requested for download {download_id}")
                else:
                    logger.warning(f"Unknown message type: {message_type}")
                    
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse message: {e}")
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for download {download_id}")
        websocket_manager.disconnect(websocket, download_id)
    except Exception as e:
        logger.error(f"WebSocket error for download {download_id}: {e}")
        websocket_manager.disconnect(websocket, download_id)
```

**关键点**：
- 实现心跳机制（ping/pong）
- 支持未来扩展（暂停/继续）
- 完善的错误处理
- 连接状态管理

### 步骤3：修改 DownloadService 集成 WebSocket

**文件**：`apps/api/src/services/download_service.py`

**修改方法**：

```python
def update_download_progress(
    self,
    download_id: str,
    progress: float,
    downloaded_bytes: int = 0,
    total_bytes: int = 0,
    download_speed: float = 0.0,
    eta: float = 0.0
):
    """
    更新下载进度并推送到 WebSocket
    
    Args:
        download_id: 下载任务ID
        progress: 进度百分比 (0-100)
        downloaded_bytes: 已下载字节数
        total_bytes: 总字节数
        download_speed: 下载速度 (KB/s)
        eta: 预计剩余时间 (秒)
    """
    # 更新数据库
    with SessionLocal() as db:
        download = db.query(Download).filter(Download.id == download_id).first()
        if download:
            download.progress = progress
            download.downloaded_bytes = downloaded_bytes
            download.total_bytes = total_bytes
            download.download_speed = download_speed
            download.eta = eta
            download.updated_at = datetime.utcnow()
            db.commit()
    
    # 通过 WebSocket 推送进度更新
    progress_data = {
        'progress': progress,
        'downloaded_bytes': downloaded_bytes,
        'total_bytes': total_bytes,
        'download_speed': download_speed,
        'eta': eta
    }
    
    # 异步推送，不阻塞下载流程
    asyncio.create_task(
        websocket_manager.send_progress_update(download_id, progress_data)
    )
```

**关键点**：
- 保持原有的数据库更新逻辑
- 添加 WebSocket 推送
- 使用异步任务避免阻塞

### 步骤4：修改状态更新推送

**文件**：`apps/api/src/services/download_service.py`

**修改方法**：

```python
def update_download_status(
    self,
    download_id: str,
    status: str,
    error_message: Optional[str] = None
):
    """
    更新下载状态并推送到 WebSocket
    
    Args:
        download_id: 下载任务ID
        status: 状态
        error_message: 错误消息（可选）
    """
    with SessionLocal() as db:
        download = db.query(Download).filter(Download.id == download_id).first()
        if download:
            download.status = status
            download.updated_at = datetime.utcnow()
            
            if status == "downloading" and not download.started_at:
                download.started_at = datetime.utcnow()
            elif status == "completed":
                download.completed_at = datetime.utcnow()
                download.progress = 100.0
            elif status == "failed" and error_message:
                download.error_message = error_message
                download.retry_count += 1
            
            db.commit()
    
    # 通过 WebSocket 推送状态更新
    asyncio.create_task(
        websocket_manager.send_status_update(download_id, status, error_message)
    )
```

### 步骤5：更新 main.py 包含 WebSocket 路由

**文件**：`apps/api/main.py`

**修改内容**：

```python
from src.routers.websocket import router as websocket_router

# ... 其他导入 ...

app.include_router(auth_router)
app.include_router(favorites_router)
app.include_router(video_router)
app.include_router(watchlater_router)
app.include_router(download_router)
app.include_router(settings_router)
app.include_router(websocket_router)  # 新增 WebSocket 路由
```

### 步骤6：前端创建 WebSocket Hook

**文件**：`apps/web/src/hooks/useDownloadProgress.ts`

**新增文件**：

```typescript
import { useEffect, useState, useCallback, useRef } from 'react'
import { apiService } from '../services/api'

interface DownloadProgress {
  progress: number
  downloaded_bytes: number
  total_bytes: number
  download_speed: number
  eta: number
}

interface UseDownloadProgressOptions {
  onProgress?: (progress: DownloadProgress) => void
  onStatusChange?: (status: string, error?: string) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

export function useDownloadProgress(
  downloadId: string | null,
  options: UseDownloadProgressOptions = {}
) {
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [reconnectCount, setReconnectCount] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const { onProgress, onStatusChange, onConnected, onDisconnected } = options

  // 清理连接
  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  // 心跳机制
  const startHeartbeat = useCallback(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // 30秒发送一次心跳
  }, [])

  // 连接 WebSocket
  const connect = useCallback(() => {
    if (!downloadId) return

    const wsUrl = `ws://localhost:8000/ws/download/${downloadId}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('WebSocket connected')
      setIsConnected(true)
      setReconnectCount(0)
      startHeartbeat()
      onConnected?.()
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        
        switch (message.type) {
          case 'connected':
            console.log('WebSocket connection confirmed')
            break
            
          case 'progress':
            const progressData = message.data
            setProgress(progressData)
            onProgress?.(progressData)
            break
            
          case 'status':
            const statusData = message.data
            onStatusChange?.(statusData.status, statusData.error_message)
            break
            
          case 'pong':
            // 心跳响应，不做处理
            break
            
          default:
            console.warn('Unknown message type:', message.type)
        }
      } catch (error) {
        console.error('Failed to parse message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setIsConnected(false)
    }

    ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason)
      setIsConnected(false)
      cleanup()
      onDisconnected?.()

      // 自动重连（最多重连 5 次）
      if (reconnectCount < 5) {
        const delay = Math.min(1000 * Math.pow(2, reconnectCount), 30000) // 指数退避
        console.log(`Reconnecting in ${delay}ms...`)
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectCount(prev => prev + 1)
          connect()
        }, delay)
      }
    }

    wsRef.current = ws
  }, [downloadId, reconnectCount, startHeartbeat, cleanup, onConnected, onDisconnected, onProgress, onStatusChange])

  // 初始化连接
  useEffect(() => {
    connect()
    return cleanup
  }, [downloadId, connect, cleanup])

  return {
    progress,
    isConnected,
    reconnectCount
  }
}
```

**关键点**：
- 自动重连机制（最多5次）
- 心跳保持连接活跃
- 指数退避重连策略
- 完善的错误处理

### 步骤7：前端集成实时进度

**文件**：`apps/web/src/pages/DownloadListPage.tsx`

**修改内容**：

```typescript
import { useDownloadProgress } from '../hooks/useDownloadProgress'

export default function DownloadListPage() {
  // ... 现有代码 ...

  return (
    <div className="download-list-page">
      {downloads.map(download => {
        const { progress, isConnected } = useDownloadProgress(download.id)
        
        return (
          <div key={download.id} className="download-item">
            {/* ... 下载信息显示 ... */}
            
            {/* 实时进度条 */}
            {download.status === 'downloading' && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${progress?.progress || 0}%` }}
                  />
                </div>
                <div className="progress-info">
                  <span className="progress-percent">
                    {progress?.progress?.toFixed(1) || 0}%
                  </span>
                  <span className="progress-size">
                    {formatBytes(progress?.downloaded_bytes || 0)} / {formatBytes(progress?.total_bytes || 0)}
                  </span>
                  <span className="progress-speed">
                    {formatSpeed(progress?.download_speed || 0)}
                  </span>
                  <span className="progress-eta">
                    ETA: {formatTime(progress?.eta || 0)}
                  </span>
                  {isConnected && (
                    <span className="status-badge connected" title="实时连接">
                      ● 实时
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

## 测试计划

### 测试1：WebSocket 连接测试

```typescript
// 测试 WebSocket 连接建立
const { progress, isConnected } = useDownloadProgress('test-download-id')

// 验证连接状态
console.log('Is connected:', isConnected)

// 验证进度更新
console.log('Progress:', progress)
```

### 测试2：实时进度推送

```python
# 后端测试：模拟进度更新
import asyncio
from src.services.websocket_manager import websocket_manager

async def test_progress_push():
    download_id = "test-download-id"
    
    # 模拟进度更新
    for i in range(0, 101, 10):
        progress_data = {
            'progress': float(i),
            'downloaded_bytes': i * 1000000,
            'total_bytes': 100000000,
            'download_speed': 5000.0,
            'eta': (100 - i) * 10
        }
        await websocket_manager.send_progress_update(download_id, progress_data)
        await asyncio.sleep(1)

asyncio.run(test_progress_push())
```

### 测试3：连接断开重连

```typescript
// 测试连接断开后的自动重连
const { isConnected, reconnectCount } = useDownloadProgress('test-download-id')

// 手动关闭连接（模拟网络中断）
// 验证自动重连
console.log('Reconnect count:', reconnectCount)
```

### 测试4：并发连接测试

```python
# 测试多个客户端同时连接
async def test_multiple_connections():
    download_id = "test-download-id"
    
    # 模拟 10 个客户端同时连接
    connections = []
    for i in range(10):
        # 创建 WebSocket 连接（模拟）
        pass
    
    # 验证连接数
    count = websocket_manager.get_connection_count(download_id)
    assert count == 10
    print(f"Total connections: {count}")
```

## 注意事项

### 1. 连接管理
- 定期清理断开的连接
- 限制单个下载任务的最大连接数
- 监控总连接数，防止资源耗尽

### 2. 心跳机制
- 客户端每 30 秒发送一次 ping
- 服务器响应 pong
- 超时未响应视为连接断开

### 3. 重连策略
- 使用指数退避算法
- 最多重连 5 次
- 重连间隔：1s, 2s, 4s, 8s, 16s

### 4. 错误处理
- 捕获所有异常，防止崩溃
- 记录详细日志便于调试
- 向客户端发送错误消息

### 5. 性能优化
- 使用异步任务推送，不阻塞下载
- 批量推送进度更新（每 1 秒一次）
- 限制消息频率

## 依赖关系

### 依赖模块
- `apps/api/src/services/websocket_manager.py` - WebSocket 管理器
- `apps/api/src/services/download_service.py` - 下载服务
- `apps/api/src/routers/websocket.py` - WebSocket 路由
- `apps/api/main.py` - 主应用
- `apps/web/src/hooks/useDownloadProgress.ts` - 前端 Hook

### 依赖库
- FastAPI WebSocket 支持
- 前端 WebSocket API

## 后续步骤

### 短期优化
1. 支持下载暂停/继续控制
2. 添加下载速度限制
3. 实现连接池管理

### 长期优化
1. 支持多标签页同步
2. 添加下载历史记录
3. 实现下载任务队列可视化

## 风险评估

### 技术风险
- **低风险**：WebSocket 技术成熟
- **中风险**：跨浏览器兼容性
- **低风险**：自动重连机制

### 性能风险
- **低风险**：连接数可控
- **低风险**：消息频率限制
- **中风险**：大量并发连接

### 兼容性风险
- **低风险**：现代浏览器都支持
- **中风险**：旧版浏览器需要 polyfill
- **低风险**：移动端支持良好

## 完成标准

- [ ] WebSocket 管理器实现
- [ ] WebSocket 路由实现
- [ ] DownloadService 集成 WebSocket
- [ ] 前端 WebSocket Hook 实现
- [ ] 前端集成实时进度显示
- [ ] 自动重连功能
- [ ] 心跳机制
- [ ] 连接测试
- [ ] 进度推送测试
- [ ] 重连测试
- [ ] 并发连接测试

---

**创建时间**: 2026-04-01  
**最后更新**: 2026-04-01  
**状态**: 📝 待实施  
**预计工期**: 3-4 天  
**优先级**: P0（高优先级）  
**依赖**: 01-aria2c-integration.md（可选）