import { useState, useEffect, useCallback } from 'react'
import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useCacheStore } from '../../stores/cache'
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
  const [error, setError] = useState('')
  
  const { user } = useAuthStore()
  const downloadStore = useDownloadStore()
  const { getWatchLaterCache, setWatchLaterCache } = useCacheStore()
  const { 
    getDownloadStatus,
    addToDownloadList, 
    removeFromDownloadListByBvid,
    syncFromServer 
  } = downloadStore

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
          time: formatTime(video.add_time),
          // 保留原始数据用于下载
          cid: video.cid,
          aid: video.aid,
          pic: video.cover,
          originalDuration: video.duration,
          owner: video.uploader,
          pubtime: video.add_time
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
  }, [user, getWatchLaterCache, setWatchLaterCache])

  // 初始加载（每次切换到该tab时都会检查缓存）
  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

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
                downloadStatus={getDownloadStatus(video.bvid)}
              />
            ))
          )}
        </div>
      )}
    </section>
  )
}