import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import VideoListCard from './VideoListCard'
import { useDownloadStore } from '../../stores/download'

interface DownloadTask {
  id: string
  bvid: string
  title: string
  status: 'pending' | 'queued' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused'
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
  file_size?: number  // 新增：文件大小（字节）
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
  const [storageInfo, setStorageInfo] = useState({
    totalSize: 0,
    totalSizeFormatted: '0 B',
    fileCount: 0,
    directoryCount: 0
  })
  const navigate = useNavigate()

  // 格式化时长
  const formatDuration = (seconds: number | undefined | null): string => {
    if (seconds === undefined || seconds === null || seconds === 0) return '0:00'
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
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
      'paused': '已暂停',
      'processing': '处理中',
      'failed': '下载失败',
      'cancelled': '已取消'
    }
    return statusMap[status] || status
  }

  // 开始下载
  const handleStartDownload = async (series: DownloadSeries) => {
    const success = await downloadStore.startBatchDownloads(series.tasks.map(task => task.id))
    if (!success) {
      alert('开始下载失败')
    }
  }

  // 暂停任务
  const handlePauseTask = async (taskId: string) => {
    const success = await downloadStore.pauseDownload(taskId)
    if (!success) {
      alert('暂停失败')
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
    
    // 删除后重新获取下载列表，并更新存储信息
    fetchDownloads(true)
  }

  // 获取存储信息
  const fetchStorageInfo = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/api/settings/storage-info')
      const data = await response.json()
      
      if (data.success && data.data) {
        setStorageInfo({
          totalSize: data.data.total_size,
          totalSizeFormatted: data.data.total_size_formatted,
          fileCount: data.data.file_count,
          directoryCount: data.data.directory_count
        })
      }
    } catch (err) {
      console.error('获取存储信息失败:', err)
    }
  }, [])

  // 获取下载任务列表
  const fetchDownloads = useCallback(async (updateStorage: boolean = false) => {
    // 只在初始加载或手动刷新时显示 loading，避免轮询时闪烁
    if (!downloads.length) {
      setLoading(true)
    }
    setError('')
    
    try {
      const response = await fetch('http://localhost:8000/api/download/list')
      const data = await response.json()
      
      if (data.success) {
        setDownloads(data.downloads)
        // 只在需要时更新存储信息
        if (updateStorage) {
          fetchStorageInfo()
        }
      } else {
        setError(data.message || '获取下载列表失败')
      }
    } catch (err) {
      setError('网络请求失败')
    } finally {
      setLoading(false)
    }
  }, [fetchStorageInfo, downloads.length])

  // 按系列分组
  const groupDownloadsBySeries = useCallback(async (tasks: DownloadTask[]): Promise<DownloadSeries[]> => {
    const groups: Record<string, DownloadSeries> = {}
    
    // 首先按aid或bvid分组
    tasks.forEach(task => {
      // 优先使用aid进行分组（系列视频有相同aid但不同bvid）
      // 如果没有aid，才使用bvid
      const seriesId = (task.aid || task.bvid)?.toString() || task.id
      
      if (!groups[seriesId]) {
        groups[seriesId] = {
          seriesId,
          seriesName: task.title || '未知视频',
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
      
      // 累加文件大小
      if (task.file_size) {
        groups[seriesId].totalSize += task.file_size
      } else if (task.total_bytes) {
        groups[seriesId].totalSize += task.total_bytes
      }
      
      if (task.status === 'completed') {
        groups[seriesId].completedCount++
        if (task.duration) {
          groups[seriesId].totalDuration += task.duration
        }
      }
    })
    
    // 提取合集名称：对于系列视频，从多个标题中提取公共部分
    for (const seriesId in groups) {
      const series = groups[seriesId]
      if (series.totalCount > 1 && series.tasks.length > 1) {
        // 尝试从多个标题中提取公共前缀
        const titles = series.tasks.map(t => t.title).filter(Boolean)
        if (titles.length > 1) {
          // 找到最长的公共前缀
          let commonPrefix = titles[0]
          for (let i = 1; i < titles.length; i++) {
            let j = 0
            while (j < commonPrefix.length && j < titles[i].length && commonPrefix[j] === titles[i][j]) {
              j++
            }
            commonPrefix = commonPrefix.substring(0, j)
          }
          
          // 如果公共前缀太短（<10字符），或者包含特殊字符，使用第一个任务的标题
          if (commonPrefix.length >= 10 && !commonPrefix.includes('【')) {
            series.seriesName = commonPrefix.trim()
          }
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
    fetchDownloads(true) // 初始加载时更新存储信息
  }, []) // 移除 fetchDownloads 依赖，避免无限循环

  // 实时刷新：当有下载中的任务时，自动刷新进度
  useEffect(() => {
    const hasDownloading = downloads.some(d => 
      d.status === 'downloading' || d.status === 'queued' || d.status === 'pending' || d.status === 'processing' || d.status === 'paused'
    )
    
    if (hasDownloading) {
      const timer = setInterval(() => {
        fetchDownloads(false) // 轮询时不更新存储信息
      }, 3000) // 增加轮询间隔到3秒，减少请求频率
      return () => clearInterval(timer)
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
    
    // 使用 debounce 避免频繁重新分组
    const timeoutId = setTimeout(() => {
      if (filteredDownloads.length > 0) {
        groupDownloadsBySeries(filteredDownloads).then(setSeriesList)
      } else {
        setSeriesList([])
      }
    }, 100) // 100ms 延迟
    
    return () => clearTimeout(timeoutId)
  }, [downloads, viewMode, groupDownloadsBySeries])

  // 获取状态统计
  const stats = {
    downloading: downloads.filter(d => 
      d.status === 'downloading' || d.status === 'queued' || d.status === 'pending' || d.status === 'processing' || d.status === 'paused'
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

      {/* 存储信息 */}
      {(storageInfo.fileCount > 0 || storageInfo.directoryCount > 0) && (
        <div className="storage-info">
          <span className="storage-label">占用空间:</span>
          <span className="storage-value">{storageInfo.totalSizeFormatted}</span>
          <span className="storage-separator">|</span>
          <span className="storage-label">文件数:</span>
          <span className="storage-value">{storageInfo.fileCount}</span>
          <span className="storage-separator">|</span>
          <span className="storage-label">视频数:</span>
          <span className="storage-value">{storageInfo.directoryCount}</span>
        </div>
      )}

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
            <button className="retry-btn" onClick={() => fetchDownloads(true)}>重试</button>
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
              const canClickDetail = true
              
              return (
                <VideoListCard
                  key={series.seriesId}
                  id={firstTask.id}
                  bvid={firstTask.bvid || series.seriesId}
                  title={series.seriesName}
                  cover={firstTask.thumbnail_url || ''}
                  duration={isSeries ? formatDuration(series.totalDuration) : formatDuration(firstTask.duration || 0)}
                  uploader={firstTask.uploader || ''}
                  views={getStatusText(firstTask.status)}
                  comments={`${formatFileSize(firstTask.downloaded_bytes || 0)} / ${formatFileSize(firstTask.total_bytes || 0)}`}
                  time={firstTask.status === 'downloading' && firstTask.download_speed > 0 ? `${formatFileSize(firstTask.download_speed)}/s` : ''}
                  progress={isSeries ? seriesProgress : firstTask.progress}
                  fileSize={isSeries ? series.totalSize : (firstTask.total_bytes || firstTask.file_size)}
                  seriesCount={isSeries ? series.totalCount : undefined}
                  downloadStatus={downloadStatus}
                  showDownloadButton={false}
                  isSeries={isSeries}
                  clickable={canClickDetail}
                  showActionButtons={true}
                  canStart={firstTask.status === 'pending' || firstTask.status === 'failed' || firstTask.status === 'paused'}
                  canPause={firstTask.status === 'downloading' || firstTask.status === 'queued' || firstTask.status === 'pending' || firstTask.status === 'processing'}
                  onActionStart={() => handleStartDownload(series)}
                  onActionPause={() => handlePauseTask(firstTask.id)}
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