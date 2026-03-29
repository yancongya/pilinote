import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

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

interface DownloadSeries {
  seriesId: string
  seriesName: string
  thumbnail_url?: string
  tasks: DownloadTask[]
  totalCount: number
  completedCount: number
  totalSize: number
  totalDuration: number
  createdTime: string
}

type ViewMode = 'completed' | 'downloading'

export default function DownloadsContent() {
  const [downloads, setDownloads] = useState<DownloadTask[]>([])
  const [seriesList, setSeriesList] = useState<DownloadSeries[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('completed')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const navigate = useNavigate()

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
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return '今天'
    if (days === 1) return '昨天'
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  // 获取下载任务列表
  const fetchDownloads = useCallback(async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('http://localhost:8000/api/download/list')
      const data = await response.json()
      
      if (data.success) {
        setDownloads(data.downloads)
      } else {
        setError(data.message || '获取下载列表失败')
      }
    } catch (err) {
      setError('网络请求失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 按系列分组
  const groupDownloadsBySeries = useCallback((tasks: DownloadTask[]): DownloadSeries[] => {
    const groups: Record<string, DownloadSeries> = {}
    
    tasks.forEach(task => {
      const seriesId = (task.aid || task.bvid).toString()
      
      if (!groups[seriesId]) {
        // 提取系列名称
        const titleParts = task.title.split(/[第第]|[\s_]\d+|[\s_]P\d+/i)
        const seriesName = titleParts[0].trim()
        
        groups[seriesId] = {
          seriesId,
          seriesName,
          thumbnail_url: task.thumbnail_url,
          tasks: [],
          totalCount: 0,
          completedCount: 0,
          totalSize: 0,
          totalDuration: 0,
          createdTime: task.created_at
        }
      }
      
      groups[seriesId].tasks.push(task)
      groups[seriesId].totalCount++
      
      if (task.status === 'completed') {
        groups[seriesId].completedCount++
        if (task.duration) {
          groups[seriesId].totalDuration += task.duration
        }
      }
    })
    
    return Object.values(groups).sort((a, b) => 
      new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime()
    )
  }, [])

  // 初始加载
  useEffect(() => {
    fetchDownloads()
  }, [fetchDownloads])

  // 实时刷新：当有下载中的任务时，自动刷新进度
  useEffect(() => {
    const hasDownloading = downloads.some(d => 
      d.status === 'downloading' || d.status === 'queued' || d.status === 'pending' || d.status === 'processing'
    )
    
    if (hasDownloading) {
      refreshTimerRef.current = setInterval(() => {
        fetchDownloads()
      }, 2000)
    } else {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [downloads, fetchDownloads])

  // 根据视图模式筛选并分组
  useEffect(() => {
    let filteredDownloads = downloads
    
    if (viewMode === 'completed') {
      // 视频列表：只显示已完成的任务
      filteredDownloads = downloads.filter(d => d.status === 'completed')
    } else if (viewMode === 'downloading') {
      // 下载列表：显示正在下载的任务
      filteredDownloads = downloads.filter(d => 
        d.status === 'downloading' || d.status === 'queued' || d.status === 'pending' || d.status === 'processing'
      )
    }
    
    setSeriesList(groupDownloadsBySeries(filteredDownloads))
  }, [downloads, viewMode, groupDownloadsBySeries])

  // 点击系列进入详情
  const handleSeriesClick = (series: DownloadSeries) => {
    // 判断是否为系列视频（aid存在且有多个任务）
    const isSeries = series.totalCount > 1
    
    if (isSeries) {
      // 系列视频：进入系列详情页
      navigate(`/download/series/${series.seriesId}`, { 
        state: { series }
      })
    } else {
      // 单个视频：进入视频详情页
      const videoId = series.tasks[0].bvid
      navigate(`/video/${videoId}`)
    }
  }

  // 获取状态统计
  const stats = {
    downloading: downloads.filter(d => 
      d.status === 'downloading' || d.status === 'queued' || d.status === 'pending' || d.status === 'processing'
    ).length,
    completed: downloads.filter(d => d.status === 'completed').length,
  }

  return (
    <div className="downloads-app">
      {/* 顶部Tab切换 */}
      <div className="downloads-tabs">
        <button 
          className={`tab-item ${viewMode === 'completed' ? 'active' : ''}`}
          onClick={() => setViewMode('completed')}
        >
          视频列表
          <span className="tab-badge completed">{stats.completed}</span>
        </button>
        <button 
          className={`tab-item ${viewMode === 'downloading' ? 'active' : ''}`}
          onClick={() => setViewMode('downloading')}
        >
          下载列表
          <span className="tab-badge downloading">{stats.downloading}</span>
        </button>
      </div>

      {/* 内容区域 */}
      <div className="downloads-content">
        {loading && seriesList.length === 0 ? (
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
        ) : seriesList.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <p>{viewMode === 'completed' ? '暂无已下载的视频' : '暂无正在下载的视频'}</p>
            {viewMode === 'completed' && <span className="empty-hint">去首页添加视频开始下载</span>}
          </div>
        ) : (
          <div className="series-list">
            {seriesList.map(series => (
              <div 
                key={series.seriesId} 
                className="series-card"
                onClick={() => handleSeriesClick(series)}
              >
                {/* 缩略图 */}
                <div className="series-thumb">
                  {series.thumbnail_url ? (
                    <img 
                      src={`http://localhost:8000/api/auth/proxy/avatar?url=${encodeURIComponent(series.thumbnail_url)}`}
                      alt={series.seriesName}
                      className="thumb-img"
                    />
                  ) : (
                    <div className="thumb-placeholder">
                      <span>🎬</span>
                    </div>
                  )}
                  <div className="series-info-overlay">
                    <div className="series-count">共{series.completedCount}/{series.totalCount}个视频</div>
                    <div className="series-duration">总时长：{formatDuration(series.totalDuration)}</div>
                  </div>
                </div>

                {/* 信息 */}
                <div className="series-info">
                  <h3 className="series-title">{series.seriesName}</h3>
                  <p className="series-meta">
                    <span>{formatTime(series.createdTime)}</span>
                    {viewMode === 'downloading' && series.tasks.some(t => t.status === 'downloading') && (
                      <span className="downloading-indicator">下载中</span>
                    )}
                  </p>
                  {viewMode === 'downloading' && (
                    <div className="series-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{ width: `${(series.completedCount / series.totalCount) * 100}%` }}
                        ></div>
                      </div>
                      <span className="progress-text">
                        {Math.round((series.completedCount / series.totalCount) * 100)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* 箭头 */}
                <div className="series-arrow">
                  <ChevronRight />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}