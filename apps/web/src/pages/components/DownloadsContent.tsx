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
  const refreshTimerRef = useRef<number | null>(null)
  const navigate = useNavigate()

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

  // 获取状态文字
  const getStatusText = (status: string): string => {
    const statusMap: Record<string, string> = {
      'pending': '等待下载',
      'queued': '队列中',
      'downloading': '下载中',
      'processing': '处理中',
      'failed': '下载失败',
      'cancelled': '已取消'
    }
    return statusMap[status] || status
  }

  // 开始下载
  const handleStartDownload = async (series: DownloadSeries) => {
    try {
      const downloadIds = series.tasks.map(task => task.id)
      const response = await fetch('http://localhost:8000/api/download/start/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ download_ids: downloadIds })
      })
      const data = await response.json()
      
      if (data.success) {
        fetchDownloads()
      } else {
        alert('开始下载失败: ' + (data.message || '未知错误'))
      }
    } catch (error) {
      alert('开始下载失败: 网络错误')
    }
  }

  // 删除下载任务
  const handleDeleteDownload = async (series: DownloadSeries) => {
    if (!confirm(`确定要删除 "${series.seriesName}" 吗？`)) {
      return
    }
    
    try {
      const deletePromises = series.tasks.map(task => 
        fetch(`http://localhost:8000/api/download/${task.id}`, {
          method: 'DELETE'
        })
      )
      
      await Promise.all(deletePromises)
      
      // 删除后重新获取下载列表
      fetchDownloads()
      
      // 同时更新全局下载状态缓存
      // 从全局store中移除已删除的下载任务
      series.tasks.forEach(task => {
        downloadStore.removeDownload(task.id)
      })
    } catch (error) {
      alert('删除失败: 网络错误')
    }
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
    
    if (filteredDownloads.length > 0) {
      groupDownloadsBySeries(filteredDownloads).then(setSeriesList)
    } else {
      setSeriesList([])
    }
  }, [downloads, viewMode, groupDownloadsBySeries])

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
          <div className="video-list" role="list" aria-label="视频列表">
            {seriesList.map(series => {
              const isSeries = series.totalCount > 1
              const firstTask = series.tasks[0]
              
              // 计算系列的整体进度
              const seriesProgress = series.totalCount > 0 
                ? Math.round((series.completedCount / series.totalCount) * 100) 
                : 0
              
              // 判断下载状态
              const downloadStatus = isSeries 
                ? (seriesProgress === 100 ? 'in_list' : 'in_list')
                : (firstTask.status === 'completed' ? 'in_list' : 'in_list')
              
              // 单个视频或系列视频都可以点击进入详情页
              const canClickDetail = true  // 所有视频都可以点击进入详情页
              
              return (
                <VideoListCard
                  key={series.seriesId}
                  id={firstTask.id}
                  bvid={firstTask.bvid || series.seriesId}
                  title={series.seriesName}
                  cover={firstTask.thumbnail_url || ''}
                  duration={formatDuration(firstTask.duration || 0)}
                  uploader={firstTask.uploader || ''}
                  views={getStatusText(firstTask.status)}
                  comments={formatTime(series.createdTime)}
                  time=""
                  progress={isSeries ? seriesProgress : firstTask.progress}
                  downloadStatus={downloadStatus}
                  showDownloadButton={false}
                  isSeries={isSeries}
                  clickable={canClickDetail}
                  showActionButtons={true}
                  canStart={firstTask.status === 'pending' || firstTask.status === 'failed'}
                  onActionStart={() => handleStartDownload(series)}
                  onActionDelete={() => handleDeleteDownload(series)}
                  onVideoClick={() => {
                    // 所有视频都可以进入详情页
                    navigate(`/downloads/${series.seriesId}`)
                  }}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}