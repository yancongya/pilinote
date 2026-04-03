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
  ChevronRight,
  RotateCcw,
  Download,
  Upload,
  Edit2
} from 'lucide-react'
import ConfirmModal from '../../components/ConfirmModal'
import { useToast } from '../../components/Toast'
import { apiService } from '../../services/api'

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
  const { showToast } = useToast()
  const [cacheData, setCacheData] = useState<CacheData>({})
  const [storageInfo, setStorageInfo] = useState({
    totalSizeFormatted: '0 B',
    fileCount: 0,
    directoryCount: 0
  })
  const [clearingCache, setClearingCache] = useState<string | null>(null)
  
  // 本地状态暂存修改
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({})
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showClearConfirm, setShowClearConfirm] = useState<{ show: boolean; type: string; message: string }>({
    show: false,
    type: '',
    message: ''
  })
  const [showEditModal, setShowEditModal] = useState<{ show: boolean; field: 'download_path' | 'temp_path' | null }>({
    show: false,
    field: null
  })
  const [editingPath, setEditingPath] = useState('')
  
  const [exportingDatabase, setExportingDatabase] = useState(false)
  const [importingDatabase, setImportingDatabase] = useState(false)

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
        
        const newLocalSettings = { ...localSettings }
        pathFields.forEach(field => delete newLocalSettings[field])
        delete (newLocalSettings as any).sidecar
        setLocalSettings(newLocalSettings)
        
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
        setCacheData(data.data || {})
        
        // 获取数据库文件大小
        const dbResponse = await fetch('http://localhost:8000/api/settings/database/info')
        if (dbResponse.ok) {
          const dbData = await dbResponse.json()
          setCacheData(prev => ({
            ...prev,
            database: {
              size: dbData.size || 0,
              size_formatted: dbData.size_formatted || '0 B',
              path: dbData.path || '',
              exists: dbData.exists || false
            }
          }))
        }
      }
    } catch (error) {
      console.error('加载缓存数据失败:', error)
    }
  }

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

  const handleResetToolPath = async (tool: string) => {
    try {
      // 获取工具状态API，获取默认路径
      const response = await fetch('http://localhost:8000/api/settings/tool-status')
      if (response.ok) {
        const data = await response.json()
        const toolStatus = data.data[tool]
        
        if (toolStatus && toolStatus.installed) {
          // 更新本地设置
          handleLocalUpdateSidecar(tool, toolStatus.path)
          showToast(`已重置 ${tool} 路径`, 'success')
          
          // 自动保存
          const sidecar = { ...((localSettings as any).sidecar || {}), [tool]: toolStatus.path }
          await updateSettings({
            storage: {
              ...(settings?.storage || {}),
              sidecar
            }
          })
          // 清空本地设置
          setLocalSettings({})
        } else {
          showToast(`${tool} 未安装，无法重置`, 'error')
        }
      }
    } catch (error) {
      console.error('重置工具路径失败:', error)
      showToast('重置失败', 'error')
    }
  }

  const getCurrentValue = useCallback((field: string) => {
    if (!settings?.storage) return undefined
    if (field in localSettings) {
      return (localSettings as any)[field]
    }
    return (settings.storage as any)[field]
  }, [localSettings, settings])

  const handleClearCache = async (cacheType: string) => {
    const confirmMessages = {
      log: '确定要清理所有日志文件吗？此操作不可恢复！',
      temp: '确定要清理所有临时文件吗？此操作不可恢复！',
      webview: '确定要清理WebView缓存吗？此操作不可恢复！'
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
        showToast('清理成功', 'success')
        await loadCacheData()
        await loadStorageInfo()
      } else {
        showToast('清理失败', 'error')
      }
    } catch (error) {
      showToast('清理失败', 'error')
      console.error('清理缓存失败:', error)
    } finally {
      setClearingCache(null)
      setShowClearConfirm({ show: false, type: '', message: '' })
    }
  }

  const handleExportDatabase = async () => {
    setExportingDatabase(true)
    try {
      const response = await fetch('http://localhost:8000/api/settings/database/export', {
        method: 'GET'
      })
      
      if (response.ok) {
        // 获取文件名
        const contentDisposition = response.headers.get('content-disposition')
        let filename = `pilinote_backup_${new Date().toISOString().slice(0,10)}.db`
        
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
          if (filenameMatch) {
            filename = filenameMatch[1]
          }
        }
        
        // 下载文件
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        showToast(`数据库导出成功: ${filename}`, 'success')
        await loadCacheData()
        await loadStorageInfo()
      } else {
        showToast('数据库导出失败', 'error')
      }
    } catch (error) {
      showToast('数据库导出失败', 'error')
      console.error('导出数据库失败:', error)
    } finally {
      setExportingDatabase(false)
    }
  }

  const handleImportDatabase = async () => {
    // 创建文件输入元素
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.db'
    
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (!file) return
      
      setImportingDatabase(true)
      try {
        // 使用FormData上传文件
        const formData = new FormData()
        formData.append('file', file)
        
        // 导入数据库
        const response = await fetch('http://localhost:8000/api/settings/database/import', {
          method: 'POST',
          body: formData
        })
        
        if (response.ok) {
          const data = await response.json()
          showToast('数据库导入成功', 'success')
          // 刷新页面以重新加载数据
          window.location.reload()
        } else {
          showToast('数据库导入失败', 'error')
        }
      } catch (error) {
        showToast('数据库导入失败', 'error')
        console.error('导入数据库失败:', error)
      } finally {
        setImportingDatabase(false)
      }
    }
    
    input.click()
  }

const handleSelectDirectory = (field: 'download_path' | 'temp_path') => {
    // 由于浏览器的安全限制，直接选择目录会触发文件上传器体验
    // 这里直接打开手动输入弹窗，提供更好的用户体验
    handleEditPath(field)
  }

  const handleDrop = (e: React.DragEvent, field: 'download_path' | 'temp_path') => {
    e.preventDefault()
    e.stopPropagation()
    
    try {
      const items = e.dataTransfer.items
      if (!items || items.length === 0) return
      
      const item = items[0]
      if (item.kind === 'file') {
        // 尝试使用 webkitGetAsEntry API（Chrome/Edge支持）
        const entry = item.webkitGetAsEntry?.()
        if (entry?.isDirectory) {
          // 由于浏览器安全限制，我们只能获取目录名
          // 建议用户使用手动输入来指定完整路径
          handleLocalUpdate(field, entry.name)
          showToast(`已设置目录: ${entry.name}（如需完整路径，请使用编辑按钮）`, 'success')
          return
        }
        
        // 备用方案：尝试从文件路径中提取目录名
        const files = e.dataTransfer.files
        if (files && files.length > 0) {
          const firstFile = files[0]
          const path = firstFile.webkitRelativePath || firstFile.name
          const directoryName = path.split('/')[0]
          
          if (directoryName && directoryName !== path) {
            handleLocalUpdate(field, directoryName)
            showToast(`已设置目录: ${directoryName}（如需完整路径，请使用编辑按钮）`, 'success')
            return
          }
        }
        
        showToast('请拖拽目录，而不是文件', 'error')
      }
    } catch (error) {
      console.error('拖拽处理失败:', error)
      showToast('拖拽功能不可用，请使用手动输入', 'error')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleEditPath = (field: 'download_path' | 'temp_path') => {
    setEditingPath(getCurrentValue(field) || '')
    setShowEditModal({ show: true, field })
  }

  const saveEditedPath = () => {
    if (showEditModal.field) {
      handleLocalUpdate(showEditModal.field, editingPath)
      setShowEditModal({ show: false, field: null })
      setEditingPath('')
      showToast('路径已保存', 'success')
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
      {/* 路径设置组 */}
      <div className="storage-group">
        <div className="storage-group-header">
          <span className="storage-group-title">路径设置</span>
          <span className="storage-group-subtitle">手动输入或拖拽目录设置</span>
        </div>
        
        <div className="storage-list">
          {/* 下载路径 */}
          <div 
            className="storage-list-item storage-list-item-input"
            onDrop={(e) => handleDrop(e, 'download_path')}
            onDragOver={handleDragOver}
          >
            <div className="storage-list-label-row">
              <Folder size={18} className="storage-list-icon" />
              <span className="storage-list-label">下载路径</span>
              <button
                className="storage-list-edit-button"
                onClick={() => handleEditPath('download_path')}
                title="编辑路径"
              >
                <Edit2 size={14} />
              </button>
            </div>
            <input
              type="text"
              className="storage-list-input"
              value={String(getCurrentValue('download_path') || './downloads')}
              onChange={(e) => handleLocalUpdate('download_path', e.target.value)}
              disabled={loading}
              placeholder="./downloads 或 /path/to/downloads"
              aria-label="输入下载路径"
              readOnly
            />
            <div className="storage-list-hint">
              点击编辑按钮手动输入，或拖拽目录到此处
            </div>
          </div>

          {/* 临时路径 */}
          <div 
            className="storage-list-item storage-list-item-input"
            onDrop={(e) => handleDrop(e, 'temp_path')}
            onDragOver={handleDragOver}
          >
            <div className="storage-list-label-row">
              <Database size={18} className="storage-list-icon" />
              <span className="storage-list-label">临时路径</span>
              <button
                className="storage-list-edit-button"
                onClick={() => handleEditPath('temp_path')}
                title="编辑路径"
              >
                <Edit2 size={14} />
              </button>
            </div>
            <input
              type="text"
              className="storage-list-input"
              value={String(getCurrentValue('temp_path') || './temp')}
              onChange={(e) => handleLocalUpdate('temp_path', e.target.value)}
              disabled={loading}
              placeholder="./temp 或 /path/to/temp"
              aria-label="输入临时文件路径"
              readOnly
            />
            <div className="storage-list-hint">
              点击编辑按钮手动输入，或拖拽目录到此处
            </div>
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
            <div className="storage-list-input-wrapper">
              <input
                type="text"
                className="storage-list-input"
                value={getCurrentValue('sidecar')?.ffmpeg || 'ffmpeg'}
                onChange={(e) => handleLocalUpdateSidecar('ffmpeg', e.target.value)}
                disabled={loading}
                placeholder="ffmpeg"
                aria-label="输入FFmpeg路径"
              />
              <button
                className="storage-list-reset-button"
                onClick={() => handleResetToolPath('ffmpeg')}
                disabled={loading}
                aria-label="重置FFmpeg路径"
                title="重置为默认路径"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          <div className="storage-list-item storage-list-item-input">
            <div className="storage-list-label-row">
              <Zap size={18} className="storage-list-icon" />
              <span className="storage-list-label">Aria2c</span>
            </div>
            <div className="storage-list-input-wrapper">
              <input
                type="text"
                className="storage-list-input"
                value={getCurrentValue('sidecar')?.aria2c || 'aria2c'}
                onChange={(e) => handleLocalUpdateSidecar('aria2c', e.target.value)}
                disabled={loading}
                placeholder="aria2c"
                aria-label="输入Aria2c路径"
              />
              <button
                className="storage-list-reset-button"
                onClick={() => handleResetToolPath('aria2c')}
                disabled={loading}
                aria-label="重置Aria2c路径"
                title="重置为默认路径"
              >
                <RotateCcw size={16} />
              </button>
            </div>
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
            onClick={() => handleClearCache('log')}
            disabled={clearingCache === 'log'}
            aria-label="清理日志文件"
          >
            <div className="storage-list-icon-wrapper">
              <Trash2 size={18} className="storage-list-icon" />
            </div>
            <div className="storage-list-content">
              <div className="storage-list-label">清理日志文件</div>
              <div className="storage-list-meta">
                {cacheData.log?.size_formatted || '0 B'}
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
            onClick={() => handleClearCache('webview')}
            disabled={clearingCache === 'webview'}
            aria-label="清理WebView缓存"
          >
            <div className="storage-list-icon-wrapper">
              <Trash2 size={18} className="storage-list-icon" />
            </div>
            <div className="storage-list-content">
              <div className="storage-list-label">清理WebView缓存</div>
              <div className="storage-list-meta">
                {cacheData.webview?.size_formatted || '0 B'}
              </div>
            </div>
            <ChevronRight size={16} className="storage-list-chevron" />
          </button>

          <button
            className="storage-list-item storage-list-button"
            onClick={handleExportDatabase}
            disabled={exportingDatabase}
            aria-label="导出数据库"
          >
            <div className="storage-list-icon-wrapper">
              <Download size={18} className="storage-list-icon" />
            </div>
            <div className="storage-list-content">
              <div className="storage-list-label">导出数据库</div>
              <div className="storage-list-meta">
                {exportingDatabase ? '导出中...' : cacheData.database?.size_formatted || '0 B'}
              </div>
            </div>
            <ChevronRight size={16} className="storage-list-chevron" />
          </button>

          <button
            className="storage-list-item storage-list-button"
            onClick={handleImportDatabase}
            disabled={importingDatabase}
            aria-label="导入数据库"
          >
            <div className="storage-list-icon-wrapper">
              <Upload size={18} className="storage-list-icon" />
            </div>
            <div className="storage-list-content">
              <div className="storage-list-label">导入数据库</div>
              <div className="storage-list-meta">
                {importingDatabase ? '导入中...' : '从备份恢复数据库'}
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

        .storage-list-input:active {
          opacity: 0.8;
        }

        .storage-list-edit-button {
          padding: 4px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #64748B;
          border-radius: 4px;
          transition: all 0.2s;
          margin-left: auto;
        }

        .storage-list-edit-button:hover {
          background: #F1F5F9;
          color: #2563EB;
        }

        .storage-list-hint {
          font-size: 12px;
          color: #94A3B8;
          margin-top: 4px;
          padding-left: 26px;
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

        .storage-list-input-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .storage-list-input-wrapper .storage-list-input {
          flex: 1;
        }

        .storage-list-reset-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          border: 1px solid #E2E8F0;
          border-radius: 6px;
          background: #F8FAFC;
          color: #64748B;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .storage-list-reset-button:hover:not(:disabled) {
          background: white;
          border-color: #2563EB;
          color: #2563EB;
        }

        .storage-list-reset-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

        

                .storage-modal-overlay {

                  position: fixed;

                  top: 0;

                  left: 0;

                  right: 0;

                  bottom: 0;

                  background: rgba(0, 0, 0, 0.5);

                  display: flex;

                  align-items: center;

                  justify-content: center;

                  z-index: 1000;

                }

        

                .storage-modal-content {

                  background: white;

                  border-radius: 12px;

                  padding: 24px;

                  width: 90%;

                  max-width: 400px;

                  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);

                }

        

                .storage-modal-title {

                  font-size: 18px;

                  font-weight: 600;

                  color: #1E293B;

                  margin: 0 0 8px 0;

                }

        

                .storage-modal-description {

                  font-size: 14px;

                  color: #64748B;

                  margin: 0 0 16px 0;

                  line-height: 1.5;

                }

        

                .storage-modal-input {

                  width: 100%;

                  padding: 10px 12px;

                  border: 1px solid #CBD5E1;

                  border-radius: 8px;

                  font-size: 14px;

                  color: #1E293B;

                  outline: none;

                  transition: border-color 0.2s;

                  box-sizing: border-box;

                }

        

                .storage-modal-input:focus {

                  border-color: #2563EB;

                }

        

                .storage-modal-hint {

        

                          font-size: 12px;

        

                          color: #64748B;

        

                          margin: 8px 0 20px 0;

        

                          line-height: 1.6;

        

                        }

        

                

        

                        .storage-modal-hint strong {

        

                          color: #1E293B;

        

                        }

        

                

        

                        .storage-modal-actions {

        

                          display: flex;

        

                          gap: 12px;

        

                          justify-content: flex-end;

        

                        }

        

                .storage-modal-button {

                  padding: 8px 16px;

                  border-radius: 8px;

                  font-size: 14px;

                  font-weight: 500;

                  cursor: pointer;

                  transition: all 0.2s;

                }

        

                .storage-modal-button-secondary {

                  background: white;

                  border: 1px solid #CBD5E1;

                  color: #64748B;

                }

        

                .storage-modal-button-secondary:hover {

                  background: #F8FAFC;

                  border-color: #94A3B8;

                }

        

                .storage-modal-button-primary {

                  background: #2563EB;

                  border: none;

                  color: white;

                }

        

                .storage-modal-button-primary:hover {

                  background: #1D4ED8;

                }

              `}</style>
        
              {/* 手动输入路径弹窗 */}
              {showEditModal.show && (
                      <div className="storage-modal-overlay">
                        <div className="storage-modal-content">
                          <h3 className="storage-modal-title">
                            {showEditModal.field === 'download_path' ? '编辑下载路径' : '编辑临时路径'}
                          </h3>
                          <p className="storage-modal-description">
                            输入目录路径，支持相对路径或绝对路径
                          </p>
                          <input
                            type="text"
                            className="storage-modal-input"
                            value={editingPath}
                            onChange={(e) => setEditingPath(e.target.value)}
                            placeholder={showEditModal.field === 'download_path' ? './downloads 或 /path/to/downloads' : './temp 或 /path/to/temp'}
                            autoFocus
                          />
                          <p className="storage-modal-hint">
                            <strong>示例：</strong><br/>
                            相对路径：./downloads, ./temp<br/>
                            绝对路径：/home/user/downloads, C:\\Users\\User\\Downloads<br/>
                            Docker路径：/data/downloads, /app/temp
                          </p>
                          <div className="storage-modal-actions">
                            <button
                              className="storage-modal-button storage-modal-button-secondary"
                              onClick={() => setShowEditModal({ show: false, field: null })}
                            >
                              取消
                            </button>
                            <button
                              className="storage-modal-button storage-modal-button-primary"
                              onClick={saveEditedPath}
                            >
                              保存
                            </button>
                          </div>
                        </div>
                      </div>
                    )}        
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