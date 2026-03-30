import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useCacheStore } from '../../stores/cache'
import { useDownloadStore } from '../../stores/download'
import { ArrowLeft, Folder } from 'lucide-react'
import VideoListCard from './VideoListCard'

// 格式化时长（秒转为 MM:SS）
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 格式化数字（播放量、评论数）
const formatNumber = (num: number): string => {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`
  }
  return num.toString()
}

// 格式化时间戳为具体日期时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

export default function FavoritesContent() {
  const [selectedFolder, setSelectedFolder] = useState<any>(null)
  const [folders, setFolders] = useState<any[]>([])
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const downloadStore = useDownloadStore()
  const { 
    getFoldersCache, 
    setFoldersCache, 
    getFolderVideosCache, 
    setFolderVideosCache 
  } = useCacheStore()
  const { 
    getDownloadStatus,
    addToDownloadList, 
    removeFromDownloadListByBvid,
    syncFromServer 
  } = downloadStore

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
  }, [folders])

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

  // 获取收藏夹详情（视频列表，带缓存）
  const fetchVideos = useCallback(async (page: number = 1, isLoadMore: boolean = false, pageSize: number = 10) => {
    if (!selectedFolder || !user?.sessdata) return
    
    // 第一页且不是加载更多时，检查缓存
    if (page === 1 && !isLoadMore) {
      const cachedVideos = getFolderVideosCache(selectedFolder.id)
      if (cachedVideos) {
        // 确保缓存中的视频对象包含所有必需字段
        const validatedVideos = cachedVideos.map(video => ({
          ...video,
          comments: video.comments || '0' // 确保评论字段存在
        }))
        setVideos(validatedVideos)
        setHasMore(false) // 缓存的数据假设是完整的
        return
      }
    }
    
    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    setError('')
    
    try {
      const response = await apiService.getFolderDetail(selectedFolder.id, user.sessdata, page, pageSize)
      if (response.success && response.data) {
        const medias = response.data.medias || []
        // 格式化视频数据
        const formattedVideos = medias.map((video: any) => ({
          id: video.id,
          bvid: video.bvid,
          title: video.title,
          cover: video.cover,
          duration: formatDuration(video.duration),
          uploader: video.uploader?.name || '未知',
          views: formatNumber(video.view),
          comments: video.comment ? formatNumber(video.comment) : '0',
          time: formatTime(video.pubtime),
          // 保留原始数据用于下载
          cid: video.cid,
          aid: video.aid,
          pic: video.cover,
          originalDuration: video.duration,
          owner: video.uploader,
          pubtime: video.pubtime
        }))
        
        if (isLoadMore) {
          setVideos(prev => {
            const pageSize = response.data.page_size || 10
            setHasMore(formattedVideos.length === pageSize)
            return [...prev, ...formattedVideos]
          })
        } else {
          setVideos(formattedVideos)
          const pageSize = response.data.page_size || 10
          setHasMore(formattedVideos.length === pageSize)
          // 保存第一页数据到缓存
          if (page === 1) {
            setFolderVideosCache(selectedFolder.id, formattedVideos)
          }
        }
      } else {
        setError(response.message || '获取视频列表失败')
      }
    } catch (err) {
      setError('网络请求失败')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [selectedFolder, user, getFolderVideosCache, setFolderVideosCache])

  // 当选中的收藏夹改变时，重新加载视频列表
  useEffect(() => {
    if (selectedFolder) {
      fetchVideos(1, false, 10)
      setCurrentPage(1)
    }
  }, [selectedFolder, fetchVideos])

  // 使用Intersection Observer实现无限滚动
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading || loadingMore || !selectedFolder) return

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0]
        if (target.isIntersecting && !loading && !loadingMore && hasMore) {
          const nextPage = currentPage + 1
          fetchVideos(nextPage, true, 10)
          setCurrentPage(nextPage)
        }
      },
      {
        rootMargin: '100px',
        threshold: 0.1
      }
    )

    observer.observe(loadMoreRef.current)
    observerRef.current = observer

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [currentPage, loading, loadingMore, hasMore, selectedFolder, fetchVideos])

  // 同步下载列表
  useEffect(() => {
    // 初始同步
    syncFromServer()
    
    // 每30秒同步一次
    const interval = setInterval(() => {
      syncFromServer()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [syncFromServer])

  const toggleDownload = async (video: any, e: React.MouseEvent) => {
    e.stopPropagation()
    
    const currentStatus = getDownloadStatus(video.bvid)
    
    // 防止重复点击
    const button = e.currentTarget as HTMLButtonElement
    if (button.disabled) return
    button.disabled = true
    
    try {
      if (currentStatus === 'in_list') {
        // 从下载列表移除
        const success = await removeFromDownloadListByBvid(video.bvid)
        if (!success) {
          alert('从下载列表移除失败')
        }
      } else {
        const sessdata = localStorage.getItem('sessdata')
        
        // 先获取视频详情，检查是否是多P视频
        try {
          const videoDetailResponse = await apiService.getVideoDetail(video.bvid, sessdata || undefined)
          
          if (videoDetailResponse.success && videoDetailResponse.data?.pages) {
            const pages = videoDetailResponse.data.pages
            
            if (pages.length > 1) {
              // 多P视频，添加所有分集
              let addedCount = 0
              let skippedCount = 0
              
              const addPromises = pages.map(async (page: any) => {
                // 检查是否已经有相同的cid在下载列表中
                if (downloadStore.isCidInDownloadList(video.bvid, page.cid)) {
                  skippedCount++
                  return { success: false, skipped: true }
                }
                
                const downloadData = {
                  bvid: video.bvid,
                  title: page.part || `${video.title} - P${page.page}`,
                  cid: page.cid,
                  aid: video.aid,
                  quality: 64,
                  output_format: 'mp4',
                  thumbnail_url: video.pic,
                  duration: page.duration,
                  uploader: video.owner?.name || '',
                  uploader_mid: video.owner?.mid || 0,
                  sessdata: sessdata || undefined
                }
                
                return apiService.addToDownloadQueue(downloadData)
              })
              
              const results = await Promise.all(addPromises)
              
              addedCount = results.filter(r => r.success).length
              
              if (skippedCount > 0) {
                alert(`已添加 ${addedCount} 个分集到下载队列，跳过 ${skippedCount} 个已存在的分集`)
              } else {
                alert(`已添加 ${addedCount} 个分集到下载队列`)
              }
            } else {
              // 单P视频，直接添加
              const downloadData = {
                bvid: video.bvid,
                title: video.title,
                cid: video.cid,
                aid: video.aid,
                quality: 64,
                output_format: 'mp4',
                thumbnail_url: video.pic,
                duration: video.originalDuration,
                uploader: video.owner?.name || '',
                uploader_mid: video.owner?.mid || 0,
                sessdata: sessdata || undefined
              }
              
              const success = await addToDownloadList(downloadData)
              if (!success) {
                alert('添加到下载列表失败')
              }
            }
          } else {
            // 获取视频详情失败，降级为直接添加
            const downloadData = {
              bvid: video.bvid,
              title: video.title,
              cid: video.cid,
              aid: video.aid,
              quality: 64,
              output_format: 'mp4',
              thumbnail_url: video.pic,
              duration: video.originalDuration,
              uploader: video.owner?.name || '',
              uploader_mid: video.owner?.mid || 0,
              sessdata: sessdata || undefined
            }
            
            const success = await addToDownloadList(downloadData)
            if (!success) {
              alert('添加到下载列表失败')
            }
          }
        } catch (error) {
          // 获取视频详情失败，降级为直接添加
          console.error('获取视频详情失败，降级为直接添加:', error)
          
          const downloadData = {
            bvid: video.bvid,
            title: video.title,
            cid: video.cid,
            aid: video.aid,
            quality: 64,
            output_format: 'mp4',
            thumbnail_url: video.pic,
            duration: video.originalDuration,
            uploader: video.owner?.name || '',
            uploader_mid: video.owner?.mid || 0,
            sessdata: sessdata || undefined
          }
          
          const success = await addToDownloadList(downloadData)
          if (!success) {
            alert('添加到下载列表失败')
          }
        }
      }
    } finally {
      // 恢复按钮状态
      button.disabled = false
    }
  }

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
        <div
          className={`section-title ${selectedFolder ? 'cursor-pointer' : ''}`}
          onClick={handleBackToFolders}
        >
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
        <div className="video-list" role="list" aria-label="视频列表">
          {videos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>暂无视频</div>
          ) : (
            <>
              {videos.map(video => (
                <VideoListCard
                  key={video.id}
                  {...video}
                  onDownloadToggle={toggleDownload}
                  downloadStatus={getDownloadStatus(video.bvid)}
                />
              ))}
              {loadingMore && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>加载中...</div>
              )}
              {!hasMore && videos.length > 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>没有更多视频了</div>
              )}
              {hasMore && <div ref={loadMoreRef} style={{ height: '1px', visibility: 'hidden' }} />}
            </>
          )}
        </div>
      )}
    </section>
  )
}