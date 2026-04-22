import { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useSettingsStore } from '../../stores/settings'
import { Monitor, Music, HardDrive, Gauge, RotateCw, Video } from 'lucide-react'
import ConfirmModal from '../../components/ConfirmModal'
import { useToast } from '../../components/Toast'
import {
  SettingsActionRow,
  SettingsField,
  SettingsLoadingState,
  SettingsSection,
  SettingsToggleRow,
} from './shared'

// 定义ref类型
interface DownloadSettingsRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

const DownloadSettings = forwardRef<DownloadSettingsRef>((_props, ref) => {
  const { settings, loading, updateSettings, resetSettings } = useSettingsStore()
  const { showToast } = useToast()
  
  // 本地状态暂存修改
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({
    video: {},
    metadata: {}
  })
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => {
      return Object.keys(localSettings.video || {}).length > 0 ||
             Object.keys(localSettings.metadata || {}).length > 0 ||
             'max_concurrent' in localSettings ||
             'speed_limit' in localSettings
    },
    saveSettings: async () => {
      if (Object.keys(localSettings.video || {}).length === 0 &&
          Object.keys(localSettings.metadata || {}).length === 0 &&
          !('max_concurrent' in localSettings) &&
          !('speed_limit' in localSettings)) {
        setSavedStatus('idle')
        return
      }

      setSavedStatus('saving')

      try {
        const currentDownload = settings?.download || {
          video: {
            default_quality: 64,
            audio_bitrate: 192,
            codec: 'avc',
            output_format: 'mp4'
          },
          max_concurrent: 3,
          speed_limit: 0,
          metadata: {
            enable_nfo: true,
            enable_subtitle: true,
            enable_cover: true,
            enable_avatar: false
          }
        }

        const mergedSettings = {
          video: { ...currentDownload.video, ...(localSettings.video || {}) },
          max_concurrent: localSettings.max_concurrent ?? currentDownload.max_concurrent,
          speed_limit: localSettings.speed_limit ?? currentDownload.speed_limit,
          metadata: { ...currentDownload.metadata, ...(localSettings.metadata || {}) }
        }

        await updateSettings({
          download: mergedSettings
        })
        
        setSavedStatus('saved')
        
        setLocalSettings({
          video: {},
          metadata: {}
        })
        
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
  }, [])

  // 本地更新函数
  const handleLocalUpdate = useCallback((field: string, value: any) => {
    setLocalSettings(prev => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.')
        return {
          ...prev,
          [parent]: {
            ...(prev[parent] || {}),
            [child]: value
          }
        }
      }
      return {
        ...prev,
        [field]: value
      }
    })
  }, [])

  // 获取当前设置值（优先使用本地暂存的值）
  const getCurrentValue = useCallback((field: string) => {
    if (!settings?.download) return undefined
    
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      const localValue = localSettings[parent]?.[child]
      if (localValue !== undefined) {
        return localValue
      }
      return (settings.download as any)[parent]?.[child]
    }
    
    if (field in localSettings) {
      return localSettings[field]
    }
    return (settings.download as any)[field]
  }, [localSettings, settings])

  const handleReset = async () => {
    setShowResetConfirm(true)
  }

  const confirmReset = async () => {
    await resetSettings('download')
    setLocalSettings({
      video: {},
      metadata: {}
    })
    setShowResetConfirm(false)
    showToast('下载设置已重置', 'success')
  }

  if (!settings) {
    return <SettingsLoadingState label="加载中..." />
  }

  return (
    <div>
      <SettingsSection title="视频参数" subtitle="分辨率、音频和编码">
        <SettingsField
          label="分辨率"
          icon={<Monitor size={18} />}
          hint="下载时，将会优先使用此处参数。若目标资源不支持此处选定的参数，则会使用其支持的最高参数。"
        >
          <select
            className="settings-control settings-select"
            value={getCurrentValue('video.default_quality') || 64}
            onChange={(e) => handleLocalUpdate('video.default_quality', parseInt(e.target.value))}
            disabled={loading}
            aria-label="选择默认分辨率"
          >
            <option value={16}>360P</option>
            <option value={32}>480P</option>
            <option value={64}>720P</option>
            <option value={80}>1080P</option>
            <option value={112}>1080P+</option>
            <option value={116}>4K</option>
          </select>
        </SettingsField>

        <SettingsField label="音频码率" icon={<Music size={18} />}>
          <select
            className="settings-control settings-select"
            value={getCurrentValue('video.audio_bitrate') || 192}
            onChange={(e) => handleLocalUpdate('video.audio_bitrate', parseInt(e.target.value))}
            disabled={loading}
            aria-label="选择默认音频码率"
          >
            <option value={64}>64K</option>
            <option value={128}>128K</option>
            <option value={132}>132K</option>
            <option value={192}>192K</option>
            <option value={30232}>杜比全景声320K</option>
            <option value={30251}>Hi-Res 无损</option>
            <option value={30250}>无损FLAC</option>
          </select>
        </SettingsField>

        <SettingsField label="编码格式" icon={<Video size={18} />}>
          <select
            className="settings-control settings-select"
            value={getCurrentValue('video.codec') || 'avc'}
            onChange={(e) => handleLocalUpdate('video.codec', e.target.value)}
            disabled={loading}
            aria-label="选择默认编码格式"
          >
            <option value="avc">AVC (H.264)</option>
            <option value="hevc">HEVC (H.265)</option>
            <option value="av1">AV1</option>
            <option value="vp9">VP9</option>
          </select>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title="下载性能" subtitle="并发和速度控制">
        <SettingsField label="最大并发下载数" icon={<HardDrive size={18} />}>
          <select
            className="settings-control settings-select"
            value={getCurrentValue('max_concurrent') || 3}
            onChange={(e) => handleLocalUpdate('max_concurrent', parseInt(e.target.value))}
            disabled={loading}
            aria-label="选择最大并发下载数"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
        </SettingsField>

        <SettingsField
          label="速度限制 (KB/s)"
          icon={<Gauge size={18} />}
          hint="0 表示不限制速度"
        >
          <input
            type="number"
            className="settings-control settings-input"
            value={getCurrentValue('speed_limit') || 0}
            onChange={(e) => handleLocalUpdate('speed_limit', parseInt(e.target.value) || 0)}
            min="0"
            disabled={loading}
            placeholder="0 表示不限制"
            aria-label="输入速度限制"
            inputMode="numeric"
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection title="元数据" subtitle="字幕、封面和头像">
        <SettingsToggleRow
          label="启用字幕下载"
          checked={(getCurrentValue('metadata.enable_subtitle') as boolean) ?? true}
          onChange={(checked) => handleLocalUpdate('metadata.enable_subtitle', checked)}
          disabled={loading}
        />
        <SettingsToggleRow
          label="启用 NFO 文件"
          checked={(getCurrentValue('metadata.enable_nfo') as boolean) ?? true}
          onChange={(checked) => handleLocalUpdate('metadata.enable_nfo', checked)}
          disabled={loading}
        />
        <SettingsToggleRow
          label="启用封面下载"
          checked={(getCurrentValue('metadata.enable_cover') as boolean) ?? true}
          onChange={(checked) => handleLocalUpdate('metadata.enable_cover', checked)}
          disabled={loading}
        />
        <SettingsToggleRow
          label="启用头像下载"
          checked={(getCurrentValue('metadata.enable_avatar') as boolean) ?? false}
          onChange={(checked) => handleLocalUpdate('metadata.enable_avatar', checked)}
          disabled={loading}
        />
      </SettingsSection>

      <SettingsActionRow>
        <button
          className="settings-button settings-button-secondary settings-button-block"
          onClick={handleReset}
          disabled={loading}
          aria-label="重置下载设置"
        >
          <RotateCw size={16} />
          <span>重置下载设置</span>
        </button>
      </SettingsActionRow>

      {/* 重置确认弹窗 */}
      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={confirmReset}
        title="重置下载设置"
        message="确定要重置下载设置吗？这将恢复所有下载设置为默认值，但不会影响已保存的视频和数据。"
        confirmText="确定重置"
        cancelText="取消"
        confirmVariant="danger"
        loading={loading}
      />
    </div>
  )
})

export default DownloadSettings
