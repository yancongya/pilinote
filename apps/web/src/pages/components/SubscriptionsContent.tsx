import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FolderHeart, ListVideo } from 'lucide-react'

import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useNewQueueStore } from '../../stores/newQueue'
import { useVideoList } from '../../hooks/useVideoList'
import { useVideoDownload } from '../../hooks/useVideoDownload'
import { videoLibraryService } from '../../services/videoLibraryService'
import { getAvatarProxyUrl } from '../../config/api'
import { formatDuration, formatNumber, formatTime } from '../../utils/videoFormatters'
import MediaListShell from '../../components/media-list/MediaListShell'
import MediaListTopBar from '../../components/media-list/MediaListTopBar'
import VideoListContainer from '../../components/VideoListContainer'
import VideoListControls from '../../components/VideoListControls'
import AlertModal from '../../components/AlertModal'

type SubscriptionSourceType = 'all' | 'favorite_folder' | 'ugc_season'

interface SubscriptionSource {
  id: string
  type: Exclude<SubscriptionSourceType, 'all'>
  source_id: string
  title: string
  cover?: string
  media_count?: number
  upper?: {
    mid?: number
    name?: string
  }
  updated_at?: number
}

const sourceTypeLabel = (type: SubscriptionSource['type']) =>
  type === 'favorite_folder' ? '订阅收藏夹' : '订阅合集'

const normalizeSource = (source: any): SubscriptionSource => {
  const type = source.type === 'ugc_season' ? 'ugc_season' : 'favorite_folder'
  return {
    id: source.id || `${type}:${source.source_id || source.id || source.season_id || source.fid}`,
    type,
    source_id: String(source.source_id || source.season_id || source.fid || source.id || ''),
    title: source.title || source.name || '未命名订阅',
    cover: source.cover || source.pic || '',
    media_count: source.media_count ?? source.count ?? source.total ?? 0,
    upper: source.upper || source.owner || source.uploader,
    updated_at: source.updated_at || source.mtime || source.pubtime,
  }
}

export default function SubscriptionsContent() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const newQueueStore = useNewQueueStore()
  const [selectedSource, setSelectedSource] = useState<SubscriptionSource | null>(null)
  const [sources, setSources] = useState<SubscriptionSource[]>([])
  const [sourceType, setSourceType] = useState<SubscriptionSourceType>('ugc_season')
  const [sourceKeyword, setSourceKeyword] = useState('')
  const [loadingSources, setLoadingSources] = useState(false)
  const [sourceError, setSourceError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [order, setOrder] = useState('default')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [loadedCount, setLoadedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [alertModal, setAlertModal] = useState<{
    show: boolean
    title: string
    message: string
    type: 'success' | 'error' | 'info'
    showConfirm?: boolean
    onConfirm?: () => void
  }>({ show: false, title: '', message: '', type: 'success' })
  const tasksSyncedRef = useRef(false)

  useEffect(() => {
    const syncData = async () => {
      if (tasksSyncedRef.current) return
      tasksSyncedRef.current = true

      try {
        newQueueStore.forceClearCache()
        await newQueueStore.fetchTasks()
        await newQueueStore.fetchSchedulers()
      } catch (error) {
        console.error('[Subscriptions] 同步队列失败:', error)
      }
    }
    void syncData()
  }, [])

  const getDownloadStatus = (bvid: string): 'none' | 'in_list' | 'downloaded' => {
    const tasks = Object.values(newQueueStore.tasks)
    if (tasks.some(task => task.media_id === bvid && !['completed', 'cancelled'].includes(task.state))) {
      return 'in_list'
    }
    if (tasks.some(task => task.media_id === bvid && task.state === 'completed')) {
      return 'downloaded'
    }
    return 'none'
  }

  const fetchSources = useCallback(async () => {
    if (!user?.mid) return
    setLoadingSources(true)
    setSourceError('')

    try {
      const response = await apiService.getSubscriptionSources(sourceType, 1, 50, sourceKeyword.trim())
      if (response.success && response.data) {
        const list = Array.isArray(response.data)
          ? response.data
          : response.data.sources || response.data.list || []
        setSources(list.map(normalizeSource))
      } else {
        setSources([])
        setSourceError(response.message || '订阅接口尚未接入')
      }
    } catch (error) {
      console.error('[Subscriptions] 获取订阅源失败:', error)
      setSources([])
      setSourceError('订阅接口尚未接入')
    } finally {
      setLoadingSources(false)
    }
  }, [sourceKeyword, sourceType, user?.mid])

  useEffect(() => {
    void fetchSources()
  }, [fetchSources])

  const selectedSourceKey = selectedSource
    ? `${selectedSource.type}:${selectedSource.source_id}`
    : ''

  const fetchSourceVideos = useCallback(async (page: number, pageSize: number) => {
    if (!selectedSource) {
      return { success: true, data: { medias: [], total: 0 } }
    }

    return apiService.getSubscriptionSourceVideos(
      selectedSource.type,
      selectedSource.source_id,
      page,
      pageSize,
      keyword,
      order,
      sortDirection
    )
  }, [keyword, order, selectedSource, sortDirection])

  const listCacheKey = selectedSource
    ? `subscriptions:${selectedSourceKey}:${keyword.trim() || '__all__'}:${order}:${sortDirection}`
    : `subscriptions:root:${sourceType}:${sourceKeyword.trim() || '__all__'}`

  const {
    videos,
    loading: videosLoading,
    loadingMore,
    loadMoreError,
    error: videosError,
    hasMore,
    total,
    loadMoreRef,
    currentPage,
    fetchVideos,
  } = useVideoList({
    fetchFn: fetchSourceVideos,
    pageSize: 10,
    deps: [],
    cacheKey: listCacheKey,
    autoLoad: Boolean(selectedSource),
    formatItem: (video: any) => ({
      id: video.id,
      bvid: video.bvid,
      title: video.title,
      cover: video.cover || video.pic,
      duration: formatDuration(video.duration),
      uploader: video.uploader?.name || video.owner?.name || '未知',
      views: video.view ? formatNumber(video.view) : '0',
      danmaku: video.danmaku ? formatNumber(video.danmaku) : '0',
      comments: video.comment ? formatNumber(video.comment) : '0',
      likes: video.like ? formatNumber(video.like) : '0',
      coins: video.coin ? formatNumber(video.coin) : '0',
      favorites: video.favorite ? formatNumber(video.favorite) : '0',
      shares: video.share ? formatNumber(video.share) : '0',
      time: formatTime(video.pubtime),
      cid: video.cid,
      aid: video.aid,
      pic: video.cover || video.pic,
      originalDuration: video.duration,
      owner: video.uploader || video.owner,
      pubtime: video.pubtime,
    }),
  })

  const handleLoadMore = useCallback(async () => {
    if (hasMore && !loadingMore) {
      await fetchVideos(currentPage + 1, true)
    }
  }, [currentPage, fetchVideos, hasMore, loadingMore])

  useEffect(() => {
    setLoadedCount(videos.length)
    setTotalCount(total)
  }, [total, videos.length])

  const { toggleDownload: baseToggleDownload } = useVideoDownload()

  const toggleDownload = useCallback(async (video: any, e: React.MouseEvent) => {
    try {
      const decision = await videoLibraryService.checkBeforeAdd(video, { forceRefresh: true })
      if (decision.action === 'show_confirm') {
        setAlertModal({
          show: true,
          title: '重新下载视频',
          message: `视频 ${video.title} 已在视频库中，是否重新下载？`,
          type: 'info',
          showConfirm: true,
          onConfirm: async () => {
            await baseToggleDownload(video, e, { forceRedownload: true })
            setAlertModal(prev => ({ ...prev, show: false }))
          },
        })
        return
      }

      if (decision.action === 'skip') {
        setAlertModal({
          show: true,
          title: '提示',
          message: `视频 ${video.title} 已下载，已在视频库中`,
          type: 'success',
        })
        return
      }

      const result = await baseToggleDownload(video, e, { forceRedownload: true })
      if (!result.success) {
        setAlertModal({
          show: true,
          title: '操作失败',
          message: result.message,
          type: 'error',
        })
      }
    } catch (error) {
      console.error('[Subscriptions] 添加下载失败:', error)
      const result = await baseToggleDownload(video, e)
      if (!result.success) {
        setAlertModal({
          show: true,
          title: '操作失败',
          message: result.message,
          type: 'error',
        })
      }
    }
  }, [baseToggleDownload])

  const filteredSources = useMemo(() => sources, [sources])

  if (!user?.mid) {
    return (
      <section className="content-section" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p className="text-secondary-400 dark:text-secondary-500 text-base">请先登录以查看订阅</p>
      </section>
    )
  }

  return (
    <section
      id="subscriptions-panel"
      role="tabpanel"
      aria-labelledby="subscriptions-tab"
      className="content-section"
    >
      {!selectedSource && (
        <MediaListShell
          topBar={(
            <MediaListTopBar
              title="订阅"
              countLabel={`共${filteredSources.length}个订阅源`}
              filters={(
                <div className="subscription-source-controls">
                  <div className="subscription-source-tabs" role="tablist" aria-label="订阅类型">
                    {[
                      { value: 'ugc_season', label: '合集/系列' },
                      { value: 'favorite_folder', label: '订阅收藏夹' },
                      { value: 'all', label: '全部' },
                    ].map(item => (
                      <button
                        key={item.value}
                        type="button"
                        className={`subscription-source-tab ${sourceType === item.value ? 'active' : ''}`}
                        onClick={() => setSourceType(item.value as SubscriptionSourceType)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <input
                    value={sourceKeyword}
                    onChange={(event) => setSourceKeyword(event.target.value)}
                    placeholder="搜索订阅..."
                    className="subscription-source-search"
                  />
                </div>
              )}
            />
          )}
          loading={loadingSources}
          error={sourceError && filteredSources.length === 0 ? sourceError : undefined}
          hasItems={filteredSources.length > 0}
          emptyText="暂无订阅源，后端接口接入后会显示订阅的收藏夹和合集"
          contentClassName="media-list-shell-content"
        >
          <div className="fav-folder-list subscription-source-list" role="list" aria-label="订阅源列表">
            {filteredSources.map(source => (
              <article
                key={source.id}
                className="fav-folder-item subscription-source-item"
                onClick={() => {
                  setSelectedSource(source)
                  navigate(`/subscriptions/${source.type}/${source.source_id}`, { replace: true })
                }}
                role="listitem"
                tabIndex={0}
              >
                <div className="fav-folder-cover">
                  <div className="fav-folder-thumbnail subscription-source-thumbnail">
                    {source.cover ? (
                      <img src={getAvatarProxyUrl(source.cover)} alt={source.title} className="w-full h-full object-cover" />
                    ) : source.type === 'favorite_folder' ? (
                      <FolderHeart />
                    ) : (
                      <ListVideo />
                    )}
                  </div>
                </div>
                <div className="fav-folder-info">
                  <h3>{source.title}</h3>
                  <div className="fav-folder-meta">
                    <span className="fav-folder-status public">{sourceTypeLabel(source.type)}</span>
                    <span className="fav-folder-count">{source.media_count || 0}个视频</span>
                    {source.upper?.name && <span className="fav-folder-count">{source.upper.name}</span>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </MediaListShell>
      )}

      {selectedSource && (
        <MediaListShell
          topBar={(
            <MediaListTopBar
              title={(
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    className="back-btn"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedSource(null)
                      navigate('/subscriptions', { replace: true })
                    }}
                    aria-label="返回订阅源列表"
                  >
                    <ArrowLeft />
                  </button>
                  <span>{selectedSource.title}</span>
                </div>
              )}
              countLabel={`共${selectedSource.media_count || totalCount}条视频`}
              secondaryActions={(
                <span className="fav-folder-status public">{sourceTypeLabel(selectedSource.type)}</span>
              )}
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
                    { value: 'favorite', label: '按收藏时间' },
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
          refreshingHint={videosLoading && videos.length > 0 ? '正在刷新订阅视频...' : undefined}
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
            cardClickable
          />
        </MediaListShell>
      )}

      <AlertModal
        isOpen={alertModal.show}
        onClose={() => setAlertModal({ show: false, title: '', message: '', type: 'success', showConfirm: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        showConfirm={alertModal.showConfirm}
        onConfirm={alertModal.onConfirm}
      />
    </section>
  )
}
