import { useEffect, useState, useCallback } from 'react'
import { useSettingsStore } from '../../stores/settings'
import { 
  Database, 
  Trash2, 
  Upload, 
  Download, 
  RefreshCw, 
  HardDrive, 
  Folder, 
  CheckSquare2, 
  AlertCircle,
  FolderOpen,
  FileVideo,
  Settings as SettingsIcon,
  Zap,
  Check
} from 'lucide-react'

interface CacheInfo {
  exists: boolean
  path: string
  size: number
  size_formatted: string
  file_count: number
}

interface CacheData {
  [key: string]: CacheInfo
}

export default function StorageSettings() {
  const { settings, loading, error, updateSettings, resetSettings, exportSettings, importSettings } = useSettingsStore()
  const [cacheData, setCacheData] = useState<CacheData>({})
  const [storageInfo, setStorageInfo] = useState({
    totalSizeFormatted: '0 B',
    fileCount: 0,
    directoryCount: 0
  })
  const [clearingCache, setClearingCache] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  })
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set())

  useEffect(() => {
    useSettingsStore.getState().fetchSettings()
    fetchStorageInfo()
    fetchCacheInfo()
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

  const fetchCacheInfo = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/settings/cache-info')
      const data = await response.json()
      
      if (data.success && data.data) {
        setCacheData(data.data)
      }
    } catch (error) {
      console.error('获取缓存信息失败:', error)
    }
  }

  const handleClearCache = async (cacheType: string) => {
    const confirmMessages = {
      downloads: '确定要清理所有下载文件吗？此操作不可恢复！',
      log: '确定要清理日志缓存吗？',
      temp: '确定要清理临时缓存吗？',
      webview: '确定要清理WebView缓存吗？',
      database: '确定要清理数据库缓存吗？',
      all: '确定要清理所有缓存吗？此操作不可恢复！'
    }
    
    if (!confirm(confirmMessages[cacheType as keyof typeof confirmMessages] || '确定要清理此缓存吗？')) {
      return
    }
    
    setClearingCache(cacheType)
    try {
      const response = await fetch(`http://localhost:8000/api/settings/clear-cache/${cacheType}`, {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        alert(data.message || '清理成功')
        // 重新获取存储和缓存信息
        fetchStorageInfo()
        fetchCacheInfo()
      } else {
        alert('清理失败: ' + (data.message || 'Unknown error'))
      }
    } catch (error) {
      alert('清理失败: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setClearingCache(null)
    }
  }

  const handleOpenCache = async (cacheType: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/settings/open-cache/${cacheType}`, {
        method: 'POST'
      })
      const data = await response.json()
      
      if (!data.success) {
        alert('打开缓存目录失败: ' + (data.message || 'Unknown error'))
      }
    } catch (error) {
      alert('打开缓存目录失败: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleExportDatabase = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/settings/database/export')
      const data = await response.json()
      
      if (data.success) {
        alert(`数据库导出成功: ${data.filename}`)
        // 重新获取缓存信息
        fetchCacheInfo()
      } else {
        alert('导出失败: ' + (data.message || 'Unknown error'))
      }
    } catch (error) {
      alert('导出失败: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleImportDatabase = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.db'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        if (!confirm(`确定要导入数据库文件 "${file.name}" 吗？\n\n此操作将替换当前数据库，建议先备份！`)) {
          return
        }
        
        try {
          const formData = new FormData()
          formData.append('file', file)
          
          // 由于需要上传文件，这里需要修改API或使用文件路径
          alert('请选择数据库文件所在路径，然后使用文件路径导入功能')
          
          // 临时方案：提示用户使用文件路径
          const filePath = prompt('请输入数据库文件的完整路径：')
          if (filePath) {
            const response = await fetch(`http://localhost:8000/api/settings/database/import?file_path=${encodeURIComponent(filePath)}`, {
              method: 'POST'
            })
            const data = await response.json()
            
            if (data.success) {
              alert('导入成功: ' + (data.backup_path ? `已备份到 ${data.backup_path}` : ''))
              // 重新获取缓存信息
              fetchCacheInfo()
            } else {
              alert('导入失败: ' + (data.message || 'Unknown error'))
            }
          }
        } catch (error) {
          alert('导入失败: ' + (error instanceof Error ? error.message : 'Unknown error'))
        }
      }
    }
    input.click()
  }

  if (!settings) {
    return (
      <div className="storage-loading-state">
        <p className="storage-loading-text">加载中...</p>
      </div>
    )
  }

  // Debounce函数：延迟执行，避免频繁保存
  const debounce = useCallback((func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout
    return (...args: any[]) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => func(...args), delay)
    }
  }, [])

  // 显示保存消息
  const showSaveMessage = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setSaveMessage({ show: true, message, type })
    setTimeout(() => setSaveMessage({ show: false, message: '', type: 'success' }), 2000)
  }, [])

  // 处理设置更新（带debounce）
  const handleUpdate = useCallback(debounce(async (field: string, value: any) => {
    setSavingFields(prev => new Set(prev).add(field))
    try {
      const currentSettings = useSettingsStore.getState().settings
      if (!currentSettings?.storage) {
        throw new Error('Settings not loaded')
      }
      await updateSettings({
        storage: {
          ...currentSettings.storage,
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
  }, 1000), [updateSettings, showSaveMessage])

  // 处理sidecar更新（带debounce）
  const handleUpdateSidecar = useCallback(debounce(async (tool: string, value: string) => {
    setSavingFields(prev => new Set(prev).add(`sidecar_${tool}`))
    try {
      const sidecar = settings.storage.sidecar || {}
      await updateSettings({
        storage: {
          sidecar: {
            ...sidecar,
            [tool]: value,
          },
        },
      })
      showSaveMessage('设置已保存', 'success')
    } catch (error) {
      showSaveMessage('保存失败', 'error')
      console.error('更新sidecar失败:', error)
    } finally {
      setSavingFields(prev => {
        const newSet = new Set(prev)
        newSet.delete(`sidecar_${tool}`)
        return newSet
      })
    }
  }, 1000), [settings, updateSettings, debounce, showSaveMessage])

  const handleReset = async () => {
    if (confirm('确定要重置存储设置吗？')) {
      await resetSettings('storage')
    }
  }

  return (
    <div className="storage-settings-new">
      {/* 保存成功提示 */}
      {saveMessage.show && (
        <div className={`save-message save-message-${saveMessage.type}`}>
          {saveMessage.type === 'success' ? (
            <Check className="save-message-icon" />
          ) : (
            <AlertCircle className="save-message-icon" />
          )}
          <span className="save-message-text">{saveMessage.message}</span>
        </div>
      )}
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

      {/* 路径设置 */}
      <div className="storage-section">
        <h3 className="storage-section-title">路径设置</h3>
        <p className="storage-section-desc">
          "临时文件"存储未下载完毕的文件，经过处理后转移至"输出文件"。
        </p>
        
        <div className="storage-form-item">
          <label className="storage-form-label" htmlFor="download-path-input">
            <Folder className="storage-form-icon" />
            <span className="storage-form-text">下载路径</span>
            {savingFields.has('download_path') && (
              <RefreshCw className="storage-form-saving storage-form-saving-spin" />
            )}
          </label>
          <input
            id="download-path-input"
            type="text"
            className={`storage-form-input ${savingFields.has('download_path') ? 'storage-form-input-saving' : ''}`}
            value={settings.storage.download_path || './downloads'}
            onChange={(e) => handleUpdate('download_path', e.target.value)}
            disabled={loading}
            placeholder="./downloads"
            aria-label="输入下载路径"
          />
        </div>

        <div className="storage-form-item">
          <label className="storage-form-label" htmlFor="temp-path-input">
            <Database className="storage-form-icon" />
            <span className="storage-form-text">临时文件路径</span>
            {savingFields.has('temp_path') && (
              <RefreshCw className="storage-form-saving storage-form-saving-spin" />
            )}
          </label>
          <input
            id="temp-path-input"
            type="text"
            className={`storage-form-input ${savingFields.has('temp_path') ? 'storage-form-input-saving' : ''}`}
            value={settings.storage.temp_path || './temp'}
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

      {/* 自定义执行路径 */}
      <div className="storage-section">
        <h3 className="storage-section-title">自定义执行路径</h3>
        <p className="storage-section-desc">
          此处可以自定义各 Sidecar 的执行路径，请注意权限等问题。重启后生效。
        </p>
        
        <div className="storage-form-item">
          <label className="storage-form-label" htmlFor="ffmpeg-path-input">
            <FileVideo className="storage-form-icon" />
            <span className="storage-form-text">FFmpeg 路径</span>
            {savingFields.has('sidecar_ffmpeg') && (
              <RefreshCw className="storage-form-saving storage-form-saving-spin" />
            )}
          </label>
          <input
            id="ffmpeg-path-input"
            type="text"
            className={`storage-form-input ${savingFields.has('sidecar_ffmpeg') ? 'storage-form-input-saving' : ''}`}
            value={settings.storage.sidecar?.ffmpeg || 'ffmpeg'}
            onChange={(e) => handleUpdateSidecar('ffmpeg', e.target.value)}
            disabled={loading}
            placeholder="ffmpeg"
            aria-label="输入FFmpeg路径"
          />
        </div>

        <div className="storage-form-item">
          <label className="storage-form-label" htmlFor="aria2c-path-input">
            <Zap className="storage-form-icon" />
            <span className="storage-form-text">Aria2c 路径</span>
            {savingFields.has('sidecar_aria2c') && (
              <RefreshCw className="storage-form-saving storage-form-saving-spin" />
            )}
          </label>
          <input
            id="aria2c-path-input"
            type="text"
            className={`storage-form-input ${savingFields.has('sidecar_aria2c') ? 'storage-form-input-saving' : ''}`}
            value={settings.storage.sidecar?.aria2c || 'aria2c'}
            onChange={(e) => handleUpdateSidecar('aria2c', e.target.value)}
            disabled={loading}
            placeholder="aria2c"
            aria-label="输入Aria2c路径"
          />
        </div>

        <div className="storage-form-item">
          <label className="storage-form-label" htmlFor="danmakufactory-path-input">
            <SettingsIcon className="storage-form-icon" />
            <span className="storage-form-text">Danmakufactory 路径</span>
            {savingFields.has('sidecar_danmakufactory') && (
              <RefreshCw className="storage-form-saving storage-form-saving-spin" />
            )}
          </label>
          <input
            id="danmakufactory-path-input"
            type="text"
            className={`storage-form-input ${savingFields.has('sidecar_danmakufactory') ? 'storage-form-input-saving' : ''}`}
            value={settings.storage.sidecar?.danmakufactory || 'danmakufactory'}
            onChange={(e) => handleUpdateSidecar('danmakufactory', e.target.value)}
            disabled={loading}
            placeholder="danmakufactory"
            aria-label="输入Danmakufactory路径"
          />
        </div>
      </div>

      {/* 缓存管理 */}
      <div className="storage-section">
        <h3 className="storage-section-title">缓存</h3>
        <p className="storage-section-desc">
          数据库存储配置、登录信息、下载记录等数据。
        </p>
        
        <div className="cache-items-grid">
          {['log', 'temp', 'webview', 'database'].map((cacheType) => {
            const cacheInfo = cacheData[cacheType] || { size_formatted: '0 B', file_count: 0, exists: false }
            const cacheLabels = {
              log: '日志缓存',
              temp: '临时缓存',
              webview: 'WebView缓存',
              database: '数据库缓存'
            }
            
            return (
              <div key={cacheType} className="cache-item-card">
                <div className="cache-item-header">
                  <Database className="cache-item-icon" />
                  <div className="cache-item-info">
                    <span className="cache-item-name">{cacheLabels[cacheType as keyof typeof cacheLabels]}</span>
                    <span className="cache-item-size">{cacheInfo.size_formatted}</span>
                  </div>
                </div>
                <div className="cache-item-stats">
                  <span className="cache-item-file-count">{cacheInfo.file_count} 个文件</span>
                </div>
                <div className="cache-item-actions">
                  <button
                    className="cache-item-btn cache-item-btn-secondary"
                    onClick={() => handleOpenCache(cacheType)}
                    disabled={loading}
                    aria-label={`打开${cacheLabels[cacheType as keyof typeof cacheLabels]}目录`}
                  >
                    <FolderOpen className="cache-item-btn-icon" />
                    <span className="cache-item-btn-text">打开目录</span>
                  </button>
                  <button
                    className="cache-item-btn cache-item-btn-warning"
                    onClick={() => handleClearCache(cacheType)}
                    disabled={clearingCache === cacheType || loading}
                    aria-label={`清理${cacheLabels[cacheType as keyof typeof cacheLabels]}`}
                  >
                    {clearingCache === cacheType ? (
                      <RefreshCw className="cache-item-btn-icon cache-item-btn-icon-spinning" />
                    ) : (
                      <Trash2 className="cache-item-btn-icon" />
                    )}
                    <span className="cache-item-btn-text">清理</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="cache-actions">
          <button
            className="storage-action-btn storage-action-btn-danger"
            onClick={() => handleClearCache('all')}
            disabled={clearingCache === 'all' || loading}
            aria-label="清理所有缓存"
          >
            <AlertCircle className="storage-action-icon" />
            <span className="storage-action-text">清理所有缓存</span>
          </button>
        </div>
      </div>

      {/* 数据库管理 */}
      <div className="storage-section">
        <h3 className="storage-section-title">数据库管理</h3>
        <p className="storage-section-desc">
          管理数据库文件，包括备份和恢复功能。
        </p>
        
        <div className="storage-actions-grid">
          <button
            className="storage-action-btn storage-action-btn-primary"
            onClick={handleExportDatabase}
            disabled={loading}
            aria-label="导出数据库"
          >
            <Download className="storage-action-icon" />
            <span className="storage-action-text">导出数据库</span>
          </button>
          
          <button
            className="storage-action-btn storage-action-btn-primary"
            onClick={handleImportDatabase}
            disabled={loading}
            aria-label="导入数据库"
          >
            <Upload className="storage-action-icon" />
            <span className="storage-action-text">导入数据库</span>
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
    </div>
  )
}