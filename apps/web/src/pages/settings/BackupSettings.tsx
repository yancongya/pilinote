import { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useSettingsStore } from '../../stores/settings'
import { 
  Cloud, 
  Loader2,
  Server,
  Lock,
  Folder,
  RefreshCw,
  Shield,
  Upload
} from 'lucide-react'
import { useToast } from '../../components/Toast'
import { getApiUrl } from '../../config/api'

// 定义ref类型
interface BackupSettingsRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

interface FTPConfig {
  host: string
  port: number
  username: string
  password: string
  remote_path: string
  use_tls: boolean
}

const BackupSettings = forwardRef<BackupSettingsRef>((_props, ref) => {
  const { settings, loading, updateSettings } = useSettingsStore()
  const { showToast } = useToast()
  
  // 本地状态暂存修改
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({
    ftp: {}
  })
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  
  // FTP 连接测试状态
  const [testingConnection, setTestingConnection] = useState(false)
  const [backupProgress, setBackupProgress] = useState<any>(null)
  const [isBackingUp, setIsBackingUp] = useState(false)

  // 暴露方法给父组件
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
        await updateSettings({ storage: { ftp: localSettings.ftp } })
        setSavedStatus('saved')
        showToast('保存成功', 'success')
        
        // 保存成功后，等待 2 秒再重置状态
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

  // 只在组件初始化时从全局状态加载
  useEffect(() => {
    if (settings?.storage?.ftp) {
      setLocalSettings({ ftp: { ...settings.storage.ftp } })
    }
  }, [settings]) // 添加settings作为依赖，当settings更新时重新执行

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

    const percentage = backupProgress.completed_files / backupProgress.total_files * 100
    const completedSize = formatFileSize(backupProgress.completed_size)
    const totalSize = formatFileSize(backupProgress.total_size)

    return (
      <div className="backup-progress">
        <div className="progress-info">
          <span>{backupProgress.message}</span>
          <span>{backupProgress.completed_files}/{backupProgress.total_files} 个文件</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <div className="progress-details">
          <span>{completedSize} / {totalSize}</span>
          <span>当前: {backupProgress.current_file}</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .backup-settings {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .settings-section {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 20px;
          font-weight: 700;
          color: #1E293B;
          margin: 0 0 8px 0;
        }

        .section-icon {
          width: 28px;
          height: 28px;
          color: #2563EB;
          flex-shrink: 0;
        }

        .section-description {
          font-size: 14px;
          color: #64748B;
          margin: 0 0 20px 0;
          line-height: 1.5;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        @media (max-width: 640px) {
          .settings-grid {
            grid-template-columns: 1fr;
          }
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #475569;
        }

        .form-icon {
          width: 18px;
          height: 18px;
          color: #94A3B8;
          flex-shrink: 0;
        }

        .form-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #E2E8F0;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 500;
          color: #1E293B;
          background: white;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .form-input:hover {
          border-color: #CBD5E1;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
        }

        .form-input:focus {
          outline: none;
          border-color: #2563EB;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .form-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background: #F8FAFC;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 24px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
          transform: translateY(-1px);
        }

        .btn-secondary {
          background: linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%);
          color: #475569;
          border: 1px solid #CBD5E1;
        }

        .btn-secondary:hover:not(:disabled) {
          background: linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transform: translateY(-1px);
        }

        .btn-icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .btn-icon.spinning {
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

        .backup-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .backup-progress {
          background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          border: 1px solid #E2E8F0;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .progress-info span:first-child {
          font-size: 14px;
          font-weight: 600;
          color: #475569;
        }

        .progress-info span:last-child {
          font-size: 13px;
          color: #64748B;
        }

        .progress-bar {
          height: 8px;
          background: #E2E8F0;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3B82F6 0%, #2563EB 100%);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .progress-details {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #94A3B8;
        }
      `}</style>
      
      <div className="backup-settings">
        <div className="settings-section">
          <h3 className="section-title">
            <Cloud className="section-icon" />
            FTP 备份配置
          </h3>
          <p className="section-description">
            配置 FTP 服务器以备份下载文件和数据库
          </p>

          <div className="settings-grid">
            <div className="form-group">
              <label className="form-label">
                <Server className="form-icon" />
                服务器地址
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="例如: ftp.example.com:21 或 192.168.1.100"
                value={localSettings.ftp?.host || ''}
                onChange={(e) => handleChange('host', e.target.value)}
                disabled={isBackingUp}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <RefreshCw className="form-icon" />
                用户名
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="用户名"
                value={localSettings.ftp?.username || ''}
                onChange={(e) => handleChange('username', e.target.value)}
                disabled={isBackingUp}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Lock className="form-icon" />
                密码
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="密码"
                value={localSettings.ftp?.password || ''}
                onChange={(e) => handleChange('password', e.target.value)}
                disabled={isBackingUp}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Folder className="form-icon" />
                远程路径
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="/pilinote"
                value={localSettings.ftp?.remote_path || ''}
                onChange={(e) => handleChange('remote_path', e.target.value)}
                disabled={isBackingUp}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Shield className="form-icon" />
                使用 TLS 加密
              </label>
              <select
                className="form-input"
                value={localSettings.ftp?.use_tls ? 'true' : 'false'}
                onChange={(e) => handleChange('use_tls', e.target.value === 'true')}
                disabled={isBackingUp}
              >
                <option value="false">否</option>
                <option value="true">是（FTPS）</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={handleTestConnection}
              disabled={testingConnection || isBackingUp}
            >
              {testingConnection ? (
                <>
                  <Loader2 className="btn-icon spinning" />
                  测试中...
                </>
              ) : (
                <>
                  <RefreshCw className="btn-icon" />
                  测试连接
                </>
              )}
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h3 className="section-title">
            <Upload className="section-icon" />
            备份操作
          </h3>
          <p className="section-description">
            将下载文件和数据库备份到 FTP 服务器
          </p>

          {renderProgressBar()}

          <div className="backup-actions">
            <button
              className="btn btn-primary"
              onClick={handleBackupDownload}
              disabled={isBackingUp}
            >
              {isBackingUp ? (
                <>
                  <Loader2 className="btn-icon spinning" />
                  备份中...
                </>
              ) : (
                <>
                  <Cloud className="btn-icon" />
                  备份下载目录
                </>
              )}
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleBackupDatabase}
              disabled={isBackingUp}
            >
              {isBackingUp ? (
                <>
                  <Loader2 className="btn-icon spinning" />
                  备份中...
                </>
              ) : (
                <>
                  <Folder className="btn-icon" />
                  备份数据库
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
})

BackupSettings.displayName = 'BackupSettings'

export default BackupSettings