import { useState, forwardRef, useImperativeHandle, useEffect } from 'react'
import { 
  Clock,
  RotateCw,
  Zap,
  Hash
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settings'
import ConfirmModal from '../../components/ConfirmModal'
import { useToast } from '../../components/Toast'

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
          advanced_scan: {
            enabled: false,
            folder_rules: [{
              match_type: 'all',
              pattern: '',
              enabled: true,
              max_videos: 20,
              max_folders: 10,
              sort_by: 'time',
              sort_order: 'desc'
            }]
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
          advanced_scan: {
            enabled: localSettings.advanced_scan?.enabled ?? currentAutoDownload.advanced_scan?.enabled ?? false,
            folder_rules: localSettings.advanced_scan?.folder_rules ?? currentAutoDownload.advanced_scan?.folder_rules ?? []
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
    advanced_scan: {
      enabled: false,
      folder_rules: [{
        match_type: 'all',
        pattern: '',
        enabled: true,
        max_videos: 20,
        max_folders: 10,
        sort_by: 'time',
        sort_order: 'desc'
      }]
    }
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

      {/* 高级扫描设置 */}
      <div className="stg-group">
        <div className="stg-group-header">
          <span className="stg-group-title">高级扫描设置</span>
          <span className="stg-group-subtitle">精确控制扫描的收藏夹和视频数量</span>
        </div>
        
        <div className="stg-toggles">
          <label className="stg-toggle">
            <div className="stg-toggle-content">
              <span className="stg-toggle-label">启用高级扫描</span>
              <span className="stg-toggle-subtitle">使用自定义规则筛选收藏夹</span>
            </div>
            <input
              type="checkbox"
              className="stg-toggle-input"
              checked={getCurrentValue('advanced_scan.enabled') ?? false}
              onChange={(e) => handleLocalUpdate('advanced_scan.enabled', e.target.checked)}
            />
          </label>
        </div>

        {getCurrentValue('advanced_scan.enabled') && (
          <div className="stg-list" style={{ marginTop: '16px' }}>
            <div className="stg-item stg-item-col">
              <div className="stg-item-label-row">
                <Hash size={18} className="stg-item-icon" />
                <span className="stg-item-label">匹配类型</span>
              </div>
              <select
                className="stg-select"
                value={getCurrentValue('advanced_scan.folder_rules.0.match_type') ?? 'all'}
                onChange={(e) => {
                  const matchType = e.target.value as 'all' | 'regex' | 'name'
                  handleLocalUpdate('advanced_scan.folder_rules', [{
                    match_type: matchType,
                    pattern: '',
                    enabled: true,
                    max_videos: 20,
                    max_folders: 10,
                    sort_by: 'time',
                    sort_order: 'desc'
                  }])
                }}
              >
                <option value="all">全部收藏夹</option>
                <option value="regex">正则表达式</option>
                <option value="name">文件夹名称</option>
              </select>
            </div>

            {(getCurrentValue('advanced_scan.folder_rules.0.match_type') === 'regex' || 
              getCurrentValue('advanced_scan.folder_rules.0.match_type') === 'name') && (
              <div className="stg-item stg-item-col">
                <div className="stg-item-label-row">
                  <Hash size={18} className="stg-item-icon" />
                  <span className="stg-item-label">
                    {getCurrentValue('advanced_scan.folder_rules.0.match_type') === 'regex' ? '正则表达式' : '文件夹名称'}
                  </span>
                  <span className="stg-hint-inline">
                    {getCurrentValue('advanced_scan.folder_rules.0.match_type') === 'regex' 
                      ? '例：^Blender|^AI 匹配以Blender或AI开头的收藏夹'
                      : '例：Blender 匹配包含Blender的收藏夹'}
                  </span>
                </div>
                <input
                  type="text"
                  className="stg-input"
                  value={getCurrentValue('advanced_scan.folder_rules.0.pattern') ?? ''}
                  onChange={(e) => {
                    const currentRules = getCurrentValue('advanced_scan.folder_rules') || [{}]
                    handleLocalUpdate('advanced_scan.folder_rules', [{
                      ...currentRules[0],
                      pattern: e.target.value
                    }])
                  }}
                  placeholder={
                    getCurrentValue('advanced_scan.folder_rules.0.match_type') === 'regex'
                      ? '输入正则表达式'
                      : '输入文件夹名称'
                  }
                />
              </div>
            )}

            <div className="stg-item stg-item-col">
              <div className="stg-item-label-row">
                <Clock size={18} className="stg-item-icon" />
                <span className="stg-item-label">每个收藏夹最大视频数</span>
              </div>
              <select
                className="stg-select"
                value={getCurrentValue('advanced_scan.folder_rules.0.max_videos') ?? 20}
                onChange={(e) => {
                  const currentRules = getCurrentValue('advanced_scan.folder_rules') || [{}]
                  handleLocalUpdate('advanced_scan.folder_rules', [{
                    ...currentRules[0],
                    max_videos: parseInt(e.target.value)
                  }])
                }}
              >
                <option value={10}>10 个视频</option>
                <option value={20}>20 个视频</option>
                <option value={50}>50 个视频</option>
                <option value={100}>100 个视频</option>
                <option value={999}>不限</option>
              </select>
            </div>

            <div className="stg-item stg-item-col">
              <div className="stg-item-label-row">
                <Clock size={18} className="stg-item-icon" />
                <span className="stg-item-label">最大扫描收藏夹数</span>
              </div>
              <select
                className="stg-select"
                value={getCurrentValue('advanced_scan.folder_rules.0.max_folders') ?? 10}
                onChange={(e) => {
                  const currentRules = getCurrentValue('advanced_scan.folder_rules') || [{}]
                  handleLocalUpdate('advanced_scan.folder_rules', [{
                    ...currentRules[0],
                    max_folders: parseInt(e.target.value)
                  }])
                }}
              >
                <option value={5}>5 个收藏夹</option>
                <option value={10}>10 个收藏夹</option>
                <option value={20}>20 个收藏夹</option>
                <option value={50}>50 个收藏夹</option>
                <option value={999}>不限</option>
              </select>
            </div>

            <div className="stg-item stg-item-col">
              <div className="stg-item-label-row">
                <RotateCw size={18} className="stg-item-icon" />
                <span className="stg-item-label">排序方式</span>
              </div>
              <select
                className="stg-select"
                value={getCurrentValue('advanced_scan.folder_rules.0.sort_by') ?? 'time'}
                onChange={(e) => {
                  const currentRules = getCurrentValue('advanced_scan.folder_rules') || [{}]
                  handleLocalUpdate('advanced_scan.folder_rules', [{
                    ...currentRules[0],
                    sort_by: e.target.value
                  }])
                }}
              >
                <option value="time">按时间</option>
                <option value="name">按名称</option>
                <option value="count">按视频数</option>
              </select>
            </div>

            <div className="stg-item stg-item-col">
              <div className="stg-item-label-row">
                <RotateCw size={18} className="stg-item-icon" />
                <span className="stg-item-label">排序顺序</span>
              </div>
              <select
                className="stg-select"
                value={getCurrentValue('advanced_scan.folder_rules.0.sort_order') ?? 'desc'}
                onChange={(e) => {
                  const currentRules = getCurrentValue('advanced_scan.folder_rules') || [{}]
                  handleLocalUpdate('advanced_scan.folder_rules', [{
                    ...currentRules[0],
                    sort_order: e.target.value
                  }])
                }}
              >
                <option value="desc">降序</option>
                <option value="asc">升序</option>
              </select>
            </div>
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
