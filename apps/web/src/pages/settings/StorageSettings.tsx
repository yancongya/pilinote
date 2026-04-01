import { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useSettingsStore } from '../../stores/settings'
import { 
  Database, 
  Trash2, 
  HardDrive, 
  Folder, 
  CheckSquare2, 
  AlertCircle,
  FileVideo,
  Settings as SettingsIcon,
  Zap,
  Check,
  ChevronRight
} from 'lucide-react'
import { ConfirmModal } from '../../components/Modal'

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
  const [showClearConfirm, setShowClearConfirm] = useState<{ show: boolean; type: string; message: string }>({
    show: false,
    type: '',
    message: ''
  })

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
        setSavedStatus('idle')
        return
      }

      setSavedStatus('saving')

      try {
        const updates: any = {}
        
        if (pathFieldsHaveChanges) {
          pathFields.forEach(field => {
            if (field in localSettings) {
              updates[field] = localSettings[field]
            }
          })
        }
        
        if (sidecarHasChanges) {
          updates.sidecar = localSettings.sidecar
        }
        
        await updateSettings({
          storage: {
            ...(settings?.storage || {}),
            ...updates
          }
        })
        
        setSavedStatus('saved')
        showSaveMessage('设置已保存', 'success')
        
        const newLocalSettings = { ...localSettings }
        pathFields.forEach(field => delete newLocalSettings[field])
        delete (newLocalSettings as any).sidecar
        setLocalSettings(newLocalSettings)
        
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
    loadStorageInfo()
    loadCacheData()
  }, [])

  const loadStorageInfo = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/settings/storage-info')
      if (response.ok) {
        const data = await response.json()
        setStorageInfo({
          totalSizeFormatted: data.total_size_formatted || '0 B',
          fileCount: data.file_count || 0,
          directoryCount: data.directory_count || 0
        })
      }
    } catch (error) {
      console.error('加载存储信息失败:', error)
    }
  }

  const loadCacheData = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/settings/cache-info')
      if (response.ok) {
        const data = await response.json()
        setCacheData(data.cache || {})
      }
    } catch (error) {
      console.error('加载缓存数据失败:', error)
    }
  }

  const showSaveMessage = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setSaveMessage({ show: true, message, type })
    setTimeout(() => setSaveMessage({ show: false, message: '', type: 'success' }), 2000)
  }, [])

  const handleLocalUpdate = useCallback((field: string, value: any) => {
    setLocalSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }, [])

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
      temp: '确定要清理所有临时文件吗？此操作不可恢复！',
      database: '确定要清理缓存数据吗？此操作不可恢复！'
    }
    
    setShowClearConfirm({
      show: true,
      type: cacheType,
      message: confirmMessages[cacheType as keyof typeof confirmMessages] || '确定要清理吗？'
    })
  }

  const confirmClearCache = async () => {
    const cacheType = showClearConfirm.type
    setClearingCache(cacheType)
    try {
      const response = await fetch(`http://localhost:8000/api/settings/clear-cache/${cacheType}`, {
        method: 'POST'
      })
      if (response.ok) {
        showSaveMessage('清理成功', 'success')
        await loadCacheData()
        await loadStorageInfo()
      } else {
        showSaveMessage('清理失败', 'error')
      }
    } catch (error) {
      showSaveMessage('清理失败', 'error')
      console.error('清理缓存失败:', error)
    } finally {
      setClearingCache(null)
      setShowClearConfirm({ show: false, type: '', message: '' })
    }
  }

  if (!settings) {
    return (
      <div className="storage-loading">
        <Database className="storage-loading-spinner" />
        <p>加载中...</p>
      </div>
    )
  }

  return (
    <div className="storage-settings-mobile">
      {/* 保存提示消息 */}
      {saveMessage.show && (
        <div className={`storage-toast storage-toast-${saveMessage.type}`}>
          {saveMessage.type === 'success' ? (
            <Check className="storage-toast-icon" />
          ) : (
            <AlertCircle className="storage-toast-icon" />
          )}
          <span>{saveMessage.message}</span>
        </div>
      )}

      {/* 存储概览 - 紧凑卡片 */}
      <div className="storage-summary">
        <div className="storage-summary-item">
          <div className="storage-summary-item-header">
            <HardDrive size={18} className="storage-summary-item-icon" />
            <span className="storage-summary-item-label">占用空间</span>
          </div>
          <div className="storage-summary-item-value">{storageInfo.totalSizeFormatted}</div>
        </div>
        <div className="storage-summary-item">
          <div className="storage-summary-item-header">
            <Folder size={18} className="storage-summary-item-icon" />
            <span className="storage-summary-item-label">文件数量</span>
          </div>
          <div className="storage-summary-item-value">{storageInfo.fileCount}</div>
        </div>
        <div className="storage-summary-item">
          <div className="storage-summary-item-header">
            <CheckSquare2 size={18} className="storage-summary-item-icon" />
            <span className="storage-summary-item-label">视频数量</span>
          </div>
          <div className="storage-summary-item-value">{storageInfo.directoryCount}</div>
        </div>
      </div>

      {/* 路径设置组 */}
      <div className="storage-group">
        <div className="storage-group-header">
          <span className="storage-group-title">路径设置</span>
          <span className="storage-group-subtitle">下载和临时文件位置</span>
        </div>
        
        <div className="storage-list">
          {/* 下载路径 */}
          <div className="storage-list-item storage-list-item-input">
            <div className="storage-list-label-row">
              <Folder size={18} className="storage-list-icon" />
              <span className="storage-list-label">下载路径</span>
            </div>
            <input
              type="text"
              className="storage-list-input"
              value={String(getCurrentValue('download_path') || './downloads')}
              onChange={(e) => handleLocalUpdate('download_path', e.target.value)}
              disabled={loading}
              placeholder="./downloads"
              aria-label="输入下载路径"
            />
          </div>

          {/* 临时路径 */}
          <div className="storage-list-item storage-list-item-input">
            <div className="storage-list-label-row">
              <Database size={18} className="storage-list-icon" />
              <span className="storage-list-label">临时路径</span>
            </div>
            <input
              type="text"
              className="storage-list-input"
              value={String(getCurrentValue('temp_path') || './temp')}
              onChange={(e) => handleLocalUpdate('temp_path', e.target.value)}
              disabled={loading}
              placeholder="./temp"
              aria-label="输入临时文件路径"
            />
          </div>
        </div>

        {/* 开关选项 */}
        <div className="storage-toggles">
          <label className="storage-toggle-item">
            <div className="storage-toggle-content">
              <span className="storage-toggle-label">自动清理临时文件</span>
            </div>
            <input
              type="checkbox"
              className="storage-toggle-input"
              checked={getCurrentValue('auto_cleanup') as boolean || false}
              onChange={(e) => handleLocalUpdate('auto_cleanup', e.target.checked)}
              disabled={loading}
              aria-label="自动清理临时文件"
            />
          </label>

          <label className="storage-toggle-item">
            <div className="storage-toggle-content">
              <span className="storage-toggle-label">保留失败的任务</span>
            </div>
            <input
              type="checkbox"
              className="storage-toggle-input"
              checked={getCurrentValue('keep_failed') as boolean || false}
              onChange={(e) => handleLocalUpdate('keep_failed', e.target.checked)}
              disabled={loading}
              aria-label="保留失败的任务"
            />
          </label>
        </div>
      </div>

      {/* 工具路径组 */}
      <div className="storage-group">
        <div className="storage-group-header">
          <span className="storage-group-title">工具路径</span>
          <span className="storage-group-subtitle">自定义执行路径</span>
        </div>
        
        <div className="storage-list">
          <div className="storage-list-item storage-list-item-input">
            <div className="storage-list-label-row">
              <FileVideo size={18} className="storage-list-icon" />
              <span className="storage-list-label">FFmpeg</span>
            </div>
            <input
              type="text"
              className="storage-list-input"
              value={getCurrentValue('sidecar')?.ffmpeg || 'ffmpeg'}
              onChange={(e) => handleLocalUpdateSidecar('ffmpeg', e.target.value)}
              disabled={loading}
              placeholder="ffmpeg"
              aria-label="输入FFmpeg路径"
            />
          </div>

          <div className="storage-list-item storage-list-item-input">
            <div className="storage-list-label-row">
              <Zap size={18} className="storage-list-icon" />
              <span className="storage-list-label">Aria2c</span>
            </div>
            <input
              type="text"
              className="storage-list-input"
              value={getCurrentValue('sidecar')?.aria2c || 'aria2c'}
              onChange={(e) => handleLocalUpdateSidecar('aria2c', e.target.value)}
              disabled={loading}
              placeholder="aria2c"
              aria-label="输入Aria2c路径"
            />
          </div>

          <div className="storage-list-item storage-list-item-input">
            <div className="storage-list-label-row">
              <SettingsIcon size={18} className="storage-list-icon" />
              <span className="storage-list-label">Danmakufactory</span>
            </div>
            <input
              type="text"
              className="storage-list-input"
              value={getCurrentValue('sidecar')?.danmakufactory || 'danmakufactory'}
              onChange={(e) => handleLocalUpdateSidecar('danmakufactory', e.target.value)}
              disabled={loading}
              placeholder="danmakufactory"
              aria-label="输入Danmakufactory路径"
            />
          </div>
        </div>
      </div>

      {/* 缓存管理组 */}
      <div className="storage-group">
        <div className="storage-group-header">
          <span className="storage-group-title">缓存管理</span>
          <span className="storage-group-subtitle">清理不必要的文件</span>
        </div>
        
        <div className="storage-list">
          <button
            className="storage-list-item storage-list-button"
            onClick={() => handleClearCache('downloads')}
            disabled={clearingCache === 'downloads'}
            aria-label="清理下载文件"
          >
            <div className="storage-list-icon-wrapper">
              <Trash2 size={18} className="storage-list-icon" />
            </div>
            <div className="storage-list-content">
              <div className="storage-list-label">清理下载文件</div>
              <div className="storage-list-meta">
                {cacheData.downloads?.size_formatted || '0 B'}
              </div>
            </div>
            <ChevronRight size={16} className="storage-list-chevron" />
          </button>

          <button
            className="storage-list-item storage-list-button"
            onClick={() => handleClearCache('temp')}
            disabled={clearingCache === 'temp'}
            aria-label="清理临时文件"
          >
            <div className="storage-list-icon-wrapper">
              <Trash2 size={18} className="storage-list-icon" />
            </div>
            <div className="storage-list-content">
              <div className="storage-list-label">清理临时文件</div>
              <div className="storage-list-meta">
                {cacheData.temp?.size_formatted || '0 B'}
              </div>
            </div>
            <ChevronRight size={16} className="storage-list-chevron" />
          </button>

          <button
            className="storage-list-item storage-list-button"
            onClick={() => handleClearCache('database')}
            disabled={clearingCache === 'database'}
            aria-label="清理缓存数据"
          >
            <div className="storage-list-icon-wrapper">
              <Trash2 size={18} className="storage-list-icon" />
            </div>
            <div className="storage-list-content">
              <div className="storage-list-label">清理缓存数据</div>
              <div className="storage-list-meta">
                {cacheData.database?.size_formatted || '0 B'}
              </div>
            </div>
            <ChevronRight size={16} className="storage-list-chevron" />
          </button>
        </div>
      </div>

      <style>{`
        .storage-settings-mobile {
          padding: 12px;
          background: #F8FAFC;
          min-height: 100vh;
        }

        /* Toast */
        .storage-toast {
          position: fixed;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          padding: 10px 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
          z-index: 1000;
          animation: toast-slide-down 0.2s ease-out;
        }

        .storage-toast-success {
          background: #10B981;
          color: white;
        }

        .storage-toast-error {
          background: #EF4444;
          color: white;
        }

        @keyframes toast-slide-down {
          from {
            transform: translateX(-50%) translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }

        /* 存储概览卡片 */
        .storage-summary {
          background: white;
          border-radius: 12px;
          padding: 12px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 16px;
          border: 1px solid #E2E8F0;
        }

        .storage-summary-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 10px 8px;
        }

        .storage-summary-item-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
        }

        .storage-summary-item-icon {
          color: #2563EB;
          flex-shrink: 0;
        }

        .storage-summary-item-label {
          font-size: 13px;
          font-weight: 500;
          color: #64748B;
        }

        .storage-summary-item-value {
          font-size: 18px;
          font-weight: 600;
          color: #1E293B;
          line-height: 1.2;
        }

        /* 分组 */
        .storage-group {
          background: white;
          border-radius: 12px;
          border: 1px solid #E2E8F0;
          margin-bottom: 12px;
          overflow: hidden;
        }

        .storage-group-header {
          padding: 12px 16px;
          background: #F8FAFC;
          border-bottom: 1px solid #E2E8F0;
        }

        .storage-group-title {
          font-size: 15px;
          font-weight: 600;
          color: #1E293B;
          display: block;
        }

        .storage-group-subtitle {
          font-size: 12px;
          color: #64748B;
          margin-top: 2px;
          display: block;
        }

        /* 列表 */
        .storage-list {
          display: flex;
          flex-direction: column;
        }

        .storage-list-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          min-height: 56px;
          border-bottom: 1px solid #F1F5F9;
        }

        .storage-list-item-input {
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }

        .storage-list-item:last-child {
          border-bottom: none;
        }

        .storage-list-icon {
          color: #64748B;
          flex-shrink: 0;
        }

        .storage-list-content {
          flex: 1;
          min-width: 0;
        }

        .storage-list-label-row {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .storage-list-label {
          font-size: 15px;
          font-weight: 500;
          color: #1E293B;
          margin-bottom: 4px;
        }

        .storage-list-item-input .storage-list-label {
          margin-bottom: 0;
        }

        .storage-list-input {
          width: 100%;
          padding: 8px 12px;
          font-size: 14px;
          border: 1px solid #E2E8F0;
          border-radius: 6px;
          background: #F8FAFC;
          color: #1E293B;
          outline: none;
          transition: all 0.15s ease;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .storage-list-input:focus {
          border-color: #2563EB;
          background: white;
        }

        .storage-list-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .storage-list-meta {
          font-size: 13px;
          color: #64748B;
        }

        /* 按钮 */
        .storage-list-button {
          width: 100%;
          text-align: left;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: background-color 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .storage-list-button:active {
          background-color: #F1F5F9;
        }

        .storage-list-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .storage-list-icon-wrapper {
          width: 36px;
          height: 36px;
          background: #FEF3C7;
          color: #F59E0B;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .storage-list-chevron {
          color: #CBD5E1;
          flex-shrink: 0;
        }

        /* 开关 */
        .storage-toggles {
          padding: 8px 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .storage-toggle-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 0;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          gap: 12px;
        }

        .storage-toggle-content {
          flex: 1;
        }

        .storage-toggle-label {
          font-size: 15px;
          font-weight: 500;
          color: #1E293B;
        }

        .storage-toggle-input {
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

        .storage-toggle-input:checked {
          background: #2563EB;
        }

        .storage-toggle-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .storage-toggle-input::before {
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

        .storage-toggle-input:checked::before {
          transform: translateX(20px);
        }

        /* Loading */
        .storage-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 16px;
          color: #64748B;
        }

        .storage-loading-spinner {
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          color: #2563EB;
          margin-bottom: 12px;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .storage-loading p {
          font-size: 14px;
          color: #64748B;
        }
      `}</style>

      {/* 清理缓存确认弹窗 */}
      <ConfirmModal
        isOpen={showClearConfirm.show}
        onClose={() => setShowClearConfirm({ show: false, type: '', message: '' })}
        onConfirm={confirmClearCache}
        title="确认清理缓存"
        message={showClearConfirm.message}
        confirmText="确定清理"
        cancelText="取消"
        confirmVariant="danger"
        loading={clearingCache === showClearConfirm.type}
      />
    </div>
  )
})

export default StorageSettings