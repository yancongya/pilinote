import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CacheState {
  // 收藏夹缓存
  foldersCache: {
    data: any[]
    timestamp: number
  } | null
  
  // 收藏夹详情缓存
  folderVideosCache: {
    [cacheKey: string]: {
      data: any[]
      total: number
      page: number
      pageSize: number
      timestamp: number
    }
  }
  
  // 稍后再看缓存
  watchLaterCache: {
    data: any[]
    timestamp: number
  } | null
  
  // 缓存过期时间（5分钟）
  cacheExpiry: number
  
  // 设置收藏夹缓存
  setFoldersCache: (data: any[]) => void
  
  // 获取收藏夹缓存
  getFoldersCache: () => any[] | null
  
  // 设置收藏夹详情缓存
  setFolderVideosCache: (
    cacheKey: string,
    data: any[],
    options?: {
      total?: number
      page?: number
      pageSize?: number
    }
  ) => void
  
  // 获取收藏夹详情缓存
  getFolderVideosCache: (
    cacheKey: string
  ) => { data: any[]; total: number; page: number; pageSize: number } | null
  
  // 设置稍后再看缓存
  setWatchLaterCache: (data: any[]) => void
  
  // 获取稍后再看缓存
  getWatchLaterCache: () => any[] | null
  
  // 清除所有缓存
  clearAllCache: () => void
}

const CACHE_EXPIRY = 5 * 60 * 1000 // 5分钟

export const useCacheStore = create<CacheState>()(
  persist(
    (set, get) => ({
      foldersCache: null,
      folderVideosCache: {},
      watchLaterCache: null,
      cacheExpiry: CACHE_EXPIRY,
      
      setFoldersCache: (data: any[]) => {
        set({
          foldersCache: {
            data,
            timestamp: Date.now()
          }
        })
      },
      
      getFoldersCache: () => {
        const { foldersCache, cacheExpiry } = get()
        if (!foldersCache) return null
        
        const isExpired = Date.now() - foldersCache.timestamp > cacheExpiry
        if (isExpired) {
          set({ foldersCache: null })
          return null
        }
        
        return foldersCache.data
      },
      
      setFolderVideosCache: (cacheKey: string, data: any[], options = {}) => {
        set((state) => ({
          folderVideosCache: {
            ...state.folderVideosCache,
            [cacheKey]: {
              data,
              total: options.total ?? data.length,
              page: options.page ?? 1,
              pageSize: options.pageSize ?? data.length,
              timestamp: Date.now()
            }
          }
        }))
      },
      
      getFolderVideosCache: (cacheKey: string) => {
        const { folderVideosCache, cacheExpiry } = get()
        const cache = folderVideosCache[cacheKey]
        
        if (!cache) return null
        
        const isExpired = Date.now() - cache.timestamp > cacheExpiry
        if (isExpired) {
          set((state) => {
            const newCache = { ...state.folderVideosCache }
            delete newCache[cacheKey]
            return { folderVideosCache: newCache }
          })
          return null
        }
        
        const data = Array.isArray(cache.data) ? cache.data : []

        return {
          data,
          total: typeof cache.total === 'number' ? cache.total : data.length,
          page: typeof cache.page === 'number' ? cache.page : 1,
          pageSize: typeof cache.pageSize === 'number' ? cache.pageSize : data.length
        }
      },
      
      setWatchLaterCache: (data: any[]) => {
        set({
          watchLaterCache: {
            data,
            timestamp: Date.now()
          }
        })
      },
      
      getWatchLaterCache: () => {
        const { watchLaterCache, cacheExpiry } = get()
        if (!watchLaterCache) return null
        
        const isExpired = Date.now() - watchLaterCache.timestamp > cacheExpiry
        if (isExpired) {
          set({ watchLaterCache: null })
          return null
        }
        
        return watchLaterCache.data
      },
      
      clearAllCache: () => {
        set({
          foldersCache: null,
          folderVideosCache: {},
          watchLaterCache: null
        })
      }
    }),
    {
      name: 'pilinote-cache',
      partialize: (state) => ({
        foldersCache: state.foldersCache,
        folderVideosCache: state.folderVideosCache,
        watchLaterCache: state.watchLaterCache,
        cacheExpiry: state.cacheExpiry
      })
    }
  )
)
