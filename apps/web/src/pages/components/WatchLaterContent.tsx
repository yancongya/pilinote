import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useNewQueueStore } from '../../stores/newQueue'
import { formatDuration, formatNumber, formatProgress, formatTime } from '../../utils/videoFormatters'
import { useVideoList } from '../../hooks/useVideoList'
import { useVideoDownload } from '../../hooks/useVideoDownload'
import VideoListContainer from '../../components/VideoListContainer'
import VideoListControls from '../../components/VideoListControls'
import AlertModal from '../../components/AlertModal'
import ConfirmModal from '../../components/ConfirmModal'

export default function WatchLaterContent() {
  const [totalCount, setTotalCount] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [order, setOrder] = useState<string>('default')
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc')
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'error' }>({
    show: false,
    title: '',
    message: '',
    type: 'success'
  })
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; title: string; message: string; onConfirm: () => void }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })

  const { user } = useAuthStore()
  const newQueueStore = useNewQueueStore()
  const navigate = useNavigate()

  // Refs to track if data has been loaded
  const tasksSyncedRef = useRef(false)

  // 下载状态检查函数（只检查新系统）
    // 不使用 useCallback，确保每次渲染时都使用最新的任务状态
    const getDownloadStatus = (bvid: string): 'none' | 'in_list' | 'downloaded' => {
      const tasks = newQueueStore.tasks
      const newSystemTasks = Object.values(tasks)
      
      // 检查是否在队列中（未完成的任务）
      const hasActiveTask = newSystemTasks.some(task =>
        task.media_id === bvid && !['completed', 'cancelled'].includes(task.state)
      )
      
      if (hasActiveTask) {
        return 'in_list'
      }
      
      // 检查是否已下载完成（已完成的任务）
      const hasCompletedTask = newSystemTasks.some(task =>
        task.media_id === bvid && task.state === 'completed'
      )
      
      if (hasCompletedTask) {
        return 'downloaded'
      }
      
      return 'none'
    }

  // 组件挂载时同步数据（只执行一次）
  useEffect(() => {
    const syncData = async () => {
      if (tasksSyncedRef.current) return
      tasksSyncedRef.current = true

      try {
        // 先清理本地缓存，确保数据一致
        newQueueStore.forceClearCache()
        
        // 同步最新数据
        await newQueueStore.fetchTasks()
        await newQueueStore.fetchSchedulers()
        
        // 清理重复的已完成任务
        await newQueueStore.cleanupDuplicateCompletedTasks()
      } catch (error) {
        console.error('[WatchLater] 同步数据失败:', error)
      }
    }
    syncData()
  }, [])

  // 使用 useCallback 缓存 fetchFn，避免每次渲染创建新函数引用
  const fetchWatchLaterVideos = useCallback(async (page: number, pageSize: number) => {
    if (!user?.mid) {
      return { success: false, message: '缺少必要参数' }
    }
    // 调用getWatchLaterList时不需要传递sessdata，后端会从cookie中获取
    const response = await apiService.getWatchLaterList(page, pageSize, keyword, order, sortDirection)
    return response
  }, [user?.mid, keyword, order, sortDirection])

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

  // 使用 useVideoDownload Hook 处理单个视频下载（使用新的下载系统）
  const { toggleDownload: baseToggleDownload } = useVideoDownload()

  // 包装toggleDownload，确保状态更新
const toggleDownload = useCallback(async (video: any, e: React.MouseEvent) => {
      const result = await baseToggleDownload(video, e)
      if (result.success) {
        // 如果需要跳转到视频库
        if (result.shouldNavigateToLibrary) {
          navigate('/downloads', { replace: true })
          // 延迟显示弹窗，让页面先跳转
          setTimeout(() => {
            setAlertModal({
              show: true,
              title: '操作成功',
              message: result.message,
              type: 'success'
            })
          }, 100)
        } else {
          setAlertModal({
            show: true,
            title: '操作成功',
            message: result.message,
            type: 'success'
          })
        }
      } else {
        setAlertModal({
          show: true,
          title: '操作失败',
          message: result.message,
          type: 'error'
        })
      }
    }, [baseToggleDownload, navigate])

  // 更新总数（从响应中获取）
  useEffect(() => {
    if (videos.length > 0 && videos.length >= totalCount) {
      setTotalCount(videos.length)
    }
  }, [videos.length, totalCount])

  if (!user?.mid) {
    return (
      <section className="content-section" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p className="text-secondary-400 dark:text-secondary-500 text-base">请先登录以查看稍后再看</p>
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
        </div>
      </div>

<VideoListControls
          keyword={keyword}
          order={order}
          sortDirection={sortDirection}
          onKeywordChange={setKeyword}
          onOrderChange={setOrder}
          onSortDirectionChange={setSortDirection}
          sortOptions={[
            { value: 'default', label: '默认' },
            { value: 'view', label: '按播放量' },
            { value: 'pubtime', label: '按发布时间' },
            { value: 'add_time', label: '按添加时间' }
          ]}
        />

      <VideoListContainer
        videos={videos}
        loading={videosLoading}
        loadingMore={loadingMore}
        error={videosError}
        onDownloadToggle={toggleDownload}
        getDownloadStatus={getDownloadStatus}
        loadMoreRef={loadMoreRef}
        hasMore={hasMore}
        emptyText="暂无视频"
        cardClickable={true}
      />

      {/* AlertModal */}
      <AlertModal
        isOpen={alertModal.show}
        onClose={() => setAlertModal({ show: false, title: '', message: '', type: 'success' })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      {/* ConfirmModal */}
      <ConfirmModal
        isOpen={confirmModal.show}
        onClose={() => setConfirmModal({ show: false, title: '', message: '', onConfirm: () => {} })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmVariant="primary"
      />
    </section>
  )
}