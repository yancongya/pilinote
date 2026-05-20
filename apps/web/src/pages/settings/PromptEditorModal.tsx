import { useEffect, useMemo, useState } from 'react'
import Modal from '../../components/Modal'
import { aiPromptTemplatesService } from '../../services/aiPromptTemplates'
import { useToast } from '../../components/Toast'
import type { PromptTemplateMeta } from '../../services/promptCatalog'

type Mode = 'edit_template' | 'create_style'

interface PromptEditorModalProps {
  isOpen: boolean
  onClose: () => void
  mode: Mode

  // edit_template
  card?: PromptTemplateMeta | null
  onSaved?: (templates: Record<string, any>) => void

  // create_style
  styleTitle?: string
  stylePrompt?: string
  onChangeStyleTitle?: (value: string) => void
  onChangeStylePrompt?: (value: string) => void
  onCreateStyle?: () => void
}

const PROMPT_CATEGORY_ACCENT: Record<string, string> = {
  通用: '#64748b',
  Markdown: '#3b82f6',
  扩展产物: '#f97316',
  风格: '#22c55e',
}

const getPromptCategoryAccent = (category?: string | null) => {
  if (!category) return '#3b82f6'
  return PROMPT_CATEGORY_ACCENT[category] || '#a855f7'
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

export default function PromptEditorModal({
  isOpen,
  onClose,
  mode,
  card,
  onSaved,
  styleTitle,
  stylePrompt,
  onChangeStyleTitle,
  onChangeStylePrompt,
  onCreateStyle,
}: PromptEditorModalProps) {
  const { showToast } = useToast()

  // edit_template state
  const [templates, setTemplates] = useState<Record<string, any>>({})
  const [defaultTemplates, setDefaultTemplates] = useState<Record<string, any>>({})
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const activeMeta = useMemo(() => (mode === 'edit_template' ? (card || null) : null), [card, mode])
  const accentColor = useMemo(() => {
    if (mode === 'create_style') return '#22c55e'
    if (!activeMeta) return '#3b82f6'
    return getPromptCategoryAccent(activeMeta.category)
  }, [activeMeta, mode])

  useEffect(() => {
    if (!isOpen) return
    if (mode !== 'edit_template') return
    if (!activeMeta) return
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

        const currentValue = getNestedValue(currentTemplates, activeMeta.path)
        if (activeMeta.kind === 'lines') {
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
    void load()
  }, [activeMeta, isOpen, mode, showToast])

  const resetCurrent = () => {
    if (!activeMeta) return
    const currentDefault = getNestedValue(defaultTemplates, activeMeta.path)
    setDraft(
      activeMeta.kind === 'lines'
        ? (Array.isArray(currentDefault) ? currentDefault.join('\n') : '')
        : (typeof currentDefault === 'string' ? currentDefault : ''),
    )
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

  const titleText = (() => {
    if (mode === 'create_style') return '新建风格'
    if (!activeMeta) return ''
    const headerMetaText = `${activeMeta.category} · ${activeMeta.title}`
    return `编辑 ${headerMetaText}`
  })()

  if (mode === 'edit_template' && !activeMeta) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={titleText}
      size="lg"
      closeOnOverlayClick={true}
      className="settings-prompt-modal"
      accentColor={accentColor}
      footer={(
        <div className="settings-prompt-footer">
          {mode === 'edit_template' ? (
            <button
              className="settings-button settings-button-secondary"
              onClick={resetCurrent}
              disabled={loading || saving}
              title="恢复为默认模板"
            >
              重置
            </button>
          ) : (
            <div />
          )}
          <div className="settings-prompt-footer-right">
            <button className="settings-button settings-button-secondary" onClick={onClose} disabled={saving}>
              取消
            </button>
            {mode === 'edit_template' ? (
              <button className="settings-button settings-button-primary" onClick={handleSave} disabled={loading || saving}>
                {saving ? '保存中...' : '保存'}
              </button>
            ) : (
              <button className="settings-button settings-button-primary" onClick={onCreateStyle} disabled={saving}>
                创建
              </button>
            )}
          </div>
        </div>
      )}
    >
      {mode === 'edit_template' ? (
        <div className="settings-prompt-editor">
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
      ) : (
        <div className="settings-prompt-form">
          <div className="settings-prompt-form-head">
            <div className="settings-prompt-form-title">标题</div>
          </div>
          <input
            type="text"
            className="settings-input"
            value={styleTitle || ''}
            onChange={(e) => onChangeStyleTitle?.(e.target.value)}
            placeholder="例如：教程笔记"
          />

          <div className="settings-prompt-form-head" style={{ marginTop: 6 }}>
            <div className="settings-prompt-form-title">Prompt</div>
          </div>
          <textarea
            className="settings-prompt-textarea"
            value={stylePrompt || ''}
            onChange={(e) => onChangeStylePrompt?.(e.target.value)}
            spellCheck={false}
            placeholder="输入该风格的写作要求…"
          />
        </div>
      )}

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
          border-bottom-color: rgba(148, 163, 184, 0.18);
        }

        .settings-prompt-modal .settings-modal-title {
          font-size: 16px;
          color: var(--color-text-primary);
        }

        .settings-prompt-modal .settings-modal-title::before {
          content: '';
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: var(--modal-accent, #3b82f6);
          margin-right: 10px;
          vertical-align: middle;
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--modal-accent, #3b82f6) 12%, transparent);
        }

        .settings-prompt-editor {
          display: grid;
          gap: 14px;
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
          border-color: color-mix(in srgb, var(--modal-accent, #3b82f6) 70%, transparent);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--modal-accent, #3b82f6) 18%, transparent);
        }
      `}</style>
    </Modal>
  )
}

