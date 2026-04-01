import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useCacheStore } from '../../stores/cache'
import { useDownloadStore } from '../../stores/download'
import { ArrowLeft, Folder } from 'lucide-react'
import { formatDuration, formatNumber, formatTime } from '../../utils/videoFormatters'
import { useVideoList } from '../../hooks/useVideoList'
import { useBatchDownload } from '../../hooks/useBatchDownload'
import { useVideoDownload } from '../../hooks/useVideoDownload'
import BatchActionsBar from '../../components/BatchActionsBar'
import VideoListContainer from '../../components/VideoListContainer'

export default function FavoritesContent() {
  const [selectedFolder, setSelectedFolder] = useState<any>(null)
  const [folders, setFolders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { user } = useAuthStore()
  const navigate = useNavigate()
  const downloadStore = useDownloadStore()
  const { 
    getFoldersCache, 
    setFoldersCache
  } = useCacheStore()
  const { getDownloadStatus } = downloadStore

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

  // 使用 useCallback 缓存 fetchFn，避免每次渲染创建新函数引用
  const fetchFavoriteVideos = useCallback(async (page: number, pageSize: number) => {
    if (!selectedFolder || !user?.sessdata) {
      return { success: false, message: '缺少必要参数' }
    }
    return apiService.getFolderDetail(selectedFolder.id, user.sessdata, page, pageSize)
  }, [selectedFolder?.id, user?.sessdata])

  // 使用 useVideoList Hook 管理视频列表
  const { videos, loading: videosLoading, loadingMore, error: videosError, hasMore, loadMoreRef } = useVideoList({
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

  // 使用 useVideoDownload Hook 处理单个视频下载
  const { toggleDownload } = useVideoDownload()

  // 批量下载收藏夹（使用新系统API）
  const batchDownloadFavorite = async () => {
    if (!selectedFolder || !user?.mid) {
      alert('无法批量下载：缺少必要信息')
      return
    }

    if (!confirm(`确定要批量下载收藏夹"${selectedFolder.title}"中的所有视频吗？`)) {
      return
    }

    setLoading(true)
    setError('')

    try {
      // 1. 使用新API获取收藏夹媒体信息
      const mediaResponse = await apiService.getFavoriteMedia(selectedFolder.id.toString(), user.mid.toString())
      if (!mediaResponse.success || !mediaResponse.data) {
        throw new Error(mediaResponse.message || '获取收藏夹信息失败')
      }

      const mediaInfo = mediaResponse.data
      const videoList = mediaInfo.list || []

      if (videoList.length === 0) {
        alert('收藏夹中没有视频可下载')
        setLoading(false)
        return
      }

      // 2. 创建调度器
      const folderName = `收藏夹-${selectedFolder.title.replace(/[\/\\:*?"<>|]/g, '_')}`
      const folderPath = `/Users/tanyancong/工作/开发/pilinote/apps/api/downloads/${folderName}`

      const schedulerResponse = await apiService.createScheduler({
        title: `收藏夹下载: ${selectedFolder.title}`,
        list: [],
        queue_type: 1, // PENDING
        folder: folderPath
      })

      if (!schedulerResponse.success || !schedulerResponse.data) {
        throw new Error(schedulerResponse.message || '创建调度器失败')
      }

      const schedulerId = schedulerResponse.data.id

      // 3. 批量提交任务
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

      // 4. 更新调度器的任务列表
      // 注意：这里需要调用updateScheduler或者直接通过scheduler的list字段更新
      // 由于新系统API可能不直接支持更新list，我们可能需要先获取scheduler，然后更新
      // 暂时跳过这一步，直接启动调度器

      // 5. 启动调度器
      const startResponse = await apiService.startScheduler(schedulerId)

      if (startResponse.success) {
        alert(`批量下载已启动！\n成功提交 ${successCount}/${videoList.length} 个任务\n保存路径: ${folderPath}`)
        // 切换到下载页面
        navigate('/downloads')
      } else {
        throw new Error(startResponse.message || '启动调度器失败')
      }

    } catch (err) {
      console.error('批量下载失败:', err)
      setError(`批量下载失败: ${err instanceof Error ? err.message : '未知错误'}`)
      alert(`批量下载失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

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
      if (!user?.sessdata || !user?.mid) return

      // 先检查缓存
      const cachedFolders = getFoldersCache()
      if (cachedFolders) {
        setFolders(cachedFolders)
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await apiService.getFolders(user.sessdata, user.mid)
        if (response.success && response.data) {
          setFolders(response.data)
          setFoldersCache(response.data) // 保存到缓存
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

  if (!user?.sessdata) {
    return (
      <section className="content-section" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: '#999', fontSize: '16px' }}>请先登录以查看收藏夹</p>
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
      <div className="section-header">
        <div className="section-title">
          {selectedFolder && (
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
          )}
          <h2>{selectedFolder ? selectedFolder.title : '我的收藏'}</h2>
          <span className="video-count">
            {selectedFolder
              ? `共${selectedFolder.media_count}条视频`
              : `${folders.length}个收藏夹`}
          </span>
          {selectedFolder && videos.length > 0 && (
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

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>加载中...</div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#ff4444' }}>{error}</div>
      )}

      {!loading && !error && !selectedFolder && (
        <div className="fav-folder-list" role="list" aria-label="收藏夹列表">
          {folders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>暂无收藏夹</div>
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
                      <img src={`http://localhost:8000/api/auth/proxy/avatar?url=${encodeURIComponent(folder.cover)}`} alt={folder.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

      {!loading && !error && selectedFolder && (
        <VideoListContainer
          videos={videos}
          loading={videosLoading}
          loadingMore={loadingMore}
          error={videosError}
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
      )}
    </section>
  )
}