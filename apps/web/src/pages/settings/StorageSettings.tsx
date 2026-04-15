import { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useSettingsStore } from '../../stores/settings'
import { 
  Database, 
  Trash2, 
  Folder, 
  FileVideo,
  Zap,
  ChevronRight,
  RotateCcw,
  Download,
  Upload,
  Edit2
} from 'lucide-react'
import { getApiUrl } from '../../config/api'
import ConfirmModal from '../../components/ConfirmModal'
import Modal from '../../components/Modal'
import { useToast } from '../../components/Toast'

interface CacheInfo {
  exists: boolean
  path: string
  size: number
  size_formatted: string
  file_count?: number
}

interface CacheData {
  [key: string]: CacheInfo | undefined
}

// 定义ref类型
interface StorageSettingsRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

const StorageSettings = forwardRef<StorageSettingsRef>((_props, ref) => {
  const { settings, loading, updateSettings } = useSettingsStore()
  const { showToast } = useToast()
  const [cacheData, setCacheData] = useState<CacheData>({})
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
        
        // 清空本地设置
        setLocalSettings({})
        
        // 重新获取设置以确认保存成功
        await useSettingsStore.getState().fetchSettings()
        
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
    loadCacheData()
  }, [])

  const loadCacheData = async () => {
    try {
      const response = await fetch(getApiUrl('/api/settings/cache-info'))
      if (response.ok) {
        const data = await response.json()
        setCacheData(data.data || {})

        // 获取数据库文件大小
        const dbResponse = await fetch(getApiUrl('/api/settings/database/info'))
        if (dbResponse.ok) {
          const dbData = await dbResponse.json()
          setCacheData(prev => ({
            ...prev,
            database: {
              size: dbData.data?.size || 0,
              size_formatted: dbData.data?.size_formatted || '0 B',
              path: dbData.data?.path || '',
              exists: dbData.data?.exists || false
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
      // 尝试获取工具状态API，获取真实路径
      try {
        const response = await fetch(getApiUrl('/api/settings/tool-status'))
        if (response.ok) {
          const data = await response.json()
          const toolStatus = data.data[tool]

          if (toolStatus && toolStatus.installed && toolStatus.path) {
            handleLocalUpdateSidecar(tool, toolStatus.path)

            // 自动保存
            const currentSidecar = (settings?.storage as any)?.sidecar || {}
            const sidecar = { ...currentSidecar, [tool]: toolStatus.path }

            await updateSettings({
              storage: {
                ...(settings?.storage as any || {}),
                sidecar
              }
            } as any)
            // 清空本地设置
            setLocalSettings({})
            showToast('已重置为系统路径', 'success')
            return
          }
        }
      } catch (e) {
        console.warn('获取工具状态失败，使用默认值:', e)
      }

      // 如果无法获取真实路径，使用默认值
      handleLocalUpdateSidecar(tool, tool)
      const currentSidecar = (settings?.storage as any)?.sidecar || {}
      const sidecar = { ...currentSidecar, [tool]: tool }
      await updateSettings({
        storage: {
          ...(settings?.storage as any || {}),
          sidecar
        }
      } as any)
      setLocalSettings({})
      showToast('已重置为默认值', 'success')
    } catch (error) {
      console.error('重置工具路径失败:', error)
      showToast('重置失败', 'error')
    }
  }

const getCurrentValue = useCallback((field: string) => {
  if (!settings?.storage) return undefined
  
  // Handle nested fields (e.g., sidecar.ffmpeg)
  if (field.includes('.')) {
    const [parent, child] = field.split('.')
    
    // Check backend settings first
    const storageValue = (settings.storage as any)[parent]
    if (storageValue && typeof storageValue === 'object' && child in storageValue) {
      return storageValue[child]
    }
    
    // Then check local temporary settings
    if (parent in localSettings) {
      const localValue = (localSettings as any)[parent]
      if (localValue && typeof localValue === 'object' && child in localValue) {
        return localValue[child]
      }
    }
    
    return undefined
  }
  
  // Handle regular fields - check local settings first for immediate feedback
  if (field in localSettings) {
    return (localSettings as any)[field]
  }
  
  // Then check backend settings
  const storageValue = (settings.storage as any)[field]
  if (storageValue !== undefined && storageValue !== null) {
    return storageValue
  }
  
  return undefined
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
      const response = await fetch(getApiUrl(`/api/settings/clear-cache/${cacheType}`), {
        method: 'POST'
      })
      if (response.ok) {
        showToast('清理成功', 'success')
        await loadCacheData()
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
      const response = await fetch(getApiUrl('/api/settings/database/export'), {
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
        const response = await fetch(getApiUrl('/api/settings/database/import'), {
          method: 'POST',
          body: formData
        })
        
        if (response.ok) {
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
          showToast(`目录已设置: ${entry.name}，请点击"保存设置"按钮保存`, 'info')
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
            showToast(`目录已设置: ${directoryName}，请点击"保存设置"按钮保存`, 'info')
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
      showToast('路径已更新，请点击右下角"保存设置"按钮保存', 'info')
    }
  }

  if (!settings) {
    return (
      <div className="stg-loading">
        <Database className="stg-spinner" />
        <p>加载中...</p>
      </div>
    )
  }

  return (
    <div className="stg-panel">
      {/* 路径设置组 */}
      <div className="stg-group">
        <div className="stg-group-header">
          <span className="stg-group-title">路径设置</span>
          <span className="stg-group-subtitle">手动输入或拖拽目录设置</span>
        </div>
        
        <div className="stg-list">
          {/* 下载路径 */}
          <div 
            className="stg-item stg-item-col"
            onDrop={(e) => handleDrop(e, 'download_path')}
            onDragOver={handleDragOver}
          >
            <div className="stg-item-label-row">
              <span className="flex items-center gap-1.5">
                <Folder size={18} className="stg-item-icon" />
                <span className="stg-item-label">下载路径</span>
              </span>
              <button
                className="stg-btn-icon p-1 w-auto h-auto flex-shrink-0"
                style={{ color: 'var(--color-text-secondary)' }}
                onClick={() => handleEditPath('download_path')}
                title="编辑路径"
              >
                <Edit2 size={14} />
              </button>
            </div>
            <input
              type="text"
              className="stg-input"
              value={getCurrentValue('download_path') ?? ''}
              onChange={(e) => handleLocalUpdate('download_path', e.target.value)}
              disabled={loading}
              placeholder="./downloads 或 /path/to/downloads"
              aria-label="输入下载路径"
              readOnly
            />
            <div className="stg-hint">
              点击编辑按钮手动输入，或拖拽目录到此处
            </div>
          </div>

          {/* 临时路径 */}
          <div 
            className="stg-item stg-item-col"
            onDrop={(e) => handleDrop(e, 'temp_path')}
            onDragOver={handleDragOver}
          >
            <div className="stg-item-label-row">
              <span className="flex items-center gap-1.5">
                <Database size={18} className="stg-item-icon" />
                <span className="stg-item-label">临时路径</span>
              </span>
              <button
                className="stg-btn-icon p-1 w-auto h-auto flex-shrink-0"
                style={{ color: 'var(--color-text-secondary)' }}
                onClick={() => handleEditPath('temp_path')}
                title="编辑路径"
              >
                <Edit2 size={14} />
              </button>
            </div>
            <input
              type="text"
              className="stg-input"
              value={getCurrentValue('temp_path') ?? ''}
              onChange={(e) => handleLocalUpdate('temp_path', e.target.value)}
              disabled={loading}
              placeholder="./temp 或 /path/to/temp"
              aria-label="输入临时文件路径"
              readOnly
            />
            <div className="stg-hint">
              点击编辑按钮手动输入，或拖拽目录到此处
            </div>
          </div>
        </div>

        {/* 开关选项 */}
        <div className="stg-toggles">
          <label className="stg-toggle">
            <div className="stg-toggle-content">
              <span className="stg-toggle-label">自动清理临时文件</span>
            </div>
            <input
              type="checkbox"
              className="stg-toggle-input"
              checked={getCurrentValue('auto_cleanup') as boolean || false}
              onChange={(e) => handleLocalUpdate('auto_cleanup', e.target.checked)}
              disabled={loading}
              aria-label="自动清理临时文件"
            />
          </label>

          <label className="stg-toggle">
            <div className="stg-toggle-content">
              <span className="stg-toggle-label">保留失败的任务</span>
            </div>
            <input
              type="checkbox"
              className="stg-toggle-input"
              checked={getCurrentValue('keep_failed') as boolean || false}
              onChange={(e) => handleLocalUpdate('keep_failed', e.target.checked)}
              disabled={loading}
              aria-label="保留失败的任务"
            />
          </label>
        </div>
      </div>

      {/* 工具路径组 */}
      <div className="stg-group">
        <div className="stg-group-header">
          <span className="stg-group-title">工具路径</span>
          <span className="stg-group-subtitle">自定义执行路径</span>
        </div>
        
        <div className="stg-list">
          <div className="stg-item stg-item-col">
            <div className="stg-item-label-row">
              <FileVideo size={18} className="stg-item-icon" />
              <span className="stg-item-label">FFmpeg</span>
            </div>
            <div className="stg-input-wrapper flex items-center gap-1.5 w-full">
              <input
                type="text"
                className="stg-input flex-1 min-w-0"
                value={getCurrentValue('sidecar.ffmpeg') ?? 'ffmpeg'}
                onChange={(e) => handleLocalUpdateSidecar('ffmpeg', e.target.value)}
                disabled={loading}
                placeholder="ffmpeg"
                aria-label="输入FFmpeg路径"
              />
              <button
                className="stg-reset-btn p-1.5 flex-shrink-0 cursor-pointer"
                style={{ 
                  border: '1px solid var(--color-border)', 
                  borderRadius: '6px', 
                  background: 'var(--color-bg-secondary)', 
                  color: 'var(--color-text-secondary)' 
                }}
                onClick={() => handleResetToolPath('ffmpeg')}
                disabled={loading}
                aria-label="重置FFmpeg路径"
                title="重置为默认路径"
              >
                <RotateCcw size={14} className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />
              </button>
            </div>
          </div>

          <div className="stg-item stg-item-col">
            <div className="stg-item-label-row">
              <Zap size={18} className="stg-item-icon" />
              <span className="stg-item-label">Aria2c</span>
            </div>
            <div className="stg-input-wrapper flex items-center gap-1.5 w-full">
              <input
                type="text"
                className="stg-input flex-1 min-w-0"
                value={getCurrentValue('sidecar.aria2c') ?? 'aria2c'}
                onChange={(e) => handleLocalUpdateSidecar('aria2c', e.target.value)}
                disabled={loading}
                placeholder="aria2c"
                aria-label="输入Aria2c路径"
              />
              <button
                className="stg-reset-btn p-1.5 flex-shrink-0 cursor-pointer"
                style={{ 
                  border: '1px solid var(--color-border)', 
                  borderRadius: '6px', 
                  background: 'var(--color-bg-secondary)', 
                  color: 'var(--color-text-secondary)' 
                }}
                onClick={() => handleResetToolPath('aria2c')}
                disabled={loading}
                aria-label="重置Aria2c路径"
                title="重置为默认路径"
              >
                <RotateCcw size={14} className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 缓存管理组 */}
      <div className="stg-group">
        <div className="stg-group-header">
          <span className="stg-group-title">缓存管理</span>
          <span className="stg-group-subtitle">清理不必要的文件</span>
        </div>
        
        <div className="stg-list">
          <button
            className="stg-btn-full stg-item"
            onClick={() => handleClearCache('log')}
            disabled={clearingCache === 'log'}
            aria-label="清理日志文件"
          >
            <div className="stg-icon-badge">
              <Trash2 size={18} className="stg-item-icon" />
            </div>
            <div className="stg-item-content">
              <div className="stg-item-label">清理日志文件</div>
              <div className="stg-meta">
                {cacheData.log?.size_formatted || '0 B'}
              </div>
            </div>
            <ChevronRight size={16} className="stg-chevron" />
          </button>

          <button
            className="stg-btn-full stg-item"
            onClick={() => handleClearCache('temp')}
            disabled={clearingCache === 'temp'}
            aria-label="清理临时文件"
          >
            <div className="stg-icon-badge">
              <Trash2 size={18} className="stg-item-icon" />
            </div>
            <div className="stg-item-content">
              <div className="stg-item-label">清理临时文件</div>
              <div className="stg-meta">
                {cacheData.temp?.size_formatted || '0 B'}
              </div>
            </div>
            <ChevronRight size={16} className="stg-chevron" />
          </button>

          <button
            className="stg-btn-full stg-item"
            onClick={() => handleClearCache('webview')}
            disabled={clearingCache === 'webview'}
            aria-label="清理WebView缓存"
          >
            <div className="stg-icon-badge">
              <Trash2 size={18} className="stg-item-icon" />
            </div>
            <div className="stg-item-content">
              <div className="stg-item-label">清理WebView缓存</div>
              <div className="stg-meta">
                {cacheData.webview?.size_formatted || '0 B'}
              </div>
            </div>
            <ChevronRight size={16} className="stg-chevron" />
          </button>

          <button
            className="stg-btn-full stg-item"
            onClick={handleExportDatabase}
            disabled={exportingDatabase}
            aria-label="导出数据库"
          >
            <div className="stg-icon-badge">
              <Download size={18} className="stg-item-icon" />
            </div>
            <div className="stg-item-content">
              <div className="stg-item-label">导出数据库</div>
              <div className="stg-meta">
                {exportingDatabase ? '导出中...' : cacheData.database?.size_formatted || '0 B'}
              </div>
            </div>
            <ChevronRight size={16} className="stg-chevron" />
          </button>

          <button
            className="stg-btn-full stg-item"
            onClick={handleImportDatabase}
            disabled={importingDatabase}
            aria-label="导入数据库"
          >
            <div className="stg-icon-badge">
              <Upload size={18} className="stg-item-icon" />
            </div>
            <div className="stg-item-content">
              <div className="stg-item-label">导入数据库</div>
              <div className="stg-meta">
                {importingDatabase ? '导入中...' : '从备份恢复数据库'}
              </div>
            </div>
            <ChevronRight size={16} className="stg-chevron" />
          </button>
        </div>
      </div>
        
              {/* 手动输入路径弹窗 */}
              <Modal
                isOpen={showEditModal.show}
                onClose={() => {
                  setShowEditModal({ show: false, field: null })
                  setEditingPath('')
                }}
                title={showEditModal.field === 'download_path' ? '编辑下载路径' : '编辑临时路径'}
                size="sm"
                footer={
                  <>
                    <button
                      className="stg-btn stg-btn-secondary"
                      onClick={() => {
                        setShowEditModal({ show: false, field: null })
                        setEditingPath('')
                      }}
                    >
                      取消
                    </button>
                    <button
                      className="stg-btn stg-btn-primary"
                      onClick={saveEditedPath}
                    >
                      保存
                    </button>
                  </>
                }
              >
                <p className="stg-modal-description">
                  输入目录路径，支持相对路径或绝对路径
                </p>
                <input
                  type="text"
                  className="stg-modal-input"
                  value={editingPath}
                  onChange={(e) => setEditingPath(e.target.value)}
                  placeholder={showEditModal.field === 'download_path' ? './downloads 或 /path/to/downloads' : './temp 或 /path/to/temp'}
                  autoFocus
                />
                <p className="stg-modal-hint">
                  <strong>示例：</strong><br/>
                  相对路径：./downloads, ./temp<br/>
                  绝对路径：/home/user/downloads, C:\Users\User\Downloads<br/>
                  Docker路径：/data/downloads, /app/temp
                </p>
              </Modal>        
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