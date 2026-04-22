import { useState, forwardRef, useImperativeHandle, useEffect } from 'react'
import { 
  Clock,
  RotateCw,
  Zap,
  Hash,
  Clock as ClockIcon
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settings'
import { apiService } from '../../services/api'
import ConfirmModal from '../../components/ConfirmModal'
import { useToast } from '../../components/Toast'
import type { FolderScanConfig } from '../../stores/settings'
import { SettingsActionRow, SettingsField, SettingsSection, SettingsToggleRow } from './shared'

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
          },
          watch_later_max: 0,
          auto_start_after_scan: false,
          storage_threshold_gb: 20
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
          },
          watch_later_max: localSettings.watch_later_max ?? currentAutoDownload.watch_later_max ?? 0,
          auto_start_after_scan: localSettings.auto_start_after_scan ?? currentAutoDownload.auto_start_after_scan ?? false,
          storage_threshold_gb: localSettings.storage_threshold_gb ?? currentAutoDownload.storage_threshold_gb ?? 20
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
    },
    watch_later_max: 0,
    auto_start_after_scan: false,
    storage_threshold_gb: 20
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
    <div>
      <SettingsSection title="自动下载" subtitle="定时扫描并下载">
        <SettingsToggleRow
          label="启用自动下载"
          checked={getCurrentValue('enabled') ?? currentSettings.enabled}
          onChange={(checked) => handleLocalUpdate('enabled', checked)}
        />
      </SettingsSection>

      <SettingsSection title="触发方式" subtitle="定时扫描的执行方式">
        <SettingsField label="触发方式" icon={<Clock size={18} />}>
          <select
            className="settings-control settings-select"
            value={getCurrentValue('trigger_type') ?? currentSettings.trigger_type}
            onChange={(e) => handleLocalUpdate('trigger_type', e.target.value)}
          >
            <option value="interval">间隔执行</option>
            <option value="cron">Cron 表达式</option>
          </select>
        </SettingsField>

        {(getCurrentValue('trigger_type') ?? currentSettings.trigger_type) === 'interval' && (
          <SettingsField label="扫描间隔 (分钟)" icon={<Clock size={18} />}>
            <select
              className="settings-control settings-select"
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
          </SettingsField>
        )}

        {(getCurrentValue('trigger_type') ?? currentSettings.trigger_type) === 'cron' && (
          <SettingsField
            label="Cron 表达式"
            icon={<Hash size={18} />}
            hint="例：0 0 * * * 表示每天 0 点"
          >
            <input
              type="text"
              className="settings-control settings-input"
              value={getCurrentValue('cron_expression') ?? currentSettings.cron_expression}
              onChange={(e) => handleLocalUpdate('cron_expression', e.target.value)}
              placeholder="秒 分 时 日 月 周"
            />
          </SettingsField>
        )}
      </SettingsSection>

      <SettingsSection title="并发限制" subtitle="控制同时下载的任务数">
        <SettingsField label="视频并发数" icon={<Zap size={18} />}>
          <select
            className="settings-control settings-select"
            value={getCurrentValue('concurrent_limit.video') ?? currentSettings.concurrent_limit.video}
            onChange={(e) => handleLocalUpdate('concurrent_limit.video', parseInt(e.target.value))}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
        </SettingsField>

        <SettingsField label="分页并发数" icon={<Zap size={18} />}>
          <select
            className="settings-control settings-select"
            value={getCurrentValue('concurrent_limit.page') ?? currentSettings.concurrent_limit.page}
            onChange={(e) => handleLocalUpdate('concurrent_limit.page', parseInt(e.target.value))}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title="自定义扫描列表"
        subtitle="自定义收藏夹扫描策略"
        actions={(
          <div className="flex items-center gap-3">
            <button
              onClick={loadFavorites}
              className="settings-icon-button"
              disabled={loadingFavorites}
              aria-label="刷新收藏夹列表"
              title="刷新收藏夹列表"
            >
              <RotateCw size={16} className={loadingFavorites ? 'is-spinning' : ''} />
            </button>
            <SettingsToggleRow
              label="启用"
              checked={customScanEnabled}
              onChange={(checked) => {
                handleLocalUpdate('custom_scan.enabled', checked)
                if (checked && folderList.length === 0) {
                  loadFavorites()
                }
              }}
            />
          </div>
        )}
      >

        {customScanEnabled && (
          <div className="mt-4">
            {/* 表头 */}
            <div 
              className="grid gap-3 p-3 mb-2 font-medium text-sm"
              style={{ 
                gridTemplateColumns: '1fr 120px',
                backgroundColor: 'var(--color-bg-tertiary)',
                borderRadius: '8px',
                color: 'var(--color-text-secondary)'
              }}
            >
              <div>收藏夹名称</div>
              <div>视频数</div>
            </div>
            
            {/* 说明文字 */}
            <div 
              className="p-3 mb-3 text-xs border"
              style={{ 
                backgroundColor: 'var(--color-warning-50)',
                borderRadius: '8px',
                color: 'var(--color-warning-700)',
                borderColor: 'var(--color-warning-200)'
              }}
            >
              💡 视频数为 0 表示不扫描该收藏夹，设置大于 0 的数值后才进行扫描
            </div>
            
            {/* 收藏夹列表 */}
            {loadingFavorites ? (
              <div 
                className="py-8 px-4 text-center text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                正在加载收藏夹列表...
              </div>
            ) : folderList.length === 0 ? (
              <div 
                className="py-8 px-4 text-center text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                点击"刷新列表"按钮获取收藏夹列表
              </div>
            ) : (
              <>
                {folderList.map((config, index) => (
                <div 
                  key={index}
                  className="grid items-center gap-3 p-3 mb-2 border"
                  style={{ 
                    gridTemplateColumns: '1fr 120px',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: '8px',
                    borderColor: 'var(--color-border)'
                  }}
                >
                  <div 
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {config.folder_name}
                  </div>
                  <input
                    type="number"
                  className="settings-input"
                    value={config.max_videos}
                    onChange={(e) => updateFolderConfig(index, 'max_videos', parseInt(e.target.value) || 0)}
                    min={0}
                    max={999}
                    placeholder="0=不扫描"
                  />
                </div>
              ))}
              </>
            )}
          </div>
        )}

        {/* 稍后再看数量设置 */}
        <div className="mt-4">
          <div className="settings-field-label-row mb-2">
            <ClockIcon size={18} className="settings-field-icon" />
            <span className="settings-field-label">稍后再看数量限制</span>
          </div>
          <div 
            className="grid gap-3 p-3 mb-2 font-medium text-sm"
            style={{ 
              gridTemplateColumns: '1fr 120px',
              backgroundColor: 'var(--color-bg-tertiary)',
              borderRadius: '8px',
              color: 'var(--color-text-secondary)'
            }}
          >
            <div>稍后再看</div>
            <div>视频数</div>
          </div>
          
          <div 
            className="p-3 mb-3 text-xs border"
            style={{ 
              backgroundColor: 'var(--color-warning-50)',
              borderRadius: '8px',
              color: 'var(--color-warning-700)',
              borderColor: 'var(--color-warning-200)'
            }}
          >
            💡 稍后再看数量为 0 表示不扫描稍后再看，设置大于 0 的数值后才进行扫描
          </div>
          
          <div 
            className="grid gap-3 p-3 border"
            style={{ 
              gridTemplateColumns: '1fr 120px',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: '8px',
              borderColor: 'var(--color-border)'
            }}
          >
            <div 
              className="flex items-center text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              稍后再看列表
            </div>
            <div>
              <input
                type="number"
                className="settings-input"
                min="0"
                max="999"
                value={getCurrentValue('watch_later_max') ?? currentSettings.watch_later_max}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0
                  handleLocalUpdate('watch_later_max', Math.max(0, Math.min(999, value)))
                }}
              />
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="下载触发控制" subtitle="控制扫描后是否自动开始下载及存储空间限制">
        <SettingsToggleRow
          label="扫描后自动开始下载"
          hint="开启后，扫描完成会自动开始下载新视频"
          checked={getCurrentValue('auto_start_after_scan') ?? currentSettings.auto_start_after_scan}
          onChange={(checked) => handleLocalUpdate('auto_start_after_scan', checked)}
        />

        <SettingsField
          label="存储空间阈值 (GB)"
          icon={<Hash size={18} />}
          hint="超过此值时不触发自动下载，避免空间不足"
        >
          <select
            className="settings-control settings-select"
            value={getCurrentValue('storage_threshold_gb') ?? currentSettings.storage_threshold_gb}
            onChange={(e) => handleLocalUpdate('storage_threshold_gb', parseInt(e.target.value))}
          >
            <option value={5}>5 GB</option>
            <option value={10}>10 GB</option>
            <option value={20}>20 GB</option>
            <option value={30}>30 GB</option>
            <option value={50}>50 GB</option>
            <option value={100}>100 GB</option>
            <option value={200}>200 GB</option>
            <option value={500}>500 GB</option>
            <option value={1024}>1 TB</option>
          </select>
        </SettingsField>

        <div
          className="p-3 mt-3 text-xs border"
          style={{
            backgroundColor: 'var(--color-info-50)',
            borderRadius: '8px',
            color: 'var(--color-info-700)',
            borderColor: 'var(--color-info-200)',
          }}
        >
          <div className="font-semibold mb-1">💡 工作流程说明：</div>
          <div className="leading-relaxed">
            1. 当"扫描后自动开始下载"开启时，扫描完成后会自动触发下载<br />
            2. 触发下载前会检查当前视频库占用空间<br />
            3. 如果占用空间超过设定的阈值，则不会触发下载，避免磁盘空间不足<br />
            4. 即使自动下载被禁用，你也可以手动选择扫描结果进行下载
          </div>
        </div>
      </SettingsSection>

      <SettingsSection>
        <SettingsActionRow>
          <button
            className="settings-button settings-button-secondary settings-button-block"
            onClick={() => setShowResetConfirm(true)}
            aria-label="重置自动下载设置"
          >
            <RotateCw size={16} />
            <span>重置自动下载设置</span>
          </button>
        </SettingsActionRow>
      </SettingsSection>

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
            },
            watch_later_max: 0,
            auto_start_after_scan: false,
            storage_threshold_gb: 20
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
