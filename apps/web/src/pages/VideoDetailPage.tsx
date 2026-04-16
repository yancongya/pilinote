import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiService } from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useNewQueueStore } from '../stores/newQueue'
import { useVideoDownload } from '../hooks/useVideoDownload'
import { videoLibraryService } from '../services/videoLibraryService'
import ReDownloadDialog from '../components/ReDownloadDialog'
import AlertModal from '../components/AlertModal'
import { ArrowLeft, Film, User, ThumbsUp, Star, MessageCircle, MessageSquare, Share2, Coins, Eye } from 'lucide-react'
import { getAvatarProxyUrl } from '../config/api'

interface VideoDetailPageProps {
  type?: 'video' | 'opus'
}

interface VideoDetailData {
  bvid: string;
  aid: string | number;
  title: string;
  description: string;
  isOpus: boolean;
  uploader: { name: string; avatar: string; mid: number };
  view: number;
  danmaku: number;
  reply: number;
  favorite: number;
  coin: number;
  share: number;
  like: number;
  pubtime: number;
  duration: number;
  cover: string;
  cid: number;
  pages: any[];
  opusParagraphs?: any[];
  opusImages?: string[];
  dimension?: any;
  rights?: any;
  descV2?: any[];
  staff?: any;
  ugcSeason?: any;
}

export default function VideoDetailPage({ type = 'video' }: VideoDetailPageProps) {
  const params = useParams<{ videoId?: string; opusId?: string }>()
  const videoId = params.videoId
  const opusId = params.opusId
  const mediaId = type === 'opus' ? opusId : videoId
  const navigate = useNavigate()
  const newQueueStore = useNewQueueStore()
  const { toggleDownload } = useVideoDownload()
  const [video, setVideo] = useState<VideoDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [downloading, setDownloading] = useState(false)
  const [downloadedCids, setDownloadedCids] = useState<Set<number>>(new Set())
  const [downloadedVideoStatus, setDownloadedVideoStatus] = useState<Record<number, 'none' | 'in_list' | 'downloaded'>>({})
  const [showReDownloadDialog, setShowReDownloadDialog] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<any>(null)
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

  // 响应式布局状态
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)

  // 检测屏幕尺寸
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth
      setIsMobile(width < 768)
      setIsTablet(width >= 768 && width < 1024)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)

    return () => {
      window.removeEventListener('resize', checkScreenSize)
    }
  }, [])

  // 获取响应式样式
  const getResponsiveStyle = () => {
    if (isMobile) {
      return {
        // 移动端：紧凑布局
        padding: '12px 16px',
        maxWidth: '100%',
        fontSize: {
          title: '18px',
          uploader: '15px',
          body: '14px',
          small: '12px'
        },
        spacing: {
          section: '16px',
          element: '12px'
        },
        layout: 'single-column' as const
      }
    } else if (isTablet) {
      return {
        // 平板：中等布局
        padding: '20px 28px',
        maxWidth: '900px',
        fontSize: {
          title: '20px',
          uploader: '16px',
          body: '15px',
          small: '13px'
        },
        spacing: {
          section: '20px',
          element: '14px'
        },
        layout: 'single-column' as const
      }
    } else {
      return {
        // 桌面：宽松双列布局
        padding: '32px 40px',
        maxWidth: '1400px',
        fontSize: {
          title: '24px',
          uploader: '17px',
          body: '16px',
          small: '14px'
        },
        spacing: {
          section: '28px',
          element: '16px'
        },
        layout: 'two-column' as const
      }
    }
  }

  const responsiveStyle = getResponsiveStyle()

  // 添加自定义拟态滚动条样式
  useEffect(() => {
    // 创建样式元素
    const style = document.createElement('style')
    style.textContent = `
      /* 隐藏原生滚动条 */
      .video-detail-page::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }

      .video-detail-page::-webkit-scrollbar-track {
        background: transparent;
        border-radius: 3px;
      }

      .video-detail-page::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, 
          rgba(110, 90, 255, 0.3) 0%, 
          rgba(106, 90, 205, 0.4) 100%);
        border-radius: 3px;
        border: 1px solid rgba(110, 90, 255, 0.1);
        box-shadow: 
          0 2px 4px rgba(0, 0, 0, 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.2);
        transition: all 0.3s ease;
      }

      .video-detail-page::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, 
          rgba(110, 90, 255, 0.5) 0%, 
          rgba(106, 90, 205, 0.6) 100%);
        box-shadow: 
          0 2px 8px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.3);
      }

      .video-detail-page::-webkit-scrollbar-thumb:active {
        background: linear-gradient(180deg, 
          rgba(110, 90, 255, 0.7) 0%, 
          rgba(106, 90, 205, 0.8) 100%);
      }

      /* 暗色模式下的滚动条 */
      .dark .video-detail-page::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, 
          rgba(139, 127, 255, 0.3) 0%, 
          rgba(138, 127, 255, 0.4) 100%);
        border-color: rgba(139, 127, 255, 0.2);
      }

      .dark .video-detail-page::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, 
          rgba(139, 127, 255, 0.5) 0%, 
          rgba(138, 127, 255, 0.6) 100%);
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // 获取代理图片URL
  const getProxyImageUrl = (url: string | null | undefined): string => {
    if (!url) return ''
    return getAvatarProxyUrl(url)
  }

  useEffect(() => {
    async function fetchMediaDetail() {
      if (!mediaId) return
      
      setLoading(true)
      setError('')
      
      try {
        let response
        
        if (type === 'opus') {
          response = await apiService.parseDownloadUrl(`cv${mediaId}`)
        } else {
          response = await apiService.getVideoDetail(mediaId, sessdata || undefined)
        }
        
        if (response.success && response.data) {
          const data = response.data
          
          if (type === 'opus') {
            // 图文数据结构
            const opusData = data.opus_info || {}
            const videoStat = data.video?.stat || {}
            const opusParagraphs = data.opus_info?.paragraphs || []
            const opusImages = data.opus_info?.image_urls || []

            setVideo({
              bvid: '',
              aid: data.aid || mediaId,
              title: opusData.title || data.title || 'Untitled',
              description: '',
              isOpus: true,
              uploader: {
                name: opusData.author || 'Unknown',
                avatar: opusData.author_avatar || '',
                mid: opusData.mid || 0
              },
              view: 0,
              danmaku: 0,
              reply: videoStat.reply || 0,
              favorite: videoStat.favorite || 0,
              coin: videoStat.coin || 0,
              share: videoStat.share || 0,
              like: videoStat.like || 0,
              pubtime: data.video?.pubdate || 0,
              duration: 0,
              cover: data.pic || opusImages[0] || '',
              cid: 0,
              pages: [],
              opusParagraphs: opusParagraphs,
              opusImages: opusImages,
              dimension: null,
              rights: null,
              descV2: [],
              staff: null,
              ugcSeason: null
            })
            
            
          } else {
            // 视频数据结构
            setVideo({
              bvid: data.bvid,
              aid: data.aid,
              title: data.title,
              description: data.desc,
              isOpus: false,
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
          }
        } else {
          setError(response.message || '获取详情失败')
        }
      } catch (err) {
        setError('网络请求失败')
      } finally {
        setLoading(false)
      }
    }

    fetchMediaDetail()
  }, [mediaId, sessdata, type])

  // 同步任务数据
  useEffect(() => {
    const syncData = async () => {
      try {
        // 先清理本地缓存，确保数据一致
        newQueueStore.forceClearCache()
        
        // 同步最新数据
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
    if (!video) return
    
    const cidsInList = new Set<number>()
    const downloadedStatus: Record<number, 'none' | 'in_list' | 'downloaded'> = {}
    const tasks = newQueueStore.tasks
    const newSystemTasks = Object.values(tasks)
    
    if (video.pages && video.pages.length > 1) {
      // 多P视频
      video.pages.forEach((page: any) => {
        // 检查是否在新下载系统队列中
        const hasInNewQueue = newSystemTasks.some(task =>
          task.media_id === video.bvid &&
          task.meta?.cid === page.cid &&
          !['completed', 'cancelled'].includes(task.state)
        )
        
        // 检查是否在新下载系统已完成
        const hasCompleted = newSystemTasks.some(task =>
          task.media_id === video.bvid &&
          task.meta?.cid === page.cid &&
          task.state === 'completed'
        )
        
        if (hasInNewQueue) {
          cidsInList.add(page.cid)
          downloadedStatus[page.cid] = 'in_list'
        } else if (hasCompleted) {
          downloadedStatus[page.cid] = 'downloaded'
        } else {
          downloadedStatus[page.cid] = 'none'
        }
      })
      
      setDownloadedCids(cidsInList)
      setDownloadedVideoStatus(downloadedStatus)
    } else {
      // 单个视频 - 立即检查状态
      checkSingleVideoStatus()
    }
  }, [video, newQueueStore.tasks])
  
  // 检查单个视频的下载状态
  const checkSingleVideoStatus = async () => {
    if (!video) return
    
    try {
      const result = await videoLibraryService.checkBeforeAdd({
        bvid: video.bvid,
        cid: video.cid,
        title: video.title || ''
      })
      
      const tasks = newQueueStore.tasks
      const newSystemTasks = Object.values(tasks)
      
      // 检查是否在新下载系统队列中或已完成
      // 对于单个视频，我们检查 media_id 是否匹配 bvid
      const hasInNewQueue = newSystemTasks.some(task =>
        task.media_id === video.bvid &&
        !['completed', 'cancelled'].includes(task.state)
      )
      
      const hasCompleted = newSystemTasks.some(task =>
        task.media_id === video.bvid &&
        task.state === 'completed'
      )
      
      let status: 'none' | 'in_list' | 'downloaded' = 'none'
      
      if (result.action === 'skip' || result.action === 'show_confirm') {
        status = 'downloaded'
      } else if (hasInNewQueue) {
        status = 'in_list'
      } else if (hasCompleted) {
        status = 'downloaded'
      }
      
      console.log('[VideoDetail] 单个视频状态检查:', {
        bvid: video.bvid,
        cid: video.cid,
        status,
        hasInNewQueue,
        hasCompleted,
        videoLibraryResult: result.action
      })
      
      setDownloadedVideoStatus({ [video.cid]: status })
      
      // 如果在队列中，更新 downloadedCids
      if (status === 'in_list') {
        setDownloadedCids(new Set([video.cid]))
      } else {
        setDownloadedCids(new Set())
      }
    } catch (error) {
      console.error('检查单个视频下载状态失败:', error)
    }
  }

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
              color: 'var(--color-primary-600)',
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
    const status = downloadedVideoStatus[video?.cid || 0]
    
    console.log('[VideoDetail] 按钮文本计算:', {
      videoBvid: video?.bvid,
      videoCid: video?.cid,
      addedCount,
      status,
      downloadedVideoStatus,
      buttonText: video?.pages && video.pages.length > 1 
        ? addedCount === 0 
          ? `添加全部 ${video.pages.length} 个视频`
          : addedCount < video.pages.length
            ? `添加剩余 ${video.pages.length - addedCount} 个视频`
            : '从列表移除'
        : status === 'downloaded'
          ? '已下载'
          : status === 'in_list' || addedCount > 0
            ? '从列表移除'
            : '添加到列表'
    })
    
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
      if (status === 'downloaded') {
        return '已下载'
      } else if (status === 'in_list' || addedCount > 0) {
        return '从列表移除'
      } else {
        return '添加到列表'
      }
    }
  }

const handleAddToDownload = async (e: React.MouseEvent) => {
  e.stopPropagation()
  if (!video) return
  
  try {
    const decision = await videoLibraryService.checkBeforeAdd(video)
    
    switch (decision.action) {
      case 'add':
        // 直接添加
        await performDownload(video, e)
        break
        
      case 'show_confirm':
        // 显示确认对话框
        setSelectedVideo(video)
        setShowReDownloadDialog(true)
        break
        
      case 'skip':
        // 静默跳过
        setAlertModal({
          show: true,
          title: '提示',
          message: '视频已下载，已在视频库中',
          type: 'success'
        })
        break
    }
  } catch (error) {
    console.error('检查下载状态失败:', error)
    // 降级到原有逻辑
    await performDownload(video, e)
  }
}

const performDownload = async (video: any, e: React.MouseEvent) => {
  setDownloading(true)
  try {
    const result = await toggleDownload(video as any, e)
    
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
  } catch (error) {
    console.error('操作失败:', error)
    setAlertModal({
      show: true,
      title: '操作失败',
      message: '添加下载失败',
      type: 'error'
    })
  } finally {
    setDownloading(false)
  }
}

const handleReDownloadConfirm = async () => {
  if (!selectedVideo) return
  
  try {
    await performDownload(selectedVideo, {} as React.MouseEvent)
    setShowReDownloadDialog(false)
    setAlertModal({
      show: true,
      title: '操作成功',
      message: '已重新添加到下载列表',
      type: 'success'
    })
  } catch (error) {
    console.error('重新下载失败:', error)
    setAlertModal({
      show: true,
      title: '操作失败',
      message: '重新下载失败',
      type: 'error'
    })
  }
}
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--color-bg-primary)',
        color: 'var(--color-text-secondary)'
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
        background: 'var(--color-bg-primary)',
        color: 'var(--color-text-secondary)'
      }}>
        <div>{error}</div>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '8px 16px',
            background: 'var(--color-primary-600)',
            color: 'var(--color-white)',
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
        background: 'var(--color-bg-primary)',
        color: 'var(--color-text-secondary)'
      }}>
        视频不存在
      </div>
    )
  }

  return (
    <div 
      className="video-detail-page"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'var(--color-bg-primary)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        zIndex: 9999
      }}>
      {/* 内容容器 - 用于居中和布局 */}
      <div style={{
        maxWidth: responsiveStyle.maxWidth,
        margin: '0 auto',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: `0 ${responsiveStyle.padding}`
      }}>
      {/* 顶部导航 */}
      <div style={{
        position: 'sticky',
        top: 0,
        background: 'var(--color-bg-primary)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--color-border)',
        padding: responsiveStyle.layout === 'two-column' ? '16px 0' : responsiveStyle.padding,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 100,
        width: '100%'
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-bg-tertiary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none'
          }}
        >
          <ArrowLeft size={responsiveStyle.layout === 'two-column' ? 24 : 20} />
        </button>
        <h1 style={{
          fontSize: responsiveStyle.layout === 'two-column' ? '18px' : '16px',
          fontWeight: '600',
          color: 'var(--color-text-primary)',
          margin: 0,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {video.title}
        </h1>
      </div>

      {/* 主内容区 - 桌面模式为左右布局 */}
      <div style={{
        display: 'flex',
        flexDirection: responsiveStyle.layout === 'two-column' ? 'row' : 'column',
        gap: responsiveStyle.layout === 'two-column' ? '32px' : '24px',
        marginBottom: '32px'
      }}>
      {/* 左侧 - 视频封面 */}
      <div style={{
        flex: responsiveStyle.layout === 'two-column' ? 1 : 'auto',
        minWidth: 0
      }}>
        <div style={{
          position: 'relative',
          width: '100%',
          paddingTop: video.isOpus ? '0' : '56.25%',
          background: 'var(--color-bg-tertiary)',
          overflow: 'hidden',
          display: video.isOpus ? 'block' : 'relative',
          borderRadius: responsiveStyle.layout === 'two-column' ? '12px' : '0'
        }}>
          {video.isOpus ? (
            video.cover ? (
              <img
                src={getProxyImageUrl(video.cover)}
                alt={video.title}
                style={{ width: '100%', borderRadius: responsiveStyle.layout === 'two-column' ? '12px' : '0' }}
              />
            ) : null
          ) : (
            video.cover ? (
              <img
                src={getProxyImageUrl(video.cover)}
                alt={video.title}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: responsiveStyle.layout === 'two-column' ? '12px' : '0'
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
                <Film size={48} />
              </div>
            )
          )}

          {/* 视频时长或图文标记 */}
          {video.isOpus ? (
            <div style={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              background: 'var(--color-primary-600)',
              color: 'var(--color-white)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '600'
            }}>
              图文
            </div>
          ) : (
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
          )}
        </div>

        {/* 视频简介 - 封面下方显示 */}
        {!video.isOpus && video.description && video.description !== '-' && video.description.trim() && (
          <div style={{
            marginTop: '16px',
            padding: responsiveStyle.layout === 'two-column' ? '16px' : '12px',
            background: 'var(--color-bg-tertiary)',
            borderRadius: responsiveStyle.layout === 'two-column' ? '12px' : '8px',
            fontSize: responsiveStyle.fontSize.body,
            color: 'var(--color-text-primary)',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            <h3 style={{
              fontSize: responsiveStyle.fontSize.small,
              fontWeight: '600',
              color: 'var(--color-text-primary)',
              marginBottom: '8px'
            }}>
              视频简介
            </h3>
            {parseLinks(video.description)}
          </div>
        )}
      </div>

      {/* 右侧 - 视频信息和状态 */}
      <div style={{
        flex: responsiveStyle.layout === 'two-column' ? 1 : 'auto',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* 视频标题 */}
        <h2 className="video-detail-title" style={{
          fontSize: responsiveStyle.fontSize.title,
          fontWeight: '600',
          margin: 0,
          lineHeight: '1.4',
          color: 'var(--color-text-primary)'
        }}>
          {video.isOpus ? (
            <a
              href={`https://www.bilibili.com/opus/${mediaId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--color-text-primary)',
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
                e.currentTarget.style.color = 'var(--color-primary-600)'
                e.currentTarget.style.textDecoration = 'underline'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)'
                e.currentTarget.style.textDecoration = 'none'
              }}
            >
              {video.title}
            </a>
          ) : (
            <a
              href={`https://www.bilibili.com/video/${video.bvid}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--color-text-primary)',
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
                e.currentTarget.style.color = 'var(--color-primary-600)'
                e.currentTarget.style.textDecoration = 'underline'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)'
                e.currentTarget.style.textDecoration = 'none'
              }}
            >
              {video.title}
            </a>
          )}
        </h2>

        {/* UP主信息 */}
        {!video.isOpus && (
          <div className="video-detail-uploader" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            background: 'var(--color-bg-tertiary)',
            borderRadius: responsiveStyle.layout === 'two-column' ? '12px' : '8px'
          }}>
            <div className="video-detail-avatar" style={{
              width: responsiveStyle.layout === 'two-column' ? '56px' : '48px',
              height: responsiveStyle.layout === 'two-column' ? '56px' : '48px',
              borderRadius: '50%',
              background: 'var(--color-bg-tertiary)',
              overflow: 'hidden',
              flexShrink: 0,
              border: '2px solid var(--color-border)'
            }}>
              {video.uploader.avatar ? (
                <img
                  src={getProxyImageUrl(video.uploader.avatar)}
                  alt={video.uploader.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <User size={responsiveStyle.layout === 'two-column' ? 32 : 24} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="video-detail-uploader-name" style={{
                fontSize: responsiveStyle.fontSize.uploader,
                fontWeight: '600',
                color: 'var(--color-text-primary)',
                marginBottom: '4px',
                lineHeight: '1.3'
              }}>
                {video.uploader.name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                {formatTime(video.pubtime)}
              </div>
            </div>
          </div>
        )}

        {/* 视频统计信息 */}
        {!video.isOpus && (
          <div className="video-detail-stats" style={{
            display: 'grid',
            gridTemplateColumns: responsiveStyle.layout === 'two-column' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
            gap: '16px',
            padding: '16px',
            background: 'var(--color-bg-tertiary)',
            borderRadius: responsiveStyle.layout === 'two-column' ? '12px' : '8px'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>
                播放量
              </div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                {formatNumber(video.view)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>
                弹幕
              </div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                {formatNumber(video.danmaku)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>
                点赞
              </div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                {formatNumber(video.like)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>
                投币
              </div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                {formatNumber(video.coin)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>
                收藏
              </div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                {formatNumber(video.favorite)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>
                评论
              </div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                {formatNumber(video.reply)}
              </div>
            </div>
          </div>
        )}

        {/* 分P信息 */}
        {video.pages && video.pages.length > 1 && (
          <div style={{
            padding: '12px',
            background: 'var(--color-bg-tertiary)',
            borderRadius: responsiveStyle.layout === 'two-column' ? '12px' : '8px',
            fontSize: responsiveStyle.fontSize.small,
            color: 'var(--color-text-primary)'
          }}>
            共{video.pages.length}个视频，总时长：{formatDuration(video.pages.reduce((total: number, p: any) => total + p.duration, 0))}
          </div>
        )}

        {/* 分P列表（仅多P视频显示） */}
        {video.pages && video.pages.length > 1 && (
          <div style={{
            background: 'var(--color-bg-tertiary)',
            borderRadius: responsiveStyle.layout === 'two-column' ? '12px' : '8px',
            padding: responsiveStyle.layout === 'two-column' ? '16px' : '12px',
            maxHeight: responsiveStyle.layout === 'two-column' ? '400px' : '300px',
            overflowY: 'auto'
          }}>
            {video.pages.map((page: any, index: number) => {
              const isInList = downloadedCids.has(page.cid)
              const status = downloadedVideoStatus[page.cid] || 'none'
              const isDownloaded = status === 'downloaded'

              return (
                <div
                  key={page.cid || index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: responsiveStyle.layout === 'two-column' ? '12px' : '10px',
                    background: 'var(--color-bg-primary)',
                    borderRadius: responsiveStyle.layout === 'two-column' ? '8px' : '6px',
                    marginBottom: index < video.pages.length - 1 ? (responsiveStyle.layout === 'two-column' ? '10px' : '8px') : '0',
                    opacity: (isInList || isDownloaded) ? 0.6 : 1
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: responsiveStyle.fontSize.small, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                      P{page.page}: {page.part || `第${page.page}个视频`}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                      {formatDuration(page.duration)}
                    </div>
                  </div>
                  {isDownloaded && (
                    <span style={{
                      fontSize: '11px',
                      color: 'var(--color-success-600)',
                      background: 'var(--color-success-50)',
                      padding: responsiveStyle.layout === 'two-column' ? '4px 8px' : '2px 6px',
                      borderRadius: '4px',
                      fontWeight: '500'
                    }}>
                      已下载
                    </span>
                  )}
                  {isInList && !isDownloaded && (
                    <span style={{
                      fontSize: '11px',
                      color: 'var(--color-primary-600)',
                      background: 'var(--color-primary-50)',
                      padding: responsiveStyle.layout === 'two-column' ? '4px 8px' : '2px 6px',
                      borderRadius: '4px',
                      fontWeight: '500'
                    }}>
                      队列中
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
            padding: responsiveStyle.layout === 'two-column' ? '16px' : '14px',
            background: downloading ? 'var(--color-secondary-400)' : 'var(--color-primary-600)',
            color: 'var(--color-white)',
            border: 'none',
            borderRadius: responsiveStyle.layout === 'two-column' ? '12px' : '8px',
            fontSize: responsiveStyle.layout === 'two-column' ? '17px' : '16px',
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
              e.currentTarget.style.background = 'var(--color-primary-700)'
            }
          }}
          onMouseLeave={(e) => {
            if (!downloading) {
              e.currentTarget.style.background = 'var(--color-primary-600)'
            }
          }}
        >
          {getButtonText()}
        </button>
      </div>
      </div>

      {/* 图文内容 - 仅图文显示 */}
      {video.isOpus && video.opusParagraphs && video.opusParagraphs.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {video.opusParagraphs.map((para: any, index: number) => {
            if (para.para_type === 1) {
              const textData = para.text?.nodes?.[0]?.word
              if (textData?.words) {
                return (
                  <p key={index} style={{
                    fontSize: '15px',
                    lineHeight: '1.6',
                    color: 'var(--color-text-primary)',
                    marginBottom: '12px'
                  }}>
                    {textData.words}
                  </p>
                )
              }
            }
            if (para.para_type === 2) {
              const pics = para.pic?.pics || []
              return pics.map((pic: any, picIndex: number) => (
                <img
                  key={`${index}-${picIndex}`}
                  src={getProxyImageUrl(pic.url)}
                  alt={`${video.title} - ${index + 1}`}
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    marginBottom: '8px'
                  }}
                />
              ))
            }
            return null
          })}
        </div>
      )}

      {/* AlertModal */}
      <AlertModal
        isOpen={alertModal.show}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ ...alertModal, show: false })}
      />

      {/* ReDownloadDialog */}
      {showReDownloadDialog && selectedVideo && (
        <ReDownloadDialog
          isOpen={showReDownloadDialog}
          video={selectedVideo}
          onConfirm={handleReDownloadConfirm}
          onCancel={() => {
            setShowReDownloadDialog(false)
            setSelectedVideo(null)
          }}
        />
      )}
      </div>
    </div>
  )

}
