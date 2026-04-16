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

export interface FolderScanConfig {
  folder_name: string  // 收藏夹名称
  max_videos: number  // 最大扫描视频数
}

export interface VideoLibraryConfig {
  cacheTTL: number              // 缓存过期时间（分钟）
  autoRefreshDelay: number      // 自动刷新延迟（秒）
  maxConcurrentChecks: number   // 最大并发检查数
  enableSmartRefresh: boolean   // 启用智能刷新
}

export interface Settings {
  download: DownloadSettings
  storage: IStorageSettings
  general: IGeneralSettings
  video_library: VideoLibraryConfig
  auto_download: {
    enabled: boolean
    trigger_type: 'interval' | 'cron'
    scan_interval: number
    cron_expression: string
    concurrent_limit: {
      video: number
      page: number
    }
    // 自定义扫描配置
    custom_scan: {
      enabled: boolean  // 是否启用自定义扫描
      folder_list: FolderScanConfig[]  // 收藏夹扫描列表
    }
    watch_later_max: number  // 稍后再看最大扫描数量，0表示不扫描
    auto_start_after_scan: boolean  // 扫描完成后是否自动开始下载
    storage_threshold_gb: number  // 存储空间阈值（GB），超过此阈值时不触发自动下载
  }
}

interface SettingsState {
  settings: Settings | null
  loading: boolean
  error: string | null
  fetchSettings: () => Promise<void>
  updateSettings: (updates: Partial<Settings>) => Promise<void>
  updateVideoLibrarySettings: (settings: Partial<VideoLibraryConfig>) => void
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
        
        // 合并设置，而不是直接替换
        const currentSettings = get().settings
        if (!currentSettings) {
          set({ settings: data, loading: false })
          return
        }
        
        const mergedSettings = {
          ...currentSettings,
          ...data,
          // 深度合并嵌套对象
          storage: {
            ...currentSettings.storage,
            ...data.storage,
            sidecar: {
              ...currentSettings.storage.sidecar,
              ...(data.storage?.sidecar || {})
            }
          },
          download: {
            ...currentSettings.download,
            ...data.download,
            video: {
              ...currentSettings.download.video,
              ...(data.download?.video || {})
            },
            metadata: {
              ...currentSettings.download.metadata,
              ...(data.download?.metadata || {})
            }
          },
          general: {
            ...currentSettings.general,
            ...(data.general || {})
          },
          auto_download: {
            ...currentSettings.auto_download,
            ...(data.auto_download || {})
          }
        }
        
        set({ settings: mergedSettings, loading: false })
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
      
          updateVideoLibrarySettings: (settings: Partial<VideoLibraryConfig>) => {
            const currentSettings = get().settings
            if (!currentSettings) {
              return
            }
            
            set((state) => ({
              settings: state.settings ? {
                ...state.settings,
                video_library: {
                  ...state.settings.video_library,
                  ...settings
                }
              } : null
            }))
          },
        }))