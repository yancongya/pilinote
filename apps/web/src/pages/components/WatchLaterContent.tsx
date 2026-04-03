import { useState, useEffect, useCallback } from 'react'
import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useNewQueueStore } from '../../stores/newQueue'
import { formatDuration, formatNumber, formatProgress, formatTime } from '../../utils/videoFormatters'
import { useVideoList } from '../../hooks/useVideoList'
import { useBatchDownload } from '../../hooks/useBatchDownload'
import { useVideoDownload } from '../../hooks/useVideoDownload'
import BatchActionsBar from '../../components/BatchActionsBar'
import VideoListContainer from '../../components/VideoListContainer'

export default function WatchLaterContent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [totalCount, setTotalCount] = useState(0)

  const { user } = useAuthStore()
  const newQueueStore = useNewQueueStore()

  // 下载状态检查函数（只检查新系统）
  const getDownloadStatus = useCallback((bvid: string): 'none' | 'in_list' => {
    const tasks = newQueueStore.tasks
    const newSystemTasks = Object.values(tasks)
    const hasInNewQueue = newSystemTasks.some(task => 
      task.media_id === bvid && !['completed', 'cancelled'].includes(task.state)
    )
    
    return hasInNewQueue ? 'in_list' : 'none'
  }, [newQueueStore.tasks])

  // 监听 newQueueStore.tasks 的变化，触发重新渲染
  const [, setForceUpdate] = useState(0)
  
  useEffect(() => {
    // 订阅 store 的变化
    const unsubscribe = useNewQueueStore.subscribe(
      (state) => {
        // 当 tasks 变化时，强制组件重新渲染
        setForceUpdate(prev => prev + 1)
      }
    )
    
    return unsubscribe
  }, [])

  // 组件挂载时同步数据（确保缓存一致性）
  useEffect(() => {
    const syncData = async () => {
      try {
        // 检查并清除新系统缓存
        const cachedData = localStorage.getItem('new-queue-storage')
        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData)
            const taskCount = Object.keys(parsed.state?.tasks || {}).length
            
            if (taskCount > 0) {
              localStorage.removeItem('new-queue-storage')
              window.location.reload()
              return
            }
          } catch (e) {
            localStorage.removeItem('new-queue-storage')
          }
        }
        
        // 同步最新数据
        await newQueueStore.fetchTasks()
        await newQueueStore.fetchSchedulers()
      } catch (error) {
        console.error('[WatchLater] 同步数据失败:', error)
      }
    }
    syncData()
  }, [])

  // 使用 useCallback 缓存 fetchFn，避免每次渲染创建新函数引用
  const fetchWatchLaterVideos = useCallback(async (page: number, pageSize: number) => {
    if (!user?.sessdata) {
      return { success: false, message: '缺少必要参数' }
    }
    const response = await apiService.getWatchLaterList(user.sessdata, page, pageSize)
    return response
  }, [user?.sessdata])

  // 使用 useVideoList Hook 管理视频列表
  const { videos, loading: videosLoading, loadingMore, error: videosError, hasMore, loadMoreRef } = useVideoList({
    fetchFn: fetchWatchLaterVideos,
    pageSize: 20,
    deps: [],  // ✅ 不需要deps，因为fetchFn已经用useCallback处理了依赖
    formatItem: (video: any) => ({
      id: video.id,
      bvid: video.bvid,
      title: video.title,
      cover: video.cover,
      duration: formatDuration(video.duration),
      durationSeconds: video.duration,
      progress: video.progress,
      watched: formatProgress(video.progress, video.duration),
      uploader: video.uploader?.name || '未知',
      views: formatNumber(video.view),
      danmaku: video.danmaku ? formatNumber(video.danmaku) : '0',
      comments: video.comment ? formatNumber(video.comment) : '0',
      likes: video.like ? formatNumber(video.like) : '0',
      coins: video.coin ? formatNumber(video.coin) : '0',
      favorites: video.favorite ? formatNumber(video.favorite) : '0',
      shares: video.share ? formatNumber(video.share) : '0',
      time: formatTime(video.add_time),
      // 保留原始数据用于下载
      cid: video.cid,
      aid: video.aid,
      pic: video.cover,
      originalDuration: video.duration,
      owner: video.uploader,
      pubtime: video.add_time
    })
  })

  // 使用 useBatchDownload Hook 管理批量下载
  const {
    batchMode,
    setBatchMode,
    selectedVideos,
    toggleVideoSelection,
    toggleSelectAll,
    batchDownloadSelected,
    clearSelection
  } = useBatchDownload({
    videos,
    setLoading,
    setError
  })

  // 使用 useVideoDownload Hook 处理单个视频下载（使用新的下载系统）
  const { toggleDownload: baseToggleDownload } = useVideoDownload(true)

  // 包装toggleDownload，确保状态更新
  const toggleDownload = useCallback(async (video: any, e: React.MouseEvent) => {
    await baseToggleDownload(video, e)
    // baseToggleDownload 中已经调用了 fetchTasks()，这里不需要再次调用
  }, [baseToggleDownload])

  // 更新总数（从响应中获取）
  useEffect(() => {
    if (videos.length > 0 && videos.length >= totalCount) {
      setTotalCount(videos.length)
    }
  }, [videos.length, totalCount])

  // 批量下载稍后再看（使用新系统API）
  const batchDownloadWatchLater = async () => {
    if (videos.length === 0) {
      alert('稍后再看中没有视频可下载')
      return
    }

    if (!confirm(`确定要批量下载稍后再看中的所有 ${videos.length} 个视频吗？`)) {
      return
    }

    setLoading(true)
    setError('')

    try {
      // 1. 使用新API获取稍后再看媒体信息
      const mediaResponse = await apiService.getWatchlaterMedia()
      if (!mediaResponse.success || !mediaResponse.data) {
        throw new Error(mediaResponse.message || '获取稍后再看信息失败')
      }

      const mediaInfo = mediaResponse.data
      const videoList = mediaInfo.list || []

      if (videoList.length === 0) {
        alert('稍后再看中没有视频可下载')
        setLoading(false)
        return
      }

      // 2. 先批量提交任务到backlog，收集任务ID
      const taskIds: string[] = []
      let successCount = 0

      for (const video of videoList) {
        try {
          const taskResponse = await apiService.submitTask({
            media_type: 'video',
            media_id: video.bvid || '',
            title: video.title || '',
            cover: video.cover || '',
            desc: video.desc || '',
            meta: {
              aid: video.aid,
              cid: video.cid,
              duration: video.duration,
              uploader: video.uploader?.name || '',
              uploader_mid: video.uploader?.mid || 0
            }
          })

          if (taskResponse.success && taskResponse.data) {
            taskIds.push(taskResponse.data.id)
            successCount++
          }
        } catch (err) {
          console.error(`提交任务失败: ${video.title}`, err)
        }
      }

      if (taskIds.length === 0) {
        throw new Error('所有任务提交失败')
      }

      // 3. 创建调度器，使用收集到的任务ID
      const folderName = `稍后再看-${new Date().toISOString().slice(0, 10)}`
      const folderPath = `/Users/tanyancong/工作/开发/pilinote/apps/api/downloads/${folderName}`

      const schedulerResponse = await apiService.createScheduler({
        title: `稍后再看批量下载`,
        task_ids: taskIds,
        folder: folderPath
      })

      if (!schedulerResponse.success || !schedulerResponse.data) {
        throw new Error(schedulerResponse.message || '创建调度器失败')
      }

      const schedulerId = schedulerResponse.data.id

      alert(`批量下载已添加到队列！\n成功提交 ${successCount}/${videoList.length} 个任务\n保存路径: ${folderPath}\n请在下载列表中点击"开始下载"按钮开始下载`)
      // 切换到下载页面
      window.location.href = '/downloads'

    } catch (err) {
      console.error('批量下载失败:', err)
      setError(`批量下载失败: ${err instanceof Error ? err.message : '未知错误'}`)
      alert(`批量下载失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  if (!user?.sessdata) {
    return (
      <section className="content-section" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: '#999', fontSize: '16px' }}>请先登录以查看稍后再看</p>
      </section>
    )
  }

  return (
    <section
      id="watchlater-panel"
      role="tabpanel"
      aria-labelledby="watchlater-tab"
      className="content-section"
    >
      <div className="section-header">
        <div className="section-title">
          <h2>稍后再看</h2>
          <span className="video-count">共{totalCount || videos.length}个视频</span>
          {videos.length > 0 && (
            <BatchActionsBar
              batchMode={batchMode}
              selectedCount={selectedVideos.size}
              onEnterBatchMode={() => setBatchMode(true)}
              onExitBatchMode={clearSelection}
              onBatchDownload={batchDownloadSelected}
              loading={loading}
            />
          )}
        </div>
      </div>

      <VideoListContainer
        videos={videos}
        loading={videosLoading}
        loadingMore={loadingMore}
        error={videosError || error}
        batchMode={batchMode}
        selectedVideos={selectedVideos}
        onToggleSelect={toggleVideoSelection}
        onSelectAll={toggleSelectAll}
        onDownloadToggle={toggleDownload}
        getDownloadStatus={getDownloadStatus}
        loadMoreRef={loadMoreRef}
        hasMore={hasMore}
        emptyText="暂无视频"
        cardClickable={true}
      />
    </section>
  )
}