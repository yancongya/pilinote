import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, Download, Loader2, Trash2, Cpu, AlertCircle, RefreshCw, Play } from 'lucide-react'
import { useToast } from '../Toast'
import { localAsrModelService, type LocalAsrModel } from '../../services/localAsrModels'

export function LocalAsrModelPanel() {
  const { showToast } = useToast()
  const [models, setModels] = useState<LocalAsrModel[]>([])
  const [activeModelId, setActiveModelId] = useState('base')
  const [loading, setLoading] = useState(false)
  const [busyModelId, setBusyModelId] = useState<string | null>(null)

  const activeModel = useMemo(() => models.find(m => m.active) || models.find(m => m.id === activeModelId), [models, activeModelId])

  const refresh = async () => {
    setLoading(true)
    try {
      const result = await localAsrModelService.listModels()
      setModels(result.models || [])
      setActiveModelId(result.active_model_id || result.active_model?.id || 'base')
    } catch (error) {
      showToast(`加载本地 ASR 模型失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleDownload = async (modelId: string) => {
    setBusyModelId(modelId)
    try {
      await localAsrModelService.downloadModel(modelId)
      showToast(`开始下载模型: ${modelId}`, 'info')
      await refresh()
    } catch (error) {
      showToast(`下载失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
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

  const handleActivate = async (modelId: string) => {
    setBusyModelId(modelId)
    try {
      await localAsrModelService.setActiveModel(modelId)
      showToast(`已切换为: ${modelId}`, 'success')
      await refresh()
    } catch (error) {
      showToast(`切换失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setBusyModelId(null)
    }
  }

  return (
    <div className="settings-group">
      <div className="settings-group-header">
        <h3 className="settings-group-title">
          <Cpu size={18} />
          本地 ASR 模型
        </h3>
        <div className="settings-group-actions">
          <button className="settings-add-btn settings-secondary-btn" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
            刷新
          </button>
        </div>
      </div>

      <div className="settings-item">
        <div className="settings-label-row">
          <label className="settings-label">当前激活模型</label>
          <span className="settings-badge">{activeModel?.id || 'base'}</span>
        </div>
        <p className="settings-helper-text">未就绪时，视频 AI 分析将被禁用；图文类分析不受影响。</p>
      </div>

      <div className="settings-model-list">
        {models.map(model => {
          const progress = Math.max(0, Math.min(100, model.progress || 0))
          const sizeText = `${(model.estimated_size_mb / 1024).toFixed(model.estimated_size_mb >= 1024 ? 1 : 0)} GB`
          const downloadedText = model.downloaded_bytes > 0
            ? `${(model.downloaded_bytes / 1024 / 1024 / 1024).toFixed(model.downloaded_bytes >= 1024 * 1024 * 1024 ? 1 : 2)} GB`
            : '0 MB'
          return (
            <div key={model.id} className={`settings-model-card ${model.active ? 'active' : ''}`}>
              <div className="settings-model-card-header">
                <div>
                  <div className="settings-model-card-title">
                    {model.name}
                    {model.active && <CheckCircle size={14} />}
                  </div>
                  <div className="settings-model-card-subtitle">{model.repo_id}</div>
                </div>
                <div className={`settings-model-state state-${model.status}`}>
                  {model.status === 'ready' && '已下载'}
                  {model.status === 'downloading' && '下载中'}
                  {model.status === 'failed' && '失败'}
                  {model.status === 'not_downloaded' && '未下载'}
                </div>
              </div>

              <div className="settings-model-progress">
                <div className="settings-model-progress-bar">
                  <div style={{ width: `${progress}%` }} />
                </div>
                <div className="settings-model-progress-meta">
                  <span>{progress}%</span>
                  <span>{downloadedText} / {sizeText}</span>
                </div>
              </div>

              {model.error && (
                <div className="settings-model-error">
                  <AlertCircle size={14} />
                  <span>{model.error}</span>
                </div>
              )}

              <div className="settings-model-actions">
                <button
                  type="button"
                  className="settings-model-action-btn"
                  onClick={() => handleActivate(model.id)}
                  disabled={busyModelId === model.id || model.active}
                >
                  <Play size={12} />
                  设为当前
                </button>
                {model.ready ? (
                  <button
                    type="button"
                    className="settings-model-action-btn danger"
                    onClick={() => handleDelete(model.id)}
                    disabled={busyModelId === model.id}
                  >
                    {busyModelId === model.id ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                    删除缓存
                  </button>
                ) : (
                  <button
                    type="button"
                    className="settings-model-action-btn primary"
                    onClick={() => handleDownload(model.id)}
                    disabled={busyModelId === model.id || model.status === 'downloading'}
                  >
                    {busyModelId === model.id ? <Loader2 size={12} className="spin" /> : <Download size={12} />}
                    下载模型
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
