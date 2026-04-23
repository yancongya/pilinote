import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useNewQueueStore } from '../../stores/newQueue'
import { videoLibraryService } from '../../services/videoLibraryService'
import { formatDuration, formatNumber, formatProgress, formatTime } from '../../utils/videoFormatters'
import { useVideoList } from '../../hooks/useVideoList'
import { useVideoDownload } from '../../hooks/useVideoDownload'
import MediaListTopBar from '../../components/media-list/MediaListTopBar'
import MediaListShell from '../../components/media-list/MediaListShell'
import VideoListContainer from '../../components/VideoListContainer'
import VideoListControls from '../../components/VideoListControls'
import AlertModal from '../../components/AlertModal'
import ConfirmModal from '../../components/ConfirmModal'

export default function HistoryContent() {
  const [keyword, setKeyword] = useState('')
  const [order, setOrder] = useState<string>('default')
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc')
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'error' | 'info'; showConfirm?: boolean; onConfirm?: () => void }>({
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
        console.error('[History] 同步数据失败:', error)
      }
    }
    syncData()
  }, [])

  // 使用 useCallback 缓存 fetchFn，避免每次渲染创建新函数引用
  const fetchHistoryVideos = useCallback(async (page: number, pageSize: number) => {
    if (!user?.mid) {
      return { success: false, message: '缺少必要参数' }
    }
    // 调用getHistoryList时不需要传递sessdata，后端会从cookie中获取
    const response = await apiService.getHistoryList(page, pageSize, keyword, order, sortDirection)
    return response
  }, [user?.mid, keyword, order, sortDirection])

  const historyCacheKey = `history:${user?.mid || 'anon'}:${keyword.trim() || '__all__'}:${order}:${sortDirection}`

  // 使用 useVideoList Hook 管理视频列表
  const { videos, loading: videosLoading, loadingMore, loadMoreError, error: videosError, hasMore, total, loadMoreRef } = useVideoList({
    fetchFn: fetchHistoryVideos,
    pageSize: 20,
    deps: [],  // ✅ 不需要deps，因为fetchFn已经用useCallback处理了依赖
    cacheKey: historyCacheKey,
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
      time: formatTime(video.view_time),
      // 保留原始数据用于下载
      cid: video.cid,
      aid: video.aid,
      pic: video.cover,
      originalDuration: video.duration,
      owner: video.uploader,
      pubtime: video.pubtime
    })
  })

  // 使用 useVideoDownload Hook 处理单个视频下载（使用新的下载系统）
  const { toggleDownload: baseToggleDownload } = useVideoDownload()

  // 包装toggleDownload，确保状态更新
const toggleDownload = useCallback(async (video: any, e: React.MouseEvent) => {
      try {
        // 检查视频是否已下载
        const decision = await videoLibraryService.checkBeforeAdd(video)
        
        switch (decision.action) {
          case 'add':
            // 直接添加
            await baseToggleDownload(video, e)
            break
            
          case 'show_confirm':
            // 显示确认对话框
            setAlertModal({
              show: true,
              title: '重新下载视频',
              message: `视频 ${video.title} 已在视频库中，是否重新下载？`,
              type: 'info',
              showConfirm: true,
              onConfirm: async () => {
                await baseToggleDownload(video, e)
                setAlertModal(prev => ({ ...prev, show: false }))
              }
            })
            break
            
          case 'skip':
            // 静默跳过
            setAlertModal({
              show: true,
              title: '提示',
              message: `视频 ${video.title} 已下载，已在视频库中`,
              type: 'success'
            })
            break
        }
      } catch (error) {
        console.error('检查下载状态失败:', error)
        // 降级到原有逻辑
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
      }
    }, [baseToggleDownload, navigate])

  if (!user?.mid) {
    return (
      <section className="content-section text-center py-15 px-5">
        <p className="text-secondary-400 dark:text-secondary-500 text-base">请先登录以查看观看历史</p>
      </section>
    )
  }

  return (
    <section
      id="history-panel"
      role="tabpanel"
      aria-labelledby="history-tab"
      className="content-section"
    >
      <MediaListShell
        topBar={(
          <MediaListTopBar
            title="观看历史"
            countLabel={`共${total || videos.length}个视频`}
            filters={(
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
                  { value: 'view_time', label: '按观看时间' }
                ]}
                compact
                sticky={false}
              />
            )}
          />
        )}
        loading={videosLoading}
        loadingMore={loadingMore}
        error={videosError}
        hasItems={videos.length > 0}
        emptyText="暂无视频"
        refreshingHint={videosLoading && videos.length > 0 ? '正在刷新观看历史...' : undefined}
        contentClassName="media-list-shell-content"
      >
        <VideoListContainer
          videos={videos}
          loading={false}
          loadingMore={false}
          error=""
          loadMoreError={loadMoreError}
          onDownloadToggle={toggleDownload}
          getDownloadStatus={getDownloadStatus}
          loadMoreRef={loadMoreRef}
          hasMore={hasMore}
          emptyText="暂无视频"
          cardClickable={true}
        />
      </MediaListShell>

      {/* AlertModal */}
      <AlertModal
        isOpen={alertModal.show}
        onClose={() => setAlertModal({ show: false, title: '', message: '', type: 'success', showConfirm: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        showConfirm={alertModal.showConfirm}
        onConfirm={alertModal.onConfirm}
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
