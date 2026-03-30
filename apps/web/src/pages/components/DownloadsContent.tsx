import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import VideoListCard from './VideoListCard'
import { useDownloadStore } from '../../stores/download'
import { apiService } from '../../services/api'

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
  const downloadStore = useDownloadStore()
  const [downloads, setDownloads] = useState<DownloadTask[]>([])
  const [seriesList, setSeriesList] = useState<DownloadSeries[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('downloading')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedSeries, setExpandedSeries] = useState<string | null>(null)
  const refreshTimerRef = useRef<number | null>(null)
  const navigate = useNavigate()

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  // 格式化速度
  const formatSpeed = (speed: number): string => {
    if (!speed || speed === 0) return '0 KB/s'
    return formatFileSize(speed * 1024) + '/s'
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

  // 格式化ETA
  const formatETA = (seconds: number): string => {
    if (!seconds || seconds === 0) return '--:--'
    if (seconds < 60) return `${Math.round(seconds)}秒`
    if (seconds < 3600) return `${Math.round(seconds / 60)}分`
    const hours = Math.floor(seconds / 3600)
    const mins = Math.round((seconds % 3600) / 60)
    return `${hours}小时${mins}分`
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

  // 获取状态文字
  const getStatusText = (status: string): string => {
    const statusMap: Record<string, string> = {
      'pending': '等待下载',
      'queued': '队列中',
      'downloading': '下载中',
      'processing': '处理中',
      'paused': '已暂停',
      'failed': '下载失败',
      'cancelled': '已取消'
    }
    return statusMap[status] || status
  }

  // 获取状态图标
  const getStatusIcon = (status: string): string => {
    const iconMap: Record<string, string> = {
      'pending': '⏳',
      'queued': '📋',
      'downloading': '⬇️',
      'processing': '⚙️',
      'paused': '⏸️',
      'failed': '❌',
      'cancelled': '🚫'
    }
    return iconMap[status] || '📥'
  }

  // 开始下载（单个任务）
  const handleStartTask = async (taskId: string) => {
    const success = await downloadStore.startDownload(taskId)
    if (!success) {
      alert('开始下载失败')
    }
  }

  // 暂停下载
  const handlePauseTask = async (taskId: string) => {
    const success = await downloadStore.pauseDownload(taskId)
    if (!success) {
      alert('暂停下载失败')
    }
  }

  // 继续下载
  const handleResumeTask = async (taskId: string) => {
    const success = await downloadStore.resumeDownload(taskId)
    if (!success) {
      alert('继续下载失败')
    }
  }

  // 取消下载
  const handleCancelTask = async (taskId: string) => {
    if (!confirm('确定要取消下载吗？')) {
      return
    }
    const success = await downloadStore.cancelDownload(taskId)
    if (!success) {
      alert('取消下载失败')
    }
  }

  // 开始下载（系列）
  const handleStartDownload = async (series: DownloadSeries) => {
    const success = await downloadStore.startBatchDownloads(series.tasks.map(task => task.id))
    if (!success) {
      alert('开始下载失败')
    }
  }

  // 删除下载任务
  const handleDeleteDownload = async (series: DownloadSeries) => {
    if (!confirm(`确定要删除 "${series.seriesName}" 吗？`)) {
      return
    }
    
    const deletePromises = series.tasks.map(task => 
      downloadStore.removeFromDownloadList(task.id)
    )
    
    await Promise.all(deletePromises)
    
    // 删除后重新获取下载列表
    fetchDownloads()
  }

  // 切换系列展开/折叠
  const toggleSeries = (seriesId: string) => {
    setExpandedSeries(expandedSeries === seriesId ? null : seriesId)
  }

  // 获取下载任务列表
  const fetchDownloads = useCallback(async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('http://localhost:8000/api/download/list')
      const data = await response.json()
      
      if (data.success) {
        // 获取所有下载任务，不过滤
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
  const groupDownloadsBySeries = useCallback(async (tasks: DownloadTask[]): Promise<DownloadSeries[]> => {
    const groups: Record<string, DownloadSeries> = {}
    const uniqueSeriesIds = new Set<string>()
    
    // 首先按aid或bvid分组
    tasks.forEach(task => {
      // 优先使用aid进行分组（系列视频有相同aid但不同bvid）
      // 如果没有aid，才使用bvid
      const seriesId = (task.aid || task.bvid)?.toString() || task.id
      
      if (!groups[seriesId]) {
        groups[seriesId] = {
          seriesId,
          seriesName: task.title, // 临时使用标题
          thumbnail_url: task.thumbnail_url,
          tasks: [],
          totalCount: 0,
          completedCount: 0,
          totalSize: 0,
          totalDuration: 0,
          createdTime: task.created_at
        }
        uniqueSeriesIds.add(seriesId)
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
    
    // 获取真实的系列名
    for (const seriesId of uniqueSeriesIds) {
      const firstTask = groups[seriesId].tasks[0]
      if (firstTask.bvid) {
        try {
          const response = await apiService.getVideoDetail(firstTask.bvid)
          if (response.success && response.data) {
            // 使用视频的真实标题作为系列名
            groups[seriesId].seriesName = response.data.title
          }
        } catch (error) {
          console.error('获取视频详情失败:', error)
          // 保持原标题
        }
      }
    }
    
    // 检查是否有多个组有相同的seriesName（相同系列但aid不同的情况）
    const nameMap: Record<string, string[]> = {}
    Object.keys(groups).forEach(seriesId => {
      const seriesName = groups[seriesId].seriesName
      if (!nameMap[seriesName]) {
        nameMap[seriesName] = []
      }
      nameMap[seriesName].push(seriesId)
    })
    
    // 合并相同seriesName的组
    const mergedGroups: Record<string, DownloadSeries> = {}
    Object.values(nameMap).forEach((seriesIds) => {
      if (seriesIds.length > 1) {
        // 合并这些组
        const mergedSeriesId = seriesIds[0]
        const mergedSeries = groups[seriesIds[0]]
        
        for (let i = 1; i < seriesIds.length; i++) {
          const series = groups[seriesIds[i]]
          mergedSeries.tasks.push(...series.tasks)
          mergedSeries.totalCount += series.totalCount
          mergedSeries.completedCount += series.completedCount
          mergedSeries.totalDuration += series.totalDuration
          // 使用最早的时间
          if (new Date(series.createdTime) < new Date(mergedSeries.createdTime)) {
            mergedSeries.createdTime = series.createdTime
          }
        }
        
        mergedGroups[mergedSeriesId] = mergedSeries
      } else {
        // 不需要合并，直接使用
        mergedGroups[seriesIds[0]] = groups[seriesIds[0]]
      }
    })
    
    return Object.values(mergedGroups).sort((a, b) => 
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
      d.status === 'downloading' || d.status === 'queued' || d.status === 'pending' || d.status === 'processing' || d.status === 'paused'
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
        d.status === 'downloading' || d.status === 'queued' || d.status === 'pending' || d.status === 'processing' || d.status === 'paused'
      )
    }
    
    if (filteredDownloads.length > 0) {
      groupDownloadsBySeries(filteredDownloads).then(setSeriesList)
    } else {
      setSeriesList([])
    }
  }, [downloads, viewMode, groupDownloadsBySeries])

  // 获取状态统计
  const stats = {
    downloading: downloads.filter(d => 
      d.status === 'downloading' || d.status === 'queued' || d.status === 'pending' || d.status === 'processing' || d.status === 'paused'
    ).length,
    completed: downloads.filter(d => d.status === 'completed').length,
  }

  // 渲染单个任务的控制按钮
  const renderTaskControls = (task: DownloadTask) => {
    switch (task.status) {
      case 'pending':
      case 'failed':
        return (
          <button 
            className="task-control-btn start"
            onClick={() => handleStartTask(task.id)}
            title="开始下载"
          >
            ▶️
          </button>
        )
      case 'downloading':
        return (
          <button 
            className="task-control-btn pause"
            onClick={() => handlePauseTask(task.id)}
            title="暂停下载"
          >
            ⏸️
          </button>
        )
      case 'paused':
        return (
          <button 
            className="task-control-btn resume"
            onClick={() => handleResumeTask(task.id)}
            title="继续下载"
          >
            ▶️
          </button>
        )
      case 'queued':
        return (
          <button 
            className="task-control-btn queued"
            onClick={() => handleCancelTask(task.id)}
            title="取消下载"
          >
            ⏸️
          </button>
        )
      default:
        return null
    }
  }

  // 渲染任务详情
  const renderTaskDetail = (task: DownloadTask) => (
    <div className="task-detail">
      <div className="task-info">
        <div className="task-status">
          <span className="status-icon">{getStatusIcon(task.status)}</span>
          <span className="status-text">{getStatusText(task.status)}</span>
        </div>
        {task.status === 'downloading' && (
          <div className="task-progress-info">
            <span className="download-speed">{formatSpeed(task.download_speed)}</span>
            <span className="eta">{formatETA(task.eta)}</span>
          </div>
        )}
        {task.error_message && (
          <div className="task-error">{task.error_message}</div>
        )}
      </div>
      <div className="task-actions">
        {renderTaskControls(task)}
        <button 
          className="task-control-btn cancel"
          onClick={() => handleCancelTask(task.id)}
          title="取消下载"
        >
          🚫
        </button>
      </div>
    </div>
  )

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
          <div className="video-list" role="list" aria-label="视频列表">
            {seriesList.map(series => {
              const isSeries = series.totalCount > 1
              const firstTask = series.tasks[0]
              const isExpanded = expandedSeries === series.seriesId
              
              // 计算系列的整体进度
              const seriesProgress = series.totalCount > 0 
                ? Math.round((series.completedCount / series.totalCount) * 100) 
                : 0
              
              return (
                <div key={series.seriesId} className="download-series-card">
                  {/* 系列卡片 */}
                  <div 
                    className={`series-header ${isExpanded ? 'expanded' : ''}`}
                    onClick={() => isSeries && toggleSeries(series.seriesId)}
                  >
                    <div className="series-info">
                      {isSeries && (
                        <span className="expand-icon">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      )}
                      {firstTask.thumbnail_url && (
                        <img 
                          src={firstTask.thumbnail_url} 
                          alt={series.seriesName}
                          className="series-thumbnail"
                        />
                      )}
                      {!firstTask.thumbnail_url && (
                        <div className="series-thumbnail placeholder">🎬</div>
                      )}
                      <div className="series-details">
                        <h3 className="series-title">{series.seriesName}</h3>
                        <div className="series-meta">
                          <span className="series-uploader">{firstTask.uploader}</span>
                          <span className="series-duration">{formatDuration(firstTask.duration || 0)}</span>
                          <span className="series-count">{series.completedCount}/{series.totalCount}</span>
                        </div>
                      </div>
                    </div>
                    <div className="series-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${seriesProgress}%` }}
                        />
                      </div>
                      <span className="progress-text">{seriesProgress}%</span>
                    </div>
                    <div className="series-actions">
                      {isSeries && !isExpanded ? (
                        <>
                          <button 
                            className="series-action-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStartDownload(series)
                            }}
                            title="开始下载"
                          >
                            ▶️
                          </button>
                          <button 
                            className="series-action-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteDownload(series)
                            }}
                            title="删除"
                          >
                            🗑️
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  
                  {/* 展开的任务列表 */}
                  {isExpanded && isSeries && (
                    <div className="series-tasks">
                      {series.tasks.map(task => (
                        <div key={task.id} className="task-item">
                          <div className="task-main">
                            <span className="task-title">
                              P{series.tasks.indexOf(task) + 1}: {task.title}
                            </span>
                            <div className="task-progress-bar">
                              <div 
                                className="task-progress-fill"
                                style={{ width: `${task.progress}%` }}
                              />
                              <span className="task-progress-text">{task.progress.toFixed(1)}%</span>
                            </div>
                          </div>
                          {renderTaskDetail(task)}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* 单个视频任务 */}
                  {!isSeries && renderTaskDetail(firstTask)}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}