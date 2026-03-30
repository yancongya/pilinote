import { useEffect } from 'react'
import { useSettingsStore } from '../../stores/settings'
import { Download, HardDrive, Gauge, FileVideo, Save } from 'lucide-react'

export default function DownloadSettings() {
  const { settings, loading, error, updateSettings, resetSettings } = useSettingsStore()

  useEffect(() => {
    useSettingsStore.getState().fetchSettings()
  }, [])

  if (!settings) {
    return <div className="loading-state">加载中...</div>
  }

  const handleUpdate = async (field: string, value: any) => {
    await updateSettings({
      download: {
        ...settings.download,
        [field]: value,
      },
    })
  }

  const handleReset = async () => {
    if (confirm('确定要重置下载设置吗？')) {
      await resetSettings('download')
    }
  }

  return (
    <div className="download-settings">
      <h2 className="settings-title">
        <Download />
        下载设置
      </h2>

      {error && (
        <div className="error-message">{error}</div>
      )}

      <div className="settings-group">
        <div className="setting-item">
          <label>
            <FileVideo />
            默认视频质量
          </label>
          <select
            value={settings.download.default_quality}
            onChange={(e) => handleUpdate('default_quality', parseInt(e.target.value))}
            disabled={loading}
          >
            <option value={16}>360P</option>
            <option value={32}>480P</option>
            <option value={64}>720P</option>
            <option value={80}>1080P</option>
            <option value={112}>1080P+</option>
            <option value={116}>4K</option>
          </select>
        </div>

        <div className="setting-item">
          <label>
            <HardDrive />
            最大并发下载数
          </label>
          <select
            value={settings.download.max_concurrent}
            onChange={(e) => handleUpdate('max_concurrent', parseInt(e.target.value))}
            disabled={loading}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
        </div>

        <div className="setting-item">
          <label>
            <Gauge />
            速度限制 (KB/s)
          </label>
          <input
            type="number"
            value={settings.download.speed_limit}
            onChange={(e) => handleUpdate('speed_limit', parseInt(e.target.value) || 0)}
            min="0"
            disabled={loading}
            placeholder="0 表示不限制"
          />
          <small>0 表示不限制速度</small>
        </div>

        <div className="setting-item">
          <label>
            <FileVideo />
            输出格式
          </label>
          <select
            value={settings.download.output_format}
            onChange={(e) => handleUpdate('output_format', e.target.value)}
            disabled={loading}
          >
            <option value="mp4">MP4</option>
            <option value="flv">FLV</option>
            <option value="mkv">MKV</option>
          </select>
        </div>

        <div className="setting-item">
          <label>
            <Save />
            下载路径
          </label>
          <input
            type="text"
            value={settings.download.download_path}
            onChange={(e) => handleUpdate('download_path', e.target.value)}
            disabled={loading}
            placeholder="./downloads"
          />
        </div>
      </div>

      <div className="settings-actions">
        <button 
          className="reset-button"
          onClick={handleReset}
          disabled={loading}
        >
          重置下载设置
        </button>
      </div>
    </div>
  )
}