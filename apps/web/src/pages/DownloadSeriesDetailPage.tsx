import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'

interface DownloadTask {
  id: string
  bvid: string
  title: string
  status: 'pending' | 'queued' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  downloaded_bytes: number
  total_bytes: number
  download_speed: number
  eta: number
  thumbnail_url?: string
  duration?: number
  uploader?: string
  file_path?: string
  error_message?: string
  created_at: string
  started_at?: string
  completed_at?: string
  aid?: number
  cid?: number
}

interface SeriesData {
  seriesId: string
  seriesName: string
  thumbnail_url?: string
  tasks: DownloadTask[]
  totalCount: number
  completedCount: number
  totalDuration: number
  createdTime: string
}

export default function DownloadSeriesDetailPage() {
  const { seriesId } = useParams<{ seriesId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [seriesData, setSeriesData] = useState<SeriesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // 格式化时长
  const formatDuration = (seconds: number): string => {
    if (!seconds) return '--:--'
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 格式化时间
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#9e9e9e',
      queued: '#ffa726',
      downloading: '#fb7299',
      processing: '#42a5f5',
      completed: '#66bb6a',
      failed: '#ef5350',
      cancelled: '#bdbdbd',
    }
    return colors[status] || '#9e9e9e'
  }

  // 获取状态标签
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '等待',
      queued: '排队',
      downloading: '下载',
      processing: '处理',
      completed: '完成',
      failed: '失败',
      cancelled: '取消',
    }
    return labels[status] || '未知'
  }

  // 获取下载任务列表
  const fetchDownloads = async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('http://localhost:8000/api/download/list')
      const data = await response.json()
      
      if (data.success) {
        // 筛选属于当前系列的任务
        const seriesTasks = data.downloads.filter((task: DownloadTask) => 
          task.aid?.toString() === seriesId || task.bvid === seriesId
        )
        
        if (seriesTasks.length > 0) {
          const seriesName = seriesTasks[0].title.split(/[第第]|[\s_]\d+|[\s_]P\d+/i)[0].trim()
          
          // 计算总时长
          const totalDuration = seriesTasks
            .filter((t: DownloadTask) => t.status === 'completed' && t.duration)
            .reduce((sum: number, t: DownloadTask) => sum + (t.duration || 0), 0)
          
          setSeriesData({
            seriesId: seriesId || '',
            seriesName,
            thumbnail_url: seriesTasks[0].thumbnail_url,
            tasks: seriesTasks.sort((a: DownloadTask, b: DownloadTask) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            ),
            totalCount: seriesTasks.length,
            completedCount: seriesTasks.filter((t: DownloadTask) => t.status === 'completed').length,
            totalDuration,
            createdTime: seriesTasks[0].created_at
          })
        } else {
          setError('未找到该系列的下载任务')
        }
      } else {
        setError(data.message || '获取下载列表失败')
      }
    } catch (err) {
      setError('网络请求失败')
    } finally {
      setLoading(false)
    }
  }

  // 自动刷新
  useEffect(() => {
    fetchDownloads()
    
    // 如果有下载中的任务，自动刷新
    const timer = setInterval(() => {
      if (seriesData?.tasks.some(t => t.status === 'downloading' || t.status === 'queued' || t.status === 'pending' || t.status === 'processing')) {
        fetchDownloads()
      }
    }, 2000)
    
    return () => clearInterval(timer)
  }, [seriesId])

  // 点击任务进入视频详情页（已完成）
  const handleTaskClick = (task: DownloadTask) => {
    if (task.status === 'completed') {
      navigate(`/video/${task.bvid}`)
    }
  }

  // 操作函数
  const handleCancelDownload = async (id: string) => {
    try {
      await fetch(`http://localhost:8000/api/download/${id}/cancel`, { method: 'POST' })
      fetchDownloads()
    } catch (err) {
      console.error('取消下载失败:', err)
    }
  }

  const handleRetryDownload = async (id: string) => {
    try {
      await fetch(`http://localhost:8000/api/download/${id}/retry`, { method: 'POST' })
      fetchDownloads()
    } catch (err) {
      console.error('重试失败:', err)
    }
  }

  const handleDeleteDownload = async (id: string) => {
    try {
      await fetch(`http://localhost:8000/api/download/${id}`, { method: 'DELETE' })
      fetchDownloads()
    } catch (err) {
      console.error('删除失败:', err)
    }
  }

  return (
    <div className="series-detail-page">
      {/* 顶部导航栏 */}
      <div className="series-nav">
        <button className="nav-back" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>返回</span>
        </button>
        <h1 className="series-title">{seriesData?.seriesName || '系列详情'}</h1>
      </div>

      {/* 统计信息 */}
      {seriesData && (
        <div className="series-stats">
          <div className="stat-item">
            <span className="stat-label">总数</span>
            <span className="stat-value">{seriesData.totalCount}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">已完成</span>
            <span className="stat-value completed">{seriesData.completedCount}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">总时长</span>
            <span className="stat-value">
              {formatDuration(seriesData.totalDuration)}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">完成率</span>
            <span className="stat-value">
              {Math.round((seriesData.completedCount / seriesData.totalCount) * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* 任务列表 */}
      <div className="series-tasks">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>加载中...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
            <button className="retry-btn" onClick={fetchDownloads}>重试</button>
          </div>
        ) : !seriesData || seriesData.tasks.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <p>暂无下载任务</p>
          </div>
        ) : (
          seriesData.tasks.map((task) => (
            <div 
              key={task.id} 
              className={`task-card ${task.status === 'completed' ? 'clickable' : ''}`}
              onClick={() => task.status === 'completed' && handleTaskClick(task)}
            >
              {/* 缩略图 */}
              <div className="task-thumb">
                {task.thumbnail_url ? (
                  <img 
                    src={`http://localhost:8000/api/auth/proxy/avatar?url=${encodeURIComponent(task.thumbnail_url)}`}
                    alt={task.title}
                    className="thumb-img"
                  />
                ) : (
                  <div className="thumb-placeholder">🎬</div>
                )}
                <div 
                  className="task-status"
                  style={{ backgroundColor: getStatusColor(task.status) }}
                >
                  {getStatusLabel(task.status)}
                </div>
              </div>

              {/* 信息 */}
              <div className="task-info">
                <h3 className="task-title">{task.title}</h3>
                <p className="task-meta">
                  <span>{formatTime(task.created_at)}</span>
                  {task.duration && <span>{formatDuration(task.duration)}</span>}
                  {task.uploader && <span>{task.uploader}</span>}
                </p>

                {/* 进度条 */}
                {(task.status === 'downloading' || task.status === 'queued' || task.status === 'pending' || task.status === 'processing') && (
                  <div className="task-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${task.progress}%` }}
                      ></div>
                    </div>
                    <div className="progress-stats">
                      <span className="progress-percent">{task.progress.toFixed(1)}%</span>
                      {task.downloaded_bytes > 0 && task.total_bytes > 0 && (
                        <>
                          <span className="progress-size">
                            {formatFileSize(task.downloaded_bytes)} / {formatFileSize(task.total_bytes)}
                          </span>
                        </>
                      )}
                      {task.download_speed > 0 && (
                        <span className="progress-speed">
                          {formatFileSize(task.download_speed)}/s
                        </span>
                      )}
                      {task.eta > 0 && (
                        <span className="progress-eta">
                          ETA: {Math.floor(task.eta)}s
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 完成信息 */}
                {task.status === 'completed' && task.file_path && (
                  <div className="task-completed">
                    <span className="completed-icon">✓</span>
                    <span className="completed-text">已下载</span>
                  </div>
                )}

                {/* 错误信息 */}
                {task.status === 'failed' && task.error_message && (
                  <div className="task-error">
                    <span className="error-icon">⚠️</span>
                    <span className="error-text">{task.error_message}</span>
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="task-actions">
                {task.status === 'downloading' || task.status === 'queued' || task.status === 'pending' || task.status === 'processing' ? (
                  <button 
                    className="action-btn cancel-btn"
                    onClick={() => handleCancelDownload(task.id)}
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                      <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                ) : task.status === 'failed' ? (
                  <button 
                    className="action-btn retry-btn"
                    onClick={() => handleRetryDownload(task.id)}
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                ) : null}
                
                <button 
                  className="action-btn delete-btn"
                  onClick={() => handleDeleteDownload(task.id)}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M3 6l2 12h10l2-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}