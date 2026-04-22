import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { RefreshCw, Clock, Zap, CheckCircle } from 'lucide-react'
import { useSettingsStore } from '../../stores/settings'
import { videoLibraryService } from '../../services/videoLibraryService'
import { useToast } from '../../components/Toast'
import { SettingsField, SettingsSection, SettingsToggleRow } from './shared'

// 定义ref类型
interface VideoLibrarySettingsRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

const VideoLibrarySettings = forwardRef<VideoLibrarySettingsRef>((_props, ref) => {
  const { settings, updateVideoLibrarySettings } = useSettingsStore()
  const { showToast } = useToast()
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [localConfig, setLocalConfig] = useState({
    cacheTTL: 10,
    autoRefreshDelay: 5,
    maxConcurrentChecks: 10,
    enableSmartRefresh: true
  })
  const [originalConfig, setOriginalConfig] = useState(localConfig)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [cacheStatus, setCacheStatus] = useState<'empty' | 'fresh' | 'stale'>('empty')
  const [cachedVideoCount, setCachedVideoCount] = useState(0)
  const [cachedFolderCount, setCachedFolderCount] = useState(0)

  // 初始化时从settings加载配置
  useEffect(() => {
    if (settings?.video_library) {
      const config = {
        cacheTTL: settings.video_library.cacheTTL,
        autoRefreshDelay: settings.video_library.autoRefreshDelay,
        maxConcurrentChecks: settings.video_library.maxConcurrentChecks,
        enableSmartRefresh: settings.video_library.enableSmartRefresh
      }
      setLocalConfig(config)
      setOriginalConfig(config)
    }
  }, [settings])

  // 暴露ref方法
  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => {
      return JSON.stringify(localConfig) !== JSON.stringify(originalConfig)
    },
    saveSettings: async () => {
      if (JSON.stringify(localConfig) === JSON.stringify(originalConfig)) {
        throw new Error('没有需要保存的修改')
      }
      
      setSavedStatus('saving')
      try {
        updateVideoLibrarySettings(localConfig)
        setOriginalConfig({ ...localConfig })
        setSavedStatus('saved')
        setTimeout(() => setSavedStatus('idle'), 2000)
      } catch (error) {
        setSavedStatus('error')
        throw error
      }
    },
    getSavedStatus: () => savedStatus
  }))

  // 检查缓存状态
  const checkCacheStatus = async () => {
    const status = await videoLibraryService.getLibraryStatus()
    if (status.cached) {
      setCacheStatus(status.is_fresh ? 'fresh' : 'stale')
      setCachedVideoCount(status.video_count)
      setCachedFolderCount(status.folder_count || 0)
      setLastRefreshTime(new Date(status.last_refresh))
    } else {
      setCacheStatus('empty')
      setCachedVideoCount(0)
      setCachedFolderCount(0)
      setLastRefreshTime(null)
    }
  }

  // 初始化时检查缓存状态
  useEffect(() => {
    checkCacheStatus()
  }, [])

  // 手动刷新视频库
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await videoLibraryService.refreshCache()
      await checkCacheStatus()
      showToast('视频库已刷新', 'success')
    } catch (error) {
      console.error('刷新视频库失败:', error)
      showToast('刷新视频库失败', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const handleConfigChange = (key: keyof typeof localConfig, value: number | boolean) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }))
  }

  const cacheStatusInfo = (() => {
    switch (cacheStatus) {
      case 'empty':
        return { text: '缓存为空', color: 'text-gray-500' }
      case 'fresh':
        return { text: '缓存有效', color: 'text-green-500' }
      case 'stale':
        return { text: '缓存过期', color: 'text-orange-500' }
      default:
        return { text: '未知状态', color: 'text-gray-500' }
    }
  })()

  return (
    <div>
      <SettingsSection title="视频库配置" subtitle="缓存和刷新设置">
        <SettingsField
          label="缓存过期时间"
          icon={<Clock size={18} />}
          hint="视频库缓存的过期时间，超过此时间后首次查询会刷新缓存"
        >
          <select
            value={localConfig.cacheTTL}
            onChange={(e) => handleConfigChange('cacheTTL', parseInt(e.target.value) || 1)}
            className="settings-control settings-select"
          >
            <option value={1}>1 分钟</option>
            <option value={5}>5 分钟</option>
            <option value={10}>10 分钟</option>
            <option value={30}>30 分钟</option>
            <option value={60}>60 分钟</option>
          </select>
        </SettingsField>

        <SettingsField
          label="自动刷新延迟"
          icon={<Zap size={18} />}
          hint="下载完成后自动刷新视频库的延迟时间，避免频繁刷新"
        >
          <select
            value={localConfig.autoRefreshDelay}
            onChange={(e) => handleConfigChange('autoRefreshDelay', parseInt(e.target.value) || 1)}
            className="settings-control settings-select"
          >
            <option value={1}>1 秒</option>
            <option value={5}>5 秒</option>
            <option value={10}>10 秒</option>
            <option value={15}>15 秒</option>
            <option value={30}>30 秒</option>
          </select>
        </SettingsField>

        <SettingsField
          label="最大并发检查数"
          icon={<CheckCircle size={18} />}
          hint="批量检查视频状态时的最大并发请求数，避免后端压力过大"
        >
          <select
            value={localConfig.maxConcurrentChecks}
            onChange={(e) => handleConfigChange('maxConcurrentChecks', parseInt(e.target.value) || 1)}
            className="settings-control settings-select"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </SettingsField>

        <SettingsToggleRow
          label="启用智能刷新"
          checked={localConfig.enableSmartRefresh}
          onChange={(checked) => handleConfigChange('enableSmartRefresh', checked)}
        />
      </SettingsSection>

      <SettingsSection
        title="缓存状态"
        subtitle="当前缓存信息"
        actions={(
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="settings-icon-button"
            title="刷新视频库"
            aria-label="刷新视频库"
          >
            <RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} />
          </button>
        )}
      >
        <SettingsField label="当前状态" icon={<RefreshCw size={18} />}>
          <div className="settings-meta">
            <span className={cacheStatusInfo.color}>
              {cacheStatusInfo.text}
            </span>
          </div>
        </SettingsField>

        {cachedFolderCount > 0 && (
          <SettingsField label="缓存系列数" icon={<Zap size={18} />}>
            <div className="settings-meta">
              {cachedFolderCount} 个系列
            </div>
          </SettingsField>
        )}

        {cachedVideoCount > 0 && (
          <SettingsField label="缓存视频数" icon={<CheckCircle size={18} />}>
            <div className="settings-meta">
              {cachedVideoCount} 个视频
            </div>
          </SettingsField>
        )}

        {lastRefreshTime && (
          <SettingsField label="最后刷新时间" icon={<Clock size={18} />}>
            <div className="settings-meta">
              {lastRefreshTime.toLocaleString('zh-CN')}
            </div>
          </SettingsField>
        )}
      </SettingsSection>
    </div>
  )
})

VideoLibrarySettings.displayName = 'VideoLibrarySettings'

export default VideoLibrarySettings
