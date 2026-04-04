import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiService } from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useSettingsStore } from '../stores/settings'
import { useNewQueueStore } from '../stores/newQueue'
import { useVideoDownload } from '../hooks/useVideoDownload'
import AlertModal from '../components/AlertModal'
import { ArrowLeft, Film, User } from 'lucide-react'

export default function VideoDetailPage() {
  const { videoId } = useParams<{ videoId: string }>()
  const navigate = useNavigate()
  const newQueueStore = useNewQueueStore()
  const settingsStore = useSettingsStore()
  const { toggleDownload } = useVideoDownload(true)
  const [video, setVideo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [downloading, setDownloading] = useState(false)
  const [downloadedCids, setDownloadedCids] = useState<Set<number>>(new Set())
  const [alertModal, setAlertModal] = useState<{
    show: boolean
    title: string
    message: string
    type: 'success' | 'error'
  }>({
    show: false,
    title: '',
    message: '',
    type: 'success'
  })
  const { user } = useAuthStore()
  const sessdata = user?.sessdata
  const { settings } = settingsStore

  // 获取代理图片URL
  const getProxyImageUrl = (url: string | null | undefined): string => {
    if (!url) return ''
    return `http://localhost:8000/api/auth/proxy/avatar?url=${encodeURIComponent(url)}`
  }

  useEffect(() => {
    async function fetchVideoDetail() {
      if (!videoId) return
      
      setLoading(true)
      setError('')
      
      try {
        const response = await apiService.getVideoDetail(videoId, sessdata || undefined)
        
        if (response.success && response.data) {
          const data = response.data
          setVideo({
            bvid: data.bvid,
            aid: data.aid,
            title: data.title,
            description: data.desc,
            uploader: {
              name: data.owner.name,
              avatar: data.owner.face,
              mid: data.owner.mid
            },
            view: data.stat.view,
            danmaku: data.stat.danmaku,
            reply: data.stat.reply,
            favorite: data.stat.favorite,
            coin: data.stat.coin,
            share: data.stat.share,
            like: data.stat.like,
            pubtime: data.pubdate,
            duration: data.duration,
            cover: data.pic,
            cid: data.cid,
            pages: data.pages || [],
            dimension: data.dimension || null,
            rights: data.rights || {},
            descV2: data.descV2 || [],
            staff: data.staff || null,
            ugcSeason: data.ugcSeason || null
          })
        } else {
          setError(response.message || '获取视频详情失败')
        }
      } catch (err) {
        setError('网络请求失败')
      } finally {
        setLoading(false)
      }
    }

    fetchVideoDetail()
  }, [videoId, sessdata])

  // 同步任务数据
  useEffect(() => {
    const syncData = async () => {
      try {
        await newQueueStore.fetchTasks()
        await newQueueStore.fetchSchedulers()
      } catch (error) {
        console.error('[VideoDetail] 同步数据失败:', error)
      }
    }
    syncData()
  }, [])

  // 检查哪些分P已经在下载列表中
  useEffect(() => {
    if (!video || !video.pages) return
    
    const cidsInList = new Set<number>()
    const tasks = newQueueStore.tasks
    const newSystemTasks = Object.values(tasks)
    
    video.pages.forEach((page: any) => {
      const hasInNewQueue = newSystemTasks.some(task =>
        task.media_id === video.bvid &&
        task.meta?.cid === page.cid &&
        !['completed', 'cancelled'].includes(task.state)
      )
      if (hasInNewQueue) {
        cidsInList.add(page.cid)
      }
    })
    setDownloadedCids(cidsInList)
  }, [video, newQueueStore.tasks])

  const formatNumber = (num: number): string => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`
    }
    return num.toString()
  }

  const formatTime = (timestamp: number | string): string => {
    if (!timestamp) return ''

    try {
      let date: Date

      // 如果是字符串（如 "2026-03-28"），直接解析
      if (typeof timestamp === 'string') {
        date = new Date(timestamp)
      } else {
        // 如果是数字（时间戳），转换为毫秒
        if (timestamp === 0) return ''
        date = new Date(timestamp * 1000)
      }

      // 检查日期是否有效
      if (isNaN(date.getTime())) return ''

      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')

      // 如果只有日期没有时间，只返回日期部分
      const hours = date.getHours()
      const minutes = date.getMinutes()

      // 如果是 00:00，可能是只有日期的情况，只返回日期
      if (hours === 0 && minutes === 0) {
        return `${year}-${month}-${day}`
      }

      return `${year}-${month}-${day} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    } catch (error) {
      console.error('格式化时间失败:', error)
      return ''
    }
  }

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '--:--'
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 解析文本中的URL并转换为可点击的链接
  const parseLinks = (text: string): React.ReactNode => {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = text.split(urlRegex)
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#fb7299',
              textDecoration: 'underline',
              wordBreak: 'break-all'
            }}
          >
            {part}
          </a>
        )
      }
      return part
    })
  }

  // 检查分P是否在下载列表中
  const isCidInDownloadList = (bvid: string, cid: number): boolean => {
    const tasks = newQueueStore.tasks
    const newSystemTasks = Object.values(tasks)
    return newSystemTasks.some(task =>
      task.media_id === bvid &&
      task.meta?.cid === cid &&
      !['completed', 'cancelled'].includes(task.state)
    )
  }

  // 计算已添加的分P数量
  const getAddedCount = () => {
    if (!video) return 0
    
    // 单个视频：检查主 cid
    if (!video.pages || video.pages.length === 0) {
      return isCidInDownloadList(video.bvid, video.cid) ? 1 : 0
    }
    
    // 多P视频：检查每个分P
    let count = 0
    video.pages.forEach((page: any) => {
      if (isCidInDownloadList(video.bvid, page.cid)) {
        count++
      }
    })
    return count
  }

  // 获取按钮文本
  const getButtonText = () => {
    if (downloading) return '操作中...'
    
    const addedCount = getAddedCount()
    
    if (video?.pages && video.pages.length > 1) {
      // 多P视频
      if (addedCount === 0) {
        return `添加全部 ${video.pages.length} 个视频`
      } else if (addedCount < video.pages.length) {
        return `添加剩余 ${video.pages.length - addedCount} 个视频`
      } else {
        return `从列表移除`
      }
    } else {
      // 单个视频
      return addedCount > 0 ? '从列表移除' : '添加到列表'
    }
  }

  // 添加到下载队列
  const handleAddToDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!video) return
    
    setDownloading(true)
    try {
      const result = await toggleDownload(video, e)
      
      if (result.success) {
        setAlertModal({
          show: true,
          title: '操作成功',
          message: result.message,
          type: 'success'
        })
      } else {
        setAlertModal({
          show: true,
          title: '操作失败',
          message: result.message,
          type: 'error'
        })
      }
    } catch (error) {
      console.error('[VideoDetail] 操作失败:', error)
      setAlertModal({
        show: true,
        title: '操作失败',
        message: '操作失败',
        type: 'error'
      })
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: '#999'
      }}>
        加载中...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '16px',
        color: '#999'
      }}>
        <div>{error}</div>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '8px 16px',
            background: '#fb7299',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          返回
        </button>
      </div>
    )
  }

  if (!video) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: '#999'
      }}>
        视频不存在
      </div>
    )
  }

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      minHeight: '100vh',
      background: '#fff',
      paddingBottom: '60px'
    }}>
      {/* 顶部导航 */}
      <div style={{
        position: 'sticky',
        top: 0,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #f0f0f0',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 100
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ArrowLeft />
        </button>
        <h1 style={{
          fontSize: '16px',
          fontWeight: '600',
          color: '#1a1a1a',
          margin: 0,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {video.title}
        </h1>
      </div>

      {/* 视频封面区域 */}
      <div style={{
        position: 'relative',
        width: '100%',
        paddingTop: '56.25%', // 16:9 比例
        background: '#f5f5f5',
        overflow: 'hidden'
      }}>
        {video.cover ? (
          <img 
            src={getProxyImageUrl(video.cover)} 
            alt={video.title}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        ) : (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#999'
          }}>
            <Film />
          </div>
        )}

        {/* 时长标签 */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: '600',
          textAlign: 'right',
          lineHeight: '1.3'
        }}>
          {formatDuration(video.duration)}
        </div>
      </div>

      {/* 视频信息 */}
      <div className="video-detail-content" style={{ padding: '16px', maxWidth: '800px', margin: '0 auto' }}>
        {/* 视频标题 */}
        <h2 className="video-detail-title" style={{
          fontSize: '18px',
          fontWeight: '600',
          margin: '0 0 16px 0',
          lineHeight: '1.4'
        }}>
          <a
            href={`https://www.bilibili.com/video/${video.bvid}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#1a1a1a',
              textDecoration: 'none',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              transition: 'color 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#fb7299'
              e.currentTarget.style.textDecoration = 'underline'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#1a1a1a'
              e.currentTarget.style.textDecoration = 'none'
            }}
          >
            {video.title}
          </a>
        </h2>

        {/* UP主信息 + 统计信息 */}
        <div className="video-detail-uploader" style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '12px',
          paddingBottom: '12px',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <div className="video-detail-avatar" style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#f0f0f0',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {video.uploader.avatar ? (
              <img
                src={getProxyImageUrl(video.uploader.avatar)}
                alt={video.uploader.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <User />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="video-detail-uploader-name" style={{
              fontSize: '15px',
              fontWeight: '600',
              color: '#1a1a1a',
              marginBottom: '2px',
              lineHeight: '1.3'
            }}>
              {video.uploader.name}
            </div>
          </div>

          {/* 统计信息 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginLeft: 'auto',
            textAlign: 'right'
          }}>
            {/* 统计信息 - 第一行 */}
            <div className="video-detail-stats" style={{
              display: 'flex',
              gap: '16px',
              fontSize: '12px',
              color: '#999',
              justifyContent: 'flex-end',
              flexWrap: 'wrap'
            }}>
              <span>{formatNumber(video.view)}播放</span>
              <span>{formatNumber(video.danmaku)}弹幕</span>
              <span>{formatTime(video.pubtime)}</span>
            </div>

            {/* 统计信息 - 第二行 */}
            <div className="video-detail-stats" style={{
              display: 'flex',
              gap: '16px',
              fontSize: '12px',
              color: '#666',
              justifyContent: 'flex-end',
              flexWrap: 'wrap'
            }}>
              <span>❤️ {formatNumber(video.like)}</span>
              <span>🪙 {formatNumber(video.coin)}</span>
              <span>⭐ {formatNumber(video.favorite)}</span>
              <span>💬 {formatNumber(video.reply)}</span>
              <span>🔗 {formatNumber(video.share)}</span>
            </div>
          </div>
        </div>        
                {/* 分P信息 */}
                {video.pages && video.pages.length > 1 && (
                  <div style={{
                    marginBottom: '16px',
                    fontSize: '13px',
                    color: '#666'
                  }}>
                    共{video.pages.length}个视频，总时长：{formatDuration(video.pages.reduce((total: number, p: any) => total + p.duration, 0))}
                  </div>
                )}

        {/* 视频简介 */}
        {(video.description && video.description !== '-' && video.description.trim()) ? (
          <div style={{
            background: '#f9f9f9',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '14px',
            color: '#333',
            lineHeight: '1.6',
            marginBottom: '16px',
            userSelect: 'text',
            WebkitUserSelect: 'text',
            MozUserSelect: 'text',
            msUserSelect: 'text'
          }}>
            {parseLinks(video.description)}
          </div>
        ) : null}

        {/* 下载区域 */}
        <div style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid #f0f0f0'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1a1a1a',
            marginBottom: '12px'
          }}>
            下载选项
          </h3>

          {/* 分P列表（只显示，不可选择） */}
          {video.pages && video.pages.length > 1 && (
            <div style={{
              background: '#f9f9f9',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              {video.pages.map((page: any, index: number) => {
                const isInList = downloadedCids.has(page.cid)
                return (
                  <div
                    key={page.cid || index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px',
                      background: '#fff',
                      borderRadius: '6px',
                      marginBottom: index < video.pages.length - 1 ? '8px' : '0',
                      opacity: isInList ? 0.6 : 1
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: '#333', marginBottom: '4px' }}>
                        P{page.page}: {page.part || `第${page.page}个视频`}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        {formatDuration(page.duration)}
                      </div>
                    </div>
                    {isInList && (
                      <span style={{
                        fontSize: '11px',
                        color: '#fb7299',
                        background: '#fff5f8',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        marginLeft: '8px'
                      }}>
                        已添加
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* 下载按钮 */}
          <button
            onClick={handleAddToDownload}
            disabled={downloading}
            style={{
              width: '100%',
              padding: '14px',
              background: downloading ? '#ccc' : '#fb7299',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: downloading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!downloading) {
                e.currentTarget.style.background = '#ff5c8d'
              }
            }}
            onMouseLeave={(e) => {
              if (!downloading) {
                e.currentTarget.style.background = '#fb7299'
              }
            }}
          >
            {getButtonText()}
          </button>
        </div>

        {/* AlertModal */}
        <AlertModal
          isOpen={alertModal.show}
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal({ ...alertModal, show: false })}
        />
      </div>
    </div>
  )
}