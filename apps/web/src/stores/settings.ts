import { create } from 'zustand'

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

export interface Settings {
  download: DownloadSettings
  storage: IStorageSettings
  general: IGeneralSettings
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
        const response = await fetch('http://localhost:8000/api/settings/')
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
        const response = await fetch('http://localhost:8000/api/settings/', {
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
          ? `http://localhost:8000/api/settings/reset?category=${category}`
          : 'http://localhost:8000/api/settings/reset'
          
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
        const response = await fetch('http://localhost:8000/api/settings/export')
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
        const response = await fetch('http://localhost:8000/api/settings/import', {
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