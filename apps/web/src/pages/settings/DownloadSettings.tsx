import { useEffect, useState, useCallback } from 'react'
import { useSettingsStore } from '../../stores/settings'
import { Download, HardDrive, Gauge, Monitor, Music, RotateCcw, Check } from 'lucide-react'

// 防抖函数
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

export default function DownloadSettings() {
  const { settings, loading, error, updateSettings, resetSettings } = useSettingsStore()
  const [saveMessage, setSaveMessage] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  })
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set())

  useEffect(() => {
    useSettingsStore.getState().fetchSettings()
  }, [])

  // 显示保存消息
  const showSaveMessage = useCallback((message: string, type: 'success' | 'error') => {
    setSaveMessage({ show: true, message, type })
    setTimeout(() => {
      setSaveMessage({ show: false, message: '', type: 'success' })
    }, 2000)
  }, [])

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

  // 处理设置更新（带debounce）
  const handleUpdate = useCallback(debounce(async (field: string, value: any) => {
    setSavingFields(prev => new Set(prev).add(field))
    try {
      await updateSettings({
        download: {
          ...settings.download,
          [field]: value,
        },
      })
      showSaveMessage('设置已保存', 'success')
    } catch (error) {
      showSaveMessage('保存失败', 'error')
      console.error('更新设置失败:', error)
    } finally {
      setSavingFields(prev => {
        const newSet = new Set(prev)
        newSet.delete(field)
        return newSet
      })
    }
  }, 1000), [settings, updateSettings, showSaveMessage])

  const handleReset = async () => {
    if (confirm('确定要重置下载设置吗？')) {
      await resetSettings('download')
    }
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
            value={settings.download.default_quality}
            onChange={(e) => handleUpdate('default_quality', parseInt(e.target.value))}
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
            value={settings.download.audio_bitrate || 192}
            onChange={(e) => handleUpdate('audio_bitrate', parseInt(e.target.value))}
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
            value={settings.download.codec || 'avc'}
            onChange={(e) => handleUpdate('codec', e.target.value)}
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
            value={settings.download.max_concurrent}
            onChange={(e) => handleUpdate('max_concurrent', parseInt(e.target.value))}
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
            value={settings.download.speed_limit}
            onChange={(e) => handleUpdate('speed_limit', parseInt(e.target.value) || 0)}
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
          <RotateCcw className="download-reset-icon" />
          <span>重置下载设置</span>
        </button>
      </div>
    </div>
  )
}