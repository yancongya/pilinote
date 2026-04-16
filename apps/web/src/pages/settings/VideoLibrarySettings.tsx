import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { RefreshCw, Clock, Zap, CheckCircle, XCircle, Settings2 } from 'lucide-react'
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

  const getStatusIcon = () => {
    switch (savedStatus) {
      case 'saving':
        return <RefreshCw className="spinning" size={16} />
      case 'saved':
        return <CheckCircle size={16} />
      case 'error':
        return <XCircle size={16} />
      default:
        return null
    }
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
    <div className="settings-content">
      {/* 视频库设置部分 */}
      <div className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-header-left">
            <Settings2 size={20} className="settings-section-icon" />
            <h2 className="settings-section-title">视频库配置</h2>
          </div>
          {getStatusIcon()}
        </div>

        <div className="settings-section-content">
          {/* 缓存过期时间 */}
          <div className="settings-item">
            <div className="settings-item-left">
              <Clock size={18} className="settings-item-icon" />
              <div className="settings-item-info">
                <div className="settings-item-label">缓存过期时间</div>
                <div className="settings-item-desc">
                  视频库缓存的过期时间（分钟），超过此时间后首次查询会刷新缓存
                </div>
              </div>
            </div>
            <div className="settings-item-right">
              <input
                type="number"
                min="1"
                max="60"
                value={localConfig.cacheTTL}
                onChange={(e) => handleConfigChange('cacheTTL', parseInt(e.target.value) || 1)}
                className="settings-number-input"
              />
            </div>
          </div>

          {/* 自动刷新延迟 */}
          <div className="settings-item">
            <div className="settings-item-left">
              <Zap size={18} className="settings-item-icon" />
              <div className="settings-item-info">
                <div className="settings-item-label">自动刷新延迟</div>
                <div className="settings-item-desc">
                  下载完成后自动刷新视频库的延迟时间（秒），避免频繁刷新
                </div>
              </div>
            </div>
            <div className="settings-item-right">
              <input
                type="number"
                min="1"
                max="30"
                value={localConfig.autoRefreshDelay}
                onChange={(e) => handleConfigChange('autoRefreshDelay', parseInt(e.target.value) || 1)}
                className="settings-number-input"
              />
            </div>
          </div>

          {/* 最大并发检查数 */}
          <div className="settings-item">
            <div className="settings-item-left">
              <CheckCircle size={18} className="settings-item-icon" />
              <div className="settings-item-info">
                <div className="settings-item-label">最大并发检查数</div>
                <div className="settings-item-desc">
                  批量检查视频状态时的最大并发请求数，避免后端压力过大
                </div>
              </div>
            </div>
            <div className="settings-item-right">
              <input
                type="number"
                min="1"
                max="50"
                value={localConfig.maxConcurrentChecks}
                onChange={(e) => handleConfigChange('maxConcurrentChecks', parseInt(e.target.value) || 1)}
                className="settings-number-input"
              />
            </div>
          </div>

          {/* 启用智能刷新 */}
          <div className="settings-item">
            <div className="settings-item-left">
              <RefreshCw size={18} className="settings-item-icon" />
              <div className="settings-item-info">
                <div className="settings-item-label">启用智能刷新</div>
                <div className="settings-item-desc">
                  如果缓存时间小于配置时间的30%，则跳过刷新，减少不必要的扫描
                </div>
              </div>
            </div>
            <div className="settings-item-right">
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={localConfig.enableSmartRefresh}
                  onChange={(e) => handleConfigChange('enableSmartRefresh', e.target.checked)}
                  className="settings-switch-input"
                />
                <span className="settings-switch-slider" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 缓存状态部分 */}
      <div className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-header-left">
            <RefreshCw size={20} className="settings-section-icon" />
            <h2 className="settings-section-title">缓存状态</h2>
          </div>
        </div>

        <div className="settings-section-content">
          <div className="settings-item">
            <div className="settings-item-left">
              <div className="settings-item-info">
                <div className="settings-item-label">当前状态</div>
                <div className={`settings-item-desc ${cacheStatusInfo.color}`}>
                  {cacheStatusInfo.text}
                </div>
              </div>
            </div>
          </div>

          {cachedVideoCount > 0 && (
            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-info">
                  <div className="settings-item-label">缓存视频数</div>
                  <div className="settings-item-desc">
                    {cachedVideoCount} 个视频
                  </div>
                </div>
              </div>
            </div>
          )}

          {lastRefreshTime && (
            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-info">
                  <div className="settings-item-label">最后刷新时间</div>
                  <div className="settings-item-desc">
                    {lastRefreshTime.toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="settings-item">
            <div className="settings-item-left">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="settings-button"
              >
                {refreshing ? (
                  <>
                    <RefreshCw size={18} className="spinning" />
                    刷新中...
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} />
                    刷新视频库
                  </>
                )}
              </button>
            </div>
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