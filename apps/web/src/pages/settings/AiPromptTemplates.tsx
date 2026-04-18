import { useEffect, useMemo, useState } from 'react'
import Modal from '../../components/Modal'
import { aiPromptTemplatesService } from '../../services/aiPromptTemplates'
import { useToast } from '../../components/Toast'

export interface PromptTemplateMeta {
  key: string
  title: string
  category: string
  path: string[]
  kind: 'text' | 'lines'
}

export const PROMPT_TEMPLATE_CARDS: PromptTemplateMeta[] = [
  { key: 'base.system', title: '系统提示词', category: '基础', path: ['base', 'system'], kind: 'text' },
  { key: 'base.final', title: '最终要求', category: '基础', path: ['base', 'final'], kind: 'lines' },
  { key: 't0', title: 'T0 视频信息', category: '分层', path: ['layers', 't0'], kind: 'text' },
  { key: 't1', title: 'T1 视频文本', category: '分层', path: ['layers', 't1'], kind: 'text' },
  { key: 't2.simple', title: 'T2 简单', category: '分层', path: ['layers', 't2', 'simple'], kind: 'text' },
  { key: 't2.detailed', title: 'T2 详细', category: '分层', path: ['layers', 't2', 'detailed'], kind: 'text' },
  { key: 't3.academic', title: 'T3 学术', category: '风格', path: ['layers', 't3', 'academic'], kind: 'text' },
  { key: 't3.tutorial', title: 'T3 教程', category: '风格', path: ['layers', 't3', 'tutorial'], kind: 'text' },
  { key: 't3.xiaohongshu', title: 'T3 小红书', category: '风格', path: ['layers', 't3', 'xiaohongshu'], kind: 'text' },
  { key: 't3.life_journal', title: 'T3 生活向', category: '风格', path: ['layers', 't3', 'life_journal'], kind: 'text' },
  { key: 't3.task_oriented', title: 'T3 任务导向', category: '风格', path: ['layers', 't3', 'task_oriented'], kind: 'text' },
  { key: 't3.business', title: 'T3 商业风格', category: '风格', path: ['layers', 't3', 'business'], kind: 'text' },
  { key: 't3.meeting_minutes', title: 'T3 会议纪要', category: '风格', path: ['layers', 't3', 'meeting_minutes'], kind: 'text' },
  { key: 'formats.toc', title: '目录', category: '格式', path: ['layers', 'formats', 'toc'], kind: 'text' },
  { key: 'formats.link', title: '原片跳转', category: '格式', path: ['layers', 'formats', 'link'], kind: 'text' },
  { key: 'formats.screenshot', title: '原片截图', category: '格式', path: ['layers', 'formats', 'screenshot'], kind: 'text' },
  { key: 'formats.summary', title: 'AI 总结', category: '格式', path: ['layers', 'formats', 'summary'], kind: 'text' },
]

interface AiPromptTemplatesProps {
  isOpen: boolean
  onClose: () => void
  card: PromptTemplateMeta | null
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

export default function AiPromptTemplates({ isOpen, onClose, card }: AiPromptTemplatesProps) {
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
      showToast('提示词已保存', 'success')
      onClose()
    } catch (error) {
      showToast(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleResetAll = async () => {
    setSaving(true)
    try {
      await aiPromptTemplatesService.resetTemplates()
      const res = await aiPromptTemplatesService.getTemplates()
      setTemplates(res.templates || {})
      const currentDefault = activeMeta ? getNestedValue(defaultTemplates, activeMeta.path) : ''
      setDraft(activeMeta?.kind === 'lines' ? (Array.isArray(currentDefault) ? currentDefault.join('\n') : '') : (typeof currentDefault === 'string' ? currentDefault : ''))
      showToast('已恢复默认模板', 'success')
    } catch (error) {
      showToast(`重置失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
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
      closeOnOverlayClick={false}
      footer={(
        <>
          <button className="settings-btn-secondary" onClick={resetCurrent} disabled={loading || saving}>
            重置当前
          </button>
          <button className="settings-btn-secondary" onClick={handleResetAll} disabled={loading || saving}>
            重置全部
          </button>
          <button className="settings-btn-primary" onClick={handleSave} disabled={loading || saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">{activeMeta.category}</span>
          <span>{activeMeta.title}</span>
        </div>
        {loading ? (
          <div className="text-sm text-slate-500">加载模板中...</div>
        ) : (
          <label className="block">
            <div className="text-sm font-medium mb-2">Prompt 内容</div>
            <textarea
              className="w-full min-h-[260px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm"
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
          </label>
        )}
      </div>
    </Modal>
  )
}
