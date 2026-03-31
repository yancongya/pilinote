import { useEffect, useState } from 'react'
import { useSettingsStore } from '../../stores/settings'
import { Database, Trash2, Upload, Download, RefreshCw, HardDrive, Folder, CheckSquare2, AlertCircle } from 'lucide-react'

export default function StorageSettings() {
  const { settings, loading, error, updateSettings, resetSettings, exportSettings, importSettings } = useSettingsStore()
  const [exportData, setExportData] = useState('')
  const [showExport, setShowExport] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)
  const [storageInfo, setStorageInfo] = useState({
    totalSizeFormatted: '0 B',
    fileCount: 0,
    directoryCount: 0
  })

  useEffect(() => {
    useSettingsStore.getState().fetchSettings()
    fetchStorageInfo()
  }, [])

  const fetchStorageInfo = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/settings/storage-info')
      const data = await response.json()
      
      if (data.success && data.data) {
        setStorageInfo({
          totalSizeFormatted: data.data.total_size_formatted,
          fileCount: data.data.file_count,
          directoryCount: data.data.directory_count
        })
      }
    } catch (error) {
      console.error('获取存储信息失败:', error)
    }
  }

  const handleClearCache = async (cacheType: string) => {
    if (cacheType === 'downloads') {
      if (!confirm('确定要清理所有下载文件吗？此操作不可恢复！')) {
        return
      }
    } else if (cacheType === 'all') {
      if (!confirm('确定要清理所有缓存吗？此操作不可恢复！')) {
        return
      }
    }
    
    setClearingCache(true)
    try {
      const response = await fetch(`http://localhost:8000/api/settings/clear-cache?cache_type=${cacheType}`, {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        alert(data.message || '清理成功')
        // 重新获取存储信息
        fetchStorageInfo()
      } else {
        alert('清理失败: ' + (data.message || 'Unknown error'))
      }
    } catch (error) {
      alert('清理失败: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setClearingCache(false)
    }
  }

  if (!settings) {
    return (
      <div 
        className="storage-loading-state"
        role="status"
        aria-live="polite"
      >
        <p className="storage-loading-text">加载中...</p>
      </div>
    )
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
    <div className="storage-settings-new">
      {/* 页面标题 */}
      <div className="storage-header">
        <Database className="storage-header-icon" />
        <h2 className="storage-header-title">数据管理</h2>
      </div>

      {/* 存储信息卡片 */}
      <div className="storage-info-card-new">
        <div className="storage-info-header">
          <HardDrive className="storage-info-header-icon" />
          <h3 className="storage-info-header-title">存储概览</h3>
        </div>
        <div className="storage-info-stats">
          <div className="storage-info-stat">
            <Folder className="storage-info-stat-icon" />
            <div className="storage-info-stat-content">
              <span className="storage-info-stat-label">占用空间</span>
              <span className="storage-info-stat-value">{storageInfo.totalSizeFormatted}</span>
            </div>
          </div>
          <div className="storage-info-stat">
            <Database className="storage-info-stat-icon" />
            <div className="storage-info-stat-content">
              <span className="storage-info-stat-label">文件数量</span>
              <span className="storage-info-stat-value">{storageInfo.fileCount}</span>
            </div>
          </div>
          <div className="storage-info-stat">
            <CheckSquare2 className="storage-info-stat-icon" />
            <div className="storage-info-stat-content">
              <span className="storage-info-stat-label">视频数量</span>
              <span className="storage-info-stat-value">{storageInfo.directoryCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 存储设置 */}
      <div className="storage-section">
        <h3 className="storage-section-title">存储设置</h3>
        
        <div className="storage-form-item">
          <label className="storage-form-label" htmlFor="download-path-input">
            <Folder className="storage-form-icon" />
            <span className="storage-form-text">下载路径</span>
          </label>
          <input
            id="download-path-input"
            type="text"
            className="storage-form-input"
            value={settings.storage.download_path || settings.download?.download_path || './downloads'}
            onChange={(e) => {
              // 优先更新 storage.download_path，如果不存在则更新 download.download_path
              if (settings.storage) {
                handleUpdate('download_path', e.target.value)
              } else {
                handleUpdate('download_path', e.target.value)
              }
            }}
            disabled={loading}
            placeholder="./downloads"
            aria-label="输入下载路径"
          />
        </div>
        
        <div className="storage-form-item">
          <label className="storage-form-label" htmlFor="temp-path-input">
            <Database className="storage-form-icon" />
            <span className="storage-form-text">临时文件路径</span>
          </label>
          <input
            id="temp-path-input"
            type="text"
            className="storage-form-input"
            value={settings.storage.temp_path}
            onChange={(e) => handleUpdate('temp_path', e.target.value)}
            disabled={loading}
            placeholder="./temp"
            aria-label="输入临时文件路径"
          />
        </div>

        <div className="storage-checkbox-item">
          <label className="storage-checkbox-label">
            <input
              type="checkbox"
              className="storage-checkbox-input"
              checked={settings.storage.auto_cleanup}
              onChange={(e) => handleUpdate('auto_cleanup', e.target.checked)}
              disabled={loading}
              aria-label="自动清理临时文件"
            />
            <span className="storage-checkbox-text">自动清理临时文件</span>
          </label>
        </div>

        <div className="storage-checkbox-item">
          <label className="storage-checkbox-label">
            <input
              type="checkbox"
              className="storage-checkbox-input"
              checked={settings.storage.keep_failed}
              onChange={(e) => handleUpdate('keep_failed', e.target.checked)}
              disabled={loading}
              aria-label="保留失败的任务"
            />
            <span className="storage-checkbox-text">保留失败的任务</span>
          </label>
        </div>
      </div>

      {/* 缓存管理 */}
      <div className="storage-section">
        <h3 className="storage-section-title">缓存管理</h3>
        
        <div className="storage-actions-grid">
          <button 
            className="storage-action-btn storage-action-btn-warning"
            onClick={() => handleClearCache('downloads')}
            disabled={clearingCache || loading}
            aria-label="清理下载文件"
          >
            <Trash2 className="storage-action-icon" />
            <span className="storage-action-text">清理下载文件</span>
          </button>
          
          <button 
            className="storage-action-btn storage-action-btn-danger"
            onClick={() => handleClearCache('all')}
            disabled={clearingCache || loading}
            aria-label="清理所有缓存"
          >
            <AlertCircle className="storage-action-icon" />
            <span className="storage-action-text">清理所有缓存</span>
          </button>
        </div>
      </div>

      {/* 数据备份 */}
      <div className="storage-section">
        <h3 className="storage-section-title">数据备份</h3>
        
        <div className="storage-actions-grid">
          <button 
            className="storage-action-btn storage-action-btn-primary"
            onClick={handleExport}
            disabled={loading}
            aria-label="导出设置"
          >
            <Download className="storage-action-icon" />
            <span className="storage-action-text">导出设置</span>
          </button>
          
          <button 
            className="storage-action-btn storage-action-btn-primary"
            onClick={handleImport}
            disabled={loading}
            aria-label="导入设置"
          >
            <Upload className="storage-action-icon" />
            <span className="storage-action-text">导入设置</span>
          </button>

          <button 
            className="storage-action-btn storage-action-btn-secondary"
            onClick={handleReset}
            disabled={loading}
            aria-label="重置存储设置"
          >
            <RefreshCw className="storage-action-icon" />
            <span className="storage-action-text">重置存储设置</span>
          </button>
        </div>
      </div>

      {/* 导出设置对话框 */}
      {showExport && (
        <div 
          className="settings-modal-overlay"
          onClick={() => setShowExport(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-settings-title"
        >
          <div 
            className="settings-modal-panel settings-modal-panel-large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-modal-header">
              <h3 id="export-settings-title" className="settings-modal-title">导出的设置</h3>
            </div>
            <div className="settings-modal-body">
              <textarea
                value={exportData}
                readOnly
                className="settings-modal-textarea"
                aria-label="导出的设置内容"
              />
            </div>
            <div className="settings-modal-footer">
              <button
                className="settings-modal-button settings-modal-button-cancel"
                onClick={() => setShowExport(false)}
                aria-label="关闭导出设置"
              >
                关闭
              </button>
              <button
                className="settings-modal-button settings-modal-button-confirm"
                onClick={handleDownloadExport}
                aria-label="下载导出文件"
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