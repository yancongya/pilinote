import { useEffect, useMemo, useState } from 'react'
import Modal from '../../components/Modal'
import { aiPromptTemplatesService } from '../../services/aiPromptTemplates'
import { useToast } from '../../components/Toast'
import type { PromptTemplateMeta } from '../../services/promptCatalog'
import { SettingsField } from './shared'

interface AiPromptTemplatesProps {
  isOpen: boolean
  onClose: () => void
  card: PromptTemplateMeta | null
  onSaved?: (templates: Record<string, any>) => void
}

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

const getNestedValue = (obj: Record<string, any>, path: string[]) => {
  let cursor: any = obj
  for (const key of path) {
    if (cursor == null) return undefined
    cursor = cursor[key]
  }
  return cursor
}

const setNestedValue = (obj: Record<string, any>, path: string[], value: any) => {
  let cursor: any = obj
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i]
    if (typeof cursor[key] !== 'object' || cursor[key] === null) {
      cursor[key] = {}
    }
    cursor = cursor[key]
  }
  cursor[path[path.length - 1]] = value
}

export default function AiPromptTemplates({ isOpen, onClose, card, onSaved }: AiPromptTemplatesProps) {
  const { showToast } = useToast()
  const [templates, setTemplates] = useState<Record<string, any>>({})
  const [defaultTemplates, setDefaultTemplates] = useState<Record<string, any>>({})
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const activeMeta = useMemo(
    () => card,
    [card],
  )

  useEffect(() => {
    if (!isOpen || !card) return
    const load = async () => {
      setLoading(true)
      try {
        const [currentRes, defaultRes] = await Promise.all([
          aiPromptTemplatesService.getTemplates(),
          aiPromptTemplatesService.getDefaultTemplates(),
        ])
        const currentTemplates = currentRes.templates || {}
        const baseTemplates = defaultRes.templates || {}
        setTemplates(currentTemplates)
        setDefaultTemplates(baseTemplates)

        const currentValue = getNestedValue(currentTemplates, card.path)
        if (card.kind === 'lines') {
          setDraft(Array.isArray(currentValue) ? currentValue.join('\n') : '')
        } else {
          setDraft(typeof currentValue === 'string' ? currentValue : '')
        }
      } catch (error) {
        showToast(`加载模板失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOpen, card, showToast])

  const resetCurrent = () => {
    if (!activeMeta) return
      const currentDefault = getNestedValue(defaultTemplates, activeMeta.path)
      setDraft(activeMeta.kind === 'lines' ? (Array.isArray(currentDefault) ? currentDefault.join('\n') : '') : (typeof currentDefault === 'string' ? currentDefault : ''))
  }

  const handleSave = async () => {
    if (!activeMeta) return
    setSaving(true)
    try {
      const nextTemplates = deepClone(templates)
      const value = activeMeta.kind === 'lines'
        ? draft.split('\n').map(line => line.trim()).filter(Boolean)
        : draft.trim()
      setNestedValue(nextTemplates, activeMeta.path, value)
      await aiPromptTemplatesService.saveTemplates(nextTemplates)
      setTemplates(nextTemplates)
      onSaved?.(nextTemplates)
      showToast('提示词已保存', 'success')
      onClose()
    } catch (error) {
      showToast(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!activeMeta) return null
  const headerMetaText = `${activeMeta.category} · ${activeMeta.title}`

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`编辑 ${headerMetaText}`}
      size="lg"
      closeOnOverlayClick={true}
      className="settings-prompt-modal"
      footer={(
        <div className="settings-prompt-footer">
          <button
            className="settings-button settings-button-secondary"
            onClick={resetCurrent}
            disabled={loading || saving}
            title="恢复为默认模板"
          >
            重置
          </button>
          <div className="settings-prompt-footer-right">
            <button className="settings-button settings-button-secondary" onClick={onClose} disabled={saving}>
              取消
            </button>
            <button className="settings-button settings-button-primary" onClick={handleSave} disabled={loading || saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}
    >
      <div className="settings-prompt-editor">
        <div className="settings-prompt-summary">
          <span className="settings-badge">{activeMeta.category}</span>
          <span className="settings-meta">{activeMeta.title}</span>
        </div>
        {loading ? (
          <div className="settings-meta">加载模板中...</div>
        ) : (
          <div className="settings-prompt-form">
            <div className="settings-prompt-form-head">
              <div className="settings-prompt-form-title">Prompt</div>
              <div className="settings-prompt-form-hint">仅修改当前卡片对应的模板；保存后立即生效</div>
            </div>
            <textarea
              className="settings-prompt-textarea"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              spellCheck={false}
            />
          </div>
        )}
      </div>

      <style>{`
        .settings-prompt-footer {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .settings-prompt-footer-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .settings-prompt-modal .settings-modal-body {
          padding: 18px;
        }

        .settings-prompt-modal .settings-modal-header {
          padding: 12px 16px;
        }

        .settings-prompt-modal .settings-modal-title {
          font-size: 16px;
        }

        .settings-prompt-modal .settings-prompt-summary {
          display: none;
        }

        .settings-prompt-form {
          display: grid;
          gap: 10px;
        }

        .settings-prompt-form-head {
          display: grid;
          gap: 4px;
        }

        .settings-prompt-form-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
          line-height: 1.2;
        }

        .settings-prompt-form-hint {
          font-size: 12px;
          color: var(--color-text-tertiary);
          line-height: 1.3;
        }

        .settings-prompt-textarea {
          width: 100%;
          min-height: 280px;
          padding: 12px 12px;
          border-radius: 12px;
          border: 1px solid var(--color-border);
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: 13px;
          line-height: 1.55;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          resize: vertical;
          outline: none;
        }

        .settings-prompt-textarea:focus {
          border-color: rgba(67, 110, 238, 0.6);
          box-shadow: 0 0 0 3px rgba(67, 110, 238, 0.12);
        }
      `}</style>
    </Modal>
  )
}
