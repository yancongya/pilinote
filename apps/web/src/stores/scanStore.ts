import { create } from 'zustand'
import { getApiUrl } from '../config/api'

export interface ScanRecord {
  id: string
  source_type: string
  source_id: string
  last_scan_time: string
  total_videos: number
  new_videos: number
  added_to_queue: number
  status: string
  created_at?: string
}

export interface FolderScanInfo {
  id: number
  title: string
  video_count: number
  new_count: number
  media_count: number
}

export interface ScanTriggerResponse {
  total: number
  new: number
  added: number
  folder_count: number
  folders: FolderScanInfo[]
}

interface ScanState {
  // 状态
  loading: boolean
  scanning: boolean
  scanRecords: ScanRecord[]
  lastScanResult: ScanTriggerResponse | null
  error: string | null

  // Actions
  fetchScanRecords: (sourceType?: string) => Promise<void>
  triggerScan: (sourceType: string, sourceId?: string) => Promise<void>
  clearError: () => void
}

export const useScanStore = create<ScanState>()((set, get) => ({
  // 初始状态
  loading: false,
  scanning: false,
  scanRecords: [],
  lastScanResult: null,
  error: null,

  // 获取扫描记录
  fetchScanRecords: async (sourceType?: string) => {
    set({ loading: true, error: null })
    try {
      const url = sourceType
        ? getApiUrl(`/api/auto-download/scan-records?source_type=${sourceType}`)
        : getApiUrl('/api/auto-download/scan-records')

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch scan records')
      }

      const result = await response.json()
      if (result.success) {
        set({ scanRecords: result.data, loading: false })
      } else {
        throw new Error(result.error || 'Failed to fetch scan records')
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false
      })
    }
  },

  // 触发扫描
  triggerScan: async (sourceType: string, sourceId: string = 'all') => {
    set({ scanning: true, error: null })
    try {
      const url = getApiUrl(`/api/auto-download/scan/trigger?source_type=${sourceType}&source_id=${sourceId}`)
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to trigger scan')
      }

      const result = await response.json()
      if (result.success) {
        set({
          lastScanResult: result.data,
          scanning: false
        })
        // 刷新扫描记录
        await get().fetchScanRecords(sourceType)
      } else {
        throw new Error(result.error || 'Failed to trigger scan')
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        scanning: false
      })
      throw error
    }
  },

  // 清除错误
  clearError: () => {
    set({ error: null })
  }
}))