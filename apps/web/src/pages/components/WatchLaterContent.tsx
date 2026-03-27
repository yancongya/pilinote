import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'

export default function WatchLaterContent() {
  const [downloadList, setDownloadList] = useState<any[]>([])
  const [videos, setVideos] = useState<any[]>([])
  const [allVideos, setAllVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'unwatched'>('all')
  const [totalCount, setTotalCount] = useState(0)
  const [unwatchedCount, setUnwatchedCount] = useState(0)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  
  const { user } = useAuthStore()
  const navigate = useNavigate()

  // 格式化时长（秒转为 MM:SS）
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 格式化观看进度
  const formatProgress = (progress: number, duration: number): string => {
    if (progress === -1) return '未观看'
    const watched = Math.floor(progress / 1000)
    return formatDuration(watched)
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
    // 处理时间戳为0或无效的情况
    if (!timestamp || timestamp <= 0) {
      return '未知时间'
    }
    
    const date = new Date(timestamp * 1000)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  // 获取代理图片URL
  const getProxyImageUrl = (url: string | null | undefined): string => {
    if (!url) return ''
    // 使用后端代理API
    return `http://localhost:8000/api/auth/proxy/avatar?url=${encodeURIComponent(url)}`
  }

  // 获取稍后再看列表
  const fetchVideos = useCallback(async (page: number = 1, isLoadMore: boolean = false, pageSize: number = 10) => {
    if (!user?.sessdata) return
    
    // 只在第一次加载时获取所有数据
    if (allVideos.length === 0) {
      setLoading(true)
      setError('')
      
      try {
        const response = await apiService.getWatchLaterList(user.sessdata, 1, 100)
        if (response.success && response.data) {
          const videoList = response.data.list || []
          
          // 格式化视频数据
          const formattedVideos = videoList.map((video: any) => ({
            id: video.id,
            bvid: video.bvid,
            title: video.title,
            cover: video.cover,
            duration: formatDuration(video.duration),
            durationSeconds: video.duration,
            watched: formatProgress(video.progress, video.duration),
            uploader: video.uploader?.name || '未知',
            views: formatNumber(video.view),
            comments: video.comment,
            time: formatTime(video.add_time), // 显示添加时间而不是发布时间
            progress: video.progress,
            addTime: formatTime(video.add_time)
          }))
          
          // 更新统计数据
          const total = formattedVideos.length
          const unwatched = formattedVideos.filter((v: any) => v.progress !== -1 && v.progress < v.durationSeconds * 1000).length
          setTotalCount(total)
          setUnwatchedCount(unwatched)
          setAllVideos(formattedVideos)
        } else {
          setError(response.message || '获取稍后再看列表失败')
        }
      } catch (err) {
        setError('网络请求失败')
      } finally {
        setLoading(false)
      }
    } else if (isLoadMore) {
      setLoadingMore(true)
    }
    
    // 根据当前tab过滤视频
    const filteredVideos = activeTab === 'unwatched' 
      ? allVideos.filter((video: any) => video.progress !== -1 && video.progress < video.durationSeconds * 1000)
      : allVideos
    
    const totalFiltered = filteredVideos.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedVideos = filteredVideos.slice(startIndex, endIndex)
    
    if (isLoadMore) {
      setVideos(prev => {
        const newLength = prev.length + paginatedVideos.length
        setHasMore(newLength < totalFiltered)
        setLoadingMore(false)
        return [...prev, ...paginatedVideos]
      })
    } else {
      setVideos(paginatedVideos)
      setHasMore(paginatedVideos.length < totalFiltered)
    }
  }, [user, activeTab, allVideos])

  // 初始加载
  useEffect(() => {
    if (user?.sessdata) {
      // 检测是否是移动端
      const isMobile = window.innerWidth < 640
      const initialPageSize = isMobile ? 5 : 10
      fetchVideos(1, false, initialPageSize)
      setCurrentPage(1)
    }
  }, [user, fetchVideos])

  // 当tab切换时重新加载
  useEffect(() => {
    if (user?.sessdata && allVideos.length > 0) {
      setVideos([])
      setCurrentPage(1)
      setHasMore(true)
      const isMobile = window.innerWidth < 640
      const pageSize = isMobile ? 5 : 10
      fetchVideos(1, false, pageSize)
    }
  }, [activeTab, user, allVideos])

  // 使用Intersection Observer实现无限滚动
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0]
        if (target.isIntersecting && !loading && !loadingMore && hasMore) {
          const nextPage = currentPage + 1
          const isMobile = window.innerWidth < 640
          const pageSize = isMobile ? 5 : 10
          fetchVideos(nextPage, true, pageSize)
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
  }, [currentPage, loading, loadingMore, hasMore, fetchVideos])

  const isAddedToDownload = (videoId: number) => {
    return downloadList.some(item => item.id === videoId)
  }

  const toggleDownload = (video: any, e: React.MouseEvent) => {
    e.stopPropagation()
    if (isAddedToDownload(video.id)) {
      setDownloadList(downloadList.filter(item => item.id !== video.id))
    } else {
      setDownloadList([...downloadList, video])
    }
  }

  const handleVideoClick = (video: any) => {
    navigate(`/video/${video.bvid || video.id}`)
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
      id="watch-later-panel"
      role="tabpanel"
      aria-labelledby="watch-later-tab"
      className="content-section"
    >
      <div className="section-header has-tabs">
        <div className="watch-later-tabs">
          <button
            className={`watch-later-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            全部 ({totalCount})
          </button>
          <button
            className={`watch-later-tab ${activeTab === 'unwatched' ? 'active' : ''}`}
            onClick={() => setActiveTab('unwatched')}
          >
            未看完 ({unwatchedCount})
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>加载中...</div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#ff4444' }}>{error}</div>
      )}

      {!loading && !error && videos.length > 0 ? (
        <div className="fav-video-list" role="list" aria-label="稍后再看列表">
          {videos.map(video => (
            <article 
              key={video.id} 
              className="fav-video-item" 
              role="listitem"
              onClick={() => handleVideoClick(video)}
              style={{ cursor: 'pointer' }}
            >
              <div className="fav-video-cover">
                <div className="fav-video-thumbnail">
                  {video.cover ? (
                    <img src={getProxyImageUrl(video.cover)} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                      <line x1="7" y1="2" x2="7" y2="22"/>
                      <line x1="17" y1="2" x2="17" y2="22"/>
                      <line x1="2" y1="12" x2="22" y2="12"/>
                      <line x1="2" y1="7" x2="7" y2="7"/>
                      <line x1="2" y1="17" x2="7" y2="17"/>
                      <line x1="17" y1="17" x2="22" y2="17"/>
                      <line x1="17" y1="7" x2="22" y2="7"/>
                    </svg>
                  )}
                  <div className="video-duration-overlay">{video.duration}</div>
                  {video.progress !== -1 && (
                    <div className="video-progress-overlay" style={{ bottom: '0', left: '0', width: `${video.progress}%` }}>
                      <div style={{ width: '100%', height: '2px', background: 'rgba(59, 130, 246, 0.7)' }}></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="fav-video-info">
                <h3>{video.title}</h3>
                <div className="fav-video-meta">
                  <span className="fav-video-uploader">{video.uploader}</span>
                  <span className="fav-video-time">{video.time}</span>
                </div>
                <div className="fav-video-stats">
                  <span className="stat-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    {video.views}
                  </span>
                  <span className="stat-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8.9L12 2.5a8.38 8.38 0 0 1 3.8.9 8.5 8.5 0 0 1 4.7 7.6z"/>
                    </svg>
                    {video.comments}
                  </span>
                </div>
              </div>
              <button
                className="fav-video-download-btn"
                onClick={(e) => toggleDownload(video, e)}
                aria-label={isAddedToDownload(video.id) ? '从下载列表移除' : '添加到下载列表'}
                title={isAddedToDownload(video.id) ? '已添加' : '添加到下载'}
              >
                <svg viewBox="0 0 24 24" fill={isAddedToDownload(video.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            </article>
          ))}
          {loadingMore && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>加载中...</div>
          )}
          {!hasMore && videos.length > 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>没有更多视频了</div>
          )}
          {/* 用于Intersection Observer的触发元素 */}
          {hasMore && <div ref={loadMoreRef} style={{ height: '1px', visibility: 'hidden' }} />}
        </div>
      ) : (
        !loading && !error && (
          <div className="empty-state">
            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <p className="empty-text">暂无稍后再看视频</p>
          </div>
        )
      )}
    </section>
  )
}