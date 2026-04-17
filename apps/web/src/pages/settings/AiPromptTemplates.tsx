import { useEffect, useMemo, useState } from 'react'
import Modal from '../../components/Modal'
import { aiPromptTemplatesService } from '../../services/aiPromptTemplates'
import { useToast } from '../../components/Toast'

type TemplateSection = 'base' | 't0' | 't1' | 't2' | 't3' | 'formats' | 'extras'

interface AiPromptTemplatesProps {
  isOpen: boolean
  onClose: () => void
}

const SECTION_ORDER: TemplateSection[] = ['base', 't0', 't1', 't2', 't3', 'formats', 'extras']

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

export default function AiPromptTemplates({ isOpen, onClose }: AiPromptTemplatesProps) {
  const { showToast } = useToast()
  const [templates, setTemplates] = useState<Record<string, any>>({})
  const [defaultTemplates, setDefaultTemplates] = useState<Record<string, any>>({})
  const [activeSection, setActiveSection] = useState<TemplateSection>('base')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const load = async () => {
      setLoading(true)
      try {
        const [currentRes, defaultRes] = await Promise.all([
          aiPromptTemplatesService.getTemplates(),
          aiPromptTemplatesService.getDefaultTemplates(),
        ])
        setTemplates(currentRes.templates || {})
        setDefaultTemplates(defaultRes.templates || {})
        setActiveSection('base')
      } catch (error) {
        showToast(`加载模板失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOpen, showToast])

  const sectionTitleMap: Record<TemplateSection, string> = {
    base: '基础与收尾',
    t0: 'T0 视频信息',
    t1: 'T1 视频文本',
    t2: 'T2 详细程度',
    t3: 'T3 风格',
    formats: 'formats 高级功能预留',
    extras: '额外要求',
  }

  const updateSectionValue = (path: string[], value: any) => {
    setTemplates(prev => {
      const next = deepClone(prev)
      let cursor: any = next
      for (let i = 0; i < path.length - 1; i += 1) {
        const key = path[i]
        cursor[key] = cursor[key] || {}
        cursor = cursor[key]
      }
      cursor[path[path.length - 1]] = value
      return next
    })
  }

  const currentSection = useMemo(() => {
    return templates[activeSection] || {}
  }, [templates, activeSection])

  const renderEditor = () => {
    if (activeSection === 'base') {
      return (
        <div className="space-y-4">
          <label className="block">
            <div className="text-sm font-medium mb-2">系统提示词</div>
            <textarea
              className="w-full min-h-[140px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm"
              value={currentSection.system || ''}
              onChange={e => updateSectionValue(['base', 'system'], e.target.value)}
            />
          </label>
          <label className="block">
            <div className="text-sm font-medium mb-2">最终要求（每行一条）</div>
            <textarea
              className="w-full min-h-[140px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm"
              value={Array.isArray(currentSection.final) ? currentSection.final.join('\n') : ''}
            onChange={e => updateSectionValue(['base', 'final'], e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
            />
          </label>
        </div>
      )
    }

    if (activeSection === 't2') {
      return (
        <div className="grid gap-4">
          {(['simple', 'detailed'] as const).map(key => (
            <label key={key} className="block">
              <div className="text-sm font-medium mb-2">{key === 'simple' ? '简单' : '详细'}</div>
              <textarea
                className="w-full min-h-[120px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm"
                value={currentSection?.[key] || ''}
                onChange={e => updateSectionValue(['layers', 't2', key], e.target.value)}
              />
            </label>
          ))}
        </div>
      )
    }

    if (activeSection === 't3' || activeSection === 'formats') {
      const entries = Object.entries(currentSection || {})
      return (
        <div className="grid gap-4">
          {entries.map(([key, value]) => (
            <label key={key} className="block">
              <div className="text-sm font-medium mb-2">{key}</div>
              <textarea
                className="w-full min-h-[120px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm"
                value={value as string}
                onChange={e => updateSectionValue(['layers', activeSection, key], e.target.value)}
              />
            </label>
          ))}
        </div>
      )
    }

    return (
      <label className="block">
        <div className="text-sm font-medium mb-2">模板内容</div>
        <textarea
          className="w-full min-h-[220px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm"
          value={typeof currentSection === 'string' ? currentSection : currentSection?.content || ''}
          onChange={e => updateSectionValue(['layers', activeSection], e.target.value)}
        />
      </label>
    )
  }

  const handleResetCurrent = () => {
    setTemplates(prev => {
      const next = deepClone(prev)
      if (activeSection === 'base') {
        next.base = deepClone(defaultTemplates.base || {})
      } else {
        next.layers = next.layers || {}
        next.layers[activeSection] = deepClone(defaultTemplates.layers?.[activeSection] || {})
      }
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await aiPromptTemplatesService.saveTemplates(templates)
      showToast('提示词模板已保存', 'success')
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
      showToast('已重制为默认模板', 'success')
    } catch (error) {
      showToast(`重制失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="提示词模板"
      size="lg"
      closeOnOverlayClick={false}
      footer={(
        <>
          <button className="settings-btn-secondary" onClick={handleResetCurrent} disabled={loading || saving}>
            重置当前层
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
      <div className="grid gap-5 md:grid-cols-[180px_1fr]">
        <aside className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible">
          {SECTION_ORDER.map(section => (
            <button
              key={section}
              className={`px-3 py-2 rounded-xl text-left text-sm border transition-colors whitespace-nowrap ${
                activeSection === section
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
              }`}
              onClick={() => setActiveSection(section)}
            >
              {sectionTitleMap[section]}
            </button>
          ))}
        </aside>

        <section className="space-y-4">
          {loading ? (
            <div className="text-sm text-slate-500">加载模板中...</div>
          ) : (
            renderEditor()
          )}
        </section>
      </div>
    </Modal>
  )
}
