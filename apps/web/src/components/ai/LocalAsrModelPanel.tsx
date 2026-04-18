import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle, Download, Loader2, Trash2, Cpu, AlertCircle, RefreshCw, Play, ChevronDown } from 'lucide-react'
import { useToast } from '../Toast'
import { localAsrModelService, type LocalAsrModel } from '../../services/localAsrModels'

export function LocalAsrModelPanel() {
  const { showToast } = useToast()
  const [models, setModels] = useState<LocalAsrModel[]>([])
  const [activeModelId, setActiveModelId] = useState('base')
  const [selectedModelId, setSelectedModelId] = useState('base')
  const [loading, setLoading] = useState(false)
  const [busyModelId, setBusyModelId] = useState<string | null>(null)
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0)
  const lastProgressRef = useRef<{ bytes: number; at: number } | null>(null)
  const refreshingRef = useRef(false)

  const activeModel = useMemo(
    () => models.find(m => m.active) || models.find(m => m.id === activeModelId),
    [models, activeModelId],
  )
  const selectedModel = useMemo(
    () => models.find(m => (m.id || m.model_id) === selectedModelId) || activeModel || models[0],
    [models, selectedModelId, activeModel],
  )
  const selectedModelKey = selectedModel?.id || selectedModel?.model_id || ''

  const formatSize = (bytes: number | null | undefined) => {
    const value = Number(bytes)
    if (!Number.isFinite(value) || value <= 0) return '-'
    const gb = value / 1024 / 1024 / 1024
    return `${gb.toFixed(gb >= 1 ? 1 : 2)} GB`
  }

  const formatDownloaded = (bytes: number | null | undefined) => {
    const value = Number(bytes)
    if (!Number.isFinite(value) || value <= 0) return '0 MB'
    const gb = value / 1024 / 1024 / 1024
    return `${gb.toFixed(gb >= 1 ? 1 : 2)} GB`
  }

  const formatSpeed = (bytesPerSecond: number | null | undefined) => {
    const value = Number(bytesPerSecond)
    if (!Number.isFinite(value) || value <= 0) return '--'
    const kb = value / 1024
    if (kb < 1024) {
      return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB/s`
    }
    const mb = kb / 1024
    if (mb < 1024) {
      return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB/s`
    }
    const gb = mb / 1024
    return `${gb.toFixed(1)} GB/s`
  }

  const refresh = async (options?: { silent?: boolean }) => {
    if (refreshingRef.current) return
    refreshingRef.current = true
    const silent = options?.silent ?? false
    if (!silent) {
      setLoading(true)
    }
    try {
      const result = await localAsrModelService.listModels()
      setModels(result.models || [])
      const nextActiveId = result.active_model_id || result.active_model?.id || 'base'
      setActiveModelId(nextActiveId)
      setSelectedModelId(prev => (result.models?.some(model => (model.id || model.model_id) === prev) ? prev : nextActiveId))

      const downloadingModel = result.models?.find(model => model.status === 'downloading')
      const now = Date.now()
      if (downloadingModel) {
        const currentBytes = downloadingModel.downloaded_bytes || 0
        const previous = lastProgressRef.current
        if (previous && currentBytes >= previous.bytes && now > previous.at) {
          const deltaBytes = currentBytes - previous.bytes
          const deltaSeconds = (now - previous.at) / 1000
          setDownloadSpeed(deltaSeconds > 0 ? deltaBytes / deltaSeconds : 0)
        }
        lastProgressRef.current = { bytes: currentBytes, at: now }
      } else {
        lastProgressRef.current = null
        setDownloadSpeed(0)
      }
    } catch (error) {
      showToast(`加载本地 ASR 模型失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      if (!silent) {
        setLoading(false)
      }
      refreshingRef.current = false
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    const hasDownloading = models.some(model => model.status === 'downloading')
    if (!hasDownloading) return undefined

    const timer = window.setInterval(() => {
      void refresh({ silent: true })
    }, 1500)

    return () => window.clearInterval(timer)
  }, [models])

  const handleSelectedAction = async () => {
    if (!selectedModel) return
    const modelId = selectedModel.id || selectedModel.model_id
    if (!modelId) return
    setBusyModelId(modelId)
    try {
      if (!selectedModel.ready) {
        await localAsrModelService.downloadModel(modelId)
        showToast(`开始下载模型: ${selectedModel.name}`, 'info')
      } else {
        await localAsrModelService.setActiveModel(modelId)
        showToast(`已切换为: ${selectedModel.name}`, 'success')
      }
      await refresh()
    } catch (error) {
      showToast(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setBusyModelId(null)
    }
  }

  const handleDelete = async (modelId: string) => {
    setBusyModelId(modelId)
    try {
      await localAsrModelService.deleteModel(modelId)
      showToast(`已删除模型缓存: ${modelId}`, 'success')
      await refresh()
    } catch (error) {
      showToast(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setBusyModelId(null)
    }
  }

  const selectedTotalBytes = selectedModel?.total_bytes || selectedModel?.estimated_size_mb || 0
  const selectedProgress = selectedModel
    ? Math.max(0, Math.min(100, selectedModel.status === 'downloading' && selectedModel.total_bytes > 0
      ? (selectedModel.downloaded_bytes / selectedModel.total_bytes) * 100
      : selectedModel.progress || 0))
    : 0
  const selectedSizeText = selectedTotalBytes ? formatSize(selectedTotalBytes) : '-'
  const selectedDownloadedText = selectedModel ? formatDownloaded(selectedModel.downloaded_bytes) : '0 MB'
  const selectedSpeedText = selectedModel?.status === 'downloading' ? formatSpeed(downloadSpeed) : '--'
  const selectedStatusLabel = selectedModel
    ? ({
        ready: '已下载',
        downloading: '下载中',
        failed: '失败',
        not_downloaded: '未下载',
      } as const)[selectedModel.status] || '未知'
    : '未知'

  return (
    <div className="settings-group">
      <div className="settings-group-header">
        <h3 className="settings-group-title">
          <Cpu size={18} />
          本地 ASR 模型
        </h3>
        <div className="settings-group-actions">
          <button className="settings-add-btn settings-secondary-btn" onClick={() => void refresh()} disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
            刷新
          </button>
        </div>
      </div>

      <div className="settings-item settings-model-selector">
        <div className="settings-label-row">
          <label className="settings-label">模型选择</label>
        </div>
        <p className="settings-helper-text">未就绪时，视频 AI 分析将被禁用；图文类分析不受影响。</p>

        <div className="settings-model-selector-bar">
          <div className="settings-select-wrap">
            <select
              className="settings-select settings-model-select"
              value={selectedModelId}
              onChange={e => setSelectedModelId(e.target.value)}
              disabled={models.length === 0}
            >
              {models.map(model => (
                <option key={model.id || model.model_id} value={model.id || model.model_id || ''}>
                  {model.name} · {model.ready ? '已下载' : '未下载'}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="settings-select-icon" />
          </div>

          <button
            type="button"
            className="settings-model-icon-btn primary"
            onClick={handleSelectedAction}
            disabled={loading || busyModelId === selectedModelKey || !selectedModelKey}
            aria-label={selectedModel?.ready ? '切换并使用' : '下载并切换'}
            title={selectedModel?.ready ? '切换并使用' : '下载并切换'}
          >
            {busyModelId === selectedModelKey ? (
              <Loader2 size={14} className="spin" />
            ) : selectedModel?.ready ? (
              <Play size={14} />
            ) : (
              <Download size={14} />
            )}
          </button>

          <button
            type="button"
            className="settings-model-icon-btn danger"
            onClick={() => {
              if (!selectedModel || !selectedModel.ready || !selectedModelKey) return
              handleDelete(selectedModelKey)
            }}
            disabled={loading || busyModelId === selectedModelKey || !selectedModel?.ready || !selectedModelKey}
            aria-label="删除缓存"
            title="删除缓存"
          >
            {busyModelId === selectedModelKey ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
          </button>
        </div>
        {selectedModel && (
          <div className={`settings-model-card ${selectedModel.active ? 'active' : ''} settings-model-preview`}>
            <div className="settings-model-card-header">
              <div className="settings-model-card-main">
              <div className="settings-model-card-title">
                  {selectedModel.name}
                  {selectedModel.active && <CheckCircle size={14} />}
                </div>
              </div>
              <div className={`settings-model-state state-${selectedModel.status || 'not_downloaded'}`}>
                {selectedStatusLabel}
              </div>
            </div>

            <div className="settings-model-progress">
              <div className="settings-model-progress-bar">
                <div style={{ width: `${selectedProgress}%` }} />
              </div>
            <div className="settings-model-progress-meta">
              <span>{selectedProgress}%</span>
              <span>{selectedDownloadedText} / {selectedSizeText}</span>
              <span>{selectedSpeedText}</span>
            </div>
          </div>

            {selectedModel.error && (
              <div className="settings-model-error">
                <AlertCircle size={14} />
                <span>{selectedModel.error}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
