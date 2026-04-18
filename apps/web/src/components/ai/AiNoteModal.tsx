import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Sparkles, Loader2, Copy, Download, RotateCcw } from 'lucide-react'
import { aiNoteService, NOTE_FORMATS, type NoteResponse, type AiTraceStep } from '../../services/aiNote'
import { useToast } from '../Toast'
import { useSettingsStore } from '../../stores/settings'

interface AiNoteModalProps {
  videoId: string
  videoTitle: string
  existingNote?: NoteResponse | null
  isOpen: boolean
  onClose: () => void
  onComplete?: (note: NoteResponse) => void
}

type ViewState = 'config' | 'loading' | 'result'

interface StyleOption {
  value: string
  label: string
  description: string
}

const SETTINGS_STYLE_CARDS = [
  { value: 'minimal', label: '精简', description: '仅记录最重要的内容' },
  { value: 'detailed', label: '详细', description: '包含完整内容和详细讨论' },
  { value: 'academic', label: '学术', description: '正式结构化，适合学术报告' },
  { value: 'tutorial', label: '教程', description: '详细记录关键点和结论' },
  { value: 'xiaohongshu', label: '小红书', description: '爆款标题、emoji表达' },
  { value: 'life_journal', label: '生活向', description: '情感化表达，记录生活感悟' },
  { value: 'task_oriented', label: '任务导向', description: '强调任务和目标' },
  { value: 'business', label: '商业风格', description: '正式精准，适合商业报告' },
  { value: 'meeting_minutes', label: '会议纪要', description: '突出决策和行动项' },
]

const TRACE_EXPANDED_KEY = 'pilinote_ai_note_trace_expanded'

export function deriveAiNoteModalStateFromLookup(lookup: {
  success: boolean
  found?: boolean
  note?: NoteResponse | null
  message?: string
}): {
  viewState: ViewState
  note: NoteResponse | null
  errorMessage: string | null
  shouldPoll: boolean
} {
  if (!lookup.success) {
    return {
      viewState: 'result',
      note: null,
      errorMessage: lookup.message || '查询失败',
      shouldPoll: false,
    }
  }

  if (!lookup.found || !lookup.note) {
    return {
      viewState: 'config',
      note: null,
      errorMessage: null,
      shouldPoll: false,
    }
  }

  if (lookup.note.status === 'processing' || lookup.note.status === 'pending') {
    return {
      viewState: 'loading',
      note: lookup.note,
      errorMessage: null,
      shouldPoll: true,
    }
  }

  return {
    viewState: 'result',
    note: lookup.note,
    errorMessage: null,
    shouldPoll: false,
  }
}

export function AiNoteModal({ videoId, videoTitle, existingNote, isOpen, onClose, onComplete }: AiNoteModalProps) {
  const { settings, fetchSettings } = useSettingsStore()
  const { showToast } = useToast()
  const [viewState, setViewState] = useState<ViewState>('config')
  const [selectedModel, setSelectedModel] = useState('')
  const [detailLevel, setDetailLevel] = useState<'simple' | 'detailed'>('detailed')
  const [style, setStyle] = useState('detailed')
  const [formats, setFormats] = useState<string[]>(['summary'])
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [note, setNote] = useState<NoteResponse | null>(existingNote || null)
  const [error, setError] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [trace, setTrace] = useState<AiTraceStep[]>([])
  const [progress, setProgress] = useState(0)
  const [traceExpanded, setTraceExpanded] = useState(false)
  const suppressLookupRef = useRef(false)

  useEffect(() => {
    suppressLookupRef.current = isAnalyzing
  }, [isAnalyzing])

  useEffect(() => {
    if (!settings || isOpen) {
      fetchSettings()
    }
  }, [settings, fetchSettings, isOpen])

  useEffect(() => {
    if (isOpen && existingNote) {
      setNote(existingNote)
      setTrace((existingNote.meta?.trace as AiTraceStep[]) || [])
      if (existingNote.status === 'processing' || existingNote.status === 'pending') {
        setViewState('loading')
      } else if (existingNote.status === 'failed') {
        setViewState('result')
      } else if (existingNote.content) {
        setViewState('result')
      } else {
        setViewState('config')
      }
    }
  }, [isOpen, existingNote])

  // Lookup latest note on open. Never treat HTTP 404 (or any success=false response) as "no note".
  useEffect(() => {
    if (!isOpen) return
    if (!videoId) return

    let cancelled = false
    setLookupError(null)

    const run = async () => {
      try {
        const raw = await aiNoteService.lookupNoteByVideo(videoId)
        if (cancelled || suppressLookupRef.current) return

        const derived = deriveAiNoteModalStateFromLookup(raw)
        setLookupError(derived.errorMessage)

        if (derived.note) {
          setNote(derived.note)
          setTrace((derived.note.meta?.trace as AiTraceStep[]) || [])
        } else if (derived.viewState === 'config') {
          setNote(null)
          setTrace([])
          setProgress(0)
        }

        setViewState(derived.viewState)

        if (derived.shouldPoll && derived.note?.id) {
          try {
            await pollStatus(derived.note.id)
          } catch (err) {
            if (cancelled) return
            setLookupError(err instanceof Error ? err.message : '分析失败')
            setViewState('result')
          }
        }
      } catch (err) {
        if (cancelled || suppressLookupRef.current) return
        setLookupError(err instanceof Error ? err.message : '加载 AI 笔记失败')
        setViewState('result')
        setNote(null)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [isOpen, videoId])

  useEffect(() => {
    if (!isOpen) return
    const saved = localStorage.getItem(TRACE_EXPANDED_KEY)
    if (saved === 'true') {
      setTraceExpanded(true)
    } else if (saved === 'false') {
      setTraceExpanded(false)
    }
  }, [isOpen])

  useEffect(() => {
    const ai = settings?.ai_note
    if (!ai) return
    const provider = ai.llm.provider || 'openai'
    const tested = ai.llm.tested_models || {}
    const providerModels = tested[provider] || []
    const nextModel = providerModels.includes(ai.llm.model)
      ? ai.llm.model
      : (providerModels[0] || ai.llm.model || '')
    setSelectedModel(nextModel)
    setStyle(ai.style.style || 'detailed')
    setFormats(['summary'])
  }, [settings])

  const activeProvider = settings?.ai_note?.llm?.provider || 'openai'

  const providerModels = useMemo(() => {
    const tested = settings?.ai_note?.llm?.tested_models || {}
    return tested[activeProvider] || []
  }, [settings, activeProvider])

  const availableStyles = useMemo(() => {
    const customStyles: StyleOption[] = Array.isArray((settings as any)?.ai_note?.style?.custom_styles)
      ? (settings as any).ai_note.style.custom_styles
      : []
    const customMap = new Map(customStyles.map((item: any) => [item.value, item]))
    return SETTINGS_STYLE_CARDS.map(styleItem => customMap.get(styleItem.value) || styleItem).concat(
      customStyles.filter((item: any) => !SETTINGS_STYLE_CARDS.some(styleItem => styleItem.value === item.value))
    )
  }, [settings])

  const currentTrace = trace.length ? trace : ((note?.meta?.trace as AiTraceStep[]) || [])
  const groupedTrace = useMemo(() => {
    const groups: Record<string, AiTraceStep[]> = {
      PREP: [],
      PROMPT: [],
      LLM: [],
      DONE: [],
      ERROR: [],
      OTHER: [],
    }

    currentTrace.forEach(step => {
      const root = step.stage.split('.')[0]
      if (root in groups) {
        groups[root].push(step)
      } else {
        groups.OTHER.push(step)
      }
    })

    return [
      { key: 'PREP', label: '准备阶段', items: groups.PREP },
      { key: 'PROMPT', label: 'Prompt 阶段', items: groups.PROMPT },
      { key: 'LLM', label: '模型阶段', items: groups.LLM },
      { key: 'DONE', label: '完成', items: groups.DONE },
      { key: 'ERROR', label: '错误', items: groups.ERROR },
      { key: 'OTHER', label: '其他', items: groups.OTHER },
    ].filter(group => group.items.length > 0)
  }, [currentTrace])

  const promptSummary = useMemo(() => {
    const prepOrder = ['PREP.T0', 'PREP.T1.1', 'PREP.T1.2', 'PREP.T1.3', 'PREP.T2', 'PREP.T3']
    const promptOrder = ['PROMPT.BUILD']
    const steps = currentTrace.filter(step => prepOrder.includes(step.stage) || promptOrder.includes(step.stage))
    if (!steps.length) return []
    return steps.map(step => ({
      stage: step.stage,
      title: step.title,
    }))
  }, [currentTrace])

  if (!isOpen) return null

  const resetState = () => {
    setViewState('config')
    setNote(null)
    setError(null)
    setLookupError(null)
    setTrace([])
    setProgress(0)
    setTraceExpanded(false)
    localStorage.setItem(TRACE_EXPANDED_KEY, 'false')
  }

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const pollStatus = async (noteId: string) => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const status = await aiNoteService.getStatus(noteId)
      setTrace((status.trace as AiTraceStep[]) || [])
      setProgress(Math.max(0, Math.min(100, Number(status.progress || 0))))

      if (status.status === 'completed') {
        const completed = await aiNoteService.getNote(noteId)
        setNote(completed)
        setViewState('result')
        onComplete?.(completed)
        return completed
      }

      if (status.status === 'failed') {
        throw new Error(status.error || '分析失败')
      }

      await delay(1500)
    }

    throw new Error('分析超时，请稍后在状态页查看')
  }

  const startAnalyze = async () => {
    setError(null)
    setIsAnalyzing(true)
    setViewState('loading')
    setTrace([])
    setProgress(0)

    if (!selectedModel) {
      setError('请先在设置面板测试并保存可用模型')
      setViewState('config')
      setIsAnalyzing(false)
      return
    }

    try {
      const response = await aiNoteService.analyze({
        video_id: videoId,
        style,
        formats,
        model_provider: activeProvider,
        model_name: selectedModel,
        extras: detailLevel === 'simple' ? '请输出简洁版本' : '请输出详细版本',
      })

      if (response.success && response.note_id) {
        await pollStatus(response.note_id)
        return
      }

      setError(response.message || '分析失败')
      setViewState('config')
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败')
      setViewState('config')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAnalyze = async () => {
    await startAnalyze()
  }

  const handleReanalyze = async () => {
    await startAnalyze()
  }

  const handleCopy = async () => {
    if (!note?.content) return
    await navigator.clipboard.writeText(note.content)
    showToast('已复制', 'success')
  }

  const handleExport = async () => {
    if (!note?.content) return
    const blob = new Blob([note.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-note-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderTrace = () => {
    if (!currentTrace.length) return null
    return (
      <div className="ai-note-trace">
        <button type="button" className="ai-note-trace-toggle" onClick={() => setTraceExpanded(prev => !prev)}>
          <span className="ai-note-trace-title">链路调试</span>
          <span className="ai-note-trace-toggle-text">
            {currentTrace.length ? `${currentTrace.length} 条记录` : '查看调试详情'}
          </span>
          <span className="ai-note-trace-toggle-arrow">{traceExpanded ? '收起' : '展开'}</span>
        </button>
        {traceExpanded && (
          <>
            {promptSummary.length > 0 && (
              <details className="ai-note-trace-prompt-summary" open={false}>
                <summary className="ai-note-trace-prompt-summary-toggle">
                  Prompt 结构摘要
                </summary>
                <div className="ai-note-trace-prompt-summary-body">
                  {promptSummary.map(item => (
                    <span key={`${item.stage}-${item.title}`} className="ai-note-trace-prompt-pill">
                      {item.stage}: {item.title}
                    </span>
                  ))}
                </div>
              </details>
            )}
            <div className="ai-note-trace-groups">
              {groupedTrace.map(group => (
                <div key={group.key} className="ai-note-trace-group">
                  <div className="ai-note-trace-group-title" data-group={group.key}>{group.label}</div>
                  <div className="ai-note-trace-list">
                    {group.items.map((step, index) => (
                      <div key={`${step.stage}-${index}`} className="ai-note-trace-item">
                        <div className="ai-note-trace-item-head">
                          <span>{step.stage}</span>
                          <span>{Math.round(step.progress || 0)}%</span>
                        </div>
                        <div className="ai-note-trace-item-title">{step.title}</div>
                        <div className="ai-note-trace-item-summary">{step.summary}</div>
                        {step.detail ? (
                          <pre className="ai-note-trace-item-detail">{JSON.stringify(step.detail, null, 2)}</pre>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  useEffect(() => {
    if (!isOpen) return
    localStorage.setItem(TRACE_EXPANDED_KEY, String(traceExpanded))
  }, [traceExpanded, isOpen])

  return (
    <div className="ai-note-modal-overlay" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
      <div className="ai-note-modal-panel" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
        <div className="ai-note-modal-header">
          <div className="ai-note-modal-title">
            <Sparkles size={20} />
            <span>AI 笔记</span>
          </div>
          <button className="ai-note-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="ai-note-modal-video-info">{videoTitle}</div>

        {viewState === 'config' && (
          <>
            <div className="ai-note-modal-content">
              <div className="ai-note-select-group">
                <label>AI 服务商</label>
                <div className="ai-note-summary-chip">{settings?.ai_note?.llm?.provider || 'openai'}</div>
              </div>

              <div className="ai-note-select-group">
                <label>模型</label>
                {providerModels.length > 0 ? (
                  <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="ai-note-select">
                    {providerModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <div className="ai-note-empty-hint">请先在设置面板测试并保存该服务商的模型</div>
                )}
              </div>

              <div className="ai-note-select-group">
                <label>详细程度</label>
                <select value={detailLevel} onChange={e => setDetailLevel(e.target.value as 'simple' | 'detailed')} className="ai-note-select">
                  <option value="simple">简单</option>
                  <option value="detailed">详细</option>
                </select>
              </div>

              <div className="ai-note-select-group">
                <label>笔记风格</label>
                <select value={style} onChange={e => setStyle(e.target.value)} className="ai-note-select">
                  {availableStyles.map(s => <option key={s.value} value={s.value}>{s.label} - {s.description}</option>)}
                </select>
              </div>

              <div className="ai-note-advanced-toggle">
                <button type="button" onClick={() => setAdvancedOpen(prev => !prev)} className="ai-note-advanced-btn">
                  {advancedOpen ? '收起高级选项' : '展开高级选项'}
                </button>
              </div>

              {advancedOpen && (
                <div className="ai-note-select-group">
                  <label>高级功能预留</label>
                  <div className="ai-note-format-row">
                    {NOTE_FORMATS.map(format => (
                      <button
                        key={format.value}
                        type="button"
                        onClick={() => setFormats(prev => prev.includes(format.value) ? prev.filter(v => v !== format.value) : [...prev, format.value])}
                        className={`ai-note-format-btn ${formats.includes(format.value) ? 'active' : ''}`}
                        title={format.description}
                      >
                        {format.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && <div className="ai-note-modal-error">{error}</div>}

            {renderTrace()}

            <div className="ai-note-modal-footer">
              <button onClick={resetState} className="ai-note-modal-btn-secondary">
                <RotateCcw size={16} />
                重置
              </button>
              <button onClick={handleAnalyze} disabled={isAnalyzing} className="ai-note-modal-btn-primary">
                {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isAnalyzing ? '分析中...' : '开始分析'}
              </button>
            </div>
          </>
        )}

        {viewState === 'loading' && (
        <div className="ai-note-modal-loading">
            <div className="ai-note-modal-loading-spinner" />
            <p>AI 正在分析中... {progress ? `${Math.round(progress)}%` : ''}</p>
            {renderTrace()}
          </div>
        )}

        {viewState === 'result' && (
          <>
            <div className="ai-note-modal-result">
              {(!note || note.status === 'failed') && (
                <div className="ai-note-modal-result-error">
                  <strong>{note?.status === 'failed' ? '分析失败' : '加载失败'}</strong>
                  <span>{note?.error || lookupError || error || '请点击重新分析重试'}</span>
                </div>
              )}
              <div className="ai-note-modal-result-actions">
                <button onClick={handleReanalyze}><Sparkles size={14} />重新分析</button>
                <button onClick={handleCopy} disabled={!note?.content}><Copy size={14} />复制</button>
                <button onClick={handleExport} disabled={!note?.content}><Download size={14} />导出</button>
                <button onClick={resetState}><RotateCcw size={14} />重置</button>
              </div>
              <div className="ai-note-modal-result-content">
                <pre>{note?.content || '当前没有可展示的笔记内容。你可以点击上方“重新分析”重新生成。'}</pre>
              </div>
            </div>
            {note?.summary && (
              <div className="ai-note-modal-summary">
                <h4>AI 总结</h4>
                <p>{note.summary}</p>
              </div>
            )}
            {renderTrace()}
          </>
        )}
      </div>

      <style>{`
        .ai-note-modal-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0,0,0,0.4); pointer-events: auto; }
        .ai-note-modal-panel { width: 100%; max-width: 520px; max-height: calc(100vh - 32px); background: var(--color-bg-primary); border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--color-border); }
        .ai-note-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--color-border); }
        .ai-note-modal-title { display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 600; }
        .ai-note-modal-close { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; color: var(--color-text-secondary); border-radius: 8px; cursor: pointer; }
        .ai-note-modal-video-info { padding: 12px 20px; background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border); font-size: 14px; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ai-note-modal-content { flex: 1; overflow-y: auto; padding: 20px; }
        .ai-note-select-group { margin-bottom: 16px; }
        .ai-note-select-group label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px; }
        .ai-note-select { width: 100%; padding: 12px 16px; border-radius: 10px; font-size: 14px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); color: var(--color-text-primary); }
        .ai-note-empty-hint { padding: 12px 14px; border-radius: 10px; background: var(--color-bg-secondary); border: 1px dashed var(--color-border); color: var(--color-text-tertiary); font-size: 13px; }
        .ai-note-summary-chip { display: inline-flex; align-items: center; padding: 8px 12px; border-radius: 999px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); color: var(--color-text-primary); font-size: 13px; font-weight: 600; }
        .ai-note-format-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .ai-note-format-btn { padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-bg-secondary); color: var(--color-text-secondary); cursor: pointer; }
        .ai-note-format-btn.active { border-color: var(--color-primary-600); color: var(--color-primary-600); }
        .ai-note-advanced-toggle { margin-top: 4px; }
        .ai-note-advanced-btn { width: 100%; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-bg-secondary); color: var(--color-text-secondary); cursor: pointer; text-align: left; }
        .ai-note-modal-error { padding: 12px 20px; background: var(--color-error-50); font-size: 14px; color: var(--color-error-600); }
        .ai-note-empty-hint { margin-top: 8px; padding: 12px 14px; border-radius: 10px; background: var(--color-bg-secondary); border: 1px dashed var(--color-border); color: var(--color-text-tertiary); font-size: 13px; }
        .ai-note-modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 20px; border-top: 1px solid var(--color-border); background: var(--color-bg-secondary); }
        .ai-note-modal-btn-secondary,.ai-note-modal-btn-primary { display: flex; align-items: center; gap: 6px; padding: 10px 16px; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; }
        .ai-note-modal-btn-secondary { background: var(--color-bg-tertiary); color: var(--color-text-primary); border: none; }
        .ai-note-modal-btn-primary { background: var(--color-primary-600); color: white; border: none; }
        .ai-note-modal-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 20px; gap: 16px; }
        .ai-note-modal-loading-spinner { width: 40px; height: 40px; border: 3px solid var(--color-border); border-top-color: var(--color-primary-600); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ai-note-modal-result { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
        .ai-note-modal-result-error { display: flex; flex-direction: column; gap: 4px; padding: 12px 20px; background: var(--color-error-50); color: var(--color-error-700); border-bottom: 1px solid var(--color-border); }
        .ai-note-modal-result-error strong { font-size: 13px; }
        .ai-note-modal-result-error span { font-size: 12px; line-height: 1.5; }
        .ai-note-modal-result-actions { display: flex; gap: 8px; padding: 12px 20px; border-bottom: 1px solid var(--color-border); }
        .ai-note-modal-result-actions button { display: flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 6px; font-size: 12px; background: var(--color-bg-secondary); border: none; color: var(--color-text-secondary); cursor: pointer; }
        .ai-note-modal-result-content { flex: 1; overflow-y: auto; padding: 16px 20px; }
        .ai-note-modal-result-content pre { font-size: 14px; line-height: 1.6; white-space: pre-wrap; margin: 0; }
        .ai-note-modal-summary { padding: 12px 20px; border-top: 1px solid var(--color-border); }
        .ai-note-modal-summary h4 { margin: 0 0 6px; font-size: 14px; }
        .ai-note-modal-summary p { margin: 0; font-size: 13px; color: var(--color-text-secondary); }
        .ai-note-trace { padding: 12px 20px 16px; border-top: 1px solid var(--color-border); }
        .ai-note-trace-toggle { width: 100%; display: flex; align-items: center; gap: 10px; padding: 0; border: none; background: transparent; cursor: pointer; text-align: left; }
        .ai-note-trace-title { font-size: 13px; font-weight: 600; color: var(--color-text-secondary); flex-shrink: 0; }
        .ai-note-trace-toggle-text { flex: 1; min-width: 0; font-size: 12px; color: var(--color-text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ai-note-trace-toggle-arrow { font-size: 12px; color: var(--color-text-secondary); flex-shrink: 0; }
        .ai-note-trace-prompt-summary { margin: 10px 0; border-radius: 10px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); overflow: hidden; }
        .ai-note-trace-prompt-summary-toggle { list-style: none; cursor: pointer; padding: 8px 10px; font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
        .ai-note-trace-prompt-summary-toggle::-webkit-details-marker { display: none; }
        .ai-note-trace-prompt-summary-body { padding: 0 10px 10px; display: flex; flex-wrap: wrap; gap: 6px; }
        .ai-note-trace-prompt-pill { padding: 4px 8px; border-radius: 999px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); font-size: 11px; color: var(--color-text-secondary); }
        .ai-note-trace-group-title[data-group="DONE"] { color: var(--color-success); }
        .ai-note-trace-group-title[data-group="ERROR"] { color: var(--color-error-600); }
        .ai-note-trace-groups { display: grid; gap: 12px; }
        .ai-note-trace-group { display: grid; gap: 8px; }
        .ai-note-trace-group-title { font-size: 12px; font-weight: 700; color: var(--color-text-primary); }
        .ai-note-trace-list { display: grid; gap: 8px; }
        .ai-note-trace-item { padding: 10px 12px; border-radius: 10px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); }
        .ai-note-trace-item-head { display: flex; justify-content: space-between; font-size: 12px; color: var(--color-text-tertiary); margin-bottom: 4px; }
        .ai-note-trace-item-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
        .ai-note-trace-item-summary { font-size: 12px; color: var(--color-text-secondary); line-height: 1.45; }
        .ai-note-trace-item-detail { margin: 8px 0 0; padding: 8px; border-radius: 8px; background: var(--color-bg-primary); border: 1px solid var(--color-border); font-size: 11px; line-height: 1.45; white-space: pre-wrap; color: var(--color-text-tertiary); }
      `}</style>
    </div>
  )
}
