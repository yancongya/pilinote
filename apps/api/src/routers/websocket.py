"""
WebSocket 路由 - 队列系统实时通信
"""
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """WebSocket 连接管理器"""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """广播消息到所有连接的客户端"""
        logger.info(f"📢 broadcast: 消息类型={message.get('type')}, 连接数={len(self.active_connections)}")
        disconnected = []
        for connection in self.active_connections:
            try:
                logger.info(f"📢 发送消息到连接: {connection}")
                await connection.send_json(message)
                logger.info(f"✓ 消息发送成功")
            except Exception as e:
                logger.error(f"❌ 发送消息失败: {e}")
                disconnected.append(connection)

        # 清理断开的连接
        for connection in disconnected:
            self.disconnect(connection)


# 全局连接管理器
manager = ConnectionManager()


@router.websocket("/ws/queue")
async def websocket_queue(websocket: WebSocket):
    """
    队列系统 WebSocket 端点

    支持的消息类型:
    - taskCreated: 新任务创建
    - taskUpdated: 任务状态更新
    - taskProgress: 任务进度更新（进度百分比、速度、ETA）
    - progress: 下载进度更新
    - schedulerCreated: 新调度器创建
    - schedulerUpdated: 调度器状态更新
    - queueUpdated: 队列更新（全量刷新）
    """
    await manager.connect(websocket)

    try:
        # 发送连接确认
        await websocket.send_json({
            "type": "connected",
            "message": "WebSocket connection established"
        })

        # 保持连接活跃
        while True:
            try:
                # 接收客户端消息（心跳等）
                data = await websocket.receive_text()
                message = json.loads(data)

                # 处理心跳
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})

            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


def broadcast_task_created(task_data: dict):
    """广播任务创建事件"""
    import asyncio
    asyncio.create_task(manager.broadcast({
        "type": "taskCreated",
        "task": task_data
    }))


def broadcast_task_updated(task_id: str, state: str, cancelled: bool = False):
    """广播任务更新事件"""
    import asyncio
    asyncio.create_task(manager.broadcast({
        "type": "taskUpdated",
        "id": task_id,
        "state": state,
        "cancelled": cancelled
    }))


def broadcast_task_progress(task_id: str, progress: float, speed: float = 0.0, eta: float = 0.0, stage: str = "", downloaded: int = 0, total: int = 0):
    """广播任务进度更新（进度百分比、速度、ETA、阶段、已下载、总大小）"""
    import asyncio

    message = {
        "type": "taskProgress",
        "id": task_id,
        "progress": progress,
        "speed": speed,
        "eta": eta,
        "stage": stage,
        "downloaded": downloaded,
        "total": total
    }

    logger.info(f"📤 broadcast_task_progress: task_id={task_id}, progress={progress}%, speed={speed/1024/1024:.2f}MB/s, eta={eta}秒, stage={stage}, downloaded={downloaded/1024/1024:.2f}MB, total={total/1024/1024:.2f}MB")
    logger.info(f"📤 消息内容: {message}")
    logger.info(f"📤 当前连接数: {len(manager.active_connections)}")

    # 创建异步任务来广播
    async def _broadcast():
        logger.info(f"📤 开始广播消息...")
        await manager.broadcast(message)
        logger.info(f"✓ 消息广播完成")

    # 在事件循环中调度任务
    try:
        loop = asyncio.get_event_loop()
        logger.info(f"📤 事件循环: running={loop.is_running()}")
        if loop.is_running():
            asyncio.run_coroutine_threadsafe(_broadcast(), loop)
        else:
            asyncio.create_task(_broadcast())
    except RuntimeError as e:
        # 如果没有事件循环，创建一个新的
        logger.warning(f"📤 事件循环错误: {e}, 使用 asyncio.run")
        asyncio.run(_broadcast())


def broadcast_progress(task_id: str, subtask_id: str, content: int, chunk: int):
    """广播下载进度"""
    import asyncio
    asyncio.create_task(manager.broadcast({
        "type": "progress",
        "task": task_id,
        "subtask": subtask_id,
        "content": content,
        "chunk": chunk
    }))


def broadcast_scheduler_updated(scheduler_data: dict):
    """广播调度器更新事件"""
    import asyncio
    asyncio.create_task(manager.broadcast({
        "type": "schedulerUpdated",
        "scheduler": scheduler_data
    }))


def broadcast_queue_updated():
    """广播队列更新事件（触发全量刷新）"""
    import asyncio
    asyncio.create_task(manager.broadcast({
        "type": "queueUpdated"
    }))


def broadcast_scheduler_deleted(scheduler_id: str):
    """广播调度器删除事件"""
    import asyncio
    asyncio.create_task(manager.broadcast({
        "type": "schedulerDeleted",
        "id": scheduler_id
    }))