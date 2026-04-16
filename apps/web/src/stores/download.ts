import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiService } from '../services/api'
import { useDownloadHistoryStore } from './downloadHistory'

// 下载状态枚举
export type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'failed' | 'paused' | 'cancelled'

// 下载阶段枚举
export type DownloadStage = 'preparing' | 'downloading' | 'moving' | 'post_processing' | 'completed'

// 错误类型
export type ErrorType = 'network' | 'authentication' | 'file_system' | 'server' | 'unknown'

// 错误信息接口
export interface ErrorInfo {
  type: ErrorType
  message: string
  code?: string
  details?: string
  timestamp: number
}

// 下载状态详细信息
export interface DownloadStatusInfo {
  progress: number          // 0-100
  speed: number            // bytes/s
  eta: number              // seconds
  stage: DownloadStage
  downloaded_bytes: number
  total_bytes: number
  retry_count: number
  max_retries: number
  error: ErrorInfo | null
  last_updated: number
}

interface DownloadItem {
  id: string
  bvid: string
  title: string
  status: DownloadStatus
  statusInfo: DownloadStatusInfo
  thumbnail_url: string | null
  duration: number | null
  uploader: string | null
  file_path: string | null
  created_at: string | null
  started_at: string | null
  completed_at: string | null
  aid: number | null
  cid: number | null
  quality: number | null
  audio_bitrate: number | null
  codec: string | null
}

interface DownloadState {
  // 下载列表
  downloads: Map<string, DownloadItem>
  downloadIds: string[]
  
  // 同步状态
  syncing: boolean
  lastSyncTime: number | null
  
  // WebSocket连接
  ws: WebSocket | null
  wsConnected: boolean
  
  // 设置下载列表
  setDownloads: (downloads: DownloadItem[]) => void
  
  // 添加下载
  addDownload: (item: DownloadItem) => void
  
  // 移除下载
  removeDownload: (downloadId: string) => void
  
  // 根据bvid移除下载
  removeDownloadByBvid: (bvid: string) => void
  
  // 更新下载状态（基本）
  updateDownloadStatus: (downloadId: string, status: DownloadStatus) => void
  
  // 更新下载进度信息
  updateDownloadProgress: (downloadId: string, progress: number, speed?: number, eta?: number) => void
  
  // 更新下载阶段
  updateDownloadStage: (downloadId: string, stage: DownloadStage) => void
  
  // 更新下载字节信息
  updateDownloadBytes: (downloadId: string, downloaded: number, total: number) => void
  
  // 设置错误信息
  setDownloadError: (downloadId: string, error: ErrorInfo) => void
  
  // 清除错误信息
  clearDownloadError: (downloadId: string) => void
  
  // 增加重试次数
  incrementRetryCount: (downloadId: string) => void
  
  // 重置重试次数
  resetRetryCount: (downloadId: string) => void
  
  // 批量更新下载状态
  batchUpdateStatus: (downloadIds: string[], status: DownloadStatus) => void
  
  // 批量更新进度
  batchUpdateProgress: (updates: Array<{ id: string; progress: number; speed?: number; eta?: number }>) => void
  
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
  
  // 任务控制方法
  startDownload: (downloadId: string) => Promise<boolean>
  pauseDownload: (downloadId: string) => Promise<boolean>
  resumeDownload: (downloadId: string) => Promise<boolean>
  cancelDownload: (downloadId: string) => Promise<boolean>
  retryDownload: (downloadId: string) => Promise<boolean>
  
  // 获取任务状态
  getTaskStatus: (downloadId: string) => Promise<DownloadItem | null>
  
  // 清空下载列表
  clearDownloads: () => void
  
  // WebSocket连接管理
  connectWebSocket: () => void
  disconnectWebSocket: () => void
  handleWebSocketMessage: (event: MessageEvent) => void
  
  // 获取下载统计信息
  getDownloadStats: () => {
    total: number
    downloading: number
    completed: number
    failed: number
    paused: number
    pending: number
    cancelled: number
  }
  
  // 根据状态筛选下载项
  getDownloadsByStatus: (status: DownloadStatus) => DownloadItem[]
  
  // 获取失败的下载项
  getFailedDownloads: () => DownloadItem[]
  
  // 获取可以重试的下载项
  getRetryableDownloads: () => DownloadItem[]
}

export const useDownloadStore = create<DownloadState>()(
  persist(
    (set, get) => ({
      downloads: new Map(),
      downloadIds: [],
      syncing: false,
      lastSyncTime: null,
      ws: null,
      wsConnected: false,
      
      // ========== 基础操作 ==========
      
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
      
      // ========== 状态更新 ==========
      
      updateDownloadStatus: (downloadId: string, status: DownloadStatus) => {
        set((state) => {
          const newDownloads = new Map(state.downloads)
          const item = newDownloads.get(downloadId)
          
          if (item) {
            const now = Date.now()
            const updatedItem: DownloadItem = {
              ...item,
              status,
              // 更新时间戳
              created_at: item.status === 'pending' && !item.created_at ? new Date(now).toISOString() : item.created_at,
              started_at: status === 'downloading' && !item.started_at ? new Date(now).toISOString() : item.started_at,
              completed_at: status === 'completed' ? new Date(now).toISOString() : item.completed_at,
              statusInfo: {
                ...item.statusInfo,
                last_updated: now
              }
            }
            newDownloads.set(downloadId, updatedItem)
          }
          
          return {
            downloads: newDownloads
          }
        })
      },
      
      updateDownloadProgress: (downloadId: string, progress: number, speed?: number, eta?: number) => {
        set((state) => {
          const newDownloads = new Map(state.downloads)
          const item = newDownloads.get(downloadId)
          
          if (item) {
            newDownloads.set(downloadId, {
              ...item,
              statusInfo: {
                ...item.statusInfo,
                progress: Math.min(100, Math.max(0, progress)),
                speed: speed !== undefined ? speed : item.statusInfo.speed,
                eta: eta !== undefined ? eta : item.statusInfo.eta,
                last_updated: Date.now()
              }
            })
          }
          
          return {
            downloads: newDownloads
          }
        })
      },
      
      updateDownloadStage: (downloadId: string, stage: DownloadStage) => {
        set((state) => {
          const newDownloads = new Map(state.downloads)
          const item = newDownloads.get(downloadId)
          
          if (item) {
            newDownloads.set(downloadId, {
              ...item,
              statusInfo: {
                ...item.statusInfo,
                stage,
                last_updated: Date.now()
              }
            })
          }
          
          return {
            downloads: newDownloads
          }
        })
      },
      
      updateDownloadBytes: (downloadId: string, downloaded: number, total: number) => {
        set((state) => {
          const newDownloads = new Map(state.downloads)
          const item = newDownloads.get(downloadId)
          
          if (item) {
            const progress = total > 0 ? (downloaded / total) * 100 : 0
            newDownloads.set(downloadId, {
              ...item,
              statusInfo: {
                ...item.statusInfo,
                progress,
                downloaded_bytes: downloaded,
                total_bytes: total,
                last_updated: Date.now()
              }
            })
          }
          
          return {
            downloads: newDownloads
          }
        })
      },
      
      // ========== 错误处理 ==========
      
      setDownloadError: (downloadId: string, error: ErrorInfo) => {
        set((state) => {
          const newDownloads = new Map(state.downloads)
          const item = newDownloads.get(downloadId)
          
          if (item) {
            newDownloads.set(downloadId, {
              ...item,
              status: 'failed',
              statusInfo: {
                ...item.statusInfo,
                error,
                last_updated: Date.now()
              }
            })
          }
          
          return {
            downloads: newDownloads
          }
        })
      },
      
      clearDownloadError: (downloadId: string) => {
        set((state) => {
          const newDownloads = new Map(state.downloads)
          const item = newDownloads.get(downloadId)
          
          if (item) {
            newDownloads.set(downloadId, {
              ...item,
              statusInfo: {
                ...item.statusInfo,
                error: null,
                last_updated: Date.now()
              }
            })
          }
          
          return {
            downloads: newDownloads
          }
        })
      },
      
      // ========== 重试管理 ==========
      
      incrementRetryCount: (downloadId: string) => {
        set((state) => {
          const newDownloads = new Map(state.downloads)
          const item = newDownloads.get(downloadId)
          
          if (item) {
            newDownloads.set(downloadId, {
              ...item,
              statusInfo: {
                ...item.statusInfo,
                retry_count: item.statusInfo.retry_count + 1,
                last_updated: Date.now()
              }
            })
          }
          
          return {
            downloads: newDownloads
          }
        })
      },
      
      resetRetryCount: (downloadId: string) => {
        set((state) => {
          const newDownloads = new Map(state.downloads)
          const item = newDownloads.get(downloadId)
          
          if (item) {
            newDownloads.set(downloadId, {
              ...item,
              statusInfo: {
                ...item.statusInfo,
                retry_count: 0,
                last_updated: Date.now()
              }
            })
          }
          
          return {
            downloads: newDownloads
          }
        })
      },
      
      // ========== 批量操作 ==========
      
      batchUpdateStatus: (downloadIds: string[], status: DownloadStatus) => {
        set((state) => {
          const newDownloads = new Map(state.downloads)
          const now = Date.now()
          
          downloadIds.forEach(downloadId => {
            const item = newDownloads.get(downloadId)
            if (item) {
              const updatedItem: DownloadItem = {
                ...item,
                status,
                created_at: item.status === 'pending' && !item.created_at ? new Date(now).toISOString() : item.created_at,
                started_at: status === 'downloading' && !item.started_at ? new Date(now).toISOString() : item.started_at,
                completed_at: status === 'completed' ? new Date(now).toISOString() : item.completed_at,
                statusInfo: {
                  ...item.statusInfo,
                  last_updated: now
                }
              }
              newDownloads.set(downloadId, updatedItem)
            }
          })
          
          return {
            downloads: newDownloads
          }
        })
      },
      
      batchUpdateProgress: (updates: Array<{ id: string; progress: number; speed?: number; eta?: number }>) => {
        set((state) => {
          const newDownloads = new Map(state.downloads)
          
          updates.forEach(({ id, progress, speed, eta }) => {
            const item = newDownloads.get(id)
            if (item) {
              newDownloads.set(id, {
                ...item,
                statusInfo: {
                  ...item.statusInfo,
                  progress: Math.min(100, Math.max(0, progress)),
                  speed: speed !== undefined ? speed : item.statusInfo.speed,
                  eta: eta !== undefined ? eta : item.statusInfo.eta,
                  last_updated: Date.now()
                }
              })
            }
          })
          
          return {
            downloads: newDownloads
          }
        })
      },
      
      // ========== 查询方法 ==========
      
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
      
      getDownloadsByStatus: (status: DownloadStatus) => {
        const { downloads } = get()
        return Array.from(downloads.values()).filter(item => item.status === status)
      },
      
      getFailedDownloads: () => {
        const { downloads } = get()
        return Array.from(downloads.values()).filter(item => 
          item.status === 'failed' && item.statusInfo.error !== null
        )
      },
      
      getRetryableDownloads: () => {
        const { downloads } = get()
        return Array.from(downloads.values()).filter(item => 
          item.status === 'failed' && 
          item.statusInfo.retry_count < item.statusInfo.max_retries
        )
      },
      
      getDownloadStats: () => {
        const { downloads } = get()
        const items = Array.from(downloads.values())
        
        return {
          total: items.length,
          downloading: items.filter(i => i.status === 'downloading').length,
          completed: items.filter(i => i.status === 'completed').length,
          failed: items.filter(i => i.status === 'failed').length,
          paused: items.filter(i => i.status === 'paused').length,
          pending: items.filter(i => i.status === 'pending').length,
          cancelled: items.filter(i => i.status === 'cancelled').length
        }
      },
      
      // ========== 服务器同步 ==========
      
      syncFromServer: async () => {
        const { syncing } = get()
        if (syncing) return
        
        set({ syncing: true })
        
        try {
          const response = await apiService.getDownloadList()
          
          if (response.success && response.data?.downloads) {
            // 只保留未完成的任务（pending, downloading, failed, paused, cancelled）
            const pendingDownloads = response.data.downloads.filter((item: any) => 
              item.status !== 'completed'
            )
            
            // 转换服务器数据格式到本地格式
            const convertedDownloads: DownloadItem[] = pendingDownloads.map((item: any) => ({
              id: item.id,
              bvid: item.bvid,
              title: item.title,
              status: item.status as DownloadStatus,
              statusInfo: {
                progress: item.progress || 0,
                speed: item.download_speed || 0,
                eta: item.eta || 0,
                stage: item.stage || 'preparing',
                downloaded_bytes: item.downloaded_bytes || 0,
                total_bytes: item.total_bytes || 0,
                retry_count: item.retry_count || 0,
                max_retries: item.max_retries || 3,
                error: item.error_message ? {
                  type: 'unknown',
                  message: item.error_message,
                  timestamp: Date.now()
                } : null,
                last_updated: Date.now()
              },
              thumbnail_url: item.thumbnail_url || null,
              duration: item.duration || null,
              uploader: item.uploader || null,
              file_path: item.file_path || null,
              created_at: item.created_at || null,
              started_at: item.started_at || null,
              completed_at: item.completed_at || null,
              aid: item.aid || null,
              cid: item.cid || null,
              quality: item.quality || null,
              audio_bitrate: item.audio_bitrate || null,
              codec: item.codec || null
            }))
            
            get().setDownloads(convertedDownloads)
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
              statusInfo: {
                progress: 0,
                speed: 0,
                eta: 0,
                stage: 'preparing',
                downloaded_bytes: 0,
                total_bytes: 0,
                retry_count: 0,
                max_retries: 3,
                error: null,
                last_updated: Date.now()
              },
              thumbnail_url: downloadData.thumbnail_url || null,
              duration: downloadData.duration || null,
              uploader: downloadData.uploader || null,
              file_path: null,
              created_at: new Date().toISOString(),
              started_at: null,
              completed_at: null,
              aid: downloadData.aid || null,
              cid: downloadData.cid || null,
              quality: downloadData.quality || null,
              audio_bitrate: downloadData.audio_bitrate || null,
              codec: downloadData.codec || null
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
          const response = await apiService.startBatchDownloads(downloadIds || [])
          
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
      
      // ========== 任务控制 ==========
      
      startDownload: async (downloadId: string) => {
        try {
          const response = await apiService.startDownloadTask(downloadId)
          
          if (response.success) {
            // 立即更新本地状态
            get().updateDownloadStatus(downloadId, 'downloading')
            get().clearDownloadError(downloadId)
            get().resetRetryCount(downloadId)
            // 同步服务器状态
            get().syncFromServer()
            return true
          }
          
          return false
        } catch (error) {
          console.error('开始下载失败:', error)
          // 设置错误信息
          get().setDownloadError(downloadId, {
            type: 'network',
            message: error instanceof Error ? error.message : '开始下载失败',
            timestamp: Date.now()
          })
          return false
        }
      },
      
      pauseDownload: async (downloadId: string) => {
        try {
          const response = await apiService.pauseDownloadTask(downloadId)
          
          if (response.success) {
            // 立即更新本地状态
            get().updateDownloadStatus(downloadId, 'paused')
            // 同步服务器状态
            get().syncFromServer()
            return true
          }
          
          return false
        } catch (error) {
          console.error('暂停下载失败:', error)
          return false
        }
      },
      
      resumeDownload: async (downloadId: string) => {
        try {
          const response = await apiService.resumeDownloadTask(downloadId)
          
          if (response.success) {
            // 立即更新本地状态
            get().updateDownloadStatus(downloadId, 'downloading')
            // 同步服务器状态
            get().syncFromServer()
            return true
          }
          
          return false
        } catch (error) {
          console.error('继续下载失败:', error)
          return false
        }
      },
      
      cancelDownload: async (downloadId: string) => {
        try {
          const response = await apiService.cancelDownloadTask(downloadId)
          
          if (response.success) {
            // 立即更新本地状态
            get().updateDownloadStatus(downloadId, 'cancelled')
            // 同步服务器状态
            get().syncFromServer()
            return true
          }
          
          return false
        } catch (error) {
          console.error('取消下载失败:', error)
          return false
        }
      },
      
      retryDownload: async (downloadId: string) => {
        try {
          // 增加重试次数
          get().incrementRetryCount(downloadId)
          
          // 检查是否超过最大重试次数
          const download = get().downloads.get(downloadId)
          if (download && download.statusInfo.retry_count > download.statusInfo.max_retries) {
            console.error(`下载任务 ${downloadId} 已超过最大重试次数`)
            return false
          }
          
          // 清除错误信息并重新开始
          get().clearDownloadError(downloadId)
          get().updateDownloadStatus(downloadId, 'pending')
          
          // 调用开始下载
          return await get().startDownload(downloadId)
        } catch (error) {
          console.error('重试下载失败:', error)
          return false
        }
      },
      
      getTaskStatus: async (downloadId: string) => {
        try {
          const response = await apiService.getDownloadTaskStatus(downloadId)
          
          if (response.success && response.data) {
            // 更新本地状态
            get().updateDownloadStatus(downloadId, response.data.status)
            if (response.data.progress !== undefined) {
              get().updateDownloadProgress(
                downloadId,
                response.data.progress,
                response.data.speed,
                response.data.eta
              )
            }
            return response.data as DownloadItem
          }
          
          return null
        } catch (error) {
          console.error('获取任务状态失败:', error)
          return null
        }
      },
      
      clearDownloads: () => {
        set({
          downloads: new Map(),
          downloadIds: []
        })
      },
      
      // ========== WebSocket连接 ==========
      
      connectWebSocket: () => {
        const { ws, wsConnected } = get()
        if (ws && wsConnected) return
        
        const wsUrl = `ws://${window.location.hostname}:8000/ws/downloads`
        const newWs = new WebSocket(wsUrl)
        
        newWs.onopen = () => {
          console.log('[DownloadStore] WebSocket connected')
          set({ wsConnected: true })
        }
        
        newWs.onmessage = (event) => {
          get().handleWebSocketMessage(event)
        }
        
        newWs.onclose = () => {
          console.log('[DownloadStore] WebSocket disconnected')
          set({ wsConnected: false, ws: null })
          // 3秒后重连
          setTimeout(() => {
            const { ws: currentWs } = get()
            if (!currentWs) {
              get().connectWebSocket()
            }
          }, 3000)
        }
        
        newWs.onerror = (error) => {
          console.error('[DownloadStore] WebSocket error:', error)
        }
        
        set({ ws: newWs })
      },
      
      disconnectWebSocket: () => {
        const { ws } = get()
        if (ws) {
          ws.close()
          set({ ws: null, wsConnected: false })
        }
      },
      
      handleWebSocketMessage: (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          const { type, ...payload } = data
          
          switch (type) {
            case 'download_progress':
              // 更新下载进度
              if (payload.download_id && payload.progress !== undefined) {
                get().updateDownloadProgress(
                  payload.download_id,
                  payload.progress,
                  payload.speed,
                  payload.eta
                )
              }
              break
              
            case 'download_status':
              // 更新下载状态
              if (payload.download_id && payload.status) {
                get().updateDownloadStatus(payload.download_id, payload.status)
              }
              break
              
            case 'download_stage':
              // 更新下载阶段
              if (payload.download_id && payload.stage) {
                get().updateDownloadStage(payload.download_id, payload.stage)
              }
              break
              
            case 'download_bytes':
              // 更新下载字节
              if (payload.download_id && payload.downloaded !== undefined && payload.total !== undefined) {
                get().updateDownloadBytes(payload.download_id, payload.downloaded, payload.total)
              }
              break
              
            case 'download_error':
              // 设置下载错误
              if (payload.download_id && payload.error) {
                get().setDownloadError(payload.download_id, {
                  type: payload.error_type || 'unknown',
                  message: payload.error,
                  code: payload.error_code,
                  details: payload.error_details,
                  timestamp: Date.now()
                })
              }
              break
              
            case 'download_completed':
              // 下载完成
              if (payload.download_id) {
                get().updateDownloadStatus(payload.download_id, 'completed')
                get().updateDownloadProgress(payload.download_id, 100, 0, 0)
                
                // 通知历史记录store更新
                setTimeout(() => {
                  useDownloadHistoryStore.getState().refreshHistory()
                }, 500)
              }
              break
              
            case 'downloads_sync':
              // 全量同步
              get().syncFromServer()
              break
              
            default:
              console.log('[DownloadStore] Unknown message type:', type)
          }
        } catch (error) {
          console.error('[DownloadStore] Failed to handle WebSocket message:', error)
        }
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
        // 重新连接WebSocket
        if (state) {
          state.wsConnected = false
          state.ws = null
          // 延迟连接以确保store完全初始化
          setTimeout(() => {
            const store = useDownloadStore.getState()
            if (!store.wsConnected) {
              store.connectWebSocket()
            }
          }, 1000)
        }
      }
    }
  )
)