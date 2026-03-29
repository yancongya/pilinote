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
    [folderId: string]: {
      data: any[]
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
  setFolderVideosCache: (folderId: string, data: any[]) => void
  
  // 获取收藏夹详情缓存
  getFolderVideosCache: (folderId: string) => any[] | null
  
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
      
      setFolderVideosCache: (folderId: string, data: any[]) => {
        set((state) => ({
          folderVideosCache: {
            ...state.folderVideosCache,
            [folderId]: {
              data,
              timestamp: Date.now()
            }
          }
        }))
      },
      
      getFolderVideosCache: (folderId: string) => {
        const { folderVideosCache, cacheExpiry } = get()
        const cache = folderVideosCache[folderId]
        
        if (!cache) return null
        
        const isExpired = Date.now() - cache.timestamp > cacheExpiry
        if (isExpired) {
          set((state) => {
            const newCache = { ...state.folderVideosCache }
            delete newCache[folderId]
            return { folderVideosCache: newCache }
          })
          return null
        }
        
        return cache.data
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