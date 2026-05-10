import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate, Outlet } from 'react-router-dom'
import { apiService } from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useNewQueueStore } from '../stores/newQueue'
import {
  getCollectionParts,
  getDownloadParts,
  useVideoDownload,
  type DownloadPart,
  type VideoDetail as DownloadVideoDetail
} from '../hooks/useVideoDownload'
import { videoLibraryService } from '../services/videoLibraryService'
import ReDownloadDialog from '../components/ReDownloadDialog'
import AlertModal from '../components/AlertModal'
import { ArrowLeft, ChevronDown, ChevronRight, Film, MessageCircle, Play, Sparkles, ThumbsUp, User, Eye, MessageSquare, Coins, Bookmark } from 'lucide-react'
import { getAvatarProxyUrl, getLocalImageUrl, getLocalVideoUrl } from '../config/api'
import './VideoDetailPage.css'
import {
  buildPlayablePages,
  getPlayableEntries,
  selectInitialPlayableEntry,
  type LocalPlaybackEntry,
  type LocalPlaybackMap
} from './videoDetailPlayback'
import { buildDetailTaskPayload, normalizeOpusMediaId } from './videoDetailMedia'
import { parseLocalOpusMarkdown, type LocalOpusContent, type OpusBlock } from './videoDetailOpus'

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
  pubtime: number | string;
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
  comments?: Array<{
    type: string;
    content: string;
    like: number;
    reply: number;
    author: string;
    time: number;
  }>;
  localOpus?: LocalOpusContent | null;
}

interface VideoDetailCacheEntry {
  video: VideoDetailData
  localOpusContent: LocalOpusContent | null
  timestamp: number
}

const DETAIL_CACHE_PREFIX = 'video-detail-cache-v3'
const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000
const detailPageMemoryCache = new Map<string, VideoDetailCacheEntry>()

const canUseSessionStorage = () =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'

const buildDetailCacheKey = (type: 'video' | 'opus', mediaId: string) =>
  `${DETAIL_CACHE_PREFIX}:${type}:${mediaId}`

const sanitizeFilename = (value: string) =>
  value.replace(/[\/\\:*?"<>|]/g, '_').trim() || '未命名'

const readDetailCache = (cacheKey: string): VideoDetailCacheEntry | null => {
  const memoryEntry = detailPageMemoryCache.get(cacheKey)
  if (memoryEntry && Date.now() - memoryEntry.timestamp <= DETAIL_CACHE_TTL_MS) {
    return memoryEntry
  }

  if (!canUseSessionStorage()) {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(cacheKey)
    if (!raw) return null

    const parsed = JSON.parse(raw) as VideoDetailCacheEntry
    if (!parsed?.video || Date.now() - parsed.timestamp > DETAIL_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(cacheKey)
      return null
    }

    detailPageMemoryCache.set(cacheKey, parsed)
    return parsed
  } catch {
    try {
      window.sessionStorage.removeItem(cacheKey)
    } catch {
      // ignore
    }
    return null
  }
}

const writeDetailCache = (cacheKey: string, entry: VideoDetailCacheEntry) => {
  detailPageMemoryCache.set(cacheKey, entry)

  if (!canUseSessionStorage()) {
    return
  }

  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(entry))
  } catch {
    // storage full or unavailable; ignore
  }
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
  const [localPlayback, setLocalPlayback] = useState<LocalPlaybackMap | null>(null)
  const [mediaMode, setMediaMode] = useState<'poster' | 'local-video'>('poster')
  const [partListMode, setPartListMode] = useState<'submission' | 'collection'>('submission')
  const [expandedCollectionItems, setExpandedCollectionItems] = useState<Set<string>>(new Set())
  const [activePlaybackEntry, setActivePlaybackEntry] = useState<LocalPlaybackEntry | null>(null)
  const [showReDownloadDialog, setShowReDownloadDialog] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<any>(null)
  const [localOpusContent, setLocalOpusContent] = useState<LocalOpusContent | null>(null)
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
        fontSize: {
          title: '18px',
          uploader: '15px',
          body: '14px',
          small: '12px'
        }
      }
    } else if (isTablet) {
      return {
        fontSize: {
          title: '20px',
          uploader: '16px',
          body: '15px',
          small: '13px'
        }
      }
    } else {
      return {
        fontSize: {
          title: '24px',
          uploader: '17px',
          body: '16px',
          small: '14px'
        }
      }
    }
  }

  const responsiveStyle = getResponsiveStyle()
  const isCompactLayout = isMobile || isTablet
  const cardRadius = isCompactLayout ? '8px' : '12px'
  const cardPadding = isCompactLayout ? '12px' : '16px'
  const avatarSize = isCompactLayout ? '48px' : '56px'
  const badgePadding = isCompactLayout ? '2px 6px' : '4px 8px'
  const listPadding = isCompactLayout ? '12px' : '16px'
  const listMaxHeight = isCompactLayout ? '300px' : '400px'
  const pageGap = isCompactLayout ? '16px' : '20px'

  // 获取代理图片URL
  const getProxyImageUrl = (url: string | null | undefined): string => {
    if (!url) return ''
    return getAvatarProxyUrl(url)
  }

  const getCommentAvatarImage = (author: string): string => {
    const urls = ['/avatar/avatar1.png', '/avatar/avatar2.png', '/avatar/avatar3.png']
    const hash = author.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return urls[hash % urls.length]
  }

  const getOriginalBilibiliUrl = (): string => {
    if (!video) return 'https://www.bilibili.com'

    if (video.isOpus) {
      const opusMediaId = normalizeOpusMediaId(String(mediaId || video.aid || ''))
      const opusNumericId = opusMediaId.replace(/^cv/i, '')
      return opusNumericId ? `https://www.bilibili.com/read/cv${opusNumericId}` : 'https://www.bilibili.com'
    }

    return video.bvid ? `https://www.bilibili.com/video/${video.bvid}` : 'https://www.bilibili.com'
  }

  useEffect(() => {
    async function fetchMediaDetail() {
      if (!mediaId) return

      const cacheKey = buildDetailCacheKey(type, String(mediaId))
      const cachedEntry = readDetailCache(cacheKey)

      setLoading(true)
      setError('')

      if (cachedEntry) {
        setVideo(cachedEntry.video)
        setLocalOpusContent(cachedEntry.localOpusContent)
      }
      
      try {
        let response
        let localOpusResponse = null

        if (type === 'opus') {
          try {
            localOpusResponse = await apiService.getLocalOpusContent(normalizeOpusMediaId(mediaId || ''))
          } catch (localOpusError) {
            // 本地图文未命中时回退远端详情，属于正常路径，不额外打日志
          }
        }
        
        if (type === 'opus') {
          if (localOpusResponse?.success && localOpusResponse.data) {
            const localData = localOpusResponse.data as LocalOpusContent
            const nfoData = localData.nfo_data || {}
            setLocalOpusContent(localData)
            const nextVideo = {
              bvid: '',
              aid: localData.opus_id,
              title: localData.title || nfoData.title || 'Untitled',
              description: '',
              isOpus: true,
              uploader: {
                name: nfoData.studio || 'Unknown',
                avatar: localData.avatar_path ? getLocalImageUrl(localData.avatar_path) : '',
                mid: 0
              },
              view: 0,
              danmaku: 0,
              reply: nfoData.statistics?.reply || 0,
              favorite: nfoData.statistics?.favorite || 0,
              coin: nfoData.statistics?.coin || 0,
              share: nfoData.statistics?.share || 0,
              like: nfoData.statistics?.like || 0,
              pubtime: nfoData.premiered || '',
              duration: 0,
              cover: localData.cover_path || '',
              cid: 0,
              pages: [],
              opusParagraphs: [],
              opusImages: [],
              dimension: null,
              rights: null,
              descV2: [],
              staff: null,
              ugcSeason: null,
              localOpus: localData
            }
            setVideo(nextVideo)
            writeDetailCache(cacheKey, {
              video: nextVideo,
              localOpusContent: localData,
              timestamp: Date.now(),
            })
            return
          }

          setLocalOpusContent(null)
          response = await apiService.parseDownloadUrl(normalizeOpusMediaId(mediaId || ''))
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
            setLocalOpusContent(null)

            const nextVideo = {
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
              ugcSeason: null,
              localOpus: null
            }
            setVideo(nextVideo)
            writeDetailCache(cacheKey, {
              video: nextVideo,
              localOpusContent: null,
              timestamp: Date.now(),
            })
            
            
          } else {
            // 视频数据结构
            const ugcSeason = data.ugc_season || data.ugcSeason || null
            const normalizedPages = getDownloadParts(
              {
                bvid: data.bvid,
                title: data.title,
                pic: data.pic,
                cover: data.pic,
              },
              {
                ...data,
                ugc_season: ugcSeason,
              } as DownloadVideoDetail
            ).map(page => ({
              bvid: page.bvid,
              cid: page.cid || 0,
              page: page.page,
              part: page.title,
              duration: page.duration || 0,
              cover: page.cover,
            }))

            const nextVideo = {
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
              pages: normalizedPages,
              dimension: data.dimension || null,
              rights: data.rights || {},
              descV2: data.descV2 || [],
              staff: data.staff || null,
              ugcSeason,
              comments: data.comments || []
            }
            setVideo(nextVideo)
            writeDetailCache(cacheKey, {
              video: nextVideo,
              localOpusContent: null,
              timestamp: Date.now(),
            })
          }
        } else {
          if (cachedEntry) {
            setError('')
          } else {
            setError(response.message || '获取详情失败')
          }
        }
      } catch (err) {
        if (!cachedEntry) {
          setError('网络请求失败')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchMediaDetail()
  }, [mediaId, sessdata, type])

  useEffect(() => {
    if (!video?.ugcSeason) {
      setPartListMode('submission')
    }
  }, [video?.ugcSeason])

  useEffect(() => {
    if (video?.bvid && video.pages?.length > 1) {
      setExpandedCollectionItems(prev => {
        const next = new Set(prev)
        next.add(video.bvid)
        return next
      })
    }
  }, [video?.bvid, video?.pages])

  useEffect(() => {
    let cancelled = false

    async function fetchLocalPlayback() {
      setLocalPlayback(null)
      setActivePlaybackEntry(null)
      setMediaMode('poster')

      if (!video || video.isOpus || !video.bvid) {
        return
      }

      try {
        const response = await apiService.getLocalPlaybackMap(video.bvid)
        if (!cancelled && response.success && response.data) {
          setLocalPlayback(response.data)
        }
      } catch (playbackError) {
        console.error('[VideoDetail] 获取本地播放映射失败:', playbackError)
      }
    }

    fetchLocalPlayback()

    return () => {
      cancelled = true
    }
  }, [video?.bvid, video?.isOpus])

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
        const pageBvid = page.bvid || video.bvid
        // 检查是否在新下载系统队列中
        const hasInNewQueue = newSystemTasks.some(task =>
          task.media_id === pageBvid &&
          task.meta?.cid === page.cid &&
          !['completed', 'cancelled'].includes(task.state)
        )
        
        // 检查是否在新下载系统已完成
        const hasCompleted = newSystemTasks.some(task =>
          task.media_id === pageBvid &&
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

  const playableEntries = getPlayableEntries(localPlayback)
  const localOpusBlocks: OpusBlock[] = localOpusContent
    ? parseLocalOpusMarkdown(localOpusContent.markdown_content, localOpusContent.folder_path)
    : []
  const hasLocalPlayback = playableEntries.length > 0
  const playablePages = video?.pages && video.pages.length > 1
    ? buildPlayablePages(video.pages, localPlayback)
    : []
  const collectionParts = video && video.ugcSeason
    ? getCollectionParts(
      {
        bvid: video.bvid,
        title: video.title,
        pic: video.cover,
        cover: video.cover,
      },
      {
        pages: video.pages,
        ugc_season: video.ugcSeason,
      } as DownloadVideoDetail
    )
    : []
  const collectionDisplayParts: Array<DownloadPart & { subparts: DownloadPart[] }> = collectionParts.map(part => ({
    ...part,
    subparts: video && part.bvid === video.bvid && video.pages?.length > 1
      ? video.pages.map((page: any) => ({
        bvid: part.bvid,
        cid: page.cid,
        page: page.page,
        title: page.part || `P${page.page}`,
        cover: page.cover || part.cover,
        duration: page.duration,
      } as DownloadPart))
      : []
  }))
  const collectionKnownDownloadItems: DownloadPart[] = collectionDisplayParts.flatMap(part =>
    part.subparts.length > 0 ? part.subparts : [part]
  )
  const collectionEpisodeCount = video?.ugcSeason?.episode_count || video?.ugcSeason?.sections?.reduce(
    (total: number, section: any) => total + (section.episodes?.length || 0),
    0
  ) || 0
  const isCollectionMember = !video?.isOpus && collectionEpisodeCount > 1
  const showingCollectionList = isCollectionMember && partListMode === 'collection'
  const activeLocalVideoUrl = activePlaybackEntry ? getLocalVideoUrl(activePlaybackEntry.path) : ''

  const startLocalPlayback = (entry: LocalPlaybackEntry) => {
    setActivePlaybackEntry(entry)
    setMediaMode('local-video')
  }

  const toggleCollectionItemExpanded = (bvid: string) => {
    setExpandedCollectionItems(prev => {
      const next = new Set(prev)
      if (next.has(bvid)) {
        next.delete(bvid)
      } else {
        next.add(bvid)
      }
      return next
    })
  }

  const handleCoverPlay = () => {
    if (!video || video.isOpus || !hasLocalPlayback) {
      return
    }

    const initialEntry = selectInitialPlayableEntry(localPlayback, video.cid)
    if (initialEntry) {
      startLocalPlayback(initialEntry)
      return
    }

    setAlertModal({
      show: true,
      title: '无法直接播放',
      message: '当前封面对应的分P未下载，请从下方已下载的视频列表中选择播放。',
      type: 'error'
    })
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

  const isCollectionItemCompleted = (part: DownloadPart): boolean => {
    const tasks = Object.values(newQueueStore.tasks)
    return tasks.some(task =>
      task.media_id === part.bvid &&
      (!part.cid || task.meta?.cid === part.cid) &&
      task.state === 'completed'
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
      if (isCidInDownloadList(page.bvid || video.bvid, page.cid)) {
        count++
      }
    })
    return count
  }

  const getCollectionRemainingDownloadCount = () => {
    return collectionKnownDownloadItems.filter(part => !isCollectionItemCompleted(part)).length
  }

  // 获取按钮文本
  const getButtonText = () => {
    if (downloading) return '操作中...'
    if (type === 'opus') {
      return localOpusContent ? '已下载' : '添加到列表'
    }

    if (showingCollectionList) {
      const remainingCount = getCollectionRemainingDownloadCount()
      if (remainingCount === 0) {
        return '合集已下载'
      }
      return `下载未完成 ${remainingCount} 个视频`
    }
    
    const addedCount = getAddedCount()
    const status = downloadedVideoStatus[video?.cid || 0]
    
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

  if (showingCollectionList) {
    await handleDownloadCollection(e)
    return
  }

  if (type === 'opus') {
    if (localOpusContent) {
      setAlertModal({
        show: true,
        title: '提示',
        message: '该图文已下载并优先使用本地 Markdown 展示',
        type: 'success'
      })
      return
    }

    await performDownload(video, e)
    return
  }
  
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

const handleDownloadCollection = async (e: React.MouseEvent) => {
  e.stopPropagation()
  if (!video || collectionParts.length === 0) return

  setDownloading(true)
  try {
    const collectionTitle = video.ugcSeason?.title || video.title
    const taskIds: string[] = []
    let addedCount = 0
    let skippedCompletedCount = 0

    const resolveEpisodeParts = async (episode: DownloadPart): Promise<DownloadPart[]> => {
      if (episode.bvid === video.bvid && video.pages?.length) {
        return getDownloadParts(
          {
            bvid: video.bvid,
            title: video.title,
            pic: video.cover,
            cover: video.cover,
          },
          { pages: video.pages } as DownloadVideoDetail
        )
      }

      try {
        const response = await apiService.getVideoDetail(episode.bvid, sessdata || undefined)
        if (response.success && response.data) {
          const detail = response.data as DownloadVideoDetail
          const parts = getDownloadParts(
            {
              bvid: episode.bvid,
              title: episode.title,
              pic: episode.cover,
              cover: episode.cover,
            },
            detail
          )
          if (parts.length > 0) {
            return parts
          }
        }
      } catch (error) {
        console.error(`获取合集投稿详情失败: ${episode.title}`, error)
      }

      return [{
        bvid: episode.bvid,
        cid: episode.cid,
        page: 1,
        title: episode.title,
        cover: episode.cover,
        duration: episode.duration,
      }]
    }

    for (const episode of collectionParts) {
      const episodeParts = await resolveEpisodeParts(episode)
      try {
        for (const part of episodeParts) {
          if (isCollectionItemCompleted(part)) {
            skippedCompletedCount++
            continue
          }

          const response = await apiService.submitTask({
            title: part.title,
            media_type: 'video',
            media_id: part.bvid,
            cover: part.cover || episode.cover,
            desc: `合集：${collectionTitle}`,
            meta: {
              cid: part.cid,
              page: part.page,
              part_title: part.title,
              collection_bvid: video.bvid,
              collection_title: collectionTitle,
              collection_episode_title: episode.title,
              output_subdir: `P${String(episode.page).padStart(2, '0')} - ${episode.title}`
            }
          })

          if (response.success && response.data) {
            taskIds.push(response.data.id)
            addedCount++
          }
        }
      } catch (error) {
        console.error(`添加合集投稿失败: ${episode.title}`, error)
      }
    }

    if (addedCount === 0) {
      if (skippedCompletedCount > 0) {
        setAlertModal({
          show: true,
          title: '提示',
          message: '合集视频已全部下载完成',
          type: 'success'
        })
        return
      }
      throw new Error('所有合集投稿添加失败')
    }

    const { useSettingsStore } = await import('../stores/settings')
    const settingsStore = useSettingsStore.getState()
    if (!settingsStore.settings) {
      await settingsStore.fetchSettings()
    }
    const downloadPath = settingsStore.settings?.storage?.download_path || '/Users/tanyancong/工作/开发/pilinote/downloads'
    const folderPath = `${downloadPath}/合集-${sanitizeFilename(collectionTitle)}`

    const schedulerResponse = await apiService.createScheduler({
      title: collectionTitle,
      task_ids: taskIds,
      folder: folderPath
    })

    if (!schedulerResponse.success || !schedulerResponse.data) {
      throw new Error(schedulerResponse.message || '创建合集调度器失败')
    }

    await newQueueStore.fetchTasks()
    await newQueueStore.fetchSchedulers()
    setAlertModal({
      show: true,
      title: '操作成功',
      message: `已添加 ${addedCount} 个投稿到合集下载列表`,
      type: 'success'
    })
  } catch (error) {
    console.error('添加整个合集失败:', error)
    setAlertModal({
      show: true,
      title: '操作失败',
      message: error instanceof Error ? error.message : '添加整个合集失败',
      type: 'error'
    })
  } finally {
    setDownloading(false)
  }
}

const performDownload = async (video: any, e: React.MouseEvent) => {
  setDownloading(true)
  try {
    if (type !== 'opus') {
      const result = await toggleDownload(video as any, e)

      if (result.success) {
        if (result.shouldNavigateToLibrary) {
          navigate('/downloads', { replace: true })
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
      return
    }

    const taskPayload = buildDetailTaskPayload({
      type,
      mediaId: type === 'opus' ? normalizeOpusMediaId(String(mediaId || video.aid || '')) : video.bvid,
      title: video.title,
      cover: video.cover,
      cid: undefined
    })

    const response = await apiService.submitTask(taskPayload)
    if (response.success) {
      await newQueueStore.fetchTasks()
      await newQueueStore.fetchSchedulers()
      setAlertModal({
        show: true,
        title: '操作成功',
        message: '已添加到下载队列',
        type: 'success'
      })
    } else {
      setAlertModal({
        show: true,
        title: '操作失败',
        message: response.message || '添加下载失败',
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

  const originalBilibiliUrl = getOriginalBilibiliUrl()
  const aiPanelPath = video?.isOpus
    ? `/opus/${normalizeOpusMediaId(String(mediaId || video?.aid || ''))}/ai`
    : `/video/${videoId}/ai`
  const handleOpenAiPanel = () => {
    if (!videoId || !video) return
    navigate(aiPanelPath)
  }

  const renderSkeleton = () => (
    <div className="video-detail-page">
      <header className="video-detail-header">
        <div className="video-detail-header-inner">
          <div className="video-detail-skeleton-header-action" aria-hidden="true" />
          <div className="video-detail-skeleton-header-title" aria-hidden="true" />
          <div className="video-detail-skeleton-header-action video-detail-skeleton-header-action--right" aria-hidden="true" />
        </div>
      </header>

      <main className="video-detail-content">
        <div className="video-detail-skeleton" aria-hidden="true">
          <div className="video-detail-skeleton-media" />
          <div className="video-detail-skeleton-card">
            <div className="video-detail-skeleton-line video-detail-skeleton-line--short" />
            <div className="video-detail-skeleton-line" />
            <div className="video-detail-skeleton-line video-detail-skeleton-line--mid" />
          </div>
          <div className="video-detail-skeleton-card">
            <div className="video-detail-skeleton-line video-detail-skeleton-line--short" />
            <div className="video-detail-skeleton-comment" />
            <div className="video-detail-skeleton-comment" />
          </div>
        </div>
      </main>
    </div>
  )

  if (loading || !video) {
    if (!loading && !video && error) {
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
    return renderSkeleton()
  }

  return (
    <div className="video-detail-page">
      <header className="video-detail-header">
        <div className="video-detail-header-inner">
          <button
            onClick={() => navigate(-1)}
            className="video-detail-back-button"
            aria-label="返回"
            type="button"
          >
            <ArrowLeft size={20} />
          </button>
          <a
            className="video-detail-title-link"
            href={originalBilibiliUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="打开原始 B 站网页"
            title="打开原始 B 站网页"
          >
            <h1 className="video-detail-title">
              {video.title}
            </h1>
          </a>
          <Link
            className="video-detail-header-action video-detail-header-action-ai"
            to={aiPanelPath}
            state={video?.isOpus && video.localOpus?.folder_path ? { folderPath: video.localOpus.folder_path } : undefined}
            aria-label="打开 AI 面板"
            title="打开 AI 面板"
            onClick={handleOpenAiPanel}
          >
            <Sparkles size={16} className="video-detail-header-action-icon" />
          </Link>
        </div>
      </header>

      <main className="video-detail-content">
      {/* 主内容区 - 统一单列竖向流 */}
      <div className="video-detail-sections" style={{ gap: pageGap }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          position: 'relative',
          width: '100%',
          paddingTop: video.isOpus ? '0' : '56.25%',
          background: 'var(--color-bg-tertiary)',
          overflow: 'hidden',
          display: video.isOpus ? 'block' : 'relative',
          borderRadius: cardRadius,
          cursor: !video.isOpus && hasLocalPlayback && mediaMode === 'poster' ? 'pointer' : 'default'
        }}
        onClick={() => {
          if (!video.isOpus && mediaMode === 'poster') {
            handleCoverPlay()
          }
        }}
        title={!video.isOpus && hasLocalPlayback ? '点击播放本地视频' : undefined}
        >
          {video.isOpus ? (
            video.cover ? (
              <img
                src={video.localOpus ? getLocalImageUrl(video.cover) : getProxyImageUrl(video.cover)}
                alt={video.title}
                style={{ width: '100%', borderRadius: cardRadius }}
              />
            ) : null
          ) : (
            mediaMode === 'local-video' && activeLocalVideoUrl ? (
              <video
                key={activeLocalVideoUrl}
                src={activeLocalVideoUrl}
                controls
                autoPlay
                playsInline
                poster={video.cover ? getProxyImageUrl(video.cover) : undefined}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  background: '#000',
                  borderRadius: cardRadius
                }}
              />
            ) : video.cover ? (
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
                  borderRadius: cardRadius
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

          {!video.isOpus && mediaMode === 'poster' && hasLocalPlayback && (
            <div style={{
              position: 'absolute',
              right: '12px',
              bottom: '44px',
              width: '38px',
              height: '38px',
              borderRadius: '999px',
              background: 'rgba(15, 15, 15, 0.78)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 24px rgba(0, 0, 0, 0.24)',
              pointerEvents: 'none'
            }}>
              <Play size={18} fill="currentColor" style={{ marginLeft: '2px' }} />
            </div>
          )}

          {!video.isOpus && mediaMode === 'local-video' && activePlaybackEntry && (
            <button
              onClick={(event) => {
                event.stopPropagation()
                setMediaMode('poster')
              }}
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                border: 'none',
                borderRadius: '999px',
                padding: '8px 12px',
                background: 'rgba(15, 15, 15, 0.78)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              返回封面
            </button>
          )}
        </div>

      </div>

      {!video.isOpus && (
        <div className="video-detail-uploader" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: cardPadding,
          background: 'var(--color-bg-tertiary)',
          borderRadius: cardRadius
        }}>
          <div className="video-detail-avatar" style={{
            width: avatarSize,
            height: avatarSize,
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
              <User size={isCompactLayout ? 24 : 32} />
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

      {/* 视频简介 - 作者面板下方显示 */}
      {!video.isOpus && video.description && video.description.trim() && (
        <div style={{
          padding: cardPadding,
          background: 'var(--color-bg-tertiary)',
          borderRadius: cardRadius,
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

      {/* 右侧 - 视频信息和状态 */}
      <div style={{
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: pageGap
      }}>
        {/* 视频统计信息 */}
        {!video.isOpus && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              padding: cardPadding,
              background: 'var(--color-bg-tertiary)',
              borderRadius: cardRadius
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Eye size={16} style={{ color: 'var(--color-text-secondary)' }} />
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                  {formatNumber(video.view)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={16} style={{ color: 'var(--color-text-secondary)' }} />
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                  {formatNumber(video.danmaku)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ThumbsUp size={16} style={{ color: 'var(--color-text-secondary)' }} />
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                  {formatNumber(video.like)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Coins size={16} style={{ color: 'var(--color-text-secondary)' }} />
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                  {formatNumber(video.coin)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Bookmark size={16} style={{ color: 'var(--color-text-secondary)' }} />
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                  {formatNumber(video.favorite)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageCircle size={16} style={{ color: 'var(--color-text-secondary)' }} />
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                  {formatNumber(video.reply)}
                </span>
              </div>
            </div>
          )}

        {isCollectionMember && (
          <div style={{
            padding: cardPadding,
            background: 'var(--color-bg-tertiary)',
            borderRadius: cardRadius,
            fontSize: responsiveStyle.fontSize.small,
            color: 'var(--color-text-primary)',
            lineHeight: '1.5',
            display: 'grid',
            gap: '12px'
          }}>
            <div>
              所属合集：{video.ugcSeason?.title || '未命名合集'}，共{collectionEpisodeCount}个投稿
            </div>
            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              {[
                { value: 'submission', label: `当前投稿 (${video.pages?.length || 1})` },
                { value: 'collection', label: `合集列表 (${collectionEpisodeCount})` }
              ].map(option => {
                const active = partListMode === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPartListMode(option.value as 'submission' | 'collection')}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: active ? '1px solid var(--color-primary-500)' : '1px solid var(--color-border)',
                      background: active ? 'var(--color-primary-50)' : 'var(--color-bg-primary)',
                      color: active ? 'var(--color-primary-700)' : 'var(--color-text-primary)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 分P信息 */}
        {!showingCollectionList && video.pages && video.pages.length > 1 && (
          <div style={{
            padding: cardPadding,
            background: 'var(--color-bg-tertiary)',
            borderRadius: cardRadius,
            fontSize: responsiveStyle.fontSize.small,
            color: 'var(--color-text-primary)'
          }}>
            共{video.pages.length}个视频，总时长：{formatDuration(video.pages.reduce((total: number, p: any) => total + p.duration, 0))}
          </div>
        )}

        {/* 分P列表（仅多P视频显示） */}
        {!showingCollectionList && video.pages && video.pages.length > 1 && (
          <div style={{
            background: 'var(--color-bg-tertiary)',
            borderRadius: cardRadius,
            padding: listPadding,
            maxHeight: listMaxHeight,
            overflowY: 'auto'
          }}>
            {playablePages.map((page: any, index: number) => {
              const isInList = downloadedCids.has(page.cid)
              const status = downloadedVideoStatus[page.cid] || 'none'
              const isDownloaded = status === 'downloaded'
              const isPlayable = page.playable
              const isActivePlayback = mediaMode === 'local-video' && activePlaybackEntry?.cid === page.cid

              return (
                <div
                  key={page.cid || index}
                  onClick={() => {
                    if (isPlayable && page.localPath) {
                      startLocalPlayback({
                        cid: page.cid,
                        path: page.localPath,
                        exists: true,
                        title: page.part
                      })
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: isCompactLayout ? '10px' : '12px',
                    background: 'var(--color-bg-primary)',
                    borderRadius: isCompactLayout ? '6px' : '8px',
                    marginBottom: index < video.pages.length - 1 ? (isCompactLayout ? '8px' : '10px') : '0',
                    opacity: isInList && !isDownloaded ? 0.6 : 1,
                    cursor: isPlayable ? 'pointer' : 'default',
                    border: isActivePlayback ? '1px solid var(--color-primary-500)' : '1px solid transparent',
                    boxShadow: isActivePlayback ? '0 0 0 3px rgba(59, 130, 246, 0.12)' : 'none'
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
                  {isPlayable && (
                    <span style={{
                      fontSize: '11px',
                      color: 'var(--color-primary-700)',
                      background: 'var(--color-primary-50)',
                      padding: badgePadding,
                      borderRadius: '4px',
                      fontWeight: '600',
                      marginRight: '8px'
                    }}>
                      {isActivePlayback ? '正在播放' : '播放本地'}
                    </span>
                  )}
                  {isDownloaded && !isPlayable && (
                    <span style={{
                      fontSize: '11px',
                      color: 'var(--color-success-600)',
                      background: 'var(--color-success-50)',
                      padding: badgePadding,
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
                      padding: badgePadding,
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

        {showingCollectionList && (
          <div style={{
            background: 'var(--color-bg-tertiary)',
            borderRadius: cardRadius,
            padding: listPadding,
            maxHeight: listMaxHeight,
            overflowY: 'auto'
          }}>
            {collectionDisplayParts.map((part, index: number) => {
              const hasSubparts = part.subparts.length > 0
              const expanded = expandedCollectionItems.has(part.bvid)

              return (
                <div
                  key={`${part.bvid}-${part.cid || index}`}
                  style={{
                    background: 'var(--color-bg-primary)',
                    borderRadius: isCompactLayout ? '6px' : '8px',
                    marginBottom: index < collectionDisplayParts.length - 1 ? (isCompactLayout ? '8px' : '10px') : '0',
                    border: part.bvid === video.bvid ? '1px solid var(--color-primary-500)' : '1px solid transparent',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: hasSubparts ? '22px 64px minmax(0, 1fr)' : '64px minmax(0, 1fr)',
                    gap: '12px',
                    alignItems: 'center',
                    padding: isCompactLayout ? '10px' : '12px'
                  }}>
                    {hasSubparts && (
                      <button
                        type="button"
                        onClick={() => toggleCollectionItemExpanded(part.bvid)}
                        aria-label={expanded ? '收起分P' : '展开分P'}
                        style={{
                          width: '22px',
                          height: '22px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--color-text-secondary)',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    )}
                    <div style={{
                      width: '64px',
                      aspectRatio: '16 / 9',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      background: 'var(--color-bg-tertiary)'
                    }}>
                      {part.cover ? (
                        <img
                          src={getProxyImageUrl(part.cover)}
                          alt={part.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                          <Film size={18} style={{ color: 'var(--color-text-tertiary)' }} />
                        </div>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: responsiveStyle.fontSize.small,
                        color: 'var(--color-text-primary)',
                        marginBottom: '4px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        P{part.page}: {part.title}
                        {part.bvid === video.bvid && (
                          <span style={{
                            marginLeft: '8px',
                            fontSize: '11px',
                            color: 'var(--color-primary-700)',
                            background: 'var(--color-primary-50)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600
                          }}>
                            当前投稿
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                        {part.bvid}{part.duration ? ` · ${formatDuration(part.duration)}` : ''}
                        {hasSubparts ? ` · 包含${part.subparts.length}个视频` : ''}
                      </div>
                    </div>
                  </div>

                  {hasSubparts && expanded && (
                    <div style={{
                      display: 'grid',
                      gap: '6px',
                      padding: isCompactLayout ? '0 10px 10px 108px' : '0 12px 12px 110px'
                    }}>
                      {part.subparts.map((subpart: DownloadPart) => (
                        <div key={`${subpart.bvid}-${subpart.cid || subpart.page}`} style={{
                          minWidth: 0,
                          padding: '8px 10px',
                          borderRadius: '6px',
                          background: 'var(--color-bg-tertiary)',
                          color: 'var(--color-text-secondary)',
                          fontSize: '12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '10px'
                        }}>
                          <span style={{
                            minWidth: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            分P{subpart.page}: {subpart.title}
                          </span>
                          <span style={{ flexShrink: 0, color: 'var(--color-text-tertiary)' }}>
                            {subpart.duration ? formatDuration(subpart.duration) : '--:--'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
      </div>

      {/* 图文内容 - 仅图文显示 */}
      {video.isOpus && localOpusBlocks.length > 0 && (
        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {localOpusBlocks.map((block, index) => {
            if (block.type === 'heading') {
              return (
                <h2
                  key={`local-${index}`}
                  style={{
                    fontSize: '20px',
                    lineHeight: '1.4',
                    color: 'var(--color-text-primary)',
                    margin: 0
                  }}
                >
                  {block.text}
                </h2>
              )
            }

            if (block.type === 'paragraph') {
              return (
                <p
                  key={`local-${index}`}
                  style={{
                    fontSize: '15px',
                    lineHeight: '1.8',
                    color: 'var(--color-text-primary)',
                    margin: 0,
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {block.text}
                </p>
              )
            }

            return (
              <img
                key={`local-${index}`}
                src={block.src}
                alt={block.alt}
                style={{
                  width: '100%',
                  borderRadius: '8px'
                }}
              />
            )
          })}
        </div>
      )}

      {video.isOpus && localOpusBlocks.length === 0 && video.opusParagraphs && video.opusParagraphs.length > 0 && (
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

      {video.comments && video.comments.length > 0 && (
        <section className="video-detail-comments">
          <div className="video-detail-card-header">
            <h3 className="video-detail-card-title">热门评论</h3>
          </div>
          <div className="video-detail-comment-list">
            {video.comments.slice(0, 3).map((comment, index) => {
              const isTop = comment.type === 'top'
              return (
                <article
                  key={index}
                  className={`video-detail-comment-item${isTop ? ' is-top' : ''}`}
                >
                  <div className="video-detail-comment-avatar" aria-hidden="true">
                    <img src={getCommentAvatarImage(comment.author)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  </div>
                  <div className="video-detail-comment-body">
                    <div className="video-detail-comment-topline">
                      <div className="video-detail-comment-author-row">
                        <span className="video-detail-comment-author">{comment.author}</span>
                        {isTop && (
                          <span className="video-detail-comment-badge">置顶</span>
                        )}
                      </div>
                      <span className="video-detail-comment-time">{formatTime(comment.time)}</span>
                    </div>
                    <p className="video-detail-comment-content">
                      {comment.content}
                    </p>
                    <div className="video-detail-comment-actions">
                      <span className="video-detail-comment-action">
                        <ThumbsUp size={13} />
                        {comment.like}
                      </span>
                      {comment.reply > 0 && (
                        <span className="video-detail-comment-action">
                          <MessageCircle size={13} />
                          {comment.reply}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <div style={{
        padding: cardPadding,
        background: 'var(--color-bg-tertiary)',
        borderRadius: cardRadius
      }}>
        <button
          onClick={handleAddToDownload}
          disabled={downloading}
          style={{
            width: '100%',
            padding: isCompactLayout ? '14px' : '16px',
            background: downloading ? 'var(--color-secondary-400)' : 'var(--color-primary-600)',
            color: 'var(--color-white)',
            border: 'none',
            borderRadius: cardRadius,
            fontSize: isCompactLayout ? '16px' : '17px',
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
      </main>

      {/* AI笔记面板子路由 */}
      <Outlet />
    </div>
  )

}
