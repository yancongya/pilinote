import { create } from 'zustand'
import { getApiUrl } from '../config/api'

export interface VideoSettings {
  default_quality: number
  audio_bitrate: number
  codec: string
  output_format: string
}

export interface MetadataSettings {
  enable_nfo: boolean
  enable_subtitle: boolean
  enable_cover: boolean
  enable_avatar: boolean
}

export interface DownloadSettings {
  video: VideoSettings
  max_concurrent: number
  speed_limit: number
  metadata: MetadataSettings
}

export interface IStorageSettings {
  download_path: string
  temp_path: string
  auto_cleanup: boolean
  keep_failed: boolean
  sidecar: {
    ffmpeg: string
    aria2c: string
  }
}

export interface IGeneralSettings {
  theme: string
  language: string
  auto_download: boolean
  clipboard_monitor: boolean
}

export interface FolderScanRule {
  // 收藏夹匹配规则
  match_type: 'all' | 'regex' | 'name'  // 匹配类型
  pattern: string  // 匹配模式（正则表达式或文件夹名）
  enabled: boolean  // 是否启用
  
  // 扫描限制
  max_videos: number  // 每个收藏夹最大扫描视频数
  max_folders: number  // 最大扫描收藏夹数
  sort_by: 'time' | 'name' | 'count'  // 排序方式
  sort_order: 'desc' | 'asc'  // 排序顺序
}

export interface Settings {
  download: DownloadSettings
  storage: IStorageSettings
  general: IGeneralSettings
  auto_download: {
    enabled: boolean
    trigger_type: 'interval' | 'cron'
    scan_interval: number
    cron_expression: string
    concurrent_limit: {
      video: number
      page: number
    }
    // 高级扫描配置
    advanced_scan: {
      enabled: boolean  // 是否启用高级扫描
      folder_rules: FolderScanRule[]  // 收藏夹扫描规则
    }
  }
}

interface SettingsState {
  settings: Settings | null
  loading: boolean
  error: string | null
  fetchSettings: () => Promise<void>
  updateSettings: (updates: Partial<Settings>) => Promise<void>
  resetSettings: (category?: string) => Promise<void>
  exportSettings: () => Promise<string>
  importSettings: (data: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
  (set, get) => ({
    settings: null,
    loading: false,
    error: null,

    fetchSettings: async () => {
      set({ loading: true, error: null })
      try {
        const response = await fetch(getApiUrl('/api/settings/'))
        if (!response.ok) {
          throw new Error('Failed to fetch settings')
        }
        const data = await response.json()
        set({ settings: data, loading: false })
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Unknown error',
          loading: false
        })
      }
    },

    updateSettings: async (updates: Partial<Settings>) => {
      set({ loading: true, error: null })
      try {
        const response = await fetch(getApiUrl('/api/settings/'), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        })

        if (!response.ok) {
          throw new Error('Failed to update settings')
        }

        const data = await response.json()
        set({ settings: data, loading: false })
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Unknown error',
          loading: false
        })
      }
    },

    resetSettings: async (category?: string) => {
      set({ loading: true, error: null })
      try {
        const url = category 
          ? getApiUrl(`/api/settings/reset?category=${category}`)
          : getApiUrl('/api/settings/reset')
          
        const response = await fetch(url, {
          method: 'POST',
        })

        if (!response.ok) {
          throw new Error('Failed to reset settings')
        }

        const data = await response.json()
        set({ settings: data, loading: false })
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Unknown error',
          loading: false
        })
      }
    },

    exportSettings: async () => {
      try {
        const response = await fetch(getApiUrl('/api/settings/export'))
        if (!response.ok) {
          throw new Error('Failed to export settings')
        }
        const data = await response.json()
        return JSON.stringify(data, null, 2)
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Unknown error')
      }
    },

    importSettings: async (data: string) => {
      set({ loading: true, error: null })
      try {
        const parsedData = JSON.parse(data)
        const response = await fetch(getApiUrl('/api/settings/import'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(parsedData.settings),
        })

        if (!response.ok) {
          throw new Error('Failed to import settings')
        }

        await get().fetchSettings()
        set({ loading: false })
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Unknown error',
          loading: false
        })
      }
    },
  })
)