import { useState, useEffect } from 'react'
import { useDownloadProgress } from './useDownloadProgress'

/**
 * WebSocket下载进度测试组件
 */
export default function WebSocketProgressTest() {
  const [testDownloadId, setTestDownloadId] = useState<string>('')
  const [isConnected, setIsConnected] = useState(false)
  
  const { progress, isConnected: wsConnected, reconnectCount } = useDownloadProgress(
    testDownloadId,
    {
      onConnected: () => {
        console.log('WebSocket connected')
        setIsConnected(true)
      },
      onDisconnected: () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
      },
      onProgress: (data) => {
        console.log('Progress update:', data)
      },
      onStatusChange: (status) => {
        console.log('Status change:', status)
      }
    }
  )

  const startTest = () => {
    // 这里可以是一个真实的下载ID，或者用于测试的假ID
    setTestDownloadId('test-download-123')
  }

  const stopTest = () => {
    setTestDownloadId('')
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>WebSocket 实时进度测试</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>连接状态</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div>
            状态: {wsConnected ? (
            <span style={{ color: 'green' }}>已连接</span>
          ) : (
            <span style={{ color: 'red' }}>未连接</span>
          )}
          </div>
          <div>重连次数: {reconnectCount}</div>
          <button 
            onClick={startTest}
            disabled={wsConnected}
            style={{ 
              padding: '8px 16px', 
              background: wsConnected ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: wsConnected ? 'not-allowed' : 'pointer'
            }}
          >
            开始测试
          </button>
          <button 
            onClick={stopTest}
            disabled={!testDownloadId}
            style={{ 
              padding: '8px 16px', 
              background: !testDownloadId ? '#ccc' : '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: !testDownloadId ? 'not-allowed' : 'pointer'
            }}
          >
            停止测试
          </button>
        </div>
      </div>

      {progress && (
        <div style={{ marginBottom: '20px' }}>
          <h3>下载进度</h3>
          <div style={{ marginBottom: '10px' }}>
            <div>进度: {progress.progress.toFixed(1)}%</div>
            <div>已下载: {(progress.downloaded_bytes / 1024 / 1024).toFixed(2)} MB</div>
            <div>总大小: {(progress.total_bytes / 1024 / 1024).toFixed(2)} MB</div>
            <div>速度: {(progress.download_speed / 1024).toFixed(2)} MB/s</div>
            <div>剩余时间: {Math.floor(progress.eta)} 秒</div>
          </div>
          
          <div style={{ 
            width: '100%', 
            height: '30px', 
            background: '#f0f0f0', 
            borderRadius: '15px',
            overflow: 'hidden'
          }}>
            <div 
              style={{
                width: `${progress.progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #007bff, #00d4ff)',
                transition: 'width 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {progress.progress.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
        <h3>测试说明</h3>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>点击"开始测试"按钮连接WebSocket</li>
          <li>如果有下载任务正在进行，会自动接收进度更新</li>
          <li>显示实时进度、速度、剩余时间等信息</li>
          <li>支持自动重连（最多5次）</li>
          <li>30秒心跳保持连接活跃</li>
        </ul>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', background: '#e7f3ff', borderRadius: '8px' }}>
        <h3>使用说明</h3>
        <p>要测试完整的WebSocket功能，请：</p>
        <ol style={{ marginTop: '10px', paddingLeft: '20px' }}>
          <li>启动后端API服务器（如果还没启动）</li>
          <li>创建一个真实的下载任务</li>
          <li>在下载页面中使用WebSocket Hook</li>
          <li>观察实时进度更新</li>
        </ol>
      </div>
    </div>
  )
}