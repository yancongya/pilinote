import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useCacheStore } from '../../stores/cache'
import VideoListCard from './VideoListCard'

export default function WatchLaterContent() {
  const [downloadList, setDownloadList] = useState<any[]>([])
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isMounted = useRef(false)
  
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { getWatchLaterCache, setWatchLaterCache } = useCacheStore()

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

  // 获取稍后再看列表（带缓存）
  const fetchVideos = useCallback(async () => {
    if (!user?.sessdata) return
    
    // 先检查缓存
    const cachedVideos = getWatchLaterCache()
    if (cachedVideos) {
      // 确保缓存中的视频对象包含所有必需字段
      const validatedVideos = cachedVideos.map(video => ({
        ...video,
        comments: video.comments || '0' // 确保评论字段存在
      }))
      setVideos(validatedVideos)
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      const response = await apiService.getWatchLaterList(user.sessdata)
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
          progress: video.progress,
          watched: formatProgress(video.progress, video.duration),
          uploader: video.uploader?.name || '未知',
          views: formatNumber(video.view),
          comments: video.comment ? formatNumber(video.comment) : '0',
          time: formatTime(video.add_time)
        }))
        
        setVideos(formattedVideos)
        setWatchLaterCache(formattedVideos) // 保存到缓存
      } else {
        setError(response.message || '获取稍后再看列表失败')
      }
    } catch (err) {
      setError('网络请求失败')
    } finally {
      setLoading(false)
    }
  }, [user, getWatchLaterCache, setWatchLaterCache, formatDuration, formatNumber, formatProgress, formatTime])

  // 初始加载（只执行一次）
  useEffect(() => {
    if (!isMounted.current) {
      fetchVideos()
      isMounted.current = true
    }
  }, [fetchVideos])

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
          <span className="video-count">共{videos.length}个视频</span>
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
            videos.map(video => (
              <VideoListCard
                key={video.id}
                {...video}
                onDownloadToggle={toggleDownload}
                isDownloaded={isAddedToDownload(video.id)}
              />
            ))
          )}
        </div>
      )}
    </section>
  )
}