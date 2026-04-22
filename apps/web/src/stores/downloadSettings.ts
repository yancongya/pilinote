import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiService } from '../services/api'

// ========== 类型定义 ==========

// 下载质量选项
export type DownloadQuality = 16 | 32 | 64 | 80 | 112 | 116

// 文件命名模板变量
export type NamingVariable =
  | '{title}'      // 视频标题
  | '{bvid}'       // 视频BV号
  | '{aid}'        // 视频AV号
  | '{uploader}'   // 上传者
  | '{date}'       // 下载日期
  | '{time}'       // 下载时间
  | '{index}'      // 分集序号
  | '{total}'      // 总集数

// 下载完成后操作
export type PostDownloadAction = 'none' | 'close' | 'move' | 'delete'

// 文件命名规则
export interface NamingRule {
  template: string           // 文件名模板，如 "{title}_{index}"
  replace_invalid_chars: boolean  // 替换非法字符
  max_length: number         // 最大文件名长度
}

// 下载质量设置
export interface QualitySettings {
  default_quality: DownloadQuality      // 默认视频质量
  audio_bitrate: number                 // 音频码率 (kbps)
  codec: string                         // 视频编码
  output_format: string                 // 输出格式
  fallback_quality: boolean             // 启用降级质量
  fallback_options: DownloadQuality[]   // 降级质量选项
}

// 下载路径设置
export interface PathSettings {
  default_path: string                   // 默认下载路径
  custom_folder_pattern: string          // 自定义文件夹命名模式
  use_subfolder: boolean                 // 使用子文件夹
  subfolder_pattern: string              // 子文件夹命名模式
  temp_path: string                      // 临时文件路径
  auto_cleanup_temp: boolean             // 自动清理临时文件
}

// 并发控制设置
export interface ConcurrencySettings {
  max_concurrent_downloads: number       // 最大并发下载数
  max_retries: number                    // 最大重试次数
  retry_delay: number                    // 重试延迟（秒）
  retry_backoff: boolean                 // 启用退避策略
  retry_backoff_multiplier: number       // 退避倍数
  max_retry_delay: number                // 最大重试延迟（秒）
}

// 重试设置
export interface RetrySettings {
  enable_auto_retry: boolean             // 启用自动重试
  retry_on_network_error: boolean        // 网络错误时重试
  retry_on_server_error: boolean         // 服务器错误时重试
  retry_on_timeout: boolean              // 超时时重试
  retry_network_errors_only: boolean     // 仅重试网络错误
}

// 下载后操作设置
export interface PostDownloadSettings {
  action: PostDownloadAction             // 下载后操作
  move_target_path: string               // 移动目标路径
  auto_move: boolean                     // 自动移动
  keep_in_queue: boolean                 // 在队列中保留
  auto_refresh_metadata: boolean         // 自动刷新元数据
}

// 元数据下载设置
export interface MetadataSettings {
  enable_subtitle: boolean               // 下载字幕
  subtitle_format: string                // 字幕格式 (srt, ass, json)
  enable_cover: boolean                  // 下载封面
  cover_format: string                   // 封面格式 (jpg, png, webp)
  enable_nfo: boolean                    // 生成NFO文件
  enable_avatar: boolean                 // 下载上传者头像
  enable_description: boolean            // 保存视频描述
  enable_tags: boolean                   // 保存视频标签
}

// 速度限制设置
export interface SpeedLimitSettings {
  enable_speed_limit: boolean            // 启用速度限制
  max_download_speed: number             // 最大下载速度 (KB/s)
  max_upload_speed: number               // 最大上传速度 (KB/s)
  schedule_limits: ScheduleLimit[]       // 定时限制
}

// 定时速度限制
export interface ScheduleLimit {
  enabled: boolean
  start_time: string                     // 开始时间 (HH:mm)
  end_time: string                       // 结束时间 (HH:mm)
  max_speed: number                      // 限制速度 (KB/s)
  days: number[]                         // 限制日期 (0-6, 周日到周六)
}

// 高级设置
export interface AdvancedSettings {
  use_aria2c: boolean                    // 使用aria2c下载
  aria2c_rpc_url: string                 // aria2c RPC地址
  aria2c_secret: string                  // aria2c RPC密钥
  use_proxy: boolean                     // 使用代理
  proxy_url: string                      // 代理地址
  connection_timeout: number             // 连接超时（秒）
  read_timeout: number                   // 读取超时（秒）
  chunk_size: number                     // 分块大小（MB）
  verify_checksum: boolean               // 验证校验和
}

// 下载设置完整结构
export interface DownloadSettings {
  quality: QualitySettings
  path: PathSettings
  naming: NamingRule
  concurrency: ConcurrencySettings
  retry: RetrySettings
  post_download: PostDownloadSettings
  metadata: MetadataSettings
  speed_limit: SpeedLimitSettings
  advanced: AdvancedSettings
}

// 设置验证结果
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ========== 默认配置 ==========

const DEFAULT_QUALITY: QualitySettings = {
  default_quality: 64,
  audio_bitrate: 192,
  codec: 'avc',
  output_format: 'mp4',
  fallback_quality: true,
  fallback_options: [64, 32, 16]
}

const DEFAULT_PATH: PathSettings = {
  default_path: '~/Downloads',
  custom_folder_pattern: '{title}',
  use_subfolder: true,
  subfolder_pattern: '{uploader}/{title}',
  temp_path: '/tmp/pilinote',
  auto_cleanup_temp: true
}

const DEFAULT_NAMING: NamingRule = {
  template: '{title}_{index}',
  replace_invalid_chars: true,
  max_length: 255
}

const DEFAULT_CONCURRENCY: ConcurrencySettings = {
  max_concurrent_downloads: 3,
  max_retries: 3,
  retry_delay: 5,
  retry_backoff: true,
  retry_backoff_multiplier: 2,
  max_retry_delay: 60
}

const DEFAULT_RETRY: RetrySettings = {
  enable_auto_retry: true,
  retry_on_network_error: true,
  retry_on_server_error: true,
  retry_on_timeout: true,
  retry_network_errors_only: false
}

const DEFAULT_POST_DOWNLOAD: PostDownloadSettings = {
  action: 'none',
  move_target_path: '',
  auto_move: false,
  keep_in_queue: false,
  auto_refresh_metadata: true
}

const DEFAULT_METADATA: MetadataSettings = {
  enable_subtitle: true,
  subtitle_format: 'srt',
  enable_cover: true,
  cover_format: 'jpg',
  enable_nfo: false,
  enable_avatar: false,
  enable_description: false,
  enable_tags: false
}

const DEFAULT_SPEED_LIMIT: SpeedLimitSettings = {
  enable_speed_limit: false,
  max_download_speed: 0,
  max_upload_speed: 0,
  schedule_limits: []
}

const DEFAULT_ADVANCED: AdvancedSettings = {
  use_aria2c: false,
  aria2c_rpc_url: 'http://localhost:6800/jsonrpc',
  aria2c_secret: '',
  use_proxy: false,
  proxy_url: '',
  connection_timeout: 30,
  read_timeout: 60,
  chunk_size: 10,
  verify_checksum: false
}

const DEFAULT_SETTINGS: DownloadSettings = {
  quality: DEFAULT_QUALITY,
  path: DEFAULT_PATH,
  naming: DEFAULT_NAMING,
  concurrency: DEFAULT_CONCURRENCY,
  retry: DEFAULT_RETRY,
  post_download: DEFAULT_POST_DOWNLOAD,
  metadata: DEFAULT_METADATA,
  speed_limit: DEFAULT_SPEED_LIMIT,
  advanced: DEFAULT_ADVANCED
}

// ========== 状态接口 ==========

interface DownloadSettingsState {
  // 设置数据
  settings: DownloadSettings
  
  // 同步状态
  syncing: boolean
  lastSyncTime: number | null
  
  // 错误信息
  error: string | null
  
  // ========== 设置管理 ==========
  
  // 更新设置
  updateSettings: (updates: Partial<DownloadSettings>) => void
  
  // 重置设置为默认值
  resetSettings: () => void
  
  // 重置特定分类的设置
  resetCategory: (
    category: keyof DownloadSettings
  ) => void
  
  // ========== 验证 ==========
  
  // 验证设置
  validateSettings: (settings?: DownloadSettings) => ValidationResult
  
  // 验证文件名模板
  validateNamingTemplate: (template: string) => ValidationResult
  
  // 验证路径
  validatePath: (path: string) => ValidationResult
  
  // ========== 服务器同步 ==========
  
  // 从服务器同步设置
  syncFromServer: () => Promise<void>
  
  // 同步设置到服务器
  syncToServer: () => Promise<void>
  
  // ========== 导入导出 ==========
  
  // 导出设置
  exportSettings: () => Promise<string>
  
  // 导入设置
  importSettings: (data: string) => Promise<void>
  
  // 导出特定分类
  exportCategory: (category: keyof DownloadSettings) => Promise<string>
  
  // 导入特定分类
  importCategory: (
    category: keyof DownloadSettings,
    data: string
  ) => Promise<void>
  
  // ========== 实用方法 ==========
  
  // 获取设置值
  getSetting: <K extends keyof DownloadSettings>(
    key: K
  ) => DownloadSettings[K]
  
  // 获取嵌套设置值
  getNestedSetting: <K extends keyof DownloadSettings, NK extends keyof DownloadSettings[K]>(
    key: K,
    nestedKey: NK
  ) => DownloadSettings[K][NK]
  
  // 格式化文件名
  formatFileName: (template: string, variables: Record<string, any>) => string
  
  // 格式化路径
  formatPath: (path: string, variables: Record<string, any>) => string
  
  // 检查是否需要降级质量
  shouldFallbackQuality: (currentQuality: DownloadQuality) => boolean
  
  // 获取下一个降级质量
  getNextFallbackQuality: (currentQuality: DownloadQuality) => DownloadQuality | null
  
  // 检查速度限制是否生效
  isSpeedLimitActive: () => boolean
  
  // 获取当前速度限制
  getCurrentSpeedLimit: () => number
  
  // 检查是否可以重试
  canRetry: (retryCount: number, errorType?: string) => boolean
  
  // 计算重试延迟
  calculateRetryDelay: (retryCount: number) => number
}

// ========== Store 创建 ==========

export const useDownloadSettingsStore = create<DownloadSettingsState>()(
  persist(
    (set, get) => ({
      // ========== 初始状态 ==========
      
      settings: DEFAULT_SETTINGS,
      syncing: false,
      lastSyncTime: null,
      error: null,
      
      // ========== 设置管理 ==========
      
      updateSettings: (updates: Partial<DownloadSettings>) => {
        const validation = get().validateSettings({
          ...get().settings,
          ...updates
        })
        
        if (!validation.valid) {
          console.error('[DownloadSettings] Invalid settings:', validation.errors)
          set({ error: validation.errors.join(', ') })
          return
        }
        
        set((state) => ({
          settings: {
            ...state.settings,
            ...updates
          },
          error: null
        }))
        
        // 自动同步到服务器
        get().syncToServer()
      },
      
      resetSettings: () => {
        set({
          settings: DEFAULT_SETTINGS,
          error: null
        })
        
        // 同步重置后的设置到服务器
        get().syncToServer()
      },
      
      resetCategory: (category: keyof DownloadSettings) => {
        set((state) => ({
          settings: {
            ...state.settings,
            [category]: DEFAULT_SETTINGS[category]
          },
          error: null
        }))
        
        // 同步重置后的设置到服务器
        get().syncToServer()
      },
      
      // ========== 验证 ==========
      
      validateSettings: (settings?: DownloadSettings): ValidationResult => {
        const settingsToValidate = settings || get().settings
        const errors: string[] = []
        const warnings: string[] = []
        
        // 验证质量设置
        if (settingsToValidate.quality.default_quality < 16 || settingsToValidate.quality.default_quality > 116) {
          errors.push('默认质量必须在16-116之间')
        }
        
        if (settingsToValidate.quality.audio_bitrate < 64 || settingsToValidate.quality.audio_bitrate > 320) {
          errors.push('音频码率必须在64-320之间')
        }
        
        // 验证路径设置
        if (!settingsToValidate.path.default_path || settingsToValidate.path.default_path.trim() === '') {
          errors.push('默认下载路径不能为空')
        }
        
        // 验证并发设置
        if (settingsToValidate.concurrency.max_concurrent_downloads < 1 || settingsToValidate.concurrency.max_concurrent_downloads > 10) {
          warnings.push('最大并发下载数建议在1-10之间')
        }
        
        if (settingsToValidate.concurrency.max_retries < 0 || settingsToValidate.concurrency.max_retries > 10) {
          warnings.push('最大重试次数建议在0-10之间')
        }
        
        // 验证重试延迟
        if (settingsToValidate.concurrency.retry_delay < 1 || settingsToValidate.concurrency.retry_delay > 300) {
          warnings.push('重试延迟建议在1-300秒之间')
        }
        
        // 验证文件命名
        const namingValidation = get().validateNamingTemplate(settingsToValidate.naming.template)
        if (!namingValidation.valid) {
          errors.push(...namingValidation.errors)
        }
        
        if (settingsToValidate.naming.max_length < 10 || settingsToValidate.naming.max_length > 255) {
          errors.push('文件名最大长度必须在10-255之间')
        }
        
        // 验证速度限制
        if (settingsToValidate.speed_limit.enable_speed_limit && settingsToValidate.speed_limit.max_download_speed <= 0) {
          errors.push('启用速度限制时，最大下载速度必须大于0')
        }
        
        // 验证超时设置
        if (settingsToValidate.advanced.connection_timeout < 5 || settingsToValidate.advanced.connection_timeout > 300) {
          warnings.push('连接超时建议在5-300秒之间')
        }
        
        if (settingsToValidate.advanced.read_timeout < 10 || settingsToValidate.advanced.read_timeout > 600) {
          warnings.push('读取超时建议在10-600秒之间')
        }
        
        return {
          valid: errors.length === 0,
          errors,
          warnings
        }
      },
      
      validateNamingTemplate: (template: string): ValidationResult => {
        const errors: string[] = []
        const warnings: string[] = []
        
        if (!template || template.trim() === '') {
          errors.push('文件名模板不能为空')
        }
        
        // 检查非法字符
        const invalidChars = /[<>:"|?*]/g
        if (invalidChars.test(template)) {
          errors.push('文件名模板包含非法字符')
        }
        
        // 检查必需的变量
        if (!template.includes('{title}')) {
          warnings.push('文件名模板建议包含 {title} 变量')
        }
        
        // 检查未知变量
        const knownVariables = ['title', 'bvid', 'aid', 'uploader', 'date', 'time', 'index', 'total']
        const templateVariables = template.match(/\{([^}]+)\}/g) || []
        const unknownVariables = templateVariables.filter(
          v => !knownVariables.includes(v.slice(1, -1))
        )
        
        if (unknownVariables.length > 0) {
          warnings.push(`未知的变量: ${unknownVariables.join(', ')}`)
        }
        
        return {
          valid: errors.length === 0,
          errors,
          warnings
        }
      },
      
      validatePath: (path: string): ValidationResult => {
        const errors: string[] = []
        const warnings: string[] = []
        
        if (!path || path.trim() === '') {
          errors.push('路径不能为空')
          return { valid: false, errors, warnings }
        }
        
        // 检查非法字符
        const invalidChars = /[<>:"|?*]/g
        if (invalidChars.test(path)) {
          errors.push('路径包含非法字符')
        }
        
        // 检查绝对路径
        if (!path.startsWith('/') && !path.match(/^[a-zA-Z]:\\/)) {
          warnings.push('建议使用绝对路径')
        }
        
        // 检查环境变量展开
        if (path.includes('~') || path.includes('$')) {
          warnings.push('路径包含环境变量，确保正确展开')
        }
        
        return {
          valid: errors.length === 0,
          errors,
          warnings
        }
      },
      
      // ========== 服务器同步 ==========
      
      syncFromServer: async () => {
        const { syncing } = get()
        if (syncing) return
        
        set({ syncing: true, error: null })
        
        try {
          const response = await apiService.getDownloadSettings()
          
          if (response.success && response.data) {
            // 验证服务器返回的设置
            const validation = get().validateSettings(response.data)
            
            if (!validation.valid) {
              console.warn('[DownloadSettings] Server settings invalid:', validation.warnings)
            }
            
            set({
              settings: {
                ...DEFAULT_SETTINGS,
                ...response.data
              },
              lastSyncTime: Date.now(),
              syncing: false
            })
          } else {
            throw new Error(response.message || 'Failed to sync settings from server')
          }
        } catch (error) {
          console.error('[DownloadSettings] Sync from server failed:', error)
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            syncing: false
          })
        }
      },
      
      syncToServer: async () => {
        const { syncing, settings } = get()
        if (syncing) return
        
        // 不等待同步完成，在后台进行
        try {
          const response = await apiService.updateDownloadSettings(settings)
          
          if (!response.success) {
            throw new Error(response.message || 'Failed to sync settings to server')
          }
          
          set({ lastSyncTime: Date.now() })
        } catch (error) {
          console.error('[DownloadSettings] Sync to server failed:', error)
          // 不设置错误状态，避免干扰用户操作
        }
      },
      
      // ========== 导入导出 ==========
      
      exportSettings: async () => {
        const { settings } = get()
        
        try {
          const exportData = {
            version: '1.0',
            export_time: new Date().toISOString(),
            settings: settings
          }
          
          return JSON.stringify(exportData, null, 2)
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Export failed')
        }
      },
      
      importSettings: async (data: string) => {
        try {
          const parsedData = JSON.parse(data)
          
          // 验证导出数据格式
          if (!parsedData.settings) {
            throw new Error('Invalid export data format')
          }
          
          // 验证设置
          const validation = get().validateSettings(parsedData.settings)
          
          if (!validation.valid) {
            throw new Error(`Invalid settings: ${validation.errors.join(', ')}`)
          }
          
          // 应用设置
          set({
            settings: {
              ...DEFAULT_SETTINGS,
              ...parsedData.settings
            },
            error: null
          })
          
          // 同步到服务器
          await get().syncToServer()
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Import failed')
        }
      },
      
      exportCategory: async (category: keyof DownloadSettings) => {
        const { settings } = get()
        
        try {
          const exportData = {
            version: '1.0',
            export_time: new Date().toISOString(),
            category,
            data: settings[category]
          }
          
          return JSON.stringify(exportData, null, 2)
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Export failed')
        }
      },
      
      importCategory: async (
        category: keyof DownloadSettings,
        data: string
      ) => {
        try {
          const parsedData = JSON.parse(data)
          
          // 验证导出数据格式
          if (!parsedData.data) {
            throw new Error('Invalid export data format')
          }
          
          // 应用分类设置
          set((state) => ({
            settings: {
              ...state.settings,
              [category]: parsedData.data
            },
            error: null
          }))
          
          // 同步到服务器
          await get().syncToServer()
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Import failed')
        }
      },
      
      // ========== 实用方法 ==========
      
      getSetting: <K extends keyof DownloadSettings>(
        key: K
      ): DownloadSettings[K] => {
        return get().settings[key]
      },
      
      getNestedSetting: <K extends keyof DownloadSettings, NK extends keyof DownloadSettings[K]>(
        key: K,
        nestedKey: NK
      ): DownloadSettings[K][NK] => {
        return get().settings[key][nestedKey]
      },
      
      formatFileName: (
        template: string,
        variables: Record<string, any>
      ): string => {
        const { naming } = get().settings
        let fileName = template
        
        // 替换变量
        Object.entries(variables).forEach(([key, value]) => {
          const placeholder = `{${key}}`
          fileName = fileName.replace(new RegExp(placeholder, 'g'), String(value || ''))
        })
        
        // 替换非法字符
        if (naming.replace_invalid_chars) {
          fileName = fileName
            .replace(/[<>:"|?*]/g, '_')
            .replace(/\s+/g, ' ')
            .trim()
        }
        
        // 限制长度
        if (fileName.length > naming.max_length) {
          const extIndex = fileName.lastIndexOf('.')
          if (extIndex > 0) {
            const ext = fileName.slice(extIndex)
            const namePart = fileName.slice(0, extIndex)
            fileName = namePart.slice(0, naming.max_length - ext.length) + ext
          } else {
            fileName = fileName.slice(0, naming.max_length)
          }
        }
        
        return fileName
      },
      
      formatPath: (
        path: string,
        variables: Record<string, any>
      ): string => {
        let formattedPath = path
        
        // 替换变量
        Object.entries(variables).forEach(([key, value]) => {
          const placeholder = `{${key}}`
          formattedPath = formattedPath.replace(new RegExp(placeholder, 'g'), String(value || ''))
        })
        
        // 展开环境变量
        const homeDir = typeof globalThis !== 'undefined' && typeof (globalThis as any).process?.env?.HOME === 'string'
          ? (globalThis as any).process.env.HOME
          : '~'
        formattedPath = formattedPath.replace(/^~/, homeDir)
        
        return formattedPath
      },
      
      shouldFallbackQuality: (currentQuality: DownloadQuality): boolean => {
        const { quality } = get().settings
        return quality.fallback_quality && quality.fallback_options.includes(currentQuality)
      },
      
      getNextFallbackQuality: (currentQuality: DownloadQuality): DownloadQuality | null => {
        const { quality } = get().settings
        
        if (!quality.fallback_quality) {
          return null
        }
        
        const currentIndex = quality.fallback_options.indexOf(currentQuality)
        
        if (currentIndex === -1 || currentIndex >= quality.fallback_options.length - 1) {
          return null
        }
        
        return quality.fallback_options[currentIndex + 1]
      },
      
      isSpeedLimitActive: (): boolean => {
        const { speed_limit } = get().settings
        
        if (!speed_limit.enable_speed_limit) {
          return false
        }
        
        // 检查定时限制
        const now = new Date()
        const currentHour = now.getHours()
        const currentMinute = now.getMinutes()
        const currentTime = currentHour * 60 + currentMinute
        const currentDay = now.getDay()
        
        const activeLimit = speed_limit.schedule_limits.find(limit => {
          if (!limit.enabled || !limit.days.includes(currentDay)) {
            return false
          }
          
          const [startHour, startMinute] = limit.start_time.split(':').map(Number)
          const [endHour, endMinute] = limit.end_time.split(':').map(Number)
          
          const startTime = startHour * 60 + startMinute
          const endTime = endHour * 60 + endMinute
          
          // 处理跨午夜的情况
          if (startTime <= endTime) {
            return currentTime >= startTime && currentTime <= endTime
          } else {
            return currentTime >= startTime || currentTime <= endTime
          }
        })
        
        return activeLimit !== undefined
      },
      
      getCurrentSpeedLimit: (): number => {
        const { speed_limit } = get().settings
        
        if (!speed_limit.enable_speed_limit) {
          return 0
        }
        
        const now = new Date()
        const currentHour = now.getHours()
        const currentMinute = now.getMinutes()
        const currentTime = currentHour * 60 + currentMinute
        const currentDay = now.getDay()
        
        const activeLimit = speed_limit.schedule_limits.find(limit => {
          if (!limit.enabled || !limit.days.includes(currentDay)) {
            return false
          }
          
          const [startHour, startMinute] = limit.start_time.split(':').map(Number)
          const [endHour, endMinute] = limit.end_time.split(':').map(Number)
          
          const startTime = startHour * 60 + startMinute
          const endTime = endHour * 60 + endMinute
          
          // 处理跨午夜的情况
          if (startTime <= endTime) {
            return currentTime >= startTime && currentTime <= endTime
          } else {
            return currentTime >= startTime || currentTime <= endTime
          }
        })
        
        return activeLimit ? activeLimit.max_speed : speed_limit.max_download_speed
      },
      
      canRetry: (retryCount: number, errorType?: string): boolean => {
        const { concurrency, retry } = get().settings
        
        // 检查是否启用自动重试
        if (!retry.enable_auto_retry) {
          return false
        }
        
        // 检查重试次数
        if (retryCount >= concurrency.max_retries) {
          return false
        }
        
        // 根据错误类型判断是否应该重试
        if (errorType) {
          switch (errorType) {
            case 'network':
              return retry.retry_on_network_error
            case 'server':
              return retry.retry_on_server_error
            case 'timeout':
              return retry.retry_on_timeout
            default:
              return !retry.retry_network_errors_only
          }
        }
        
        return true
      },
      
      calculateRetryDelay: (retryCount: number): number => {
        const { concurrency } = get().settings
        
        if (!concurrency.retry_backoff) {
          return concurrency.retry_delay
        }
        
        // 计算退避延迟
        const delay = concurrency.retry_delay * Math.pow(
          concurrency.retry_backoff_multiplier,
          retryCount
        )
        
        return Math.min(delay, concurrency.max_retry_delay)
      }
    }),
    {
      name: 'pilinote-download-settings',
      partialize: (state) => ({
        settings: state.settings,
        lastSyncTime: state.lastSyncTime
      })
    }
  )
)
