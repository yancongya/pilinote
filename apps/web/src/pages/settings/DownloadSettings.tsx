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

// 定义ref类型
interface DownloadSettingsRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

const DownloadSettings = forwardRef<DownloadSettingsRef>((_props, ref) => {
  const { settings, loading, updateSettings, resetSettings } = useSettingsStore()
  
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
      <div className="dl-loading-state" role="status" aria-live="polite">
        <p className="dl-loading-text">加载中...</p>
      </div>
    )
  }

  return (
    <div className="dl-panel">
      {/* 视频参数设置组 */}
      <div className="dl-group">
        <div className="dl-group-header">
          <span className="dl-group-title">视频参数</span>
          <span className="dl-group-subtitle">分辨率、音频和编码</span>
        </div>
        
        <div className="dl-list">
          {/* 分辨率 */}
          <div className="dl-item dl-item-select">
            <div className="dl-label-row">
              <Monitor size={18} className="dl-icon" />
              <span className="dl-label">分辨率</span>
            </div>
            <select
              className="dl-select"
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
            <p className="dl-hint">下载时，将会优先使用此处参数。若目标资源不支持此处选定的参数，则会使用其支持的最高参数。</p>
          </div>

          {/* 音频码率 */}
          <div className="dl-item dl-item-select">
            <div className="dl-label-row">
              <Music size={18} className="dl-icon" />
              <span className="dl-label">音频码率</span>
            </div>
            <select
              className="dl-select"
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
          <div className="dl-item dl-item-select">
            <div className="dl-label-row">
              <Video size={18} className="dl-icon" />
              <span className="dl-label">编码格式</span>
            </div>
            <select
              className="dl-select"
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
      <div className="dl-group">
        <div className="dl-group-header">
          <span className="dl-group-title">下载性能</span>
          <span className="dl-group-subtitle">并发和速度控制</span>
        </div>
        
        <div className="dl-list">
          {/* 最大并发下载数 */}
          <div className="dl-item dl-item-select">
            <div className="dl-label-row">
              <HardDrive size={18} className="dl-icon" />
              <span className="dl-label">最大并发下载数</span>
            </div>
            <select
              className="dl-select"
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
          <div className="dl-item dl-item-input">
            <div className="dl-label-row">
              <Gauge size={18} className="dl-icon" />
              <span className="dl-label">速度限制 (KB/s)</span>
            </div>
            <input
              type="number"
              className="dl-input"
              value={getCurrentValue('speed_limit') || 0}
              onChange={(e) => handleLocalUpdate('speed_limit', parseInt(e.target.value) || 0)}
              min="0"
              disabled={loading}
              placeholder="0 表示不限制"
              aria-label="输入速度限制"
              inputMode="numeric"
            />
            <p className="dl-hint">0 表示不限制速度</p>
          </div>
        </div>
      </div>

      {/* 元数据设置组 */}
      <div className="dl-group">
        <div className="dl-group-header">
          <span className="dl-group-title">元数据</span>
          <span className="dl-group-subtitle">字幕、弹幕和封面</span>
        </div>
        
        <div className="dl-toggles">
          <label className="dl-toggle">
            <div className="dl-toggle-content">
              <span className="dl-toggle-label">启用字幕下载</span>
            </div>
            <input
              type="checkbox"
              className="dl-toggle-input"
              checked={getCurrentValue('metadata.enable_subtitle') as boolean ?? true}
              onChange={(e) => handleLocalUpdate('metadata.enable_subtitle', e.target.checked)}
              disabled={loading}
              aria-label="启用字幕下载"
            />
          </label>

          <label className="dl-toggle">
            <div className="dl-toggle-content">
              <span className="dl-toggle-label">启用弹幕下载</span>
            </div>
            <input
              type="checkbox"
              className="dl-toggle-input"
              checked={getCurrentValue('metadata.enable_danmaku') as boolean ?? false}
              onChange={(e) => handleLocalUpdate('metadata.enable_danmaku', e.target.checked)}
              disabled={loading}
              aria-label="启用弹幕下载"
            />
          </label>

          <label className="dl-toggle">
            <div className="dl-toggle-content">
              <span className="dl-toggle-label">启用 NFO 文件</span>
            </div>
            <input
              type="checkbox"
              className="dl-toggle-input"
              checked={getCurrentValue('metadata.enable_nfo') as boolean ?? true}
              onChange={(e) => handleLocalUpdate('metadata.enable_nfo', e.target.checked)}
              disabled={loading}
              aria-label="启用 NFO 文件"
            />
          </label>

          <label className="dl-toggle">
            <div className="dl-toggle-content">
              <span className="dl-toggle-label">启用封面下载</span>
            </div>
            <input
              type="checkbox"
              className="dl-toggle-input"
              checked={getCurrentValue('metadata.enable_cover') as boolean ?? true}
              onChange={(e) => handleLocalUpdate('metadata.enable_cover', e.target.checked)}
              disabled={loading}
              aria-label="启用封面下载"
            />
          </label>

          <label className="dl-toggle">
            <div className="dl-toggle-content">
              <span className="dl-toggle-label">启用头像下载</span>
            </div>
            <input
              type="checkbox"
              className="dl-toggle-input"
              checked={getCurrentValue('metadata.enable_avatar') as boolean ?? false}
              onChange={(e) => handleLocalUpdate('metadata.enable_avatar', e.target.checked)}
              disabled={loading}
              aria-label="启用头像下载"
            />
          </label>

          <label className="dl-toggle">
            <div className="dl-toggle-content">
              <span className="dl-toggle-label">屏蔽 PCDN 地址</span>
            </div>
            <input
              type="checkbox"
              className="dl-toggle-input"
              checked={getCurrentValue('metadata.block_pcdn') as boolean ?? true}
              onChange={(e) => handleLocalUpdate('metadata.block_pcdn', e.target.checked)}
              disabled={loading}
              aria-label="屏蔽 PCDN 地址"
            />
          </label>
        </div>
      </div>

      {/* 重置按钮 */}
      <div className="dl-actions">
        <button 
          className="dl-reset-btn"
          onClick={handleReset}
          disabled={loading}
          aria-label="重置下载设置"
        >
          <RotateCw className="dl-reset-icon" />
          <span>重置下载设置</span>
        </button>
      </div>

      <style>{`
        .dl-panel {
          padding: 12px;
          background: #F8FAFC;
          min-height: 100vh;
        }

        /* 分组 */
        .dl-group {
          background: white;
          border-radius: 12px;
          border: 1px solid #E2E8F0;
          margin-bottom: 12px;
          overflow: hidden;
        }

        .dl-group-header {
          padding: 12px 16px;
          background: #F8FAFC;
          border-bottom: 1px solid #E2E8F0;
        }

        .dl-group-title {
          font-size: 15px;
          font-weight: 600;
          color: #1E293B;
          display: block;
        }

        .dl-group-subtitle {
          font-size: 12px;
          color: #64748B;
          margin-top: 2px;
          display: block;
        }

        /* 列表 */
        .dl-list {
          display: flex;
          flex-direction: column;
        }

        .dl-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          min-height: 56px;
          border-bottom: 1px solid #F1F5F9;
        }

        .dl-item:last-child {
          border-bottom: none;
        }

        .dl-item-select,
        .dl-item-input {
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }

        .dl-icon {
          color: #64748B;
          flex-shrink: 0;
        }

        .dl-label-row {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .dl-label {
          font-size: 15px;
          font-weight: 500;
          color: #1E293B;
          margin-bottom: 4px;
        }

        .dl-item-select .dl-label,
        .dl-item-input .dl-label {
          margin-bottom: 0;
        }

        .dl-select {
          width: 100%;
          padding: 8px 12px;
          font-size: 14px;
          border: 1px solid #E2E8F0;
          border-radius: 6px;
          background: #F8FAFC;
          color: #1E293B;
          outline: none;
          transition: all 0.15s ease;
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
          background-position: right 8px center;
          background-repeat: no-repeat;
          background-size: 16px;
          padding-right: 32px;
        }

        .dl-select:hover {
          border-color: #CBD5E1;
          background-color: white;
        }

        .dl-select:focus {
          border-color: #2563EB;
          background-color: white;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .dl-select:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .dl-input {
          width: 100%;
          padding: 8px 12px;
          font-size: 14px;
          border: 1px solid #E2E8F0;
          border-radius: 6px;
          background: #F8FAFC;
          color: #1E293B;
          outline: none;
          transition: all 0.15s ease;
        }

        .dl-input:focus {
          border-color: #2563EB;
          background: white;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .dl-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .dl-hint {
          font-size: 12px;
          color: #94A3B8;
          margin: 0;
          line-height: 1.4;
        }

        /* 开关 */
        .dl-toggles {
          padding: 8px 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .dl-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 0;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          gap: 12px;
        }

        .dl-toggle-content {
          flex: 1;
        }

        .dl-toggle-label {
          font-size: 15px;
          font-weight: 500;
          color: #1E293B;
        }

        .dl-toggle-input {
          width: 48px;
          height: 28px;
          border-radius: 14px;
          appearance: none;
          background: #E2E8F0;
          position: relative;
          cursor: pointer;
          transition: background-color 0.15s ease;
          flex-shrink: 0;
        }

        .dl-toggle-input:checked {
          background: #2563EB;
        }

        .dl-toggle-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dl-toggle-input::before {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          transition: transform 0.15s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .dl-toggle-input:checked::before {
          transform: translateX(20px);
        }

        /* 重置按钮 */
        .dl-actions {
          margin-top: 16px;
          display: flex;
          justify-content: center;
        }

        .dl-reset-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          background: white;
          color: #64748B;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dl-reset-btn:hover {
          background: #F8FAFC;
          border-color: #CBD5E1;
          color: #475569;
        }

        .dl-reset-btn:active {
          background: #F1F5F9;
        }

        .dl-reset-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dl-reset-icon {
          width: 16px;
          height: 16px;
        }

        /* Loading */
        .dl-loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 16px;
          color: #64748B;
        }

        .dl-loading-text {
          font-size: 14px;
          color: #64748B;
        }
      `}</style>

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
