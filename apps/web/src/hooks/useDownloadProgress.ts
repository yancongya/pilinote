import { useEffect, useState, useCallback, useRef } from 'react'

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

    const wsUrl = `ws://localhost:8000/api/ws/download/${downloadId}`
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