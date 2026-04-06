import { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useSettingsStore } from '../../stores/settings'
import { 
  Monitor, 
  Music, 
  HardDrive, 
  Gauge, 
  RotateCw, 
  Video
} from 'lucide-react'
import ConfirmModal from '../../components/ConfirmModal'
import { useToast } from '../../components/Toast'

// 定义ref类型
interface DownloadSettingsRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

const DownloadSettings = forwardRef<DownloadSettingsRef>((_props, ref) => {
  const { settings, loading, updateSettings, resetSettings } = useSettingsStore()
  const { showToast } = useToast()
  
  // 本地状态暂存修改
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({
    video: {},
    metadata: {}
  })
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => {
      return Object.keys(localSettings.video || {}).length > 0 ||
             Object.keys(localSettings.metadata || {}).length > 0 ||
             'max_concurrent' in localSettings ||
             'speed_limit' in localSettings
    },
    saveSettings: async () => {
      if (Object.keys(localSettings.video || {}).length === 0 &&
          Object.keys(localSettings.metadata || {}).length === 0 &&
          !('max_concurrent' in localSettings) &&
          !('speed_limit' in localSettings)) {
        setSavedStatus('idle')
        return
      }

      setSavedStatus('saving')

      try {
        const currentDownload = settings?.download || {
          video: {
            default_quality: 64,
            audio_bitrate: 192,
            codec: 'avc',
            output_format: 'mp4'
          },
          max_concurrent: 3,
          speed_limit: 0,
          metadata: {
            enable_nfo: true,
            enable_subtitle: true,
            enable_cover: true,
            enable_avatar: false
          }
        }

        const mergedSettings = {
          video: { ...currentDownload.video, ...(localSettings.video || {}) },
          max_concurrent: localSettings.max_concurrent ?? currentDownload.max_concurrent,
          speed_limit: localSettings.speed_limit ?? currentDownload.speed_limit,
          metadata: { ...currentDownload.metadata, ...(localSettings.metadata || {}) }
        }

        await updateSettings({
          download: mergedSettings
        })
        
        setSavedStatus('saved')
        
        setLocalSettings({
          video: {},
          metadata: {}
        })
        
        setTimeout(() => {
          setSavedStatus('idle')
        }, 2000)
      } catch (error) {
        setSavedStatus('error')
        console.error('保存设置失败:', error)
        throw error
      }
    },
    getSavedStatus: () => savedStatus
  }))

  useEffect(() => {
    useSettingsStore.getState().fetchSettings()
  }, [])

  // 本地更新函数
  const handleLocalUpdate = useCallback((field: string, value: any) => {
    setLocalSettings(prev => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.')
        return {
          ...prev,
          [parent]: {
            ...(prev[parent] || {}),
            [child]: value
          }
        }
      }
      return {
        ...prev,
        [field]: value
      }
    })
  }, [])

  // 获取当前设置值（优先使用本地暂存的值）
  const getCurrentValue = useCallback((field: string) => {
    if (!settings?.download) return undefined
    
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      const localValue = localSettings[parent]?.[child]
      if (localValue !== undefined) {
        return localValue
      }
      return (settings.download as any)[parent]?.[child]
    }
    
    if (field in localSettings) {
      return localSettings[field]
    }
    return (settings.download as any)[field]
  }, [localSettings, settings])

  const handleReset = async () => {
    setShowResetConfirm(true)
  }

  const confirmReset = async () => {
    await resetSettings('download')
    setLocalSettings({
      video: {},
      metadata: {}
    })
    setShowResetConfirm(false)
    showToast('下载设置已重置', 'success')
  }

  if (!settings) {
    return (
      <div className="stg-loading" role="status" aria-live="polite">
        <RotateCw className="stg-spinner" />
        <p>加载中...</p>
      </div>
    )
  }

  return (
    <div className="stg-panel">
      {/* 视频参数设置组 */}
      <div className="stg-group">
        <div className="stg-group-header">
          <span className="stg-group-title">视频参数</span>
          <span className="stg-group-subtitle">分辨率、音频和编码</span>
        </div>
        
        <div className="stg-list">
          {/* 分辨率 */}
          <div className="stg-item stg-item-col">
            <div className="stg-item-label-row">
              <Monitor size={18} className="stg-item-icon" />
              <span className="stg-item-label">分辨率</span>
            </div>
            <select
              className="stg-select"
              value={getCurrentValue('video.default_quality') || 64}
              onChange={(e) => handleLocalUpdate('video.default_quality', parseInt(e.target.value))}
              disabled={loading}
              aria-label="选择默认分辨率"
            >
              <option value={16}>360P</option>
              <option value={32}>480P</option>
              <option value={64}>720P</option>
              <option value={80}>1080P</option>
              <option value={112}>1080P+</option>
              <option value={116}>4K</option>
            </select>
            <p className="stg-hint">下载时，将会优先使用此处参数。若目标资源不支持此处选定的参数，则会使用其支持的最高参数。</p>
          </div>

          {/* 音频码率 */}
          <div className="stg-item stg-item-col">
            <div className="stg-item-label-row">
              <Music size={18} className="stg-item-icon" />
              <span className="stg-item-label">音频码率</span>
            </div>
            <select
              className="stg-select"
              value={getCurrentValue('video.audio_bitrate') || 192}
              onChange={(e) => handleLocalUpdate('video.audio_bitrate', parseInt(e.target.value))}
              disabled={loading}
              aria-label="选择默认音频码率"
            >
              <option value={64}>64K</option>
              <option value={128}>128K</option>
              <option value={132}>132K</option>
              <option value={192}>192K</option>
              <option value={30232}>杜比全景声320K</option>
              <option value={30251}>Hi-Res 无损</option>
              <option value={30250}>无损FLAC</option>
            </select>
          </div>

          {/* 编码格式 */}
          <div className="stg-item stg-item-col">
            <div className="stg-item-label-row">
              <Video size={18} className="stg-item-icon" />
              <span className="stg-item-label">编码格式</span>
            </div>
            <select
              className="stg-select"
              value={getCurrentValue('video.codec') || 'avc'}
              onChange={(e) => handleLocalUpdate('video.codec', e.target.value)}
              disabled={loading}
              aria-label="选择默认编码格式"
            >
              <option value="avc">AVC (H.264)</option>
              <option value="hevc">HEVC (H.265)</option>
              <option value="av1">AV1</option>
              <option value="vp9">VP9</option>
            </select>
          </div>
        </div>
      </div>

      {/* 下载性能组 */}
      <div className="stg-group">
        <div className="stg-group-header">
          <span className="stg-group-title">下载性能</span>
          <span className="stg-group-subtitle">并发和速度控制</span>
        </div>
        
        <div className="stg-list">
          {/* 最大并发下载数 */}
          <div className="stg-item stg-item-col">
            <div className="stg-item-label-row">
              <HardDrive size={18} className="stg-item-icon" />
              <span className="stg-item-label">最大并发下载数</span>
            </div>
            <select
              className="stg-select"
              value={getCurrentValue('max_concurrent') || 3}
              onChange={(e) => handleLocalUpdate('max_concurrent', parseInt(e.target.value))}
              disabled={loading}
              aria-label="选择最大并发下载数"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </div>

          {/* 速度限制 */}
          <div className="stg-item stg-item-col">
            <div className="stg-item-label-row">
              <Gauge size={18} className="stg-item-icon" />
              <span className="stg-item-label">速度限制 (KB/s)</span>
            </div>
            <input
              type="number"
              className="stg-input"
              value={getCurrentValue('speed_limit') || 0}
              onChange={(e) => handleLocalUpdate('speed_limit', parseInt(e.target.value) || 0)}
              min="0"
              disabled={loading}
              placeholder="0 表示不限制"
              aria-label="输入速度限制"
              inputMode="numeric"
            />
            <p className="stg-hint">0 表示不限制速度</p>
          </div>
        </div>
      </div>

      {/* 元数据设置组 */}
      <div className="stg-group">
        <div className="stg-group-header">
          <span className="stg-group-title">元数据</span>
          <span className="stg-group-subtitle">字幕、弹幕和封面</span>
        </div>
        
        <div className="stg-toggles">
          <label className="stg-toggle">
            <div className="stg-toggle-content">
              <span className="stg-toggle-label">启用字幕下载</span>
            </div>
            <input
              type="checkbox"
              className="stg-toggle-input"
              checked={getCurrentValue('metadata.enable_subtitle') as boolean ?? true}
              onChange={(e) => handleLocalUpdate('metadata.enable_subtitle', e.target.checked)}
              disabled={loading}
              aria-label="启用字幕下载"
            />
          </label>

          <label className="stg-toggle">
            <div className="stg-toggle-content">
              <span className="stg-toggle-label">启用 NFO 文件</span>
            </div>
            <input
              type="checkbox"
              className="stg-toggle-input"
              checked={getCurrentValue('metadata.enable_nfo') as boolean ?? true}
              onChange={(e) => handleLocalUpdate('metadata.enable_nfo', e.target.checked)}
              disabled={loading}
              aria-label="启用 NFO 文件"
            />
          </label>

          <label className="stg-toggle">
            <div className="stg-toggle-content">
              <span className="stg-toggle-label">启用封面下载</span>
            </div>
            <input
              type="checkbox"
              className="stg-toggle-input"
              checked={getCurrentValue('metadata.enable_cover') as boolean ?? true}
              onChange={(e) => handleLocalUpdate('metadata.enable_cover', e.target.checked)}
              disabled={loading}
              aria-label="启用封面下载"
            />
          </label>

          <label className="stg-toggle">
            <div className="stg-toggle-content">
              <span className="stg-toggle-label">启用头像下载</span>
            </div>
            <input
              type="checkbox"
              className="stg-toggle-input"
              checked={getCurrentValue('metadata.enable_avatar') as boolean ?? false}
              onChange={(e) => handleLocalUpdate('metadata.enable_avatar', e.target.checked)}
              disabled={loading}
              aria-label="启用头像下载"
            />
          </label>
        </div>
      </div>

      {/* 重置按钮 */}
      <div className="stg-actions">
        <button 
          className="stg-btn stg-btn-secondary"
          onClick={handleReset}
          disabled={loading}
          aria-label="重置下载设置"
        >
          <RotateCw size={16} className="stg-item-icon" />
          <span>重置下载设置</span>
        </button>
      </div>

      {/* 重置确认弹窗 */}
      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={confirmReset}
        title="重置下载设置"
        message="确定要重置下载设置吗？这将恢复所有下载设置为默认值，但不会影响已保存的视频和数据。"
        confirmText="确定重置"
        cancelText="取消"
        confirmVariant="danger"
        loading={loading}
      />
    </div>
  )
})

export default DownloadSettings
