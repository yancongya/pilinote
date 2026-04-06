import { useState, forwardRef, useImperativeHandle, useEffect } from 'react'
import { 
  Clock,
  RotateCw,
  Zap,
  Hash
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settings'
import { apiService } from '../../services/api'
import ConfirmModal from '../../components/ConfirmModal'
import { useToast } from '../../components/Toast'
import type { FolderScanConfig } from '../../stores/settings'

interface AutoDownloadSettingsRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

const AutoDownloadSettings = forwardRef<AutoDownloadSettingsRef>((_props, ref) => {
  const { settings, updateSettings, fetchSettings } = useSettingsStore()
  const { showToast } = useToast()
  
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({})
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // 初始化时获取设置
  useEffect(() => {
    useSettingsStore.getState().fetchSettings()
  }, [])

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => {
      return Object.keys(localSettings).length > 0
    },
    saveSettings: async () => {
      if (Object.keys(localSettings).length === 0) {
        setSavedStatus('idle')
        return
      }

      setSavedStatus('saving')

      try {
        const currentAutoDownload = settings?.auto_download || {
          enabled: false,
          trigger_type: 'interval',
          scan_interval: 60,
          cron_expression: '',
          concurrent_limit: {
            video: 3,
            page: 3
          },
          custom_scan: {
            enabled: false,
            folder_list: []
          }
        }

        const mergedSettings = {
          enabled: localSettings.enabled ?? currentAutoDownload.enabled,
          trigger_type: localSettings.trigger_type ?? currentAutoDownload.trigger_type,
          scan_interval: localSettings.scan_interval ?? currentAutoDownload.scan_interval,
          cron_expression: localSettings.cron_expression ?? currentAutoDownload.cron_expression,
          concurrent_limit: {
            video: localSettings.concurrent_limit?.video ?? currentAutoDownload.concurrent_limit?.video ?? 3,
            page: localSettings.concurrent_limit?.page ?? currentAutoDownload.concurrent_limit?.page ?? 3
          },
          custom_scan: {
            enabled: localSettings.custom_scan?.enabled ?? currentAutoDownload.custom_scan?.enabled ?? false,
            folder_list: localSettings.custom_scan?.folder_list ?? currentAutoDownload.custom_scan?.folder_list ?? []
          }
        }

        await updateSettings({
          auto_download: mergedSettings
        })
        
        setSavedStatus('saved')
        setLocalSettings({})
        
        // 重新获取设置以确保数据同步
        await fetchSettings()
        
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

  const handleLocalUpdate = (field: string, value: any) => {
    setLocalSettings(prev => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.')
        return {
          ...prev,
          [parent]: {
            ...(prev as any)[parent],
            [child]: value
          }
        }
      }
      return {
        ...prev,
        [field]: value
      }
    })
  }

  const getCurrentValue = (field: string) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      const localValue = (localSettings as any)[parent]?.[child]
      if (localValue !== undefined) {
        return localValue
      }
      return (settings?.auto_download as any)?.[parent]?.[child]
    }
    
    if (field in localSettings) {
      return localSettings[field as keyof typeof localSettings]
    }
    return (settings?.auto_download as any)?.[field]
  }

  const currentSettings = settings?.auto_download || {
    enabled: false,
    trigger_type: 'interval',
    scan_interval: 60,
    cron_expression: '',
    concurrent_limit: {
      video: 3,
      page: 3
    },
    custom_scan: {
      enabled: false,
      folder_list: []
    }
  }

  // 自定义扫描配置
  const customScanEnabled = getCurrentValue('custom_scan.enabled') ?? false
  const folderList = (getCurrentValue('custom_scan.folder_list') ?? []) as FolderScanConfig[]
  const [loadingFavorites, setLoadingFavorites] = useState(false)

  // 加载收藏夹列表
  const loadFavorites = async () => {
    setLoadingFavorites(true)
    try {
      const result = await apiService.getFolders(1, 100)
      
      if (result.success && result.data && result.data.length > 0) {
        // 如果folderList为空，则用收藏夹列表初始化（默认视频数为0）
        if (folderList.length === 0) {
          const initialConfigs: FolderScanConfig[] = result.data.map((folder: any) => ({
            folder_name: folder.title,
            max_videos: 0
          }))
          handleLocalUpdate('custom_scan.folder_list', initialConfigs)
          showToast(`已加载 ${result.data.length} 个收藏夹`, 'success')
        } else {
          showToast('收藏夹列表已存在', 'info')
        }
      } else {
        showToast('获取收藏夹列表失败', 'error')
      }
    } catch (error) {
      console.error('加载收藏夹失败:', error)
      showToast('加载收藏夹失败，请检查网络连接', 'error')
    } finally {
      setLoadingFavorites(false)
    }
  }

  // 初始化时加载收藏夹
  useEffect(() => {
    if (customScanEnabled && folderList.length === 0) {
      loadFavorites()
    }
  }, [customScanEnabled])

  // 更新收藏夹配置
  const updateFolderConfig = (index: number, field: keyof FolderScanConfig, value: any) => {
    const newList = [...folderList]
    newList[index] = { ...newList[index], [field]: value }
    handleLocalUpdate('custom_scan.folder_list', newList)
  }

  return (
    <div className="stg-panel">
      {/* 启用开关 */}
      <div className="stg-group">
        <div className="stg-group-header">
          <span className="stg-group-title">自动下载</span>
          <span className="stg-group-subtitle">定时扫描并下载</span>
        </div>
        
        <div className="stg-toggles">
          <label className="stg-toggle">
            <div className="stg-toggle-content">
              <span className="stg-toggle-label">启用自动下载</span>
            </div>
            <input
              type="checkbox"
              className="stg-toggle-input"
              checked={getCurrentValue('enabled') ?? currentSettings.enabled}
              onChange={(e) => handleLocalUpdate('enabled', e.target.checked)}
            />
          </label>
        </div>
      </div>

      {/* 触发方式 */}
      <div className="stg-group">
        <div className="stg-group-header">
          <span className="stg-group-title">触发方式</span>
          <span className="stg-group-subtitle">定时扫描的执行方式</span>
        </div>
        
        <div className="stg-list">
          <div className="stg-item stg-item-col">
            <div className="stg-item-label-row">
              <Clock size={18} className="stg-item-icon" />
              <span className="stg-item-label">触发方式</span>
            </div>
            <select
              className="stg-select"
              value={getCurrentValue('trigger_type') ?? currentSettings.trigger_type}
              onChange={(e) => handleLocalUpdate('trigger_type', e.target.value)}
            >
              <option value="interval">间隔执行</option>
              <option value="cron">Cron 表达式</option>
            </select>
          </div>

          {(getCurrentValue('trigger_type') ?? currentSettings.trigger_type) === 'interval' && (
            <div className="stg-item stg-item-col">
              <div className="stg-item-label-row">
                <Clock size={18} className="stg-item-icon" />
                <span className="stg-item-label">扫描间隔 (分钟)</span>
              </div>
              <select
                className="stg-select"
                value={getCurrentValue('scan_interval') ?? currentSettings.scan_interval}
                onChange={(e) => handleLocalUpdate('scan_interval', parseInt(e.target.value))}
              >
                <option value={15}>15 分钟</option>
                <option value={30}>30 分钟</option>
                <option value={60}>1 小时</option>
                <option value={120}>2 小时</option>
                <option value={360}>6 小时</option>
                <option value={720}>12 小时</option>
                <option value={1440}>24 小时</option>
              </select>
            </div>
          )}

          {(getCurrentValue('trigger_type') ?? currentSettings.trigger_type) === 'cron' && (
            <div className="stg-item stg-item-col">
              <div className="stg-item-label-row">
                <Hash size={18} className="stg-item-icon" />
                <span className="stg-item-label">Cron 表达式</span>
                <span className="stg-hint-inline">例：0 0 * * * 表示每天 0 点</span>
              </div>
              <input
                type="text"
                className="stg-input"
                value={getCurrentValue('cron_expression') ?? currentSettings.cron_expression}
                onChange={(e) => handleLocalUpdate('cron_expression', e.target.value)}
                placeholder="秒 分 时 日 月 周"
              />
            </div>
          )}
        </div>
      </div>

      {/* 并发限制 */}
      <div className="stg-group">
        <div className="stg-group-header">
          <span className="stg-group-title">并发限制</span>
          <span className="stg-group-subtitle">控制同时下载的任务数</span>
        </div>
        
        <div className="stg-list">
          <div className="stg-item stg-item-col">
            <div className="stg-item-label-row">
              <Zap size={18} className="stg-item-icon" />
              <span className="stg-item-label">视频并发数</span>
            </div>
            <select
              className="stg-select"
              value={getCurrentValue('concurrent_limit.video') ?? currentSettings.concurrent_limit.video}
              onChange={(e) => handleLocalUpdate('concurrent_limit.video', parseInt(e.target.value))}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </div>

          <div className="stg-item stg-item-col">
            <div className="stg-item-label-row">
              <Zap size={18} className="stg-item-icon" />
              <span className="stg-item-label">分页并发数</span>
            </div>
            <select
              className="stg-select"
              value={getCurrentValue('concurrent_limit.page') ?? currentSettings.concurrent_limit.page}
              onChange={(e) => handleLocalUpdate('concurrent_limit.page', parseInt(e.target.value))}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </div>
        </div>
      </div>

      {/* 自定义扫描列表 */}
      <div className="stg-group">
        <div className="stg-group-header" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <span className="stg-group-title">自定义扫描列表</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              onClick={loadFavorites}
              style={{ 
                cursor: loadingFavorites ? 'not-allowed' : 'pointer',
                opacity: loadingFavorites ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                transition: 'all 0.2s',
                padding: '4px'
              }}
              onMouseEnter={(e) => {
                if (!loadingFavorites) {
                  e.currentTarget.style.color = '#fb7299'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#64748b'
              }}
              aria-label="刷新收藏夹列表"
              title="刷新收藏夹列表"
            >
              <RotateCw size={16} className={loadingFavorites ? 'animate-spin' : ''} />
            </div>
            <label className="stg-toggle" style={{ marginBottom: 0 }}>
              <div className="stg-toggle-content">
                <span className="stg-toggle-label">启用</span>
              </div>
              <input
                type="checkbox"
                className="stg-toggle-input"
                checked={customScanEnabled}
                onChange={(e) => {
                  handleLocalUpdate('custom_scan.enabled', e.target.checked)
                  if (e.target.checked && folderList.length === 0) {
                    loadFavorites()
                  }
                }}
              />
            </label>
          </div>
        </div>

        {customScanEnabled && (
          <div style={{ marginTop: '16px' }}>
            {/* 表头 */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 120px', 
              gap: '12px',
              padding: '12px',
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              marginBottom: '8px',
              fontWeight: 500,
              fontSize: '13px',
              color: '#64748b'
            }}>
              <div>收藏夹名称</div>
              <div>视频数</div>
            </div>
            
            {/* 说明文字 */}
            <div style={{ 
              padding: '12px',
              backgroundColor: '#fef3c7',
              borderRadius: '8px',
              marginBottom: '12px',
              fontSize: '12px',
              color: '#92400e',
              border: '1px solid #fcd34d'
            }}>
              💡 视频数为 0 表示不扫描该收藏夹，设置大于 0 的数值后才进行扫描
            </div>
            
            {/* 收藏夹列表 */}
            {loadingFavorites ? (
              <div style={{ 
                padding: '32px 16px', 
                textAlign: 'center', 
                color: '#94a3b8',
                fontSize: '14px' 
              }}>
                正在加载收藏夹列表...
              </div>
            ) : folderList.length === 0 ? (
              <div style={{ 
                padding: '32px 16px', 
                textAlign: 'center', 
                color: '#94a3b8',
                fontSize: '14px' 
              }}>
                点击"刷新列表"按钮获取收藏夹列表
              </div>
            ) : (
              folderList.map((config, index) => (
                <div key={index} style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 120px', 
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  alignItems: 'center'
                }}>
                  <div style={{ 
                    color: '#1e293b',
                    fontSize: '14px',
                    fontWeight: 500
                  }}>
                    {config.folder_name}
                  </div>
                  <input
                    type="number"
                    className="stg-input"
                    value={config.max_videos}
                    onChange={(e) => updateFolderConfig(index, 'max_videos', parseInt(e.target.value) || 0)}
                    min={0}
                    max={999}
                    placeholder="0=不扫描"
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 重置按钮 */}
      <div className="stg-actions">
        <button 
          className="stg-btn stg-btn-secondary"
          onClick={() => setShowResetConfirm(true)}
          aria-label="重置自动下载设置"
        >
          <RotateCw size={16} className="stg-item-icon" />
          <span>重置自动下载设置</span>
        </button>
      </div>

      {/* 重置确认弹窗 */}
      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={() => {
          setLocalSettings({
            enabled: false,
            trigger_type: 'interval',
            scan_interval: 60,
            cron_expression: '',
            concurrent_limit: {
              video: 3,
              page: 3
            },
            custom_scan: {
              enabled: false,
              folder_list: []
            }
          })
          setShowResetConfirm(false)
          showToast('自动下载设置已重置', 'success')
        }}
        title="重置自动下载设置"
        message="确定要重置自动下载设置吗？"
        confirmText="确定重置"
        cancelText="取消"
        confirmVariant="danger"
      />
    </div>
  )
})

export default AutoDownloadSettings