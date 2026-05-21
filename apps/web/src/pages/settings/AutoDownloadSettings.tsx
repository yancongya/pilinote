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
          favorite_trigger_type: localSettings.favorite_trigger_type ?? (currentAutoDownload as any).favorite_trigger_type ?? 'interval',
          favorite_scan_interval: localSettings.favorite_scan_interval ?? (currentAutoDownload as any).favorite_scan_interval ?? currentAutoDownload.scan_interval ?? 60,
          favorite_cron_expression: localSettings.favorite_cron_expression ?? (currentAutoDownload as any).favorite_cron_expression ?? '',
          watch_later_trigger_type: localSettings.watch_later_trigger_type ?? (currentAutoDownload as any).watch_later_trigger_type ?? 'interval',
          watch_later_scan_interval: localSettings.watch_later_scan_interval ?? (currentAutoDownload as any).watch_later_scan_interval ?? currentAutoDownload.scan_interval ?? 60,
          watch_later_cron_expression: localSettings.watch_later_cron_expression ?? (currentAutoDownload as any).watch_later_cron_expression ?? '',
          subscription_trigger_type: localSettings.subscription_trigger_type ?? (currentAutoDownload as any).subscription_trigger_type ?? 'interval',
          subscription_scan_interval: localSettings.subscription_scan_interval ?? (currentAutoDownload as any).subscription_scan_interval ?? currentAutoDownload.scan_interval ?? 60,
          subscription_cron_expression: localSettings.subscription_cron_expression ?? (currentAutoDownload as any).subscription_cron_expression ?? '',
          concurrent_limit: {
            video: localSettings.concurrent_limit?.video ?? currentAutoDownload.concurrent_limit?.video ?? 3,
            page: localSettings.concurrent_limit?.page ?? currentAutoDownload.concurrent_limit?.page ?? 3
          },
          scan_favorite: localSettings.scan_favorite ?? (currentAutoDownload as any).scan_favorite ?? true,
          scan_watch_later: localSettings.scan_watch_later ?? (currentAutoDownload as any).scan_watch_later ?? true,
          scan_subscription: localSettings.scan_subscription ?? (currentAutoDownload as any).scan_subscription ?? false,
          subscription_max_sources: localSettings.subscription_max_sources ?? (currentAutoDownload as any).subscription_max_sources ?? 10,
          subscription_max_videos: localSettings.subscription_max_videos ?? (currentAutoDownload as any).subscription_max_videos ?? 20,
          subscription_scan: localSettings.subscription_scan ?? (currentAutoDownload as any).subscription_scan ?? { enabled: true, source_list: [] },
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
    scan_favorite: true,
    scan_watch_later: true,
    scan_subscription: false,
    subscription_max_sources: 10,
    subscription_max_videos: 20,
    subscription_scan: { enabled: true, source_list: [] },
    favorite_trigger_type: 'interval',
    favorite_scan_interval: 60,
    favorite_cron_expression: '',
    watch_later_trigger_type: 'interval',
    watch_later_scan_interval: 60,
    watch_later_cron_expression: '',
    subscription_trigger_type: 'interval',
    subscription_scan_interval: 60,
    subscription_cron_expression: '',
    custom_scan: {
      enabled: false,
      folder_list: []
    },
    watch_later_max: 0,
    auto_start_after_scan: false,
    storage_threshold_gb: 20
  }

  // 自定义扫描配置：不再用 enabled 开关，直接用每项 max_videos 控制（0=不扫）
  const folderList = (getCurrentValue('custom_scan.folder_list') ?? []) as FolderScanConfig[]
  const [loadingFavorites, setLoadingFavorites] = useState(false)
  const [customScanTab, setCustomScanTab] = useState<'favorite' | 'watch_later' | 'subscription'>('favorite')
  const subscriptionScan = (getCurrentValue('subscription_scan') ?? (currentSettings as any).subscription_scan ?? { enabled: true, source_list: [] }) as any
  const subscriptionSourceList = (subscriptionScan?.source_list ?? []) as any[]
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false)

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

      const loadSubscriptionSources = async () => {
    setLoadingSubscriptions(true)
    try {
      const result = await apiService.getSubscriptionSources('all', 1, 100, '')
      const raw = (result as any)?.data?.sources ?? (result as any)?.data?.data?.sources ?? []
      if (raw.length === 0) {
        showToast('未获取到订阅源列表', 'error')
        return
      }

      // 若为空则初始化
      if (!Array.isArray(subscriptionSourceList) || subscriptionSourceList.length === 0) {
        const initial = raw.map((s: any) => ({
          source_id: String(s.source_id ?? s.id ?? ''),
          source_type: String(s.type ?? 'favorite_folder'),
          title: String(s.title ?? s.name ?? ''),
          max_videos: 0,
        }))
        handleLocalUpdate('subscription_scan', { enabled: true, source_list: initial })
        showToast(`已加载 ${initial.length} 个订阅源`, 'success')
      } else {
        showToast('订阅源列表已存在', 'info')
      }
    } catch (e) {
      console.error('加载订阅源失败:', e)
      showToast('加载订阅源失败', 'error')
    } finally {
      setLoadingSubscriptions(false)
    }
  }

    const updateSubscriptionSourceConfig = (index: number, field: string, value: any) => {
      const next = [...subscriptionSourceList]
      const item = { ...(next[index] || {}) }
      item[field] = value
      next[index] = item
      handleLocalUpdate('subscription_scan', { enabled: true, source_list: next })
    }

  // 初始化时不自动加载列表（避免无意发请求）；用户手动点“刷新列表”初始化

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

      {/* 扫描范围已合并到“定时扫描”面板 */}

      <SettingsSection title="自定义扫描" subtitle="按来源分别管理扫描数量与目录策略">
        <div className="settings-segmented">
          <button
            type="button"
            className={`settings-segmented-item ${customScanTab === 'favorite' ? 'is-active' : ''}`}
            onClick={() => setCustomScanTab('favorite')}
          >
            <span className="settings-segmented-item-label">收藏夹</span>
            <span className="settings-segmented-item-spacer" />
            <button
              type="button"
              className="settings-segmented-item-icon"
              onClick={(e) => {
                e.stopPropagation()
                loadFavorites()
              }}
              disabled={loadingFavorites}
              aria-label="刷新收藏夹列表"
              title="刷新收藏夹列表"
            >
              <RotateCw size={14} className={loadingFavorites ? 'is-spinning' : ''} />
            </button>
          </button>
          <button
            type="button"
            className={`settings-segmented-item ${customScanTab === 'watch_later' ? 'is-active' : ''}`}
            onClick={() => setCustomScanTab('watch_later')}
          >
            <span className="settings-segmented-item-label">稍后再看</span>
          </button>
          <button
            type="button"
            className={`settings-segmented-item ${customScanTab === 'subscription' ? 'is-active' : ''}`}
            onClick={() => setCustomScanTab('subscription')}
          >
            <span className="settings-segmented-item-label">订阅源</span>
            <span className="settings-segmented-item-spacer" />
            <button
              type="button"
              className="settings-segmented-item-icon"
              onClick={(e) => {
                e.stopPropagation()
                loadSubscriptionSources()
              }}
              disabled={loadingSubscriptions}
              aria-label="刷新订阅源列表"
              title="刷新订阅源列表"
            >
              <RotateCw size={14} className={loadingSubscriptions ? 'is-spinning' : ''} />
            </button>
          </button>
        </div>

        {(() => {
          const def =
            customScanTab === 'favorite'
              ? {
                  label: '收藏夹',
                  enabledField: 'scan_favorite',
                  triggerTypeField: 'favorite_trigger_type',
                  intervalField: 'favorite_scan_interval',
                  cronField: 'favorite_cron_expression',
                }
              : customScanTab === 'watch_later'
                ? {
                    label: '稍后再看',
                    enabledField: 'scan_watch_later',
                    triggerTypeField: 'watch_later_trigger_type',
                    intervalField: 'watch_later_scan_interval',
                    cronField: 'watch_later_cron_expression',
                  }
                : {
                    label: '订阅源',
                    enabledField: 'scan_subscription',
                    triggerTypeField: 'subscription_trigger_type',
                    intervalField: 'subscription_scan_interval',
                    cronField: 'subscription_cron_expression',
                  }

          const enabled = (getCurrentValue(def.enabledField) ?? (currentSettings as any)[def.enabledField]) as boolean
          const triggerType = (getCurrentValue(def.triggerTypeField) ?? (currentSettings as any)[def.triggerTypeField] ?? 'interval') as string

          return (
            <div className="mt-4 grid gap-3">
              <SettingsToggleRow
                label={`启用${def.label}定时扫描`}
                checked={!!enabled}
                onChange={(checked) => handleLocalUpdate(def.enabledField, checked)}
              />

              <SettingsField label="触发方式" icon={<Clock size={18} />}>
                <select
                  className="settings-control settings-select"
                  value={triggerType}
                  onChange={(e) => handleLocalUpdate(def.triggerTypeField, e.target.value)}
                  disabled={!enabled}
                >
                  <option value="interval">间隔执行</option>
                  <option value="cron">Cron 表达式</option>
                </select>
              </SettingsField>

              {triggerType === 'interval' && (
                <SettingsField label="扫描间隔 (分钟)" icon={<Clock size={18} />}>
                  <select
                    className="settings-control settings-select"
                    value={(getCurrentValue(def.intervalField) ?? (currentSettings as any)[def.intervalField] ?? 60) as number}
                    onChange={(e) => handleLocalUpdate(def.intervalField, parseInt(e.target.value))}
                    disabled={!enabled}
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

              {triggerType === 'cron' && (
                <SettingsField label="Cron 表达式" icon={<Hash size={18} />} hint="例：0 0 * * * 表示每天 0 点">
                  <input
                    type="text"
                    className="settings-control settings-input"
                    value={(getCurrentValue(def.cronField) ?? (currentSettings as any)[def.cronField] ?? '') as string}
                    onChange={(e) => handleLocalUpdate(def.cronField, e.target.value)}
                    placeholder="分 时 日 月 周"
                    disabled={!enabled}
                  />
                </SettingsField>
              )}
            </div>
          )
        })()}

        {customScanTab === 'favorite' && (
          <div className="mt-4">
            <div className="mt-3">
              <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
                视频数为 0 表示不扫描该收藏夹，设置大于 0 的数值后才进行扫描。
              </div>

              {loadingFavorites ? (
                <div className="py-8 px-4 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  正在加载收藏夹列表...
                </div>
              ) : folderList.length === 0 ? (
                <div className="py-8 px-4 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  点击"刷新列表"按钮获取收藏夹列表
                </div>
              ) : (
                <>
                  {folderList.map((config, index) => (
                    <div key={index} className="auto-download-folder-row" title={config.folder_name}>
                      <div className="auto-download-folder-name">{config.folder_name}</div>
                      <input
                        type="number"
                        className="settings-input auto-download-folder-input"
                        value={config.max_videos}
                        onChange={(e) => updateFolderConfig(index, 'max_videos', parseInt(e.target.value) || 0)}
                        min={0}
                        max={999}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {customScanTab === 'watch_later' && (
          <div className="mt-4">
            <SettingsField
              label="稍后再看扫描数量"
              icon={<ClockIcon size={18} />}
              hint="为 0 表示不扫描；大于 0 时扫描并限制处理数量"
            >
              <input
                type="number"
                className="settings-control settings-input"
                min="0"
                max="999"
                value={getCurrentValue('watch_later_max') ?? currentSettings.watch_later_max}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0
                  handleLocalUpdate('watch_later_max', Math.max(0, Math.min(999, value)))
                }}
              />
            </SettingsField>
          </div>
        )}

        {customScanTab === 'subscription' && (
          <div className="mt-4">
            <div className="mt-3">
              <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
                视频数为 0 表示不扫描该订阅源，设置大于 0 的数值后才进行扫描。
              </div>

              {loadingSubscriptions ? (
                <div className="py-8 px-4 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  正在加载订阅源列表...
                </div>
              ) : subscriptionSourceList.length === 0 ? (
                <div className="py-8 px-4 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  点击"刷新列表"按钮获取订阅源列表
                </div>
              ) : (
                <>
                  {subscriptionSourceList.map((config, index) => (
                    <div
                      key={`${config.source_type ?? 'source'}:${config.source_id ?? index}`}
                      className="auto-download-folder-row"
                      title={String(config.title ?? '')}
                    >
                      <div className="auto-download-folder-name">{String(config.title ?? '')}</div>
                      <input
                        type="number"
                        className="settings-input auto-download-folder-input"
                        value={Number(config.max_videos ?? 0)}
                        onChange={(e) => updateSubscriptionSourceConfig(index, 'max_videos', parseInt(e.target.value) || 0)}
                        min={0}
                        max={999}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
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
          <div className="font-semibold mb-1">工作流程说明：</div>
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
