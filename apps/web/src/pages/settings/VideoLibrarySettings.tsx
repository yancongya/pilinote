import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { RefreshCw, Clock, Zap, CheckCircle } from 'lucide-react'
import { useSettingsStore } from '../../stores/settings'
import { videoLibraryService } from '../../services/videoLibraryService'
import { useToast } from '../../components/Toast'

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
      setLastRefreshTime(new Date(status.last_refresh))
    } else {
      setCacheStatus('empty')
      setCachedVideoCount(0)
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

  const getCacheStatusInfo = () => {
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
  }

  const cacheStatusInfo = getCacheStatusInfo()

  return (
    <div className="stg-panel">
      {/* 视频库设置部分 */}
      <div className="stg-group">
        <div className="stg-group-header">
          <span className="stg-group-title">视频库配置</span>
          <span className="stg-group-subtitle">缓存和刷新设置</span>
        </div>

        <div className="stg-list">
          {/* 缓存过期时间 */}
          <div className="stg-item stg-item-col">
            <div className="stg-item-label-row">
              <Clock size={18} className="stg-item-icon" />
              <span className="stg-item-label">缓存过期时间</span>
            </div>
            <div className="stg-item-content">
              <select
                value={localConfig.cacheTTL}
                onChange={(e) => handleConfigChange('cacheTTL', parseInt(e.target.value) || 1)}
                className="stg-select"
              >
                <option value={1}>1 分钟</option>
                <option value={5}>5 分钟</option>
                <option value={10}>10 分钟</option>
                <option value={30}>30 分钟</option>
                <option value={60}>60 分钟</option>
              </select>
              <p className="stg-hint">视频库缓存的过期时间，超过此时间后首次查询会刷新缓存</p>
            </div>
          </div>

          {/* 自动刷新延迟 */}
          <div className="stg-item stg-item-col">
            <div className="stg-item-label-row">
              <Zap size={18} className="stg-item-icon" />
              <span className="stg-item-label">自动刷新延迟</span>
            </div>
            <div className="stg-item-content">
              <select
                value={localConfig.autoRefreshDelay}
                onChange={(e) => handleConfigChange('autoRefreshDelay', parseInt(e.target.value) || 1)}
                className="stg-select"
              >
                <option value={1}>1 秒</option>
                <option value={5}>5 秒</option>
                <option value={10}>10 秒</option>
                <option value={15}>15 秒</option>
                <option value={30}>30 秒</option>
              </select>
              <p className="stg-hint">下载完成后自动刷新视频库的延迟时间，避免频繁刷新</p>
            </div>
          </div>

          {/* 最大并发检查数 */}
          <div className="stg-item stg-item-col">
            <div className="stg-item-label-row">
              <CheckCircle size={18} className="stg-item-icon" />
              <span className="stg-item-label">最大并发检查数</span>
            </div>
            <div className="stg-item-content">
              <select
                value={localConfig.maxConcurrentChecks}
                onChange={(e) => handleConfigChange('maxConcurrentChecks', parseInt(e.target.value) || 1)}
                className="stg-select"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <p className="stg-hint">批量检查视频状态时的最大并发请求数，避免后端压力过大</p>
            </div>
          </div>

          {/* 启用智能刷新 */}
          <label className="stg-toggle">
            <div className="stg-toggle-content">
              <span className="stg-toggle-label">启用智能刷新</span>
            </div>
            <input
              type="checkbox"
              checked={localConfig.enableSmartRefresh}
              onChange={(e) => handleConfigChange('enableSmartRefresh', e.target.checked)}
              className="stg-toggle-input"
            />
          </label>
        </div>
      </div>

      {/* 缓存状态部分 */}
      <div className="stg-group">
        <div className="stg-group-header">
          <span className="stg-group-title">缓存状态</span>
          <span className="stg-group-subtitle">当前缓存信息</span>
        </div>

        <div className="stg-list">
          <div className="stg-item">
            <div className="stg-item-label-row">
              <RefreshCw size={18} className="stg-item-icon" />
              <span className="stg-item-label">当前状态</span>
            </div>
            <div className="stg-item-content">
              <span className={`stg-item-sublabel ${cacheStatusInfo.color}`}>
                {cacheStatusInfo.text}
              </span>
            </div>
          </div>

          {cachedVideoCount > 0 && (
            <div className="stg-item">
              <div className="stg-item-label-row">
                <CheckCircle size={18} className="stg-item-icon" />
                <span className="stg-item-label">缓存视频数</span>
              </div>
              <div className="stg-item-content">
                <span className="stg-item-sublabel">
                  {cachedVideoCount} 个视频
                </span>
              </div>
            </div>
          )}

          {lastRefreshTime && (
            <div className="stg-item">
              <div className="stg-item-label-row">
                <Clock size={18} className="stg-item-icon" />
                <span className="stg-item-label">最后刷新时间</span>
              </div>
              <div className="stg-item-content">
                <span className="stg-item-sublabel">
                  {lastRefreshTime.toLocaleString('zh-CN')}
                </span>
              </div>
            </div>
          )}

          <div className="stg-actions">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="stg-btn stg-btn-primary"
            >
              {refreshing ? (
                <>
                  <RefreshCw size={16} className="stg-btn-icon stg-spin" />
                  刷新中...
                </>
              ) : (
                <>
                  <RefreshCw size={16} className="stg-btn-icon" />
                  刷新视频库
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
})

VideoLibrarySettings.displayName = 'VideoLibrarySettings'

export default VideoLibrarySettings