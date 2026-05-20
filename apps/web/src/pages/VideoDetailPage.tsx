import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
import AlertModal from '../components/AlertModal'
import { ArrowLeft, ChevronDown, ChevronRight, Film, FolderTree, List, MessageCircle, Play, SkipBack, SkipForward, Sparkles, ThumbsUp, User, Eye, MessageSquare, Coins, Bookmark, Pin, PinOff } from 'lucide-react'
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
import { MarkdownPreview } from '../components/ai/MarkdownPreview'

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

const parsePageNumberFromLocalEntry = (entry: LocalPlaybackEntry): number | null => {
  const text = `${entry.title || ''} ${entry.path || ''}`
  const match = text.match(/(?:^|[\/\\\s_-])P?0*(\d{1,3})(?=\s|[.、．_-]|$)/i)
  if (!match) return null
  const page = Number(match[1])
  return Number.isFinite(page) && page > 0 ? page : null
}

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
  const [relatedPanelCollapsed, setRelatedPanelCollapsed] = useState(true)
  const [submissionListCollapsed, setSubmissionListCollapsed] = useState(false)
  const [expandedCollectionItems, setExpandedCollectionItems] = useState<Set<string>>(new Set())
  const [activePlaybackEntry, setActivePlaybackEntry] = useState<LocalPlaybackEntry | null>(null)
  const [switchingLayout, setSwitchingLayout] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<any>(null)
  const [localOpusContent, setLocalOpusContent] = useState<LocalOpusContent | null>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const pendingSeekSecondsRef = useRef<number | null>(null)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isVideoPinned, setIsVideoPinned] = useState(false)
  const [mobileDetailTab, setMobileDetailTab] = useState<'intro' | 'ai'>('intro')
  const [aiNoteMarkdown, setAiNoteMarkdown] = useState('')
  const [aiNoteFolderPath, setAiNoteFolderPath] = useState<string | null>(null)
  const [aiNoteLoading, setAiNoteLoading] = useState(false)
  const [aiNoteError, setAiNoteError] = useState<string | null>(null)
  const [aiNoteRevision, setAiNoteRevision] = useState(0)
  const [localVideoDurationSeconds, setLocalVideoDurationSeconds] = useState<number | null>(null)
  const [alertModal, setAlertModal] = useState<{
    show: boolean
    title: string
    message: string
    type: 'success' | 'error'
    showConfirm?: boolean
    onConfirm?: () => void
  }>({
    show: false,
    title: '',
    message: '',
    type: 'success',
    showConfirm: false
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
  const shouldStickyPlayer = mediaMode === 'local-video' && !video?.isOpus && (isVideoPinned || isVideoPlaying)

  const normalizeLocalFsPath = (value: string): string => {
    return (value || '').replace(/^file:\/\//i, '').trim()
  }

  const aiNoteFileId = useMemo(() => {
    if (!videoId || type === 'opus') return ''
    // 1) Prefer the currently playing local video file.
    if (activePlaybackEntry?.path) {
      return normalizeLocalFsPath(activePlaybackEntry.path)
    }

    // 2) When not playing, prefer the first playable local entry.
    const initialEntry = selectInitialPlayableEntry(
      localPlayback,
      video?.pages && video.pages.length > 1 ? undefined : video?.cid
    )
    if (initialEntry?.path) {
      return normalizeLocalFsPath(initialEntry.path)
    }

    // 3) Fallback to folder path (may contain series root) and finally bvid.
    const candidate = localPlayback?.folder_path || videoId
    return typeof candidate === 'string' ? normalizeLocalFsPath(candidate) : String(candidate || '')
  }, [activePlaybackEntry?.path, localPlayback, type, video?.cid, video?.pages, videoId])

  const aiNoteEffectiveFileId = aiNoteFileId

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!videoId || type === 'opus') {
        setAiNoteMarkdown('')
        setAiNoteFolderPath(null)
        setAiNoteError(null)
        setAiNoteLoading(false)
        return
      }

      if (!aiNoteEffectiveFileId) {
        setAiNoteMarkdown('')
        setAiNoteFolderPath(null)
        setAiNoteError(null)
        return
      }

      setAiNoteLoading(true)
      setAiNoteError(null)

      try {
        const response = await apiService.getLocalFile(aiNoteEffectiveFileId, 'note')
        if (cancelled) return

        if (response.success) {
          setAiNoteMarkdown(typeof response.data === 'string' ? response.data : '')
          setAiNoteFolderPath(response.folder_path ? String(response.folder_path) : null)
          setAiNoteError(null)
        } else {
          setAiNoteMarkdown('')
          setAiNoteFolderPath(null)
          setAiNoteError(response.error || '加载笔记失败')
        }
      } catch (err) {
        if (cancelled) return
        setAiNoteMarkdown('')
        setAiNoteFolderPath(null)
        setAiNoteError(err instanceof Error ? err.message : '加载笔记失败')
      } finally {
        if (!cancelled) setAiNoteLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [aiNoteEffectiveFileId, aiNoteRevision, type, videoId])

  useEffect(() => {
    if (mediaMode === 'poster') {
      setIsVideoPlaying(false)
      setIsVideoPinned(false)
      pendingSeekSecondsRef.current = null
    }
  }, [mediaMode])

  // 获取代理图片URL
  const getProxyImageUrl = (url: string | null | undefined): string => {
    if (!url) return ''
    return getAvatarProxyUrl(url)
  }

  const getCommentAvatarImage = (_author: string, index = 0): string => {
    const urls = ['/avatar/avatar1.png', '/avatar/avatar2.png', '/avatar/avatar3.png']
    return urls[index % urls.length]
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

  const refreshLocalPlayback = useCallback(async () => {
    setLocalPlayback(null)
    setActivePlaybackEntry(null)
    setMediaMode('poster')

    if (!video || video.isOpus || !video.bvid) {
      return
    }

    try {
      const response = await apiService.getLocalPlaybackMap(video.bvid)
      if (response.success && response.data) {
        setLocalPlayback(response.data)
      }
    } catch (playbackError) {
      console.error('[VideoDetail] 获取本地播放映射失败:', playbackError)
    }
  }, [video?.bvid, video?.isOpus])

  useEffect(() => {
    refreshLocalPlayback()
  }, [refreshLocalPlayback])

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
      const localPlayablePages = buildPlayablePages(video.pages, localPlayback)
      const playableCidSet = new Set(
        localPlayablePages
          .filter((page: any) => page.playable)
          .map((page: any) => page.cid)
      )

      video.pages.forEach((page: any) => {
        const pageBvid = page.bvid || video.bvid
        // 检查是否在新下载系统队列中
        const hasInNewQueue = newSystemTasks.some(task =>
          task.media_id === pageBvid &&
          task.meta?.cid === page.cid &&
          !['completed', 'cancelled'].includes(task.state)
        )
        
        if (hasInNewQueue) {
          cidsInList.add(page.cid)
          downloadedStatus[page.cid] = 'in_list'
        } else if (playableCidSet.has(page.cid)) {
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
  }, [video, newQueueStore.tasks, localPlayback])
  
  // 检查单个视频的下载状态
  const checkSingleVideoStatus = async () => {
    if (!video) return
    
    try {
      await videoLibraryService.checkBeforeAdd({
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
      
      let status: 'none' | 'in_list' | 'downloaded' = 'none'
      const hasLocalVideo = playableEntries.length > 0

      if (hasLocalVideo) {
        status = 'downloaded'
      } else if (hasInNewQueue) {
        status = 'in_list'
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
      if (playableEntries.length > 0) {
        setDownloadedVideoStatus({ [video.cid]: 'downloaded' })
        setDownloadedCids(new Set())
      }
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
  const localPlayablePageNumbers = new Set(
    playableEntries
      .map(parsePageNumberFromLocalEntry)
      .filter((page): page is number => page !== null)
  )
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
  const isCollectionPartCompleted = (part: DownloadPart & { subparts: DownloadPart[] }) => {
    if (part.subparts.length > 0) {
      return part.subparts.every(subpart => {
        const downloadedByTask = isCollectionItemCompleted(subpart)
        const downloadedByLocalPage = localPlayablePageNumbers.has(subpart.page)
        return downloadedByTask || downloadedByLocalPage
      })
    }

    return isCollectionItemCompleted(part)
  }
  const collectionEpisodeCount = video?.ugcSeason?.episode_count || video?.ugcSeason?.sections?.reduce(
    (total: number, section: any) => total + (section.episodes?.length || 0),
    0
  ) || 0
  const isCollectionMember = !video?.isOpus && collectionEpisodeCount > 1
  const showingCollectionList = isCollectionMember && partListMode === 'collection'
  const submissionTotalDuration = video?.pages?.reduce((total: number, page: any) => total + (page.duration || 0), 0) || 0
  const collectionVideoCount = collectionDisplayParts.reduce((total: number, part) => {
    if (part.subparts.length > 0) {
      return total + part.subparts.length
    }
    return total + 1
  }, 0)
  const collectionTotalDuration = collectionDisplayParts.reduce((total: number, part) => {
    if (part.duration) return total + part.duration
    if (part.subparts.length > 0) {
      return total + part.subparts.reduce((subTotal, subpart) => subTotal + (subpart.duration || 0), 0)
    }
    return total
  }, 0)
  const activeLocalVideoUrl = activePlaybackEntry ? getLocalVideoUrl(normalizeLocalFsPath(activePlaybackEntry.path)) : ''
  const playableLocalPages = playablePages.filter((page: any) => page.playable && page.localPath)
  const activePlayablePageIndex = activePlaybackEntry
    ? playableLocalPages.findIndex((page: any) =>
      (activePlaybackEntry.cid && page.cid === activePlaybackEntry.cid) ||
      page.localPath === activePlaybackEntry.path
    )
    : -1
  const activePlayablePage = activePlayablePageIndex >= 0 ? playableLocalPages[activePlayablePageIndex] : null
  const seriesLayoutMode = localPlayback?.series_layout?.mode
  const submissionGridColumns = 'repeat(3, minmax(0, 1fr))'
  const collectionGridColumns = 'repeat(3, minmax(0, 1fr))'
  const canSwitchSeriesLayout = Boolean(
    !video?.isOpus &&
    localPlayback?.folder_path &&
    playableEntries.length > 1 &&
    (seriesLayoutMode === 'flat' || seriesLayoutMode === 'folder' || seriesLayoutMode === 'mixed')
  )
  const getLayoutButtonStyle = (mode: 'flat' | 'folder') => ({
    width: '30px',
    height: '30px',
    border: 'none',
    borderRadius: '7px',
    background: seriesLayoutMode === mode ? 'var(--color-primary-600)' : 'var(--color-bg-primary)',
    color: seriesLayoutMode === mode ? 'var(--color-white)' : 'var(--color-text-secondary)',
    display: 'grid',
    placeItems: 'center',
    cursor: seriesLayoutMode === mode ? 'default' : 'pointer',
    opacity: switchingLayout && seriesLayoutMode !== mode ? 0.6 : 1
  })

  const startLocalPlayback = (entry: LocalPlaybackEntry) => {
    setActivePlaybackEntry({
      ...entry,
      path: normalizeLocalFsPath(entry.path),
    })
    setMediaMode('local-video')
  }

  const handleSwitchSeriesLayout = async (targetMode: 'flat' | 'folder') => {
    if (!localPlayback?.folder_path || switchingLayout) {
      return
    }
    if (seriesLayoutMode === targetMode) {
      return
    }

    setSwitchingLayout(true)
    try {
      const planResponse = await apiService.switchSeriesLayout({
        folder_path: localPlayback.folder_path,
        target_mode: targetMode,
        dry_run: true
      })
      const plan = planResponse.data
      if (!planResponse.success || !plan) {
        throw new Error(planResponse.message || '生成整理计划失败')
      }
      if (plan.move_count === 0) {
        setAlertModal({
          show: true,
          title: '无需整理',
          message: '当前目录已经是目标整理模式',
          type: 'success'
        })
        return
      }
      if (plan.conflicts?.length) {
        throw new Error(`目标路径存在冲突，未执行移动：${plan.conflicts.length} 个文件`)
      }

      const targetLabel = targetMode === 'flat' ? '根目录平铺' : '分P子目录'
      const confirmed = window.confirm(`将系列目录切换为「${targetLabel}」模式，并真实移动 ${plan.move_count} 个文件。是否继续？`)
      if (!confirmed) {
        return
      }

      const applyResponse = await apiService.switchSeriesLayout({
        folder_path: localPlayback.folder_path,
        target_mode: targetMode,
        dry_run: false
      })
      if (!applyResponse.success) {
        throw new Error(applyResponse.message || '切换目录模式失败')
      }

      await refreshLocalPlayback()
      setAlertModal({
        show: true,
        title: '整理完成',
        message: applyResponse.message || `已切换为${targetLabel}模式`,
        type: 'success'
      })
    } catch (error) {
      setAlertModal({
        show: true,
        title: '整理失败',
        message: error instanceof Error ? error.message : '切换目录模式失败',
        type: 'error'
      })
    } finally {
      setSwitchingLayout(false)
    }
  }

  const startPagePlayback = (page: any) => {
    if (!page?.playable || !page.localPath) {
      return
    }

    startLocalPlayback({
      cid: page.cid,
      path: page.localPath,
      exists: true,
      title: page.part || `P${page.page}`
    })
  }

  const switchPlayablePage = (direction: -1 | 1) => {
    if (playableLocalPages.length <= 1) {
      return
    }

    const currentIndex = activePlayablePageIndex >= 0 ? activePlayablePageIndex : 0
    const nextIndex = currentIndex + direction

    if (nextIndex < 0 || nextIndex >= playableLocalPages.length) {
      return
    }

    startPagePlayback(playableLocalPages[nextIndex])
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

    const initialEntry = selectInitialPlayableEntry(
      localPlayback,
      video.pages && video.pages.length > 1 ? undefined : video.cid
    )
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

  const parseTimestampToSeconds = (timestamp: unknown): number | null => {
    if (typeof timestamp !== 'string') return null
    const trimmed = timestamp.trim()
    const match = trimmed.match(/^(\d{1,2}:)?\d{2}:\d{2}$/)
    if (!match) return null
    const parts = trimmed.split(':').map(Number)
    if (parts.some(p => !Number.isFinite(p))) return null
    if (parts.length === 2) {
      const [mm, ss] = parts
      return mm * 60 + ss
    }
    if (parts.length === 3) {
      const [hh, mm, ss] = parts
      return hh * 3600 + mm * 60 + ss
    }
    return null
  }

  type AiNoteKeypoint = { timestamp: string; seconds: number; title: string }

  const aiNoteKeypoints = useMemo<AiNoteKeypoint[]>(() => {
    if (!aiNoteMarkdown.trim()) return []
    const lines = aiNoteMarkdown.split(/\r?\n/)

    const results: AiNoteKeypoint[] = []
    const seen = new Set<number>()

    const pushPoint = (timestamp: unknown, title: unknown) => {
      const seconds = parseTimestampToSeconds(timestamp)
      if (seconds === null) return
      if (seconds < 0) return
      if (seen.has(seconds)) return
      seen.add(seconds)
      const ts = typeof timestamp === 'string' ? timestamp.trim() : ''
      const tt = typeof title === 'string' ? title.trim() : ''
      if (!ts) return
      results.push({ timestamp: ts, seconds, title: tt })
    }

    // Prefer the explicit "## 时间戳" section.
    const tsHeadingIndex = lines.findIndex(line => /^\s*##\s*时间戳\s*$/.test(line))
    if (tsHeadingIndex >= 0) {
      for (let i = tsHeadingIndex + 1; i < lines.length; i++) {
        const line = lines[i]
        if (/^\s*#{1,6}\s+/.test(line)) break
        const itemMatch = line.match(/^\s*-\s*((?:[0-9]{1,2}:)?[0-9]{2}:[0-9]{2})\s+(.+)\s*$/)
        if (!itemMatch) continue
        pushPoint(itemMatch[1], itemMatch[2])
      }
    }

    // Fallback: scan headings with timestamps.
    if (results.length === 0) {
      for (const line of lines) {
        const headingMatch = line.match(/^\s*#{2,6}\s*(([0-9]{1,2}:)?[0-9]{2}:[0-9]{2})\s+(.+)\s*$/)
        if (!headingMatch) continue
        pushPoint(headingMatch[1], headingMatch[3])
      }
    }

    results.sort((a, b) => a.seconds - b.seconds)
    return results.slice(0, 18)
  }, [aiNoteMarkdown])

  const keypointBarDurationSeconds = useMemo(() => {
    const fallback = typeof video?.duration === 'number' ? video.duration : Number(video?.duration || 0)
    const durationFromMeta = Number.isFinite(fallback) && fallback > 0 ? fallback : 0
    const durationFromVideo = typeof localVideoDurationSeconds === 'number' && localVideoDurationSeconds > 0
      ? localVideoDurationSeconds
      : 0
    const last = aiNoteKeypoints.length > 0 ? aiNoteKeypoints[aiNoteKeypoints.length - 1] : undefined
    return durationFromVideo || durationFromMeta || (last?.seconds || 0)
  }, [aiNoteKeypoints, localVideoDurationSeconds, video?.duration])

  const handleSeekToSeconds = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return
    if (!video || video.isOpus || !hasLocalPlayback) return

    if (mediaMode !== 'local-video') {
      pendingSeekSecondsRef.current = seconds
      handleCoverPlay()
      return
    }

    const el = videoElementRef.current
    if (!el) return

    try {
      el.currentTime = seconds
      const maybePromise = el.play()
      if (maybePromise && typeof (maybePromise as any).catch === 'function') {
        ;(maybePromise as any).catch(() => {})
      }
    } catch {
      // ignore
    }
  }, [handleCoverPlay, hasLocalPlayback, mediaMode, video])

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
      const status = downloadedVideoStatus[video.cid] || (hasLocalPlayback ? 'downloaded' : 'none')
      return status === 'none' ? 0 : 1
    }
    
    // 多P视频：检查每个分P
    let count = 0
    video.pages.forEach((page: any) => {
      const status = downloadedVideoStatus[page.cid] || 'none'
      if (status === 'in_list' || status === 'downloaded') {
        count++
      }
    })
    return count
  }

  const getCollectionRemainingDownloadCount = () => {
    return collectionDisplayParts.filter(part => !isCollectionPartCompleted(part)).length
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
    const status = downloadedVideoStatus[video?.cid || 0] || (hasLocalPlayback ? 'downloaded' : 'none')
    
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

  if (video.pages && video.pages.length > 1) {
    const remainingPages = video.pages.filter((page: any) => (downloadedVideoStatus[page.cid] || 'none') === 'none')
    if (remainingPages.length > 0) {
      await performDownload(video, e)
      return
    }
  }
  
  try {
    const decision = await videoLibraryService.checkBeforeAdd(video)
    
    switch (decision.action) {
      case 'add':
        // 直接添加
        await performDownload(video, e)
        break
        
      case 'show_confirm':
        setSelectedVideo(video)
        setAlertModal({
          show: true,
          title: '重新下载视频',
          message: `视频 ${video.title || '未知视频'} 已在视频库中，是否重新下载？`,
          type: 'success',
          showConfirm: true,
          onConfirm: async () => {
            await handleReDownloadConfirm(video)
          }
        })
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

const performDownload = async (video: any, e: React.MouseEvent, options?: { forceRedownload?: boolean }) => {
  setDownloading(true)
  try {
    if (type !== 'opus') {
      let selectedPages: Set<number> | undefined

      if (video?.pages?.length > 1) {
        const remainingPages = video.pages
          .filter((page: any) => (downloadedVideoStatus[page.cid] || 'none') === 'none')
          .map((page: any) => page.page)

        if (remainingPages.length > 0 && remainingPages.length < video.pages.length) {
          selectedPages = new Set(remainingPages)
        }
      }

      const result = await toggleDownload(video as any, e, {
        selectedPages,
        forceRedownload: options?.forceRedownload
      })

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

const handleSinglePageDownload = async (page: any, e: React.MouseEvent) => {
  e.stopPropagation()
  if (!video || type === 'opus') return

  const status = downloadedVideoStatus[page.cid] || 'none'
  if (status !== 'none') {
    return
  }

  setDownloading(true)
  try {
    const result = await toggleDownload(video as any, e, {
      selectedPages: new Set([page.page])
    })

    setAlertModal({
      show: true,
      title: result.success ? '操作成功' : '操作失败',
      message: result.message,
      type: result.success ? 'success' : 'error',
      showConfirm: false
    })
  } catch (error) {
    console.error('添加单个分P失败:', error)
    setAlertModal({
      show: true,
      title: '操作失败',
      message: '添加下载失败',
      type: 'error',
      showConfirm: false
    })
  } finally {
    setDownloading(false)
  }
}

const handleReDownloadConfirm = async (targetVideo = selectedVideo) => {
  if (!targetVideo) return
  
  try {
    await performDownload(targetVideo, {} as React.MouseEvent, { forceRedownload: true })
    setSelectedVideo(null)
    setAlertModal({
      show: true,
      title: '操作成功',
      message: '已重新添加到下载列表',
      type: 'success',
      showConfirm: false
    })
  } catch (error) {
    console.error('重新下载失败:', error)
    setAlertModal({
      show: true,
      title: '操作失败',
      message: '重新下载失败',
      type: 'error',
      showConfirm: false
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

  const renderCommentsSection = () => {
    if (!video.comments || video.comments.length === 0) {
      return null
    }

    return (
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
                  <img src={getCommentAvatarImage(comment.author, index)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
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
    )
  }

  const renderAiNotePanel = () => {
    if (video.isOpus) {
      return null
    }

    return (
      <section
        aria-label="AI 笔记"
        style={{
          padding: cardPadding,
          background: 'var(--color-bg-tertiary)',
          borderRadius: cardRadius,
          border: '1px solid var(--color-border)',
          overflow: 'hidden'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: aiNoteKeypoints.length > 0 ? '12px' : '10px'
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: responsiveStyle.fontSize.small,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              lineHeight: '1.2'
            }}>
              AI 笔记
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
              点击时间戳即可跳转播放进度
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setAiNoteRevision((v) => v + 1)}
              disabled={aiNoteLoading}
              style={{
                padding: '7px 10px',
                borderRadius: '999px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                cursor: aiNoteLoading ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 650
              }}
            >
              刷新
            </button>
            <button
              type="button"
              onClick={() => {
                navigate(`${aiPanelPath}#note`, {
                  state: {
                    initialFileId: aiNoteEffectiveFileId || undefined,
                  }
                })
              }}
              style={{
                padding: '7px 10px',
                borderRadius: '999px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 650
              }}
            >
              打开面板
            </button>
          </div>
        </div>

        {aiNoteKeypoints.length > 0 && keypointBarDurationSeconds > 0 && (
          <div
            className="video-detail-keypoint-bar-wrap"
            style={{ marginBottom: '12px' }}
          >
            <div className="video-detail-keypoint-bar" role="list" aria-label="关键点时间轴">
              {aiNoteKeypoints.map((item, index) => {
                const next = aiNoteKeypoints[index + 1]
                const start = item.seconds
                const end = next ? next.seconds : keypointBarDurationSeconds
                const safeStart = Math.max(0, Math.min(start, keypointBarDurationSeconds))
                const safeEnd = Math.max(safeStart, Math.min(end, keypointBarDurationSeconds))
                const left = (safeStart / keypointBarDurationSeconds) * 100
                const width = ((safeEnd - safeStart) / keypointBarDurationSeconds) * 100
                const hue = Math.round((index / Math.max(1, aiNoteKeypoints.length)) * 220)

                return (
                  <button
                    key={`${item.seconds}-${item.timestamp}`}
                    type="button"
                    role="listitem"
                    className="video-detail-keypoint-segment"
                    onClick={() => handleSeekToSeconds(item.seconds)}
                    title={`${item.timestamp}  ${item.title}`}
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(1.5, width)}%`,
                      background: `linear-gradient(90deg, hsla(${hue}, 85%, 62%, 0.75), hsla(${hue}, 85%, 62%, 0.55))`,
                      borderColor: `hsla(${hue}, 85%, 72%, 0.55)`,
                    }}
                    aria-label={`${item.timestamp} ${item.title}`}
                  >
                    <span className="sr-only">{`${item.timestamp} ${item.title}`}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {aiNoteLoading && (
          <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
            加载中...
          </div>
        )}

        {!aiNoteLoading && aiNoteError && (
          <div style={{ fontSize: '12px', color: 'var(--color-error-600)' }}>
            {aiNoteError}
          </div>
        )}

        {!aiNoteLoading && !aiNoteError && !aiNoteMarkdown.trim() && (
          <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
            当前分P暂无笔记
          </div>
        )}

        {!aiNoteLoading && !aiNoteError && aiNoteMarkdown.trim() && (
          <div style={{ marginTop: '10px' }}>
            <MarkdownPreview
              content={aiNoteMarkdown}
              sourceFolderPath={aiNoteFolderPath}
              onSeekToSeconds={handleSeekToSeconds}
              className="video-detail-ai-markdown"
            />
          </div>
        )}
      </section>
    )
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
      {/* 主内容区 */}
      <div className="video-detail-sections" style={{ gap: pageGap }}>
      <div className="video-detail-left">
      <div className={`video-detail-player-rail${shouldStickyPlayer ? ' is-sticky' : ''}`}>
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
                ref={videoElementRef}
                src={activeLocalVideoUrl}
                controls
                autoPlay
                playsInline
                poster={video.cover ? getProxyImageUrl(video.cover) : undefined}
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
                onEnded={() => setIsVideoPlaying(false)}
                onLoadedMetadata={() => {
                  const pending = pendingSeekSecondsRef.current
                  if (pending === null) return
                  pendingSeekSecondsRef.current = null
                  if (!videoElementRef.current) return
                  try {
                    videoElementRef.current.currentTime = pending
                  } catch {
                    // ignore
                  }
                }}
                onDurationChange={() => {
                  const el = videoElementRef.current
                  if (!el) return
                  const duration = Number(el.duration)
                  if (Number.isFinite(duration) && duration > 0) {
                    setLocalVideoDurationSeconds(duration)
                  }
                }}
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
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setIsVideoPinned((prev) => !prev)
                }}
                aria-label={isVideoPinned ? '取消钉固' : '钉固播放器'}
                title={isVideoPinned ? '取消钉固' : '钉固播放器'}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  width: '38px',
                  height: '38px',
                  borderRadius: '999px',
                  border: 'none',
                  padding: 0,
                  background: 'rgba(15, 15, 15, 0.78)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  zIndex: 2
                }}
              >
                {isVideoPinned ? <PinOff size={18} /> : <Pin size={18} />}
              </button>
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
                  fontWeight: 600,
                  zIndex: 2
                }}
              >
                返回封面
              </button>

              {playableLocalPages.length > 1 && activePlayablePage && (
                <div style={{
                  position: 'absolute',
                  left: '12px',
                  right: '12px',
                  bottom: '52px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  pointerEvents: 'none',
                  zIndex: 2
                }}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      switchPlayablePage(-1)
                    }}
                    disabled={activePlayablePageIndex <= 0}
                    aria-label="播放上一P"
                    title="播放上一P"
                    style={{
                      width: '38px',
                      height: '38px',
                      border: 'none',
                      borderRadius: '999px',
                      background: activePlayablePageIndex <= 0 ? 'rgba(15, 15, 15, 0.32)' : 'rgba(15, 15, 15, 0.78)',
                      color: '#fff',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: activePlayablePageIndex <= 0 ? 'not-allowed' : 'pointer',
                      pointerEvents: 'auto'
                    }}
                  >
                    <SkipBack size={17} />
                  </button>
                  <div style={{
                    minWidth: 0,
                    maxWidth: 'calc(100% - 112px)',
                    padding: '7px 10px',
                    borderRadius: '999px',
                    background: 'rgba(15, 15, 15, 0.72)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    pointerEvents: 'auto'
                  }}>
                    P{activePlayablePage.page}: {activePlayablePage.part || activePlaybackEntry.title || '当前视频'}
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      switchPlayablePage(1)
                    }}
                    disabled={activePlayablePageIndex >= playableLocalPages.length - 1}
                    aria-label="播放下一P"
                    title="播放下一P"
                    style={{
                      width: '38px',
                      height: '38px',
                      border: 'none',
                      borderRadius: '999px',
                      background: activePlayablePageIndex >= playableLocalPages.length - 1 ? 'rgba(15, 15, 15, 0.32)' : 'rgba(15, 15, 15, 0.78)',
                      color: '#fff',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: activePlayablePageIndex >= playableLocalPages.length - 1 ? 'not-allowed' : 'pointer',
                      pointerEvents: 'auto'
                    }}
                  >
                    <SkipForward size={17} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {!video.isOpus && isCompactLayout && (
          <div className="video-detail-player-tabs" role="tablist" aria-label="详情页切换">
            <button
              type="button"
              role="tab"
              aria-selected={mobileDetailTab === 'intro'}
              className={`video-detail-player-tab${mobileDetailTab === 'intro' ? ' is-active' : ''}`}
              onClick={() => setMobileDetailTab('intro')}
            >
              简介
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileDetailTab === 'ai'}
              className={`video-detail-player-tab${mobileDetailTab === 'ai' ? ' is-active' : ''}`}
              onClick={() => setMobileDetailTab('ai')}
            >
              AI
            </button>
          </div>
        )}

      </div>

      {(!isCompactLayout || mobileDetailTab === 'intro') && (
      <div className="video-detail-intro-panel">
      {!video.isOpus && (isCollectionMember || (video.pages && video.pages.length > 1)) && (
        <div style={{
          padding: cardPadding,
          background: 'var(--color-bg-tertiary)',
          borderRadius: cardRadius,
          display: 'grid',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={() => setRelatedPanelCollapsed(prev => !prev)}
            style={{
              width: '100%',
              padding: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              textAlign: 'left',
              color: 'var(--color-text-primary)'
            }}
            aria-expanded={!relatedPanelCollapsed}
            aria-label={relatedPanelCollapsed ? '展开合集与分集信息' : '折叠合集与分集信息'}
          >
            <div style={{ display: 'grid', gap: '4px', minWidth: 0 }}>
                <span style={{
                  fontSize: responsiveStyle.fontSize.small,
                  fontWeight: 600,
                  color: 'var(--color-text-primary)'
                }}>
                {showingCollectionList
                  ? `合集与分集信息 · 共${collectionEpisodeCount}个投稿，${collectionVideoCount}个视频`
                  : `分集信息 · 共${video.pages?.length || 1}个视频`}
              </span>
              {isCollectionMember && (
                <span style={{
                  fontSize: '12px',
                  color: 'var(--color-text-tertiary)'
                }}>
                  {video.ugcSeason?.title || '未命名合集'}
                </span>
              )}
            </div>
            {relatedPanelCollapsed ? (
              <ChevronRight size={18} style={{ flexShrink: 0, color: 'var(--color-text-secondary)' }} />
            ) : (
              <ChevronDown size={18} style={{ flexShrink: 0, color: 'var(--color-text-secondary)' }} />
            )}
          </button>

          {!relatedPanelCollapsed && (
            <>
              {isCollectionMember && (
                <div style={{
                  padding: cardPadding,
                  background: 'var(--color-bg-primary)',
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
                    gap: '10px',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'nowrap'
                  }}>
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      minWidth: 0,
                      flex: 1
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
                    <button
                      type="button"
                      onClick={() => setSubmissionListCollapsed(prev => !prev)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '8px',
                        minWidth: 0,
                        flexShrink: 0,
                        color: 'var(--color-text-primary)',
                        padding: 0
                      }}
                      aria-expanded={!submissionListCollapsed}
                      aria-label={submissionListCollapsed
                        ? (showingCollectionList ? '展开合集列表' : '展开当前投稿视频列表')
                        : (showingCollectionList ? '折叠合集列表' : '折叠当前投稿视频列表')}
                    >
                      <span style={{
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)',
                        whiteSpace: 'nowrap'
                      }}>
                        {showingCollectionList
                          ? `${collectionEpisodeCount}投稿 · ${collectionVideoCount}视频 · ${formatDuration(collectionTotalDuration)}`
                          : `${video.pages?.length || 0}视频 · ${formatDuration(submissionTotalDuration)}`}
                      </span>
                      {submissionListCollapsed ? (
                        <ChevronRight size={18} style={{ flexShrink: 0, color: 'var(--color-text-secondary)' }} />
                      ) : (
                        <ChevronDown size={18} style={{ flexShrink: 0, color: 'var(--color-text-secondary)' }} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {!isCollectionMember && video.pages && video.pages.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSubmissionListCollapsed(prev => !prev)}
                  style={{
                    width: '100%',
                    padding: cardPadding,
                    background: 'var(--color-bg-primary)',
                    borderRadius: cardRadius,
                    fontSize: responsiveStyle.fontSize.small,
                    color: 'var(--color-text-primary)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    textAlign: 'left'
                  }}
                  aria-expanded={!submissionListCollapsed}
                  aria-label={submissionListCollapsed ? '展开当前投稿视频列表' : '折叠当前投稿视频列表'}
                >
                  <span>
                    共{video.pages.length}个视频，总时长：{formatDuration(submissionTotalDuration)}
                  </span>
                  {submissionListCollapsed ? (
                    <ChevronRight size={18} style={{ flexShrink: 0, color: 'var(--color-text-secondary)' }} />
                  ) : (
                    <ChevronDown size={18} style={{ flexShrink: 0, color: 'var(--color-text-secondary)' }} />
                  )}
                </button>
              )}

              {!showingCollectionList && !submissionListCollapsed && video.pages && video.pages.length > 1 && (
                <div style={{
                  background: 'var(--color-bg-primary)',
                  borderRadius: cardRadius,
                  padding: listPadding,
                  maxHeight: listMaxHeight,
                  overflowY: 'auto'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: submissionGridColumns,
                    gap: isCompactLayout ? '8px' : '12px'
                  }}>
                    {playablePages.map((page: any, index: number) => {
                      const isInList = downloadedCids.has(page.cid)
                      const status = downloadedVideoStatus[page.cid] || 'none'
                      const isDownloaded = status === 'downloaded'
                      const isPlayable = page.playable
                      const isActivePlayback = mediaMode === 'local-video' && activePlaybackEntry?.cid === page.cid
                      const canDownloadThisPage = status === 'none'

                      return (
                        <div
                          key={page.cid || index}
                          onClick={(event) => {
                            if (isPlayable) {
                              startPagePlayback(page)
                            } else if (canDownloadThisPage) {
                              void handleSinglePageDownload(page, event)
                            }
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            padding: isCompactLayout ? '10px' : '12px',
                            background: 'var(--color-bg-tertiary)',
                            borderRadius: isCompactLayout ? '6px' : '8px',
                            opacity: isInList && !isDownloaded ? 0.6 : 1,
                            cursor: isPlayable || canDownloadThisPage ? 'pointer' : 'default',
                            border: isActivePlayback ? '1px solid var(--color-primary-500)' : '1px solid transparent',
                            boxShadow: isActivePlayback ? '0 0 0 3px rgba(59, 130, 246, 0.12)' : 'none',
                            minWidth: 0,
                            gap: '10px'
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: responsiveStyle.fontSize.small, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                              P{page.page}: {page.part || `第${page.page}个视频`}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                              {formatDuration(page.duration)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            {isPlayable && (
                              <span style={{
                                fontSize: '11px',
                                color: 'var(--color-primary-700)',
                                background: 'var(--color-primary-50)',
                                padding: badgePadding,
                                borderRadius: '4px',
                                fontWeight: '600'
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
                            {canDownloadThisPage && (
                              <span style={{
                                fontSize: '11px',
                                color: 'var(--color-warning-700)',
                                background: 'var(--color-warning-50)',
                                padding: badgePadding,
                                borderRadius: '4px',
                                fontWeight: '600'
                              }}>
                                下载此视频
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {showingCollectionList && !submissionListCollapsed && (
                <div style={{
                  background: 'var(--color-bg-primary)',
                  borderRadius: cardRadius,
                  padding: listPadding,
                  maxHeight: listMaxHeight,
                  overflowY: 'auto'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: collectionGridColumns,
                    gap: isCompactLayout ? '8px' : '12px'
                  }}>
                    {collectionDisplayParts.map((part, index: number) => {
                      const hasSubparts = part.subparts.length > 0
                      const expanded = expandedCollectionItems.has(part.bvid)

                      return (
                        <div
                          key={`${part.bvid}-${part.cid || index}`}
                          style={{
                            background: 'var(--color-bg-tertiary)',
                            borderRadius: isCompactLayout ? '6px' : '8px',
                            border: part.bvid === video.bvid ? '1px solid var(--color-primary-500)' : '1px solid transparent',
                            overflow: 'hidden',
                            gridColumn: hasSubparts ? '1 / -1' : 'auto',
                            minWidth: 0
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
                              background: 'var(--color-bg-primary)'
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
                              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                              gap: isCompactLayout ? '8px' : '10px',
                              padding: isCompactLayout ? '0 10px 10px 10px' : '0 12px 12px 12px'
                            }}>
                              {part.subparts.map((subpart: DownloadPart) => (
                                <div key={`${subpart.bvid}-${subpart.cid || subpart.page}`} style={{
                                  minWidth: 0,
                                  padding: isCompactLayout ? '10px' : '12px',
                                  borderRadius: '6px',
                                  background: 'var(--color-bg-primary)',
                                  color: 'var(--color-text-secondary)',
                                  fontSize: '12px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  gap: '8px'
                                }}>
                                  <span style={{
                                    minWidth: 0,
                                    color: 'var(--color-text-primary)',
                                    fontSize: responsiveStyle.fontSize.small,
                                    lineHeight: 1.4,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
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
                </div>
              )}
            </>
          )}
        </div>
      )}

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
          {canSwitchSeriesLayout && (
            <div style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              gap: '4px',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <button
                type="button"
                onClick={() => handleSwitchSeriesLayout('flat')}
                disabled={switchingLayout || seriesLayoutMode === 'flat'}
                aria-label="根目录平铺模式"
                title="根目录平铺模式"
                style={getLayoutButtonStyle('flat')}
              >
                <List size={15} />
              </button>
              <button
                type="button"
                onClick={() => handleSwitchSeriesLayout('folder')}
                disabled={switchingLayout || seriesLayoutMode === 'folder'}
                aria-label="分P子目录模式"
                title="分P子目录模式"
                style={getLayoutButtonStyle('folder')}
              >
                <FolderTree size={15} />
              </button>
            </div>
          )}
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

        {renderCommentsSection()}

      </div>
      </div>
      )}

      {isCompactLayout && !video.isOpus && mobileDetailTab === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: pageGap }}>
          {renderAiNotePanel()}
        </div>
      )}

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
        onClose={() => setAlertModal({ ...alertModal, show: false, showConfirm: false, onConfirm: undefined })}
        showConfirm={alertModal.showConfirm}
        onConfirm={alertModal.onConfirm}
      />
      </div>
      {!isCompactLayout && !video.isOpus && (
        <div className="video-detail-right">
          {renderAiNotePanel()}
        </div>
      )}
      </div>
      </main>

      {/* AI笔记面板子路由 */}
      <Outlet />
    </div>
  )

}
