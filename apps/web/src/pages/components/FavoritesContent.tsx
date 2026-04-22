import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useCacheStore } from '../../stores/cache'
import { useNewQueueStore } from '../../stores/newQueue'
import { videoLibraryService } from '../../services/videoLibraryService'
import { ArrowLeft, Folder } from 'lucide-react'
import { formatDuration, formatNumber, formatTime } from '../../utils/videoFormatters'
import { useVideoList } from '../../hooks/useVideoList'
import { getAvatarProxyUrl } from '../../config/api'
import { useVideoDownload } from '../../hooks/useVideoDownload'
import MediaListTopBar from '../../components/media-list/MediaListTopBar'
import MediaListShell from '../../components/media-list/MediaListShell'
import VideoListContainer from '../../components/VideoListContainer'
import VideoListControls from '../../components/VideoListControls'
import AlertModal from '../../components/AlertModal'
import ConfirmModal from '../../components/ConfirmModal'

export default function FavoritesContent() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const newQueueStore = useNewQueueStore()
  const { 
    getFoldersCache, 
    setFoldersCache,
    getFolderVideosCache,
    setFolderVideosCache
  } = useCacheStore()

  // 初始化时从缓存恢复 folders 状态，避免切换 tab 时闪烁
  const [selectedFolder, setSelectedFolder] = useState<any>(null)
  const [folders, setFolders] = useState<any[]>(() => {
    const cached = getFoldersCache()
    return cached || []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [order, setOrder] = useState<string>('default')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [loadedCount, setLoadedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [alertModal, setAlertModal] = useState<{ 
    show: boolean; 
    title: string; 
    message: string; 
    type: 'success' | 'error' | 'info';
    showConfirm?: boolean;
    onConfirm?: () => void;
  }>({
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

  // Refs to track if data has been loaded
  const foldersLoadedRef = useRef(false)
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
        console.error('[Favorites] 同步数据失败:', error)
      }
    }
    syncData()
  }, [])

  // 处理收藏夹选择，更新路由
  const handleSelectFolder = (folder: any) => {
    setSelectedFolder(folder)
    navigate(`/favorites/${folder.id}`, { replace: true })
  }

  // 处理返回收藏夹列表，更新路由
  const handleBackToFolders = () => {
    setSelectedFolder(null)
    navigate('/favorites', { replace: true })
  }

  const buildFolderVideosCacheKey = useCallback(
    (folderId: number, page: number, pageSize: number) => {
      const normalizedKeyword = keyword.trim()
      return [
        folderId,
        page,
        pageSize,
        normalizedKeyword || '__all__',
        order,
        sortDirection
      ].join(':')
    },
    [keyword, order, sortDirection]
  )

  // 使用 useCallback 缓存 fetchFn，避免每次渲染创建新函数引用
  const fetchFavoriteVideos = useCallback(async (page: number, pageSize: number) => {
    if (!selectedFolder || !user?.mid) {
      // 当 selectedFolder 为 null 时（返回收藏夹列表页），返回空的成功结果
      return { success: true, data: { list: [], total: 0 } }
    }

    const cacheKey = buildFolderVideosCacheKey(selectedFolder.id, page, pageSize)
    const cached = getFolderVideosCache(cacheKey)
    if (cached) {
      return {
        success: true,
        data: {
          medias: cached.data,
          page: cached.page,
          page_size: cached.pageSize,
          info: selectedFolder
        },
        total: cached.total
      }
    }

    // 调用getFolderDetail时不需要传递sessdata，后端会从cookie中获取
    const response = await apiService.getFolderDetail(
      selectedFolder.id,
      page,
      pageSize,
      keyword,
      order,
      sortDirection,
      true
    )

    if (response.success && response.data) {
      const medias = response.data.medias || []
      const total = response.total || response.data.total || selectedFolder.media_count || medias.length
      setFolderVideosCache(cacheKey, medias, {
        total,
        page,
        pageSize
      })
    }

    return response
  }, [
    selectedFolder?.id,
    selectedFolder?.media_count,
    user?.mid,
    keyword,
    order,
    sortDirection,
    buildFolderVideosCacheKey,
    getFolderVideosCache,
    setFolderVideosCache
  ])

  // 使用 useVideoList Hook 管理视频列表
  const { videos, loading: videosLoading, loadingMore, error: videosError, hasMore, total, loadMoreRef, fetchVideos } = useVideoList({
    fetchFn: fetchFavoriteVideos,
    pageSize: 10,
    deps: [],  // ✅ 不需要deps，因为fetchFn已经用useCallback处理了依赖
    formatItem: (video: any) => ({
      id: video.id,
      bvid: video.bvid,
      title: video.title,
      cover: video.cover,
      duration: formatDuration(video.duration),
      uploader: video.uploader?.name || '未知',
      views: formatNumber(video.view),
      danmaku: video.danmaku ? formatNumber(video.danmaku) : '0',
      comments: video.comment ? formatNumber(video.comment) : '0',
      likes: video.like ? formatNumber(video.like) : '0',
      coins: video.coin ? formatNumber(video.coin) : '0',
      favorites: video.favorite ? formatNumber(video.favorite) : '0',
      shares: video.share ? formatNumber(video.share) : '0',
      time: formatTime(video.pubtime),
      // 保留原始数据用于下载
      cid: video.cid,
      aid: video.aid,
      pic: video.cover,
      originalDuration: video.duration,
      owner: video.uploader,
      pubtime: video.pubtime
    })
  })

  // 加载更多函数
  const handleLoadMore = useCallback(async () => {
    if (hasMore && !loadingMore) {
      await fetchVideos(undefined, true)
    }
  }, [hasMore, loadingMore, fetchVideos])

  // 更新loadedCount和totalCount状态
  useEffect(() => {
    setLoadedCount(videos.length)
    setTotalCount(total)
  }, [videos.length, total])

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

  // 监听路由变化，支持通过URL直接访问收藏夹详情
  useEffect(() => {
    const currentPath = window.location.pathname
    const favoritesMatch = currentPath.match(/^\/favorites\/(\d+)$/)
    if (favoritesMatch && folders.length > 0) {
      const folderId = parseInt(favoritesMatch[1])
      const folder = folders.find(f => f.id === folderId)
      if (folder) {
        setSelectedFolder(folder)
      }
    }
  }, [folders, setSelectedFolder])

  // 获取收藏夹列表（带缓存）
  useEffect(() => {
    const fetchFolders = async () => {
      if (!user?.mid || foldersLoadedRef.current) return

      foldersLoadedRef.current = true

      // 先检查缓存
      const cachedFolders = getFoldersCache()
      if (cachedFolders) {
        setFolders(cachedFolders)
        // 后台静默刷新
        try {
          // 调用getFolders时不需要传递sessdata和upMid，后端会从cookie中获取
          const response = await apiService.getFolders()
          if (response.success && response.data) {
            setFolders(response.data)
            setFoldersCache(response.data)
          }
        } catch (err) {
          console.error('[Favorites] 后台刷新收藏夹失败:', err)
        }
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await apiService.getFolders()
        if (response.success && response.data) {
          setFolders(response.data)
          setFoldersCache(response.data)
        } else {
          setError(response.message || '获取收藏夹列表失败')
        }
      } catch (err) {
        setError('网络请求失败')
      } finally {
        setLoading(false)
      }
    }

    fetchFolders()
  }, [user, getFoldersCache, setFoldersCache])

  if (!user?.mid) {
    return (
      <section className="content-section" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p className="text-secondary-400 dark:text-secondary-500 text-base">请先登录以查看收藏夹</p>
      </section>
    )
  }

  return (
    <section
      id="favorites-panel"
      role="tabpanel"
      aria-labelledby="favorites-tab"
      className="content-section"
    >
      {!selectedFolder && loading && (
        <div className="text-center py-10 text-secondary-400 dark:text-secondary-500">加载中...</div>
      )}

      {!selectedFolder && error && (
        <div className="text-center py-10 text-error-600 dark:text-error-500">{error}</div>
      )}

      {!selectedFolder && !loading && !error && (
        <div className="fav-folder-list" role="list" aria-label="收藏夹列表">
          {folders.length === 0 ? (
            <div className="text-center py-16 px-5 text-secondary-400 dark:text-secondary-500">暂无收藏夹</div>
          ) : (
            folders.map(folder => (
              <article
                key={folder.id}
                className="fav-folder-item"
                onClick={() => handleSelectFolder(folder)}
                role="listitem"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleSelectFolder(folder)
                  }
                }}
              >
                <div className="fav-folder-cover">
                  <div className="fav-folder-thumbnail">
                    {folder.cover ? (
                      <img src={getAvatarProxyUrl(folder.cover)} alt={folder.title} className="w-full h-full object-cover" />
                    ) : (
                      <Folder />
                    )}
                  </div>
                </div>
                <div className="fav-folder-info">
                  <h3>{folder.title}</h3>
                  <div className="fav-folder-meta">
                    <span className="fav-folder-count">{folder.media_count}个内容</span>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {selectedFolder && (
        <MediaListShell
          topBar={(
            <MediaListTopBar
              title={(
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    className="back-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleBackToFolders()
                    }}
                    aria-label="返回收藏夹列表"
                  >
                    <ArrowLeft />
                  </button>
                  <span>{selectedFolder.title}</span>
                </div>
              )}
              countLabel={`共${selectedFolder.media_count}条视频`}
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
                    { value: 'favorite', label: '按收藏时间' }
                  ]}
                  loadedCount={loadedCount}
                  totalCount={totalCount}
                  canLoadMore={hasMore}
                  onLoadMore={handleLoadMore}
                  isLoading={loadingMore}
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
          refreshingHint={videosLoading && videos.length > 0 ? '正在刷新收藏视频...' : undefined}
          contentClassName="media-list-shell-content"
        >
          <VideoListContainer
            videos={videos}
            loading={false}
            loadingMore={false}
            error=""
            onDownloadToggle={toggleDownload}
            getDownloadStatus={getDownloadStatus}
            loadMoreRef={loadMoreRef}
            hasMore={hasMore}
            emptyText="暂无视频"
            cardClickable={true}
          />
        </MediaListShell>
      )}

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
