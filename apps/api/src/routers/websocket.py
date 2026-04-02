"""
WebSocket 路由
"""
import logging
import json
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
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