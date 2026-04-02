"""
WebSocket 连接管理器
"""
import json
import logging
import time
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