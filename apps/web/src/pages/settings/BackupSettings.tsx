import { useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { useSettingsStore } from '../../stores/settings'
import { 
  Cloud, 
  Loader2,
  Server,
  Lock,
  Folder,
  RefreshCw,
  Shield,
  Database
} from 'lucide-react'
import { useToast } from '../../components/Toast'
import { getApiUrl } from '../../config/api'

interface BackupSettingsRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

const BackupSettings = forwardRef<BackupSettingsRef>((_props, ref) => {
  const { settings, updateSettings } = useSettingsStore()
  const { showToast } = useToast()
  
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({
    ftp: {}
  })
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  
  const [testingConnection, setTestingConnection] = useState(false)
  const [backupProgress, setBackupProgress] = useState<any>(null)
  const [isBackingUp, setIsBackingUp] = useState(false)

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => {
      return Object.keys(localSettings.ftp || {}).length > 0
    },
    saveSettings: async () => {
      if (Object.keys(localSettings.ftp || {}).length === 0) {
        setSavedStatus('idle')
        return
      }

      setSavedStatus('saving')
      try {
        await updateSettings({ storage: { ftp: localSettings.ftp } as any })
        setSavedStatus('saved')
        showToast('保存成功', 'success')
        
        setTimeout(() => {
          setSavedStatus('idle')
        }, 2000)
      } catch (error) {
        setSavedStatus('error')
        showToast('保存失败', 'error')
      }
    },
    getSavedStatus: () => savedStatus
  }))

  useEffect(() => {
    const storage = settings?.storage as any
    if (storage?.ftp) {
      setLocalSettings({ ftp: { ...storage.ftp } })
    }
  }, [settings])

  const handleChange = (field: string, value: any) => {
    setLocalSettings(prev => ({
      ...prev,
      ftp: {
        ...prev.ftp,
        [field]: value
      }
    }))
  }

  const handleTestConnection = async () => {
    setTestingConnection(true)
    try {
      const response = await fetch(getApiUrl('/api/settings/ftp/test'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(localSettings.ftp),
      })

      const result = await response.json()

      if (result.success) {
        showToast('连接测试成功', 'success')
      } else {
        showToast(`连接测试失败: ${result.message}`, 'error')
      }
    } catch (error) {
      showToast('连接测试失败', 'error')
    } finally {
      setTestingConnection(false)
    }
  }

  const handleBackupDownload = async () => {
    setIsBackingUp(true)
    setBackupProgress({ type: 'progress', message: '正在连接...' })

    try {
      const response = await fetch(getApiUrl('/api/settings/backup/download'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(localSettings.ftp),
      })

      if (!response.ok) {
        throw new Error('备份请求失败')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('无法读取响应流')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              setBackupProgress(data)

              if (data.type === 'complete' || data.type === 'error') {
                showToast(data.message, data.type === 'complete' ? 'success' : 'error')
                setIsBackingUp(false)
                return
              }
            } catch (e) {
              console.error('解析 SSE 数据失败:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('备份失败:', error)
      showToast('备份失败', 'error')
      setBackupProgress({ type: 'error', message: '备份失败' })
      setIsBackingUp(false)
    }
  }

  const handleBackupDatabase = async () => {
    setIsBackingUp(true)
    setBackupProgress({ type: 'progress', message: '正在连接...' })

    try {
      const response = await fetch(getApiUrl('/api/settings/backup/database'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(localSettings.ftp),
      })

      if (!response.ok) {
        throw new Error('备份请求失败')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('无法读取响应流')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              setBackupProgress(data)

              if (data.type === 'complete' || data.type === 'error') {
                showToast(data.message, data.type === 'complete' ? 'success' : 'error')
                setIsBackingUp(false)
                return
              }
            } catch (e) {
              console.error('解析 SSE 数据失败:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('备份失败:', error)
      showToast('备份失败', 'error')
      setBackupProgress({ type: 'error', message: '备份失败' })
      setIsBackingUp(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const renderProgressBar = () => {
    if (!backupProgress || backupProgress.type !== 'progress') return null

    const percentage = (backupProgress.completed_files / backupProgress.total_files) * 100
    const completedSize = formatFileSize(backupProgress.completed_size)
    const totalSize = formatFileSize(backupProgress.total_size)

    return (
      <div className="bg-slate-100 rounded-xl p-4 mb-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-slate-700">{backupProgress.message}</span>
          <span className="text-xs text-slate-500">{backupProgress.completed_files}/{backupProgress.total_files} 个文件</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
          <div 
            className="h-full bg-primary-500 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>{completedSize} / {totalSize}</span>
          <span className="truncate max-w-[60%] text-right">{backupProgress.current_file}</span>
        </div>
      </div>
    )
  }

  const isProcessing = testingConnection || isBackingUp

  return (
    <div className="stg-panel">
      {/* FTP 配置 */}
      <div className="stg-group">
        <div className="stg-group-header">
          <span className="stg-group-title">FTP 备份配置</span>
          <span className="stg-group-subtitle">配置 FTP 服务器以备份文件</span>
        </div>

        <div className="stg-form-stack">
          <div className="stg-form-item">
            <label className="stg-form-label">
              <Server className="w-4 h-4" />
              服务器地址
            </label>
            <input
              type="text"
              className="stg-input"
              placeholder="ftp.example.com:21"
              value={localSettings.ftp?.host || ''}
              onChange={(e) => handleChange('host', e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div className="stg-form-item">
            <label className="stg-form-label">
              <RefreshCw className="w-4 h-4" />
              用户名
            </label>
            <input
              type="text"
              className="stg-input"
              placeholder="用户名"
              value={localSettings.ftp?.username || ''}
              onChange={(e) => handleChange('username', e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div className="stg-form-item">
            <label className="stg-form-label">
              <Lock className="w-4 h-4" />
              密码
            </label>
            <input
              type="password"
              className="stg-input"
              placeholder="密码"
              value={localSettings.ftp?.password || ''}
              onChange={(e) => handleChange('password', e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div className="stg-form-item">
            <label className="stg-form-label">
              <Folder className="w-4 h-4" />
              远程路径
            </label>
            <input
              type="text"
              className="stg-input"
              placeholder="/pilinote"
              value={localSettings.ftp?.remote_path || ''}
              onChange={(e) => handleChange('remote_path', e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div className="stg-form-item">
            <label className="stg-form-label">
              <Shield className="w-4 h-4" />
              TLS 加密
            </label>
            <select
              className="stg-select"
              value={localSettings.ftp?.use_tls ? 'true' : 'false'}
              onChange={(e) => handleChange('use_tls', e.target.value === 'true')}
              disabled={isProcessing}
            >
              <option value="false">否</option>
              <option value="true">是（FTPS）</option>
            </select>
          </div>
        </div>

        <div className="stg-actions">
          <button
            className="stg-btn stg-btn-secondary stg-btn-block"
            onClick={handleTestConnection}
            disabled={testingConnection || isBackingUp}
            aria-label="测试 FTP 连接"
          >
            {testingConnection ? (
              <>
                <Loader2 size={16} className="stg-item-icon stg-spin" />
                测试中...
              </>
            ) : (
              <>
                <RefreshCw size={16} className="stg-item-icon" />
                测试连接
              </>
            )}
          </button>
        </div>
      </div>

      {/* 备份操作 */}
      <div className="stg-group">
        <div className="stg-group-header">
          <span className="stg-group-title">备份操作</span>
          <span className="stg-group-subtitle">将文件和数据库备份到 FTP</span>
        </div>

        <div className="stg-action-body">
          {renderProgressBar()}

          <div className="stg-backup-actions">
            <button
              className="stg-btn stg-btn-primary stg-btn-lg stg-btn-block"
              onClick={handleBackupDownload}
              disabled={isBackingUp}
            >
              {isBackingUp ? (
                <>
                  <Loader2 size={16} className="stg-spin" />
                  备份中...
                </>
              ) : (
                <>
                  <Cloud size={16} />
                  备份下载目录
                </>
              )}
            </button>

            <button
              className="stg-btn stg-btn-secondary stg-btn-lg stg-btn-block"
              onClick={handleBackupDatabase}
              disabled={isBackingUp}
            >
              {isBackingUp ? (
                <>
                  <Loader2 size={16} className="stg-spin" />
                  备份中...
                </>
              ) : (
                <>
                  <Database size={16} />
                  备份数据库
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

BackupSettings.displayName = 'BackupSettings'

export default BackupSettings
