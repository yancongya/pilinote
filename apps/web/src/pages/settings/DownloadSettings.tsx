import { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useSettingsStore } from '../../stores/settings'
import { Download, HardDrive, Gauge, Monitor, Music, RotateCw, Check } from 'lucide-react'
import ConfirmModal from '../../components/ConfirmModal'

// 定义ref类型
interface DownloadSettingsRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

const DownloadSettings = forwardRef<DownloadSettingsRef>((_props, ref) => {
  const { settings, loading, updateSettings, resetSettings } = useSettingsStore()
  const [saveMessage, setSaveMessage] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  })
  
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
        // 合并现有的 download 设置，确保提供完整的对象结构
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
            enable_danmaku: false,
            danmaku_format: 'xml',
            enable_cover: true,
            enable_avatar: false,
            block_pcdn: true
          }
        }

        // 深度合并设置
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
        showSaveMessage('设置已保存', 'success')
        
        // 清除已保存的字段
        setLocalSettings({
          video: {},
          metadata: {}
        })
        
        // 2秒后重置状态
        setTimeout(() => {
          setSavedStatus('idle')
        }, 2000)
      } catch (error) {
        setSavedStatus('error')
        showSaveMessage('保存失败', 'error')
        console.error('保存设置失败:', error)
        throw error
      }
    },
    getSavedStatus: () => savedStatus
  }))

  useEffect(() => {
    useSettingsStore.getState().fetchSettings()
  }, [])

  // 显示保存消息
  const showSaveMessage = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setSaveMessage({ show: true, message, type })
    setTimeout(() => {
      setSaveMessage({ show: false, message: '', type: 'success' })
    }, 2000)
  }, [])

  // 本地更新函数
  const handleLocalUpdate = useCallback((field: string, value: any) => {
    setLocalSettings(prev => {
      // 处理嵌套字段（如 video.default_quality）
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
      // 处理顶级字段（如 max_concurrent）
      return {
        ...prev,
        [field]: value
      }
    })
  }, [])

  // 获取当前设置值（优先使用本地暂存的值）
  const getCurrentValue = useCallback((field: string) => {
    if (!settings?.download) return undefined
    
    // 处理嵌套字段
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      const localValue = localSettings[parent]?.[child]
      if (localValue !== undefined) {
        return localValue
      }
      return (settings.download as any)[parent]?.[child]
    }
    
    // 处理顶级字段
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
  }

  if (!settings) {
    return (
      <div
        className="download-loading-state"
        role="status"
        aria-live="polite"
      >
        <p className="download-loading-text">加载中...</p>
      </div>
    )
  }

  return (
    <div className="download-settings-new">
      {/* 保存提示消息 */}
      {saveMessage.show && (
        <div className={`save-message ${saveMessage.type === 'success' ? 'save-message-success' : 'save-message-error'}`}>
          <Check className="save-message-icon" />
          <span className="save-message-text">{saveMessage.message}</span>
        </div>
      )}

      {/* 页面标题 */}
      <div className="download-header">
        <Download className="download-header-icon" />
        <h2 className="download-header-title">下载设置</h2>
      </div>

      {/* 下载设置表单 */}
      <div className="download-form-group">
        {/* 分辨率 */}
        <div className="download-form-item">
          <label className="download-form-label" htmlFor="resolution-select">
            <Monitor className="download-form-icon" />
            <span className="download-form-text">分辨率</span>
          </label>
          <select
            id="resolution-select"
            className="download-form-select"
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
          <p className="download-form-hint">下载时，将会优先使用此处参数。若目标资源不支持此处选定的参数，则会使用其支持的最高参数。</p>
        </div>

        {/* 音频码率（比特率） */}
        <div className="download-form-item">
          <label className="download-form-label" htmlFor="bitrate-select">
            <Music className="download-form-icon" />
            <span className="download-form-text">音频码率</span>
          </label>
          <select
            id="bitrate-select"
            className="download-form-select"
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
        <div className="download-form-item">
          <label className="download-form-label" htmlFor="codec-select">
            <Download className="download-form-icon" />
            <span className="download-form-text">编码格式</span>
          </label>
          <select
            id="codec-select"
            className="download-form-select"
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

        {/* 最大并发下载数 */}
        <div className="download-form-item">
          <label className="download-form-label" htmlFor="concurrent-select">
            <HardDrive className="download-form-icon" />
            <span className="download-form-text">最大并发下载数</span>
          </label>
          <select
            id="concurrent-select"
            className="download-form-select"
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
        <div className="download-form-item">
          <label className="download-form-label" htmlFor="speed-limit-input">
            <Gauge className="download-form-icon" />
            <span className="download-form-text">速度限制 (KB/s)</span>
          </label>
          <input
            id="speed-limit-input"
            type="number"
            className="download-form-input"
            value={getCurrentValue('speed_limit') || 0}
            onChange={(e) => handleLocalUpdate('speed_limit', parseInt(e.target.value) || 0)}
            min="0"
            disabled={loading}
            placeholder="0 表示不限制"
            aria-label="输入速度限制"
            inputMode="numeric"
          />
          <p className="download-form-hint">0 表示不限制速度</p>
        </div>
      </div>

      {/* 重置按钮 */}
      <div className="download-actions">
        <button 
          className="download-reset-btn"
          onClick={handleReset}
          disabled={loading}
          aria-label="重置下载设置"
        >
          <RotateCw className="download-reset-icon" />
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