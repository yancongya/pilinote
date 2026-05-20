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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`编辑 ${activeMeta.title}`}
      size="lg"
      closeOnOverlayClick={true}
      className="settings-prompt-modal"
      footer={(
        <>
          <button className="settings-button settings-button-secondary" onClick={resetCurrent} disabled={loading || saving}>
            重置当前
          </button>
          <button className="settings-button settings-button-primary" onClick={handleSave} disabled={loading || saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </>
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
          <SettingsField label="Prompt 内容" hint="修改后会立即同步到提示词模板">
            <textarea
              className="settings-input settings-textarea settings-prompt-textarea"
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
          </SettingsField>
        )}
      </div>
    </Modal>
  )
}
