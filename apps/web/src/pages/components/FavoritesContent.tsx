import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'

export default function FavoritesContent() {
  const [selectedFolder, setSelectedFolder] = useState<any>(null)
  const [downloadList, setDownloadList] = useState<any[]>([])
  const [folders, setFolders] = useState<any[]>([])
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  
  const { user } = useAuthStore()
  const navigate = useNavigate()

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

  // 获取代理图片URL
  const getProxyImageUrl = (url: string | null | undefined): string => {
    if (!url) return ''
    // 使用后端代理API
    return `http://localhost:8000/api/auth/proxy/avatar?url=${encodeURIComponent(url)}`
  }

  // 获取收藏夹列表
  useEffect(() => {
    const fetchFolders = async () => {
      if (!user?.sessdata || !user?.mid) return
      
      setLoading(true)
      setError('')
      
      try {
        console.log('开始获取收藏夹列表...', { sessdata: user.sessdata, mid: user.mid })
        const response = await apiService.getFolders(user.sessdata, user.mid)
        console.log('API响应:', response)
        if (response.success && response.data) {
          console.log('设置收藏夹数据:', response.data)
          setFolders(response.data)
        } else {
          console.error('API调用失败:', response)
          setError(response.message || '获取收藏夹列表失败')
        }
      } catch (err) {
        console.error('网络请求异常:', err)
        setError('网络请求失败')
      } finally {
        setLoading(false)
      }
    }

    fetchFolders()
  }, [user])

  // 获取收藏夹详情（视频列表）
  const fetchVideos = useCallback(async (page: number = 1, isLoadMore: boolean = false, pageSize: number = 10) => {
    if (!selectedFolder || !user?.sessdata) return
    
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
          comments: video.comment,
          time: formatTime(video.pubtime)
        }))
        
        if (isLoadMore) {
          setVideos(prev => {
            const newLength = prev.length + formattedVideos.length
            const total = response.data.total || 0
            setHasMore(newLength < total)
            return [...prev, ...formattedVideos]
          })
        } else {
          setVideos(formattedVideos)
          const total = response.data.total || 0
          setHasMore(formattedVideos.length < total)
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
  }, [selectedFolder, user])

  // 当选中的收藏夹改变时，重新加载视频列表
  useEffect(() => {
    if (selectedFolder) {
      // 检测是否是移动端
      const isMobile = window.innerWidth < 640
      const initialPageSize = isMobile ? 5 : 10
      fetchVideos(1, false, initialPageSize)
      setCurrentPage(1)
    }
  }, [selectedFolder, fetchVideos])

  // 无限滚动加载更多
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      
      // 当滚动到距离底部100px时加载更多
      if (scrollTop + windowHeight >= documentHeight - 100 && !loading && !loadingMore && hasMore && selectedFolder) {
        const nextPage = currentPage + 1
        // 检测是否是移动端
        const isMobile = window.innerWidth < 640
        const pageSize = isMobile ? 5 : 10
        fetchVideos(nextPage, true, pageSize)
        setCurrentPage(nextPage)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [currentPage, loading, loadingMore, hasMore, selectedFolder, fetchVideos])

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
    // 暂时使用video.id作为bvid，后续需要从后端获取真实的bvid
    navigate(`/video/${video.bvid || video.id}`)
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
          onClick={() => selectedFolder && setSelectedFolder(null)}
        >
          {selectedFolder && (
            <button
              className="back-btn"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedFolder(null)
              }}
              aria-label="返回收藏夹列表"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5"/>
                <path d="M12 19l-7-7 7-7"/>
              </svg>
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
                onClick={() => setSelectedFolder(folder)}
                role="listitem"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedFolder(folder)
                  }
                }}
              >
                <div className="fav-folder-cover">
                  <div className="fav-folder-thumbnail">
                    {folder.cover ? (
                      <img src={getProxyImageUrl(folder.cover)} alt={folder.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      </svg>
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
        <div className="fav-video-list" role="list" aria-label="视频列表">
          {videos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>暂无视频</div>
          ) : (
            <>
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
              {!loadingMore && hasMore && videos.length > 0 && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <button 
                    onClick={() => {
                      const nextPage = currentPage + 1
                      const isMobile = window.innerWidth < 640
                      const pageSize = isMobile ? 5 : 10
                      fetchVideos(nextPage, true, pageSize)
                      setCurrentPage(nextPage)
                    }}
                    style={{
                      padding: '10px 20px',
                      background: '#3B82F6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    加载更多
                  </button>
                </div>
              )}
              {!hasMore && videos.length > 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>没有更多视频了</div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}