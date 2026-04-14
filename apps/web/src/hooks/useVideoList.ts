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
   */
  fetchVideos: (page?: number, isLoadMore?: boolean) => Promise<void>

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
    checkHasMore
  } = options

  // 状态管理
  const [videos, setVideos] = useState<VideoData[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)

  // 引用
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

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

  // 获取视频列表
  const fetchVideos = useCallback(
    async (page: number = 1, isLoadMore: boolean = false) => {
      // 设置加载状态
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError('')

      try {
        // 调用 fetchFn 获取数据
        const response = await fetchFn(page, customPageSize)

        if (!response.success || !response.data) {
          throw new Error(response.message || '获取视频列表失败')
        }

        // 提取视频列表（支持 list 或 medias 字段）
        const videoList = response.data.list || response.data.medias || []

        // 格式化视频数据
        const formattedVideos = videoList.map(formatVideoItem)

        // 更新total状态
        const totalVideos = response.total || response.data?.total || 0
        if (typeof totalVideos === 'number') {
          setTotal(totalVideos)
        }

        // 更新视频列表
        if (isLoadMore) {
          setVideos(prevVideos => {
            // 使用Map去重，以bvid为唯一标识
            const videoMap = new Map()
            prevVideos.forEach(video => videoMap.set(video.bvid, video))
            formattedVideos.forEach(video => videoMap.set(video.bvid, video))
            
            const newVideos = Array.from(videoMap.values())
            
            // 手动计算hasMore
            const returnedList = response.data?.list || response.data?.medias || []
            const pageSize = response.data?.page_size || customPageSize
            const totalVideos = response.total || response.data?.total || 0
            
            let newHasMore = true
            if (typeof totalVideos === 'number' && totalVideos > 0) {
              newHasMore = newVideos.length < totalVideos
            } else if (returnedList.length < pageSize) {
              newHasMore = false
            }
            
            setHasMore(newHasMore)
            return newVideos
          })
        } else {
          setVideos(formattedVideos)
          
          // 手动计算hasMore
          const returnedList = response.data?.list || response.data?.medias || []
          const pageSize = response.data?.page_size || customPageSize
          const totalVideos = response.total || response.data?.total || 0
          
          let newHasMore = true
          if (typeof totalVideos === 'number' && totalVideos > 0) {
            newHasMore = formattedVideos.length < totalVideos
          } else if (returnedList.length < pageSize) {
            newHasMore = false
          }
          
          setHasMore(newHasMore)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '网络请求失败')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [fetchFn, customPageSize, formatVideoItem, checkHasMore, defaultCheckHasMore]
  )

  // 重新加载当前页
  const refresh = useCallback(async () => {
    await fetchVideos(currentPage, false)
  }, [fetchVideos, currentPage])

  // 初始加载或依赖变化时重新加载
  useEffect(() => {
    if (autoLoad) {
      fetchVideos(1, false)
      setCurrentPage(1)
    }
  }, [...deps, fetchFn]) // eslint-disable-line react-hooks/exhaustive-deps

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
          setCurrentPage(nextPage)
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
    refresh
  }
}