import { useEffect, useState } from 'react'
import { useSettingsStore } from '../../stores/settings'
import { Database, Trash2, Upload, Download, RefreshCw } from 'lucide-react'

export default function StorageSettings() {
  const { settings, loading, error, updateSettings, resetSettings, exportSettings, importSettings } = useSettingsStore()
  const [exportData, setExportData] = useState('')
  const [showExport, setShowExport] = useState(false)

  useEffect(() => {
    useSettingsStore.getState().fetchSettings()
  }, [])

  if (!settings) {
    return <div className="loading-state">加载中...</div>
  }

  const handleUpdate = async (field: string, value: any) => {
    await updateSettings({
      storage: {
        ...settings.storage,
        [field]: value,
      },
    })
  }

  const handleReset = async () => {
    if (confirm('确定要重置存储设置吗？')) {
      await resetSettings('storage')
    }
  }

  const handleExport = async () => {
    try {
      const data = await exportSettings()
      setExportData(data)
      setShowExport(true)
    } catch (error) {
      alert('导出失败: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        try {
          const text = await file.text()
          await importSettings(text)
          alert('导入成功')
        } catch (error) {
          alert('导入失败: ' + (error instanceof Error ? error.message : 'Unknown error'))
        }
      }
    }
    input.click()
  }

  const handleDownloadExport = () => {
    const blob = new Blob([exportData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pilinote-settings-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowExport(false)
  }

  return (
    <div className="storage-settings">
      <h2 className="settings-title">
        <Database />
        数据管理
      </h2>

      {error && (
        <div className="error-message">{error}</div>
      )}

      <div className="settings-group">
        <h3>存储设置</h3>
        
        <div className="setting-item">
          <label>
            <Database />
            临时文件路径
          </label>
          <input
            type="text"
            value={settings.storage.temp_path}
            onChange={(e) => handleUpdate('temp_path', e.target.value)}
            disabled={loading}
            placeholder="./temp"
          />
        </div>

        <div className="setting-item">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.storage.auto_cleanup}
              onChange={(e) => handleUpdate('auto_cleanup', e.target.checked)}
              disabled={loading}
            />
            <span>自动清理临时文件</span>
          </label>
        </div>

        <div className="setting-item">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.storage.keep_failed}
              onChange={(e) => handleUpdate('keep_failed', e.target.checked)}
              disabled={loading}
            />
            <span>保留失败的任务</span>
          </label>
        </div>
      </div>

      <div className="settings-group">
        <h3>数据备份</h3>
        
        <div className="data-actions">
          <button 
            className="action-button"
            onClick={handleExport}
            disabled={loading}
          >
            <Download />
            导出设置
          </button>
          
          <button 
            className="action-button"
            onClick={handleImport}
            disabled={loading}
          >
            <Upload />
            导入设置
          </button>

          <button 
            className="action-button reset-button"
            onClick={handleReset}
            disabled={loading}
          >
            <RefreshCw />
            重置存储设置
          </button>
        </div>
      </div>

      {showExport && (
        <div className="modal-overlay" onClick={() => setShowExport(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>导出的设置</h3>
            </div>
            <div className="modal-body">
              <textarea
                value={exportData}
                readOnly
                className="export-textarea"
              />
            </div>
            <div className="modal-footer">
              <button
                className="modal-btn cancel-btn"
                onClick={() => setShowExport(false)}
              >
                关闭
              </button>
              <button
                className="modal-btn confirm-btn"
                onClick={handleDownloadExport}
              >
                下载文件
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}