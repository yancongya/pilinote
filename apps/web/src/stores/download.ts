import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiService } from '../services/api'

interface DownloadItem {
  id: string
  bvid: string
  title: string
  status: string
  progress: number
  downloaded_bytes: number
  total_bytes: number
  download_speed: number
  eta: number
  thumbnail_url: string | null
  duration: number | null
  uploader: string | null
  file_path: string | null
  error_message: string | null
  created_at: string | null
  started_at: string | null
  completed_at: string | null
  aid: number | null
  cid: number | null
}

interface DownloadState {
  // 下载列表
  downloads: Map<string, DownloadItem>
  downloadIds: string[]
  
  // 同步状态
  syncing: boolean
  lastSyncTime: number | null
  
  // 设置下载列表
  setDownloads: (downloads: DownloadItem[]) => void
  
  // 添加下载
  addDownload: (item: DownloadItem) => void
  
  // 移除下载
  removeDownload: (downloadId: string) => void
  
  // 根据bvid移除下载
  removeDownloadByBvid: (bvid: string) => void
  
  // 更新下载状态
  updateDownloadStatus: (downloadId: string, status: string, progress?: number) => void
  
  // 检查bvid是否在下载列表中
  isBvidInDownloadList: (bvid: string) => boolean
  
  // 检查特定cid是否在下载列表中
  isCidInDownloadList: (bvid: string, cid: number) => boolean
  
  // 获取下载状态：'none' | 'in_list'
  getDownloadStatus: (bvid: string) => 'none' | 'in_list'
  
  // 获取指定bvid的下载任务
  getDownloadsByBvid: (bvid: string) => DownloadItem[]
  
  // 从服务器同步下载列表
  syncFromServer: () => Promise<void>
  
  // 添加到下载列表
  addToDownloadList: (downloadData: any) => Promise<boolean>
  
  // 从下载列表移除
  removeFromDownloadList: (downloadId: string) => Promise<boolean>
  
  // 从下载列表移除（通过bvid）
  removeFromDownloadListByBvid: (bvid: string) => Promise<boolean>
  
  // 批量开始下载
  startBatchDownloads: (downloadIds?: string[]) => Promise<boolean>
  
  // 清空下载列表
  clearDownloads: () => void
}

export const useDownloadStore = create<DownloadState>()(
  persist(
    (set, get) => ({
      downloads: new Map(),
      downloadIds: [],
      syncing: false,
      lastSyncTime: null,
      
      setDownloads: (downloadItems: DownloadItem[]) => {
        const newDownloads = new Map<string, DownloadItem>()
        const newIds: string[] = []
        
        downloadItems.forEach(item => {
          newDownloads.set(item.id, item)
          newIds.push(item.id)
        })
        
        set({
          downloads: newDownloads,
          downloadIds: newIds
        })
      },
      
      addDownload: (item: DownloadItem) => {
        set((state) => {
          const newDownloads = new Map(state.downloads)
          newDownloads.set(item.id, item)
          
          const newIds = [...state.downloadIds, item.id]
          
          return {
            downloads: newDownloads,
            downloadIds: newIds
          }
        })
      },
      
      removeDownload: (downloadId: string) => {
        set((state) => {
          const newDownloads = new Map(state.downloads)
          newDownloads.delete(downloadId)
          
          const newIds = state.downloadIds.filter(id => id !== downloadId)
          
          return {
            downloads: newDownloads,
            downloadIds: newIds
          }
        })
      },
      
      removeDownloadByBvid: (bvid: string) => {
        set((state) => {
          const newDownloads = new Map(state.downloads)
          const idsToRemove: string[] = []
          
          state.downloadIds.forEach(id => {
            const item = state.downloads.get(id)
            if (item && item.bvid === bvid) {
              newDownloads.delete(id)
              idsToRemove.push(id)
            }
          })
          
          const newIds = state.downloadIds.filter(id => !idsToRemove.includes(id))
          
          return {
            downloads: newDownloads,
            downloadIds: newIds
          }
        })
      },
      
      updateDownloadStatus: (downloadId: string, status: string, progress?: number) => {
        set((state) => {
          const newDownloads = new Map(state.downloads)
          const item = newDownloads.get(downloadId)
          
          if (item) {
            newDownloads.set(downloadId, {
              ...item,
              status,
              progress: progress !== undefined ? progress : item.progress
            })
          }
          
          return {
            downloads: newDownloads
          }
        })
      },
      
      isBvidInDownloadList: (bvid: string) => {
      
                const { downloads } = get()
      
                for (const item of downloads.values()) {
      
                  if (item.bvid === bvid) {
      
                    return true
      
                  }
      
                }
      
                return false
      
              },
      
              
      
              isCidInDownloadList: (bvid: string, cid: number) => {
      
                const { downloads } = get()
      
                for (const item of downloads.values()) {
      
                  if (item.bvid === bvid && item.cid === cid) {
      
                    return true
      
                  }
      
                }
      
                return false
      
              },
      
              
      
              getDownloadStatus: (bvid: string): 'none' | 'in_list' => {
      
              
      
                        const { downloads } = get()
      
              
      
                        const items = Array.from(downloads.values()).filter(item => item.bvid === bvid)
      
              
      
                        
      
              
      
                        if (items.length === 0) {
      
              
      
                          return 'none'
      
              
      
                        }
      
              
      
                        
      
              
      
                        // 由于completed状态的任务已经被过滤掉，所以只需要判断是否有在下载列表中的任务
      
              
      
                        return 'in_list'
      
              
      
                      },
      
      getDownloadsByBvid: (bvid: string) => {
        const { downloads } = get()
        const result: DownloadItem[] = []
        
        for (const item of downloads.values()) {
          // 尝试通过bvid或aid匹配
          if (item.bvid === bvid || (item.aid && item.aid.toString() === bvid)) {
            result.push(item)
          }
        }
        
        return result
      },
      
      syncFromServer: async () => {
        const { syncing } = get()
        if (syncing) return
        
        set({ syncing: true })
        
        try {
          const response = await apiService.getDownloadList()
          
          if (response.success && response.data?.downloads) {
            // 只保留未完成的任务（pending, queued, downloading, processing, failed, cancelled）
            const pendingDownloads = response.data.downloads.filter((item: DownloadItem) => 
              item.status !== 'completed'
            )
            get().setDownloads(pendingDownloads)
            set({ lastSyncTime: Date.now() })
          }
        } catch (error) {
          console.error('同步下载列表失败:', error)
        } finally {
          set({ syncing: false })
        }
      },
      
      addToDownloadList: async (downloadData: any) => {
        try {
          const response = await apiService.addToDownloadQueue(downloadData)
          
          if (response.success && (response as any).download_id) {
            // 立即添加到本地状态，提供即时反馈
            const newItem: DownloadItem = {
              id: (response as any).download_id,
              bvid: downloadData.bvid,
              title: downloadData.title,
              status: 'pending',
              progress: 0,
              downloaded_bytes: 0,
              total_bytes: 0,
              download_speed: 0,
              eta: 0,
              thumbnail_url: downloadData.thumbnail_url || null,
              duration: downloadData.duration || null,
              uploader: downloadData.uploader || null,
              file_path: null,
              error_message: null,
              created_at: new Date().toISOString(),
              started_at: null,
              completed_at: null,
              aid: downloadData.aid || null,
              cid: downloadData.cid || null
            }
            get().addDownload(newItem)
            
            // 异步同步服务器状态
            get().syncFromServer()
            return true
          }
          
          console.error('添加到下载列表失败:', response.message)
          return false
        } catch (error) {
          console.error('添加到下载列表失败:', error)
          return false
        }
      },
      
      removeFromDownloadList: async (downloadId: string) => {
        try {
          const response = await apiService.deleteDownload(downloadId)
          
          if (response.success) {
            get().removeDownload(downloadId)
            return true
          }
          
          return false
        } catch (error) {
          console.error('从下载列表移除失败:', error)
          return false
        }
      },
      
      removeFromDownloadListByBvid: async (bvid: string) => {
        try {
          // 立即从本地状态移除，提供即时反馈
          get().removeDownloadByBvid(bvid)
          
          const response = await apiService.deleteDownloadByBvid(bvid)
          
          if (response.success) {
            // 异步同步服务器状态
            get().syncFromServer()
            return true
          } else {
            // 如果服务器删除失败，重新添加回本地状态
            console.error('服务器删除失败，尝试恢复本地状态')
            get().syncFromServer()
            return false
          }
        } catch (error) {
          console.error('从下载列表移除失败:', error)
          // 发生错误时，重新同步服务器状态
          get().syncFromServer()
          return false
        }
      },
      
      startBatchDownloads: async (downloadIds?: string[]) => {
        try {
          const response = await apiService.startBatchDownloads(downloadIds)
          
          if (response.success) {
            // 同步最新的下载列表
            await get().syncFromServer()
            return true
          }
          
          return false
        } catch (error) {
          console.error('批量开始下载失败:', error)
          return false
        }
      },
      
      clearDownloads: () => {
        set({
          downloads: new Map(),
          downloadIds: []
        })
      }
    }),
    {
      name: 'pilinote-download',
      partialize: (state) => ({
        downloads: Array.from(state.downloads.entries()),
        downloadIds: state.downloadIds,
        lastSyncTime: state.lastSyncTime
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.downloads) {
          // 将数组转换回Map
          state.downloads = new Map(state.downloads as any)
        }
      }
    }
  )
)