import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * 视频列表数据类型
 */
export interface VideoData {
  id: string
  bvid: string
  title: string
  cover: string
  duration: string
  uploader: string
  views: string
  danmaku: string
  comments: string
  likes: string
  coins: string
  favorites: string
  shares: string
  time: string
  [key: string]: any // 允许其他字段
}

/**
 * API 响应类型
 */
export interface VideoListResponse {
  success: boolean
  data?: {
    list?: any[]
    medias?: any[]
    total?: number
    page_size?: number
    [key: string]: any
  }
  total?: number
  message?: string
}

interface CachedPageEntry {
  response: VideoListResponse
  timestamp: number
}

interface SessionStoredPageEntry {
  response: VideoListResponse
  timestamp: number
  page: number
  pageSize: number
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000
const DEFAULT_RETRY_COUNT = 2
const DEFAULT_LOAD_MORE_COOLDOWN_MS = 4000
const SESSION_STORAGE_CACHE_PREFIX = 'video-list-page-cache'
const SESSION_STORAGE_CACHE_VERSION = 1

const pageResponseCache = new Map<string, Map<number, CachedPageEntry>>()
const inflightRequestCache = new Map<string, Promise<VideoListResponse>>()

const now = () => Date.now()
const canUseSessionStorage = () =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const buildSessionStorageKey = (cacheKey: string, page: number, pageSize: number) =>
  `${SESSION_STORAGE_CACHE_PREFIX}:v${SESSION_STORAGE_CACHE_VERSION}:${cacheKey}:${page}:${pageSize}`

const isRetryableMessage = (message?: string) => {
  if (!message) {
    return true
  }

  const lowerMessage = message.toLowerCase()
  if (lowerMessage.includes('缺少必要参数')) {
    return false
  }

  return [
    'timeout',
    'timed out',
    'network',
    'fetch',
    'failed',
    'request was banned',
    'too many requests',
    '频率过高',
    '请求频率过高',
    'api暂时限制',
    '412',
    '500',
    '502',
    '503',
    '504'
  ].some(keyword => lowerMessage.includes(keyword))
}

const getCacheBucket = (cacheKey: string) => {
  let bucket = pageResponseCache.get(cacheKey)
  if (!bucket) {
    bucket = new Map<number, CachedPageEntry>()
    pageResponseCache.set(cacheKey, bucket)
  }
  return bucket
}

const getCachedPageResponse = (
  cacheKey: string,
  page: number,
  ttlMs: number
): VideoListResponse | null => {
  const bucket = pageResponseCache.get(cacheKey)
  if (!bucket) {
    return null
  }

  const entry = bucket.get(page)
  if (!entry) {
    return null
  }

  if (now() - entry.timestamp > ttlMs) {
    bucket.delete(page)
    if (bucket.size === 0) {
      pageResponseCache.delete(cacheKey)
    }
    return null
  }

  return entry.response
}

const setCachedPageResponse = (
  cacheKey: string,
  page: number,
  response: VideoListResponse
) => {
  getCacheBucket(cacheKey).set(page, {
    response,
    timestamp: now()
  })
}

const getSessionStoredPageResponse = (
  cacheKey: string,
  page: number,
  pageSize: number,
  ttlMs: number
): VideoListResponse | null => {
  if (!cacheKey.trim() || !canUseSessionStorage()) {
    return null
  }

  const storageKey = buildSessionStorageKey(cacheKey, page, pageSize)

  try {
    const raw = window.sessionStorage.getItem(storageKey)
    if (!raw) {
      return null
    }

    const entry = JSON.parse(raw) as SessionStoredPageEntry
    const isValidEntry =
      Boolean(entry) &&
      entry.page === page &&
      entry.pageSize === pageSize &&
      entry.response?.success &&
      Boolean(entry.response?.data) &&
      now() - entry.timestamp <= ttlMs

    if (!isValidEntry) {
      window.sessionStorage.removeItem(storageKey)
      return null
    }

    return entry.response
  } catch {
    try {
      window.sessionStorage.removeItem(storageKey)
    } catch {
      // 忽略 sessionStorage 清理失败
    }

    return null
  }
}

const setSessionStoredPageResponse = (
  cacheKey: string,
  page: number,
  pageSize: number,
  response: VideoListResponse
) => {
  if (!cacheKey.trim() || !canUseSessionStorage()) {
    return
  }

  const storageKey = buildSessionStorageKey(cacheKey, page, pageSize)

  try {
    const payload: SessionStoredPageEntry = {
      response,
      timestamp: now(),
      page,
      pageSize
    }

    window.sessionStorage.setItem(storageKey, JSON.stringify(payload))
  } catch {
    // sessionStorage 容量或权限异常时静默降级
  }
}

const getResponseItems = (response: VideoListResponse['data']) => {
  return response?.list || response?.medias || []
}

/**
 * fetchFn 函数类型
 * @param page - 页码
 * @param pageSize - 每页大小
 * @returns Promise<VideoListResponse>
 */
export type FetchVideosFunction = (
  page: number,
  pageSize: number
) => Promise<VideoListResponse>

/**
 * useVideoList Hook 参数
 */
export interface UseVideoListOptions {
  /**
   * 获取视频列表的函数
   */
  fetchFn: FetchVideosFunction

  /**
   * 每页大小，默认为 10
   */
  pageSize?: number

  /**
   * 初始页码，默认为 1
   */
  initialPage?: number

  /**
   * 依赖数组，当依赖变化时重新加载
   */
  deps?: React.DependencyList

  /**
   * 自定义数据格式化函数，如果不提供则直接使用返回的列表
   * @param item - 原始数据项
   * @returns 格式化后的视频数据
   */
  formatItem?: (item: any) => VideoData

  /**
   * 是否自动加载，默认为 true
   */
  autoLoad?: boolean

  /**
   * 用于跨渲染缓存、请求去重和首屏 sessionStorage 持久化的稳定键
   */
  cacheKey?: string

  /**
   * 缓存有效期，默认 5 分钟
   */
  cacheTtlMs?: number

  /**
   * 失败后的重试次数，默认 2
   */
  retryCount?: number

  /**
   * 加载更多失败后的冷却时间，默认 4 秒
   */
  loadMoreCooldownMs?: number

  /**
   * 检查是否有更多数据的函数
   * @param response - API 响应数据
   * @param currentVideos - 当前视频列表
   * @returns 是否有更多数据
   */
  checkHasMore?: (
    response: VideoListResponse['data'],
    currentVideos: VideoData[]
  ) => boolean
}

/**
 * useVideoList Hook 返回值
 */
export interface UseVideoListReturn {
  /**
   * 视频列表
   */
  videos: VideoData[]

  /**
   * 是否正在加载
   */
  loading: boolean

  /**
   * 是否正在加载更多
   */
  loadingMore: boolean

  /**
   * 错误信息
   */
  error: string

  /**
   * 加载更多失败信息
   */
  loadMoreError: string

  /**
   * 当前页码
   */
  currentPage: number

  /**
   * 是否有更多数据
   */
  hasMore: boolean

  /**
   * 总数据量
   */
  total: number

  /**
   * 加载更多元素引用
   */
  loadMoreRef: React.RefObject<HTMLDivElement | null>

  /**
   * 手动获取视频列表
   * @param page - 页码，默认为 1
   * @param isLoadMore - 是否为加载更多，默认为 false
   * @param forceRefresh - 是否绕过缓存，默认为 false
   */
  fetchVideos: (page?: number, isLoadMore?: boolean, forceRefresh?: boolean) => Promise<void>

  /**
   * 重新加载当前页
   */
  refresh: () => Promise<void>
}

/**
 * 视频列表 Hook
 * 提供视频列表的加载、分页和无限滚动功能
 *
 * @example
 * ```tsx
 * const { videos, loading, loadingMore, error, hasMore, loadMoreRef, fetchVideos } = useVideoList({
 *   fetchFn: (page, pageSize) => apiService.getFolderDetail(folderId, sessdata, page, pageSize),
 *   pageSize: 10,
 *   deps: [folderId],
 *   formatItem: (item) => ({
 *     id: item.id,
 *     bvid: item.bvid,
 *     title: item.title,
 *     // ...
 *   })
 * })
 * ```
 */
export function useVideoList(options: UseVideoListOptions): UseVideoListReturn {
  const {
    fetchFn,
    pageSize: customPageSize = 10,
    initialPage = 1,
    deps = [],
    formatItem,
    autoLoad = true,
    cacheKey,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    retryCount = DEFAULT_RETRY_COUNT,
    loadMoreCooldownMs = DEFAULT_LOAD_MORE_COOLDOWN_MS,
    checkHasMore
  } = options

  const persistentCacheKey = cacheKey?.trim() || ''

  // 状态管理
  const [videos, setVideos] = useState<VideoData[]>([])
  const [loading, setLoading] = useState(autoLoad)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [loadMoreError, setLoadMoreError] = useState('')
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)

  // 引用
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const latestRequestIdRef = useRef(0)
  const videosRef = useRef<VideoData[]>([])
  const blockedLoadMorePageRef = useRef<{ page: number; until: number } | null>(null)
  const instanceCacheKeyRef = useRef(
    `video-list-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
  )
  const resolvedCacheKey = (cacheKey || instanceCacheKeyRef.current).trim()

  // 默认的 hasMore 检查函数
  const defaultCheckHasMore = useCallback(
    (response: VideoListResponse['data'], currentVideos: VideoData[]) => {
      // 优先使用返回的 list/medias 长度判断
      const returnedList = response?.list || response?.medias || []
      const pageSize = response?.page_size || customPageSize

      // 如果返回的数据少于 pageSize，说明没有更多了
      if (returnedList.length < pageSize) {
        return false
      }

      // 如果有 total 字段，比较当前数量和 total
      if (typeof response?.total === 'number') {
        return currentVideos.length < response.total
      }

      // 默认返回 true（假设还有更多）
      return true
    },
    [customPageSize]
  )

  // 格式化单个视频数据
  const formatVideoItem = useCallback(
    (item: any): VideoData => {
      if (formatItem) {
        return formatItem(item)
      }
      // 默认格式化：直接返回原始数据
      return item
    },
    [formatItem]
  )

  useEffect(() => {
    videosRef.current = videos
  }, [videos])

  const determineHasMore = useCallback(
    (response: VideoListResponse['data'], currentVideos: VideoData[]) => {
      if (checkHasMore) {
        return checkHasMore(response, currentVideos)
      }
      return defaultCheckHasMore(response, currentVideos)
    },
    [checkHasMore, defaultCheckHasMore]
  )

  const isLoadMorePageBlocked = useCallback((page: number) => {
    const blocked = blockedLoadMorePageRef.current
    return Boolean(blocked && blocked.page === page && blocked.until > now())
  }, [])

  const resolveFetchResponse = useCallback(
    async (page: number, forceRefresh = false): Promise<VideoListResponse> => {
      const requestKey = `${resolvedCacheKey}:${page}:${customPageSize}`

      if (!forceRefresh) {
        const cachedResponse = getCachedPageResponse(resolvedCacheKey, page, cacheTtlMs)
        if (cachedResponse) {
          return cachedResponse
        }

        if (page === initialPage) {
          const sessionCachedResponse = getSessionStoredPageResponse(
            persistentCacheKey,
            page,
            customPageSize,
            cacheTtlMs
          )

          if (sessionCachedResponse) {
            setCachedPageResponse(resolvedCacheKey, page, sessionCachedResponse)
            return sessionCachedResponse
          }
        }
      }

      const inFlight = inflightRequestCache.get(requestKey)
      if (inFlight) {
        return inFlight
      }

      const requestPromise = (async () => {
        let lastResponse: VideoListResponse = {
          success: false,
          message: '获取视频列表失败'
        }

        for (let attempt = 0; attempt <= retryCount; attempt += 1) {
          const response = await fetchFn(page, customPageSize)
          lastResponse = response

          if (response.success && response.data) {
            setCachedPageResponse(resolvedCacheKey, page, response)

            if (page === initialPage) {
              setSessionStoredPageResponse(persistentCacheKey, page, customPageSize, response)
            }

            return response
          }

          if (attempt < retryCount && isRetryableMessage(response.message)) {
            await wait(250 * (attempt + 1))
            continue
          }

          return response
        }

        return lastResponse
      })()

      inflightRequestCache.set(requestKey, requestPromise)

      try {
        return await requestPromise
      } finally {
        inflightRequestCache.delete(requestKey)
      }
    },
    [
      cacheTtlMs,
      customPageSize,
      fetchFn,
      initialPage,
      persistentCacheKey,
      retryCount,
      resolvedCacheKey
    ]
  )

  // 获取视频列表
  const fetchVideos = useCallback(
    async (page: number = 1, isLoadMore: boolean = false, forceRefresh = false) => {
      if (isLoadMore) {
        if (isLoadMorePageBlocked(page)) {
          return
        }
        setLoadingMore(true)
        setLoadMoreError('')
      } else {
        blockedLoadMorePageRef.current = null
        setLoading(true)
        setError('')
        setLoadMoreError('')
      }

      const requestId = latestRequestIdRef.current + 1
      latestRequestIdRef.current = requestId

      try {
        const response = await resolveFetchResponse(page, forceRefresh)

        if (latestRequestIdRef.current !== requestId) {
          return
        }

        if (!response.success || !response.data) {
          const message = response.message || '获取视频列表失败'
          if (isLoadMore && videosRef.current.length > 0) {
            setLoadMoreError(message)
            blockedLoadMorePageRef.current = {
              page,
              until: now() + loadMoreCooldownMs
            }
            return
          }

          setError(message)
          return
        }

        const videoList = getResponseItems(response.data)
        const formattedVideos = videoList.map(formatVideoItem)
        const totalVideos = response.total || response.data?.total || 0

        if (typeof totalVideos === 'number') {
          setTotal(totalVideos)
        }

        setLoadMoreError('')
        blockedLoadMorePageRef.current = null

        if (isLoadMore) {
          setVideos(prevVideos => {
            const videoMap = new Map<string, VideoData>()
            prevVideos.forEach(video => videoMap.set(video.bvid, video))
            formattedVideos.forEach(video => videoMap.set(video.bvid, video))

            const newVideos = Array.from(videoMap.values())
            const newHasMore = determineHasMore(response.data, newVideos)
            setHasMore(newHasMore)
            return newVideos
          })
        } else {
          setVideos(formattedVideos)
          const newHasMore = determineHasMore(response.data, formattedVideos)
          setHasMore(newHasMore)
        }

        setCurrentPage(page)
      } catch (err) {
        if (latestRequestIdRef.current !== requestId) {
          return
        }

        const message = err instanceof Error ? err.message : '网络请求失败'
        if (isLoadMore && videosRef.current.length > 0) {
          setLoadMoreError(message)
          blockedLoadMorePageRef.current = {
            page,
            until: now() + loadMoreCooldownMs
          }
          return
        }

        setError(message)
      } finally {
        if (latestRequestIdRef.current === requestId) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [
      customPageSize,
      determineHasMore,
      formatVideoItem,
      isLoadMorePageBlocked,
      loadMoreCooldownMs,
      resolveFetchResponse
    ]
  )

  // 重新加载当前页
  const refresh = useCallback(async () => {
    await fetchVideos(currentPage, false, true)
  }, [fetchVideos, currentPage])

  // 初始加载或依赖变化时重新加载
  useEffect(() => {
    if (autoLoad) {
      setCurrentPage(initialPage)
      fetchVideos(initialPage, false)
    }
  }, [...deps, fetchFn, autoLoad, initialPage]) // eslint-disable-line react-hooks/exhaustive-deps

  // 使用 Intersection Observer 实现无限滚动
  useEffect(() => {
    // 满足以下条件才启用观察器：
    // 1. loadMoreRef 元素存在
    // 2. 还有更多数据
    // 3. 没有在加载中
    // 4. 已经有数据（避免初始加载时触发）
    if (!loadMoreRef.current || !hasMore || loading || loadingMore || videos.length === 0) {
      return
    }

    // 创建 Intersection Observer
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0]
        // 当目标元素进入视口且满足加载条件时
        if (target.isIntersecting && !loading && !loadingMore && hasMore) {
          const nextPage = currentPage + 1
          fetchVideos(nextPage, true)
        }
      },
      {
        rootMargin: '100px', // 提前 100px 触发
        threshold: 0.1 // 10% 可见时触发
      }
    )

    // 开始观察
    observer.observe(loadMoreRef.current)
    observerRef.current = observer

    // 清理函数
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
    }
  }, [currentPage, loading, loadingMore, hasMore, videos.length, fetchVideos])

  return {
    videos,
    loading,
    loadingMore,
    error,
    currentPage,
    hasMore,
    total,
    loadMoreRef,
    fetchVideos,
    refresh,
    loadMoreError
  }
}
