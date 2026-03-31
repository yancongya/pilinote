import { useState, useEffect, useCallback, useRef } from 'react'
import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useDownloadStore } from '../../stores/download'
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

// 格式化进度（秒转为百分比）
const formatProgress = (progress: number, duration: number): string => {
  if (progress === -1 || duration === 0) return '未观看'
  const percent = Math.floor((progress / duration) * 100)
  return `${percent}%`
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

export default function WatchLaterContent() {
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  
  const { user } = useAuthStore()
  const downloadStore = useDownloadStore()
  const { 
    getDownloadStatus,
    addToDownloadList, 
    removeFromDownloadListByBvid,
    syncFromServer 
  } = downloadStore

  // 获取稍后再看列表（移除缓存，支持分页）
  const fetchVideos = useCallback(async (page: number = 1, isLoadMore: boolean = false, pageSize: number = 20) => {
    if (!user?.sessdata) return
    
    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    setError('')
    
    try {
      const response = await apiService.getWatchLaterList(user.sessdata, page, pageSize)
      if (response.success && response.data) {
        const videoList = response.data.list || []
        const total = response.data.total || 0
        
        // 格式化视频数据
        const formattedVideos = videoList.map((video: any) => ({
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
        }))
        
        setTotalCount(total)
        
        if (isLoadMore) {
          setVideos(prev => {
            const currentLength = prev.length + formattedVideos.length
            setHasMore(currentLength < total)
            return [...prev, ...formattedVideos]
          })
        } else {
          setVideos(formattedVideos)
          setHasMore(formattedVideos.length < total)
        }
      } else {
        setError(response.message || '获取稍后再看列表失败')
      }
    } catch (err) {
      setError('网络请求失败')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [user])

  // 初始加载
  useEffect(() => {
    fetchVideos(1, false, 20)
    setCurrentPage(1)
  }, [user, fetchVideos])

  // 使用Intersection Observer实现无限滚动
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0]
        if (target.isIntersecting && !loading && !loadingMore && hasMore) {
          const nextPage = currentPage + 1
          fetchVideos(nextPage, true, 20)
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
            const videoDetailData = videoDetailResponse.data
            
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
                  aid: videoDetailData.aid || video.aid,
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
              // 单P视频，使用视频详情API返回的数据
              const downloadData = {
                bvid: video.bvid,
                title: video.title,
                cid: videoDetailData.cid || pages[0]?.cid,
                aid: videoDetailData.aid || video.aid,
                quality: 64,
                output_format: 'mp4',
                thumbnail_url: video.pic,
                duration: video.originalDuration || videoDetailData.duration || pages[0]?.duration,
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
              cid: video.cid || video.id,
              aid: video.aid || video.id,
              quality: 64,
              output_format: 'mp4',
              thumbnail_url: video.pic,
              duration: video.originalDuration || video.durationSeconds,
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
            cid: video.cid || video.id,
            aid: video.aid || video.id,
            quality: 64,
            output_format: 'mp4',
            thumbnail_url: video.pic,
            duration: video.originalDuration || video.durationSeconds,
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
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>加载中...</div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#ff4444' }}>{error}</div>
      )}

      {!loading && !error && (
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