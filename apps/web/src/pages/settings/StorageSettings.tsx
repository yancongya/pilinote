import { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
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

// 定义ref类型
interface StorageSettingsRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

const StorageSettings = forwardRef<StorageSettingsRef>((_props, ref) => {
  const { settings, loading, updateSettings, resetSettings } = useSettingsStore()
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
  
  // 本地状态暂存修改
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({})
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => {
      const pathFields = ['download_path', 'temp_path', 'auto_cleanup', 'keep_failed']
      const pathFieldsHaveChanges = pathFields.some(field => field in localSettings)
      const sidecarHasChanges = (localSettings.sidecar as any) && Object.keys(localSettings.sidecar).length > 0
      return pathFieldsHaveChanges || sidecarHasChanges
    },
    saveSettings: async () => {
      const pathFields = ['download_path', 'temp_path', 'auto_cleanup', 'keep_failed']
      const pathFieldsHaveChanges = pathFields.some(field => field in localSettings)
      const sidecarHasChanges = (localSettings.sidecar as any) && Object.keys(localSettings.sidecar).length > 0
      
      if (!pathFieldsHaveChanges && !sidecarHasChanges) {
        throw new Error('没有需要保存的修改')
      }

      setSavedStatus('saving')

      try {
        const updates: any = {}
        
        // 保存路径设置
        if (pathFieldsHaveChanges) {
          pathFields.forEach(field => {
            if (field in localSettings) {
              updates[field] = localSettings[field]
            }
          })
        }
        
        // 保存sidecar设置
        if (sidecarHasChanges) {
          updates.sidecar = localSettings.sidecar
        }
        
        // 合并现有的 storage 设置
        await updateSettings({
          storage: {
            ...(settings?.storage || {}),
            ...updates
          }
        })
        
        setSavedStatus('saved')
        showSaveMessage('设置已保存', 'success')
        
        // 清除已保存的字段
        const newLocalSettings = { ...localSettings }
        pathFields.forEach(field => delete newLocalSettings[field])
        delete (newLocalSettings as any).sidecar
        setLocalSettings(newLocalSettings)
        
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

  // 显示保存消息
  const showSaveMessage = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setSaveMessage({ show: true, message, type })
    setTimeout(() => setSaveMessage({ show: false, message: '', type: 'success' }), 2000)
  }, [])

  // 本地更新函数（不立即保存）
  const handleLocalUpdate = useCallback((field: string, value: any) => {
    setLocalSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }, [])

  // 本地更新 sidecar
  const handleLocalUpdateSidecar = useCallback((tool: string, value: string) => {
    setLocalSettings(prev => {
      const sidecar = (prev as any).sidecar || {}
      return {
        ...prev,
        sidecar: {
          ...sidecar,
          [tool]: value
        }
      }
    })
  }, [])

  // 获取当前设置值（优先使用本地暂存的值）
  const getCurrentValue = useCallback((field: string) => {
    if (!settings?.storage) return undefined
    if (field in localSettings) {
      return (localSettings as any)[field]
    }
    return (settings.storage as any)[field]
  }, [localSettings, settings])

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

  const handleReset = async () => {
    if (confirm('确定要重置存储设置吗？')) {
      await resetSettings('storage')
      setLocalSettings({})
    }
  }

  return (
    <div className="storage-settings-new">
      <style>{`
        .storage-section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
          position: relative;
        }
        
        .storage-section-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .storage-section-save-btn {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 4px 8px;
          background: transparent;
          color: #6b7280;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .storage-section-save-btn:hover:not(:disabled) {
          color: #2563eb;
          background: #eff6ff;
        }
        
        .storage-section-save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .storage-section-save-btn.has-changes {
          color: #f59e0b;
        }
        
        .storage-section-save-btn.has-changes:hover:not(:disabled) {
          color: #d97706;
          background: #fef3c7;
        }
        
        .storage-section-save-btn-icon {
          width: 14px;
          height: 14px;
        }
        
        .storage-section-save-btn-icon.spinning {
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
        
        .storage-unsaved-indicator {
          display: inline-block;
          margin-left: 4px;
          color: #f59e0b;
          font-size: 14px;
          font-weight: bold;
        }
        
        .storage-saving-indicator {
          display: inline-block;
          margin-left: 4px;
          color: #2563eb;
          font-size: 12px;
          font-weight: 500;
        }
        
        .storage-saved-indicator {
          display: inline-block;
          margin-left: 4px;
          color: #10b981;
          font-size: 12px;
          font-weight: 500;
        }
      `}</style>
      
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
        <h3 className="storage-section-title">
          路径设置
        </h3>
        <p className="storage-section-desc">
          "临时文件"存储未下载完毕的文件，经过处理后转移至"输出文件"。
        </p>
        
        <div className="storage-form-item">
          <label className="storage-form-label" htmlFor="download-path-input">
            <Folder className="storage-form-icon" />
            <span className="storage-form-text">下载路径</span>
          </label>
          <input
            id="download-path-input"
            type="text"
            className="storage-form-input"
            value={String(getCurrentValue('download_path') || './downloads')}
            onChange={(e) => handleLocalUpdate('download_path', e.target.value)}
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
            value={String(getCurrentValue('temp_path') || './temp')}
            onChange={(e) => handleLocalUpdate('temp_path', e.target.value)}
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
              checked={getCurrentValue('auto_cleanup') as boolean || false}
              onChange={(e) => handleLocalUpdate('auto_cleanup', e.target.checked)}
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
              checked={getCurrentValue('keep_failed') as boolean || false}
              onChange={(e) => handleLocalUpdate('keep_failed', e.target.checked)}
              disabled={loading}
              aria-label="保留失败的任务"
            />
            <span className="storage-checkbox-text">保留失败的任务</span>
          </label>
        </div>
      </div>

      {/* 自定义执行路径 */}
      <div className="storage-section">
        <h3 className="storage-section-title">
          自定义执行路径
        </h3>
        <p className="storage-section-desc">
          此处可以自定义各 Sidecar 的执行路径，请注意权限等问题。重启后生效。
        </p>
        
        <div className="storage-form-item">
          <label className="storage-form-label" htmlFor="ffmpeg-path-input">
            <FileVideo className="storage-form-icon" />
            <span className="storage-form-text">FFmpeg 路径</span>
          </label>
          <input
            id="ffmpeg-path-input"
            type="text"
            className="storage-form-input"
            value={getCurrentValue('sidecar')?.ffmpeg || 'ffmpeg'}
            onChange={(e) => handleLocalUpdateSidecar('ffmpeg', e.target.value)}
            disabled={loading}
            placeholder="ffmpeg"
            aria-label="输入FFmpeg路径"
          />
        </div>

        <div className="storage-form-item">
          <label className="storage-form-label" htmlFor="aria2c-path-input">
            <Zap className="storage-form-icon" />
            <span className="storage-form-text">Aria2c 路径</span>
          </label>
          <input
            id="aria2c-path-input"
            type="text"
            className="storage-form-input"
            value={getCurrentValue('sidecar')?.aria2c || 'aria2c'}
            onChange={(e) => handleLocalUpdateSidecar('aria2c', e.target.value)}
            disabled={loading}
            placeholder="aria2c"
            aria-label="输入Aria2c路径"
          />
        </div>

        <div className="storage-form-item">
          <label className="storage-form-label" htmlFor="danmakufactory-path-input">
            <SettingsIcon className="storage-form-icon" />
            <span className="storage-form-text">Danmakufactory 路径</span>
          </label>
          <input
            id="danmakufactory-path-input"
            type="text"
            className="storage-form-input"
            value={getCurrentValue('sidecar')?.danmakufactory || 'danmakufactory'}
            onChange={(e) => handleLocalUpdateSidecar('danmakufactory', e.target.value)}
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
})

export default StorageSettings