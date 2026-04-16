import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiService } from '../services/api'

// ========== 类型定义 ==========

// 历史记录状态类型
export type HistoryStatus = 'completed' | 'failed' | 'cancelled'

// 历史记录阶段类型
export type HistoryStage = 'preparing' | 'downloading' | 'moving' | 'post_processing' | 'completed'

// 错误类型
export type HistoryErrorType = 'network' | 'authentication' | 'file_system' | 'server' | 'unknown'

// 历史记录项
export interface HistoryItem {
  id: string
  bvid: string
  title: string
  status: HistoryStatus
  progress: number
  download_speed: number
  downloaded_bytes: number
  total_bytes: number
  file_size: number  // 实际文件大小
  file_path: string
  thumbnail_url: string | null
  duration: number | null
  uploader: string | null
  uploader_mid: number | null
  quality: number | null
  audio_bitrate: number | null
  codec: string | null
  error_message: string | null
  created_at: string | null
  started_at: string | null
  completed_at: string | null
  aid: number | null
  cid: number | null
  media_type: string | null
  source_type: string | null
  source_id: string | null
  retry_count: number
  max_retries: number
}

// 历史记录筛选条件
export interface HistoryFilter {
  status?: HistoryStatus
  media_type?: string
  source_type?: string
  date_from?: string
  date_to?: string
  keyword?: string
  quality?: number
}

// 历史记录排序选项
export type HistorySortOption = 
  | 'completed_at_desc'
  | 'completed_at_asc'
  | 'title_asc'
  | 'title_desc'
  | 'size_desc'
  | 'size_asc'
  | 'created_at_desc'
  | 'created_at_asc'

// 历史记录分页参数
export interface HistoryPagination {
  page: number
  page_size: number
  total: number
}

// 历史记录统计信息
export interface HistoryStats {
  total: number
  completed: number
  failed: number
  cancelled: number
  total_size: number
  average_size: number
  completed_today: number
  completed_this_week: number
  completed_this_month: number
  success_rate: number
}

// 导出格式
export type ExportFormat = 'csv' | 'json'

// ========== Store 状态接口 ==========

interface DownloadHistoryState {
  // 历史记录数据
  historyItems: Map<string, HistoryItem>
  historyIds: string[]
  
  // 加载状态
  loading: boolean
  error: string | null
  
  // 分页信息
  pagination: HistoryPagination
  
  // 当前筛选条件
  currentFilter: HistoryFilter
  
  // 当前排序选项
  currentSort: HistorySortOption
  
  // 同步状态
  syncing: boolean
  lastSyncTime: number | null
  
  // ========== 数据加载 ==========
  
  // 从服务器加载历史记录
  loadHistory: (filter?: HistoryFilter, sort?: HistorySortOption, page?: number, pageSize?: number) => Promise<void>
  
  // 刷新历史记录
  refreshHistory: () => Promise<void>
  
  // ========== 数据管理 ==========
  
  // 设置历史记录
  setHistoryItems: (items: HistoryItem[]) => void
  
  // 添加历史记录项
  addHistoryItem: (item: HistoryItem) => void
  
  // 更新历史记录项
  updateHistoryItem: (id: string, updates: Partial<HistoryItem>) => void
  
  // 删除历史记录项
  deleteHistoryItem: (id: string) => Promise<boolean>
  
  // 批量删除历史记录项
  batchDeleteHistoryItems: (ids: string[]) => Promise<boolean>
  
  // 清空历史记录
  clearHistory: () => Promise<boolean>
  
  // ========== 查询方法 ==========
  
  // 获取所有历史记录
  getAllHistoryItems: () => HistoryItem[]
  
  // 根据状态获取历史记录
  getHistoryByStatus: (status: HistoryStatus) => HistoryItem[]
  
  // 根据BVID获取历史记录
  getHistoryByBvid: (bvid: string) => HistoryItem[]
  
  // 搜索历史记录
  searchHistory: (keyword: string) => HistoryItem[]
  
  // 筛选历史记录
  filterHistory: (filter: HistoryFilter) => HistoryItem[]
  
  // 排序历史记录
  sortHistory: (items: HistoryItem[], sort: HistorySortOption) => HistoryItem[]
  
  // 获取分页历史记录
  getPaginatedHistory: (page: number, pageSize: number) => { items: HistoryItem[]; total: number }
  
  // 获取历史记录统计
  getHistoryStats: () => HistoryStats
  
  // ========== 筛选和排序管理 ==========
  
  // 设置筛选条件
  setFilter: (filter: HistoryFilter) => void
  
  // 设置排序选项
  setSort: (sort: HistorySortOption) => void
  
  // 重置筛选和排序
  resetFilterAndSort: () => void
  
  // ========== 数据清理 ==========
  
  // 按日期清理历史记录
  clearHistoryByDate: (beforeDate: string) => Promise<boolean>
  
  // 按状态清理历史记录
  clearHistoryByStatus: (status: HistoryStatus) => Promise<boolean>
  
  // 清理失败的历史记录
  clearFailedHistory: () => Promise<boolean>
  
  // 清理取消的历史记录
  clearCancelledHistory: () => Promise<boolean>
  
  // ========== 数据导出 ==========
  
  // 导出历史记录
  exportHistory: (format: ExportFormat, items?: HistoryItem[]) => Promise<Blob | null>
  
  // 导出CSV格式
  exportToCSV: (items?: HistoryItem[]) => Promise<Blob | null>
  
  // 导出JSON格式
  exportToJSON: (items?: HistoryItem[]) => Promise<Blob | null>
  
  // ========== 与其他Store集成 ==========
  
  // 从下载列表移动到历史记录
  moveFromDownload: (downloadId: string) => Promise<boolean>
  
  // 从队列移动到历史记录
  moveFromQueue: (taskId: string) => Promise<boolean>
}

// 默认筛选条件
const DEFAULT_FILTER: HistoryFilter = {}

// 默认排序选项
const DEFAULT_SORT: HistorySortOption = 'completed_at_desc'

// 默认分页参数
const DEFAULT_PAGINATION: HistoryPagination = {
  page: 1,
  page_size: 20,
  total: 0
}

// ========== Store 创建 ==========

export const useDownloadHistoryStore = create<DownloadHistoryState>()(
  persist(
    (set, get) => ({
      // ========== 初始状态 ==========
      
      historyItems: new Map(),
      historyIds: [],
      loading: false,
      error: null,
      pagination: DEFAULT_PAGINATION,
      currentFilter: DEFAULT_FILTER,
      currentSort: DEFAULT_SORT,
      syncing: false,
      lastSyncTime: null,
      
      // ========== 数据加载 ==========
      
      loadHistory: async (
        filter?: HistoryFilter,
        sort?: HistorySortOption,
        page: number = 1,
        pageSize: number = 20
      ) => {
        set({ loading: true, error: null })
        
        try {
          // 构建查询参数
          const params = new URLSearchParams({
            status: 'completed', // 只获取已完成的记录
            page: page.toString(),
            page_size: pageSize.toString()
          })
          
          // 添加筛选条件
          if (filter?.keyword) {
            params.append('keyword', filter.keyword)
          }
          
          if (filter?.date_from) {
            params.append('date_from', filter.date_from)
          }
          
          if (filter?.date_to) {
            params.append('date_to', filter.date_to)
          }
          
          // 添加排序条件
          if (sort) {
            const [sortField, sortDirection] = sort.split('_')
            params.append('order', sortField)
            params.append('sort_direction', sortDirection)
          }
          
          // 调用API
          const response = await apiService.request<any>(
            `/api/download/list?${params.toString()}`,
            { method: 'GET' }
          )
          
          if (response.success && response.data?.downloads) {
            // 转换服务器数据格式
            const historyItems: HistoryItem[] = response.data.downloads.map((item: any) => ({
              id: item.id,
              bvid: item.bvid,
              title: item.title,
              status: item.status as HistoryStatus,
              progress: item.progress || 100,
              download_speed: item.download_speed || 0,
              downloaded_bytes: item.downloaded_bytes || item.total_bytes || 0,
              total_bytes: item.total_bytes || 0,
              file_size: item.file_size || 0,
              file_path: item.file_path || '',
              thumbnail_url: item.thumbnail_url || null,
              duration: item.duration || null,
              uploader: item.uploader || null,
              uploader_mid: item.uploader_mid || null,
              quality: item.quality || null,
              audio_bitrate: item.audio_bitrate || null,
              codec: item.codec || null,
              error_message: item.error_message || null,
              created_at: item.created_at || null,
              started_at: item.started_at || null,
              completed_at: item.completed_at || null,
              aid: item.aid || null,
              cid: item.cid || null,
              media_type: item.media_type || null,
              source_type: item.source_type || null,
              source_id: item.source_id || null,
              retry_count: item.retry_count || 0,
              max_retries: item.max_retries || 3
            }))
            
            // 更新状态
            get().setHistoryItems(historyItems)
            
            set({
              loading: false,
              pagination: {
                page,
                page_size: pageSize,
                total: response.data.total || historyItems.length
              },
              currentFilter: filter || DEFAULT_FILTER,
              currentSort: sort || DEFAULT_SORT,
              lastSyncTime: Date.now()
            })
          } else {
            set({
              loading: false,
              error: response.message || '加载历史记录失败'
            })
          }
        } catch (error) {
          console.error('[DownloadHistoryStore] Load history failed:', error)
          set({
            loading: false,
            error: error instanceof Error ? error.message : '加载历史记录失败'
          })
        }
      },
      
      refreshHistory: async () => {
        const { currentFilter, currentSort, pagination } = get()
        await get().loadHistory(currentFilter, currentSort, pagination.page, pagination.page_size)
      },
      
      // ========== 数据管理 ==========
      
      setHistoryItems: (items: HistoryItem[]) => {
        const newHistoryItems = new Map<string, HistoryItem>()
        const newHistoryIds: string[] = []
        
        items.forEach(item => {
          newHistoryItems.set(item.id, item)
          newHistoryIds.push(item.id)
        })
        
        set({
          historyItems: newHistoryItems,
          historyIds: newHistoryIds
        })
      },
      
      addHistoryItem: (item: HistoryItem) => {
        set((state) => {
          const newHistoryItems = new Map(state.historyItems)
          newHistoryItems.set(item.id, item)
          
          // 添加到列表头部
          const newHistoryIds = [item.id, ...state.historyIds]
          
          return {
            historyItems: newHistoryItems,
            historyIds: newHistoryIds,
            pagination: {
              ...state.pagination,
              total: state.pagination.total + 1
            }
          }
        })
      },
      
      updateHistoryItem: (id: string, updates: Partial<HistoryItem>) => {
        set((state) => {
          const newHistoryItems = new Map(state.historyItems)
          const item = newHistoryItems.get(id)
          
          if (item) {
            newHistoryItems.set(id, { ...item, ...updates })
          }
          
          return {
            historyItems: newHistoryItems
          }
        })
      },
      
      deleteHistoryItem: async (id: string) => {
        try {
          const response = await apiService.deleteDownload(id)
          
          if (response.success) {
            set((state) => {
              const newHistoryItems = new Map(state.historyItems)
              newHistoryItems.delete(id)
              
              const newHistoryIds = state.historyIds.filter(historyId => historyId !== id)
              
              return {
                historyItems: newHistoryItems,
                historyIds: newHistoryIds,
                pagination: {
                  ...state.pagination,
                  total: state.pagination.total - 1
                }
              }
            })
            
            return true
          }
          
          return false
        } catch (error) {
          console.error('[DownloadHistoryStore] Delete history item failed:', error)
          return false
        }
      },
      
      batchDeleteHistoryItems: async (ids: string[]) => {
        try {
          // 并行删除所有项
          const results = await Promise.all(
            ids.map(id => apiService.deleteDownload(id))
          )
          
          // 检查是否所有删除都成功
          const allSuccess = results.every(result => result.success)
          
          if (allSuccess) {
            set((state) => {
              const newHistoryItems = new Map(state.historyItems)
              ids.forEach(id => newHistoryItems.delete(id))
              
              const newHistoryIds = state.historyIds.filter(id => !ids.includes(id))
              
              return {
                historyItems: newHistoryItems,
                historyIds: newHistoryIds,
                pagination: {
                  ...state.pagination,
                  total: state.pagination.total - ids.length
                }
              }
            })
            
            return true
          }
          
          return false
        } catch (error) {
          console.error('[DownloadHistoryStore] Batch delete failed:', error)
          return false
        }
      },
      
      clearHistory: async () => {
        try {
          const response = await apiService.request<any>('/api/download/clear-all', {
            method: 'POST'
          })
          
          if (response.success) {
            set({
              historyItems: new Map(),
              historyIds: [],
              pagination: {
                page: 1,
                page_size: DEFAULT_PAGINATION.page_size,
                total: 0
              }
            })
            
            return true
          }
          
          return false
        } catch (error) {
          console.error('[DownloadHistoryStore] Clear history failed:', error)
          return false
        }
      },
      
      // ========== 查询方法 ==========
      
      getAllHistoryItems: () => {
        const { historyItems, historyIds } = get()
        return historyIds.map(id => historyItems.get(id)!).filter(Boolean)
      },
      
      getHistoryByStatus: (status: HistoryStatus) => {
        const { historyItems } = get()
        return Array.from(historyItems.values()).filter(item => item.status === status)
      },
      
      getHistoryByBvid: (bvid: string) => {
        const { historyItems } = get()
        return Array.from(historyItems.values()).filter(item => item.bvid === bvid)
      },
      
      searchHistory: (keyword: string) => {
        const { historyItems } = get()
        const lowerKeyword = keyword.toLowerCase()
        
        return Array.from(historyItems.values()).filter(item =>
          item.title.toLowerCase().includes(lowerKeyword) ||
          item.bvid.toLowerCase().includes(lowerKeyword) ||
          (item.uploader && item.uploader.toLowerCase().includes(lowerKeyword))
        )
      },
      
      filterHistory: (filter: HistoryFilter) => {
        let items = get().getAllHistoryItems()
        
        // 按状态筛选
        if (filter.status) {
          items = items.filter(item => item.status === filter.status)
        }
        
        // 按媒体类型筛选
        if (filter.media_type) {
          items = items.filter(item => item.media_type === filter.media_type)
        }
        
        // 按来源类型筛选
        if (filter.source_type) {
          items = items.filter(item => item.source_type === filter.source_type)
        }
        
        // 按日期范围筛选
        if (filter.date_from) {
          const fromDate = new Date(filter.date_from).getTime()
          items = items.filter(item => 
            item.completed_at && new Date(item.completed_at).getTime() >= fromDate
          )
        }
        
        if (filter.date_to) {
          const toDate = new Date(filter.date_to).getTime()
          items = items.filter(item => 
            item.completed_at && new Date(item.completed_at).getTime() <= toDate
          )
        }
        
        // 按关键词筛选
        if (filter.keyword) {
          const lowerKeyword = filter.keyword.toLowerCase()
          items = items.filter(item =>
            item.title.toLowerCase().includes(lowerKeyword) ||
            item.bvid.toLowerCase().includes(lowerKeyword) ||
            (item.uploader && item.uploader.toLowerCase().includes(lowerKeyword))
          )
        }
        
        // 按质量筛选
        if (filter.quality) {
          items = items.filter(item => item.quality === filter.quality)
        }
        
        return items
      },
      
      sortHistory: (items: HistoryItem[], sort: HistorySortOption) => {
        const [field, direction] = sort.split('_')
        const isAsc = direction === 'asc'
        
        return [...items].sort((a, b) => {
          let comparison = 0
          
          switch (field) {
            case 'completed_at':
              const completedAtA = a.completed_at ? new Date(a.completed_at).getTime() : 0
              const completedAtB = b.completed_at ? new Date(b.completed_at).getTime() : 0
              comparison = completedAtA - completedAtB
              break
              
            case 'title':
              comparison = a.title.localeCompare(b.title)
              break
              
            case 'size':
              comparison = a.file_size - b.file_size
              break
              
            case 'created_at':
              const createdAtA = a.created_at ? new Date(a.created_at).getTime() : 0
              const createdAtB = b.created_at ? new Date(b.created_at).getTime() : 0
              comparison = createdAtA - createdAtB
              break
              
            default:
              comparison = 0
          }
          
          return isAsc ? comparison : -comparison
        })
      },
      
      getPaginatedHistory: (page: number, pageSize: number) => {
        let items = get().getAllHistoryItems()
        
        // 应用当前筛选
        const { currentFilter } = get()
        if (Object.keys(currentFilter).length > 0) {
          items = get().filterHistory(currentFilter)
        }
        
        // 应用当前排序
        const { currentSort } = get()
        items = get().sortHistory(items, currentSort)
        
        // 分页
        const total = items.length
        const startIndex = (page - 1) * pageSize
        const endIndex = startIndex + pageSize
        const paginatedItems = items.slice(startIndex, endIndex)
        
        return {
          items: paginatedItems,
          total
        }
      },
      
      getHistoryStats: () => {
        const { historyItems } = get()
        const items = Array.from(historyItems.values())
        
        const total = items.length
        const completed = items.filter(item => item.status === 'completed').length
        const failed = items.filter(item => item.status === 'failed').length
        const cancelled = items.filter(item => item.status === 'cancelled').length
        
        const totalSize = items.reduce((sum, item) => sum + item.file_size, 0)
        const averageSize = total > 0 ? totalSize / total : 0
        
        // 计算最近的时间统计
        const now = Date.now()
        const oneDay = 24 * 60 * 60 * 1000
        const oneWeek = 7 * oneDay
        const oneMonth = 30 * oneDay
        
        const completedItems = items.filter(item => 
          item.status === 'completed' && item.completed_at
        )
        
        const completedToday = completedItems.filter(item =>
          new Date(item.completed_at!).getTime() >= now - oneDay
        ).length
        
        const completedThisWeek = completedItems.filter(item =>
          new Date(item.completed_at!).getTime() >= now - oneWeek
        ).length
        
        const completedThisMonth = completedItems.filter(item =>
          new Date(item.completed_at!).getTime() >= now - oneMonth
        ).length
        
        const successRate = total > 0 ? (completed / total) * 100 : 0
        
        return {
          total,
          completed,
          failed,
          cancelled,
          total_size: totalSize,
          average_size: averageSize,
          completed_today: completedToday,
          completed_this_week: completedThisWeek,
          completed_this_month: completedThisMonth,
          success_rate: successRate
        }
      },
      
      // ========== 筛选和排序管理 ==========
      
      setFilter: (filter: HistoryFilter) => {
        set({ currentFilter: filter })
      },
      
      setSort: (sort: HistorySortOption) => {
        set({ currentSort: sort })
      },
      
      resetFilterAndSort: () => {
        set({
          currentFilter: DEFAULT_FILTER,
          currentSort: DEFAULT_SORT
        })
      },
      
      // ========== 数据清理 ==========
      
      clearHistoryByDate: async (beforeDate: string) => {
        try {
          const items = get().getAllHistoryItems()
          const cutoffDate = new Date(beforeDate).getTime()
          
          // 找出需要删除的项
          const itemsToDelete = items.filter(item =>
            item.completed_at && new Date(item.completed_at).getTime() < cutoffDate
          )
          
          if (itemsToDelete.length === 0) {
            return true
          }
          
          // 批量删除
          const idsToDelete = itemsToDelete.map(item => item.id)
          return await get().batchDeleteHistoryItems(idsToDelete)
        } catch (error) {
          console.error('[DownloadHistoryStore] Clear history by date failed:', error)
          return false
        }
      },
      
      clearHistoryByStatus: async (status: HistoryStatus) => {
        try {
          const items = get().getHistoryByStatus(status)
          
          if (items.length === 0) {
            return true
          }
          
          // 批量删除
          const idsToDelete = items.map(item => item.id)
          return await get().batchDeleteHistoryItems(idsToDelete)
        } catch (error) {
          console.error('[DownloadHistoryStore] Clear history by status failed:', error)
          return false
        }
      },
      
      clearFailedHistory: async () => {
        return await get().clearHistoryByStatus('failed')
      },
      
      clearCancelledHistory: async () => {
        return await get().clearHistoryByStatus('cancelled')
      },
      
      // ========== 数据导出 ==========
      
      exportHistory: async (format: ExportFormat, items?: HistoryItem[]) => {
        const historyItems = items || get().getAllHistoryItems()
        
        if (format === 'csv') {
          return await get().exportToCSV(historyItems)
        } else {
          return await get().exportToJSON(historyItems)
        }
      },
      
      exportToCSV: async (items?: HistoryItem[]) => {
        const historyItems = items || get().getAllHistoryItems()
        
        if (historyItems.length === 0) {
          return null
        }
        
        try {
          // 构建CSV内容
          const headers = [
            'ID',
            'BVID',
            '标题',
            '状态',
            '进度',
            '下载速度',
            '已下载字节',
            '总字节数',
            '文件大小',
            '文件路径',
            '时长',
            'UP主',
            '画质',
            '创建时间',
            '开始时间',
            '完成时间',
            '错误信息'
          ]
          
          const rows = historyItems.map(item => [
            item.id,
            item.bvid,
            `"${item.title.replace(/"/g, '""')}"`, // 处理包含逗号和引号的标题
            item.status,
            item.progress,
            item.download_speed,
            item.downloaded_bytes,
            item.total_bytes,
            item.file_size,
            item.file_path,
            item.duration || '',
            item.uploader || '',
            item.quality || '',
            item.created_at || '',
            item.started_at || '',
            item.completed_at || '',
            item.error_message || ''
          ])
          
          const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
          ].join('\n')
          
          // 添加BOM以支持Excel正确显示中文
          const bom = '\uFEFF'
          const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
          
          return blob
        } catch (error) {
          console.error('[DownloadHistoryStore] Export to CSV failed:', error)
          return null
        }
      },
      
      exportToJSON: async (items?: HistoryItem[]) => {
        const historyItems = items || get().getAllHistoryItems()
        
        if (historyItems.length === 0) {
          return null
        }
        
        try {
          const jsonContent = JSON.stringify(historyItems, null, 2)
          const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
          
          return blob
        } catch (error) {
          console.error('[DownloadHistoryStore] Export to JSON failed:', error)
          return null
        }
      },
      
      // ========== 与其他Store集成 ==========
      
      moveFromDownload: async (downloadId: string) => {
        // 这个方法将由download store调用，当下载完成时
        // 历史记录通过syncFromServer自动更新，所以这里主要是占位符
        console.log('[DownloadHistoryStore] Moving download to history:', downloadId)
        return true
      },
      
      moveFromQueue: async (taskId: string) => {
        // 这个方法将由queue store调用，当任务完成时
        // 历史记录通过syncFromServer自动更新，所以这里主要是占位符
        console.log('[DownloadHistoryStore] Moving queue task to history:', taskId)
        return true
      }
    }),
    {
      name: 'pilinote-download-history',
      // 只持久化基本状态，不持久化历史记录数据（数据量太大）
      partialize: (state) => ({
        currentFilter: state.currentFilter,
        currentSort: state.currentSort,
        lastSyncTime: state.lastSyncTime
      })
    }
  )
)