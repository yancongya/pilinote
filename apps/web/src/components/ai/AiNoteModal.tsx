import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Sparkles, Loader2, RotateCcw, Copy, Pause, Play } from 'lucide-react'
import {
  aiNoteService,
  NOTE_FORMATS,
  AI_NOTE_TRACE_STAGE_TEMPLATES,
  type NoteResponse,
  type AiTraceStep,
  type AiNotePipelineMode,
  type AiNoteTraceStageTemplate,
} from '../../services/aiNote'
import { aiPromptTemplatesService } from '../../services/aiPromptTemplates'
import { buildPromptStyleOptions, normalizePromptStyleValue } from '../../services/promptCatalog'
import { useToast } from '../Toast'
import { useSettingsStore } from '../../stores/settings'
import { localAsrModelService } from '../../services/localAsrModels'
import { useAiRuntimeState } from '../../hooks/useAiRuntimeState'
import { aiRuntimeStateService } from '../../services/aiRuntimeState'
import Modal from '../Modal'

interface AiNoteModalProps {
  videoId: string
  videoTitle: string
  existingNote?: NoteResponse | null
  isOpen: boolean
  onClose: () => void
  onComplete?: (note: NoteResponse) => void
}

type ViewState = 'config' | 'result'

interface StyleOption {
  value: string
  label: string
  description: string
}

type TraceDotStatus = 'pending' | 'running' | 'done' | 'error'

interface TraceDotItem {
  id: string
  stage: string
  title: string
  shortLabel: string
  summary: string
  status: TraceDotStatus
  statusLabel: string
  detailText: string
  steps: AiTraceStep[]
  progress?: number
}

const TRACE_STATUS_META: Record<TraceDotStatus, { label: string }> = {
  pending: { label: '等待中' },
  running: { label: '进行中' },
  done: { label: '完成' },
  error: { label: '错误' },
}

const normalizeStage = (stage: string): string => {
  const upper = stage.toUpperCase()
  const parts = upper.split('.')
  const root = parts[parts.length - 1] || upper
  const semanticStage = parts.slice(-2).join('.')
  if (semanticStage === 'AUDIO.FETCH') return 'AUDIO.FETCH'
  if (semanticStage === 'SUBTITLE.GENERATE') return 'SUBTITLE.GENERATE'
  if (semanticStage === 'NFO.READ') return 'NFO.READ'
  if (semanticStage === 'PROMPT.BUILD') return 'PROMPT.BUILD'
  if (semanticStage === 'LLM.ANALYZE') return 'LLM.ANALYZE'
  if (semanticStage === 'CONTENT.GENERATE') return 'CONTENT.GENERATE'
  if (root === 'T0') return 'AUDIO.FETCH'
  if (root === 'T1') return 'SUBTITLE.GENERATE'
  if (root === 'T2') return 'NFO.READ'
  if (root === 'T3') return 'PROMPT.BUILD'
  if (root === 'PROMPT') return 'PROMPT.BUILD'
  if (root === 'LLM') return 'LLM.ANALYZE'
  if (root === 'DONE') return 'DONE'
  return stage ? 'ERROR' : ''
}

const DEFAULT_PIPELINE_MODE: AiNotePipelineMode = 'video'

const getPipelineMode = (note?: NoteResponse | null, trace?: AiTraceStep[] | null): AiNotePipelineMode => {
  if (note?.pipeline_mode === 'video' || note?.pipeline_mode === 'series' || note?.pipeline_mode === 'image_text') {
    return note.pipeline_mode
  }

  const metaMode = note?.meta?.pipeline_mode
  if (metaMode === 'video' || metaMode === 'series' || metaMode === 'image_text') {
    return metaMode
  }

  const firstStage = trace?.[0]?.stage?.toLowerCase?.() || ''
  if (firstStage.includes('ocr') || firstStage.includes('image')) return 'image_text'
  if (firstStage.includes('series') || firstStage.includes('season') || firstStage.includes('episode')) return 'series'
  return DEFAULT_PIPELINE_MODE
}

const getStageTemplates = (mode: AiNotePipelineMode): AiNoteTraceStageTemplate[] => {
  return AI_NOTE_TRACE_STAGE_TEMPLATES[mode] || AI_NOTE_TRACE_STAGE_TEMPLATES.video
}

const getTraceStatus = (step: AiTraceStep, nextStep?: AiTraceStep): TraceDotStatus => {
  const stage = step.stage.toUpperCase()
  const parts = stage.split('.')
  const stageRoot = parts[parts.length - 1] || stage
  const title = step.title || ''
  const summary = step.summary || ''
  const stageStr = step.stage || ''
  if (/失败|错误/i.test(title) || /失败|错误/i.test(stageStr)) return 'error'
  if (stageRoot === 'ERROR' || stage.includes('FAIL')) return 'error'
  if (stageRoot === 'DONE' || stageRoot === 'CONTENT') return 'done'
  if (nextStep) return 'done'
  if (typeof step.progress === 'number' && step.progress >= 100) return 'done'
  if (typeof step.progress === 'number' && step.progress > 0) return 'running'
  if (stageRoot === 'FETCH' || stageRoot === 'READ' || stageRoot === 'GENERATE' || stageRoot === 'BUILD' || stageRoot === 'ANALYZE' || stageRoot === 'PROMPT' || stageRoot === 'LLM' || stageRoot === 'NFO' || stageRoot === 'T0' || stageRoot === 'T1' || stageRoot === 'T2' || stageRoot === 'T3') return 'running'
  return step.stage ? 'running' : 'pending'
}

const buildTraceDotItems = (trace: AiTraceStep[], mode: AiNotePipelineMode = DEFAULT_PIPELINE_MODE): TraceDotItem[] => {
  const templates = getStageTemplates(mode)
  const grouped = new Map<string, AiTraceStep[]>()
  templates.forEach(item => grouped.set(normalizeStage(item.stage), []))

  trace.forEach(step => {
    const stage = normalizeStage(step.stage)
    const items = grouped.get(stage)
    if (items) {
      items.push(step)
    }
  })

  return templates.map((item, index) => {
    const stageKey = normalizeStage(item.stage)
    const items = grouped.get(stageKey) || []
    if (!items.length) {
      return {
        id: `${stageKey}-${index}`,
        stage: item.stage,
        title: item.title,
        shortLabel: item.shortLabel,
        summary: '等待执行',
        status: 'pending',
        statusLabel: TRACE_STATUS_META.pending.label,
        detailText: '暂无原始详情',
        steps: [],
        progress: 0,
      }
    }

    const last = items[items.length - 1]
    const summary = items
      .map((step, idx) => {
        const head = `${idx + 1}. ${step.title || step.stage}`
        const body = step.summary?.trim() || '暂无摘要'
        return `${head}\n${body}`
      })
      .join('\n\n')

    const detailText = items
      .map((step, idx) => {
        const detail = step.detail ? JSON.stringify(step.detail, null, 2) : '暂无原始详情'
        const ts = step.ts ? `\n时间: ${step.ts}` : ''
        return `步骤 ${idx + 1}: ${step.title || step.stage}${ts}\n${detail}`
      })
      .join('\n\n')

    const nextTemplate = templates[index + 1]
    const nextStageKey = nextTemplate ? normalizeStage(nextTemplate.stage) : undefined
    const hasNextTrace = nextStageKey ? (grouped.get(nextStageKey)?.length ?? 0) > 0 : false
    const status = getTraceStatus(last, hasNextTrace ? last : undefined)
    return {
      id: `${stageKey}-${index}`,
      stage: item.stage,
      title: item.title,
      shortLabel: item.shortLabel,
      summary: summary || last.summary || '暂无摘要',
      status,
      statusLabel: TRACE_STATUS_META[status].label,
      detailText: detailText || '暂无原始详情',
      steps: items,
      progress: last.progress,
    }
  })
}

const buildDefaultTraceDotItems = (mode: AiNotePipelineMode = DEFAULT_PIPELINE_MODE): TraceDotItem[] => {
  return getStageTemplates(mode).map((item, index) => ({
    id: `${normalizeStage(item.stage)}-${index}`,
    stage: item.stage,
    title: item.title,
    shortLabel: item.shortLabel,
    summary: '等待执行',
    status: 'pending',
    statusLabel: TRACE_STATUS_META.pending.label,
    detailText: '暂无原始详情',
    steps: [],
    progress: 0,
  }))
}

export const buildTraceDotItemsForNote = (note: NoteResponse | null, trace: AiTraceStep[]): TraceDotItem[] => {
  const mode = getPipelineMode(note, trace)
  return trace.length ? buildTraceDotItems(trace, mode) : buildDefaultTraceDotItems(mode)
}

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
      viewState: 'config',
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
      viewState: 'config',
      note: lookup.note,
      errorMessage: null,
      shouldPoll: true,
    }
  }

  if (lookup.note.status === 'failed') {
    return {
      viewState: 'config',
      note: lookup.note,
      errorMessage: lookup.note.error || lookup.message || '分析失败',
      shouldPoll: false,
    }
  }

  return {
    viewState: lookup.note.status === 'completed' ? 'result' : 'config',
    note: lookup.note,
    errorMessage: null,
    shouldPoll: false,
  }
}

export function AiNoteModal({ videoId, videoTitle: _videoTitle, existingNote, isOpen, onClose, onComplete }: AiNoteModalProps) {
  const { settings, fetchSettings } = useSettingsStore()
  const runtimeState = useAiRuntimeState()
  const { showToast } = useToast()
  const [viewState, setViewState] = useState<ViewState>('config')
  const [selectedModel, setSelectedModel] = useState('')
  const [detailLevel, setDetailLevel] = useState<'simple' | 'detailed'>('detailed')
  const [style, setStyle] = useState('detailed')
  const [formats, setFormats] = useState<string[]>(['summary'])
  const [note, setNote] = useState<NoteResponse | null>(existingNote || null)
  const [error, setError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [trace, setTrace] = useState<AiTraceStep[]>([])
  const [localAsrReady, setLocalAsrReady] = useState(true)
  const [styleOptions, setStyleOptions] = useState<StyleOption[]>([])
  const [selectedTraceItem, setSelectedTraceItem] = useState<TraceDotItem | null>(null)
  const [controlState, setControlState] = useState<'running' | 'paused' | 'cancelled' | 'completed'>('running')
  const activeNoteIdRef = useRef<string | null>(null)
  const currentRequestRef = useRef<{ video_id: string; style: string; formats: string[]; model_provider: string; model_name: string; extras: string } | null>(null)
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
    if (!isOpen) return
    let cancelled = false
    aiRuntimeStateService.refresh().then(() => {
      if (cancelled) return
    }).catch(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const load = async () => {
      try {
        const [currentRes, defaultRes] = await Promise.all([
          aiPromptTemplatesService.getTemplates(),
          aiPromptTemplatesService.getDefaultTemplates(),
        ])
        if (cancelled) return

        const currentTemplates = currentRes.templates || {}
        const defaultTemplates = defaultRes.templates || {}
        const customStyles = Array.isArray((settings as any)?.ai_note?.style?.custom_styles)
          ? (settings as any).ai_note.style.custom_styles
          : []
        const builtin = buildPromptStyleOptions(currentTemplates, defaultTemplates, customStyles)
        setStyleOptions(builtin)
      } catch {
        if (!cancelled) setStyleOptions([])
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && existingNote) {
      setNote(existingNote)
      setTrace((existingNote.meta?.trace as AiTraceStep[]) || [])
      activeNoteIdRef.current = existingNote.id
      setControlState(existingNote.control_state || (existingNote.meta?.control?.state as any) || 'running')
      if (existingNote.style) {
        setStyle(normalizePromptStyleValue(existingNote.style))
      }
      if (existingNote.status === 'failed') {
        showToast(existingNote.error || '分析失败', 'error')
      }
      setViewState('config')
    }
  }, [isOpen, existingNote])

  // Lookup latest note on open. Never treat HTTP 404 (or any success=false response) as "no note".
  useEffect(() => {
    if (!isOpen) return
    if (!videoId) return

    let cancelled = false
    const run = async () => {
      try {
        const raw = await aiNoteService.lookupNoteByVideo(videoId)
        if (cancelled || suppressLookupRef.current) return

        const derived = deriveAiNoteModalStateFromLookup(raw)

        if (derived.note) {
          setNote(derived.note)
          setTrace((derived.note.meta?.trace as AiTraceStep[]) || [])
          activeNoteIdRef.current = derived.note.id
          setControlState(derived.note.control_state || (derived.note.meta?.control?.state as any) || 'running')
          if (derived.note.style) {
            setStyle(normalizePromptStyleValue(derived.note.style))
          }
        } else {
          setNote(null)
          setTrace([])
          if (derived.errorMessage) {
            showToast(derived.errorMessage, 'error')
          }
        }

        setViewState(derived.viewState)

        if (derived.shouldPoll && derived.note?.id) {
          try {
            await pollStatus(derived.note.id)
          } catch (err) {
            if (cancelled) return
            setViewState('config')
            showToast(err instanceof Error ? err.message : '分析失败', 'error')
          }
        }
      } catch (err) {
        if (cancelled || suppressLookupRef.current) return
        setViewState('config')
        setNote(null)
        showToast(err instanceof Error ? err.message : '加载 AI 笔记失败', 'error')
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [isOpen, videoId])

  useEffect(() => {
    if (!isOpen) return
    const llm = settings?.llm
    if (!llm) return
    const provider = llm.provider || 'openai'
    const providerModels = runtimeState.testedModels[provider] || []
    const configuredModel = llm.model || ''
    const nextModel = providerModels.includes(configuredModel)
      ? configuredModel
      : (providerModels[0] || configuredModel)
    setSelectedModel(nextModel)
    setFormats(['summary'])
  }, [isOpen, settings?.llm, runtimeState.testedModels])

  useEffect(() => {
    if (!isOpen || styleOptions.length === 0) return
    setStyle(prev => {
      if (styleOptions.some(option => option.value === prev)) {
        return prev
      }
      return styleOptions[0]?.value || prev
    })
  }, [isOpen, styleOptions])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    localAsrModelService.checkReady().then(result => {
      if (!cancelled) setLocalAsrReady(result.ready)
    }).catch(() => {
      if (!cancelled) setLocalAsrReady(false)
    })
    return () => {
      cancelled = true
    }
  }, [isOpen])

  const activeProvider = settings?.llm?.provider || 'openai'
  const activeProviderLabel = settings?.llm?.providers?.find(item => item.id === activeProvider)?.name || activeProvider

  const providerModels = useMemo(() => {
    return runtimeState.testedModels[activeProvider] || []
  }, [runtimeState.testedModels, activeProvider])

  const availableStyles = useMemo(() => {
    const customStyles: StyleOption[] = Array.isArray((settings as any)?.ai_note?.style?.custom_styles)
      ? (settings as any).ai_note.style.custom_styles
      : []
    const customMap = new Map(customStyles.map((item: any) => [item.value, item]))
    return styleOptions.map(styleItem => customMap.get(styleItem.value) || styleItem).concat(
      customStyles.filter((item: any) => !styleOptions.some(styleItem => styleItem.value === item.value))
    )
  }, [settings, styleOptions])

  const currentTrace = trace.length ? trace : ((note?.meta?.trace as AiTraceStep[]) || [])
  const effectiveControlState = controlState || (note?.control_state || (note?.meta?.control?.state as any) || 'running')
  const traceDots = useMemo(() => {
    return buildTraceDotItemsForNote(note, currentTrace)
  }, [currentTrace, note])

  useEffect(() => {
    if (!isOpen) {
      setSelectedTraceItem(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (selectedTraceItem && !traceDots.some(item => item.id === selectedTraceItem.id)) {
      setSelectedTraceItem(null)
    }
  }, [selectedTraceItem, traceDots])

  if (!isOpen) return null

  const resetState = () => {
    setViewState('config')
    setNote(null)
    setError(null)
    setTrace([])
    setSelectedTraceItem(null)
    setControlState('running')
    activeNoteIdRef.current = null
  }

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const pollStatus = async (noteId: string) => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const status = await aiNoteService.getStatus(noteId)
      setTrace((status.trace as AiTraceStep[]) || [])
      setControlState(status.control_state || 'running')
      if (status.status === 'processing' && status.control_state === 'paused') {
        await delay(500)
        continue
      }

      if (status.status === 'completed') {
        const completed = await aiNoteService.getNote(noteId)
        setNote(completed)
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

  const resumeFromStage = async (stage: string) => {
    const noteId = activeNoteIdRef.current || note?.id
    if (!noteId) return

    try {
      setError(null)
      setSelectedTraceItem(prev => prev || traceDots.find(item => item.stage === stage) || null)
      setControlState('running')
      await aiNoteService.resumeFromStage(noteId, stage)
      await pollStatus(noteId)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '按阶段重跑失败', 'error')
    }
  }

  const handleReanalyze = async () => {
    const noteId = activeNoteIdRef.current || note?.id
    if (!noteId) return

    try {
      setError(null)
      setControlState('running')
      showToast('正在重新生成...', 'info')
      const response = await aiNoteService.reanalyze(noteId)
      if (response.success && response.note_id) {
        activeNoteIdRef.current = response.note_id
        const completed = await pollStatus(response.note_id)
        if (completed?.status === 'completed') {
          setViewState('result')
        }
        showToast('重新生成完成', 'success')
      } else {
        showToast(response.message || '重新生成失败', 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '重新生成失败', 'error')
    }
  }

  const startAnalyze = async () => {
    setError(null)
    setIsAnalyzing(true)
    setViewState('config')
    setTrace([])
    setControlState('running')

    if (!localAsrReady) {
      setError('请先在 AI 笔记设置中下载并启用本地 ASR 模型')
      showToast('请先在 AI 笔记设置中下载并启用本地 ASR 模型', 'warning')
      setIsAnalyzing(false)
      return
    }

    if (!selectedModel) {
      setError('请先在设置面板测试并保存可用模型')
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
        activeNoteIdRef.current = response.note_id
        currentRequestRef.current = {
          video_id: videoId,
          style,
          formats,
          model_provider: activeProvider,
          model_name: selectedModel,
          extras: detailLevel === 'simple' ? '请输出简洁版本' : '请输出详细版本',
        }
        await pollStatus(response.note_id)
        return
      }

      setError(response.message || '分析失败')
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAnalyze = async () => {
    await startAnalyze()
  }

  const handlePauseOrResume = async () => {
    if (!activeNoteIdRef.current) return
    try {
      if (effectiveControlState === 'paused') {
        await aiNoteService.resumeNote(activeNoteIdRef.current)
        setControlState('running')
        showToast('已恢复分析', 'success')
      } else {
        await aiNoteService.pauseNote(activeNoteIdRef.current)
        setControlState('paused')
        showToast('已暂停分析', 'success')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '控制分析失败', 'error')
    }
  }

  const handleResetAnalyze = async () => {
    const noteId = activeNoteIdRef.current
    try {
      if (noteId) {
        await aiNoteService.cancelNote(noteId)
      }
      resetState()
      if (currentRequestRef.current) {
        await startAnalyze()
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '重置失败', 'error')
    }
  }

  const copyTraceItem = async (item: TraceDotItem) => {
    const text = item.detailText && item.detailText !== '暂无原始详情'
      ? item.detailText
      : '{}'

    try {
      await navigator.clipboard.writeText(text)
      showToast('已复制 JSON', 'success')
    } catch {
      showToast('复制 JSON 失败', 'error')
    }
  }

  const renderTraceBar = () => {
    if (!traceDots.length) return null

    return (
      <div className="ai-note-trace-timeline" aria-label="链路状态">
        <div className="ai-note-trace-timeline-track" />
        {traceDots.map((item, index) => {
          const isSelected = selectedTraceItem?.id === item.id
          const isLast = index === traceDots.length - 1
          return (
            <button
              key={item.id}
              type="button"
              className="ai-note-trace-timeline-node"
              data-status={item.status}
              data-selected={isSelected ? 'true' : 'false'}
              data-completed={item.status === 'done' ? 'true' : 'false'}
              onClick={() => setSelectedTraceItem(item)}
              title={`${item.stage} · ${item.title}`}
              aria-label={`查看 ${item.title} 的日志`}
              aria-pressed={isSelected}
              onDoubleClick={() => {
                setSelectedTraceItem(item)
                if (item.stage === 'LLM.ANALYZE' || item.stage === 'CONTENT.GENERATE') {
                  void handleReanalyze()
                } else {
                  void resumeFromStage(item.stage)
                }
              }}
              style={{
                flex: `${isLast ? 0.9 : 1.05} 1 0`,
              }}
            >
              <span className="ai-note-trace-timeline-node-line" data-status={item.status} />
              <span className="ai-note-trace-timeline-node-dot" data-status={item.status} data-selected={isSelected ? 'true' : 'false'} />
              <span className="ai-note-trace-timeline-node-label">{item.shortLabel}</span>
            </button>
          )
        })}
      </div>
    )
  }

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

        {viewState === 'config' && (
          <>
            <div className="ai-note-modal-content">
              <div className="ai-note-select-group">
                <label>AI 服务商</label>
                <div className="ai-note-summary-chip">{activeProviderLabel}</div>
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

              <div className="ai-note-select-group">
                <label>高级功能</label>
                <div className="ai-note-format-row">
                  {NOTE_FORMATS.map(f => {
                    const isActive = formats.includes(f.value)
                    return (
                      <button
                        key={f.value}
                        type="button"
                        data-active={isActive}
                        onClick={() => {
                          const newValue = isActive
                            ? formats.filter(v => v !== f.value)
                            : [...formats, f.value]
                          setFormats(newValue)
                        }}
                        className={isActive ? 'ai-note-format-btn active' : 'ai-note-format-btn'}
                      >
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {error && <div className="ai-note-modal-error">{error}</div>}

            <div className="ai-note-modal-footer">
              <button onClick={handleResetAnalyze} className="ai-note-modal-btn-secondary">
                <RotateCcw size={16} />
                重置
              </button>
              <button onClick={handlePauseOrResume} disabled={!activeNoteIdRef.current || (!isAnalyzing && effectiveControlState !== 'paused')} className="ai-note-modal-btn-secondary">
                {effectiveControlState === 'paused' ? <Play size={16} /> : <Pause size={16} />}
                {effectiveControlState === 'paused' ? '继续' : '暂停'}
              </button>
              <button onClick={handleAnalyze} disabled={isAnalyzing || !localAsrReady} className="ai-note-modal-btn-primary">
                {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isAnalyzing ? '分析中...' : (localAsrReady ? '开始分析' : '模型未就绪')}
              </button>
            </div>
          </>
        )}

        {viewState === 'result' && note && (
          <>
            <div className="ai-note-modal-content">
              <div className="ai-note-result-path-card">
                <div className="ai-note-result-path-label">本地 Markdown 路径</div>
                <div className="ai-note-result-path-value">{note?.generated_markdown_path || note?.meta?.generated_markdown_path || '暂无路径'}</div>
                {(note?.generated_markdown_path || note?.meta?.generated_markdown_path) && (
                  <button
                    type="button"
                    className="ai-note-result-path-copy"
                    onClick={() => {
                      void navigator.clipboard.writeText(note?.generated_markdown_path || note?.meta?.generated_markdown_path || '')
                      showToast('已复制本地路径', 'success')
                    }}
                  >
                    复制路径
                  </button>
                )}
              </div>
            </div>
            <div className="ai-note-modal-footer">
              <button onClick={handleResetAnalyze} className="ai-note-modal-btn-secondary">
                <RotateCcw size={16} />
                重新分析
              </button>
              <button onClick={onClose} className="ai-note-modal-btn-primary">
                关闭
              </button>
            </div>
          </>
        )}

        {renderTraceBar()}
      </div>

      <Modal
        isOpen={Boolean(selectedTraceItem)}
        onClose={() => setSelectedTraceItem(null)}
        title={selectedTraceItem?.title || '阶段日志'}
        size="lg"
        footer={selectedTraceItem ? (
          <>
            <button type="button" className="ai-note-trace-detail-copy" onClick={() => { void copyTraceItem(selectedTraceItem) }}>
              <Copy size={14} />
              复制
            </button>
            <button type="button" className="ai-note-trace-detail-close" onClick={() => setSelectedTraceItem(null)}>
              关闭
            </button>
          </>
        ) : null}
      >
        {selectedTraceItem && (
          <div className="ai-note-trace-detail">
            <div className="ai-note-trace-detail-head">
              <div className="ai-note-trace-detail-stage">{selectedTraceItem.stage}</div>
              <span className="ai-note-trace-detail-status" data-status={selectedTraceItem.status}>
                {selectedTraceItem.statusLabel}
              </span>
            </div>
            {typeof selectedTraceItem.progress === 'number' && (
              <div className="ai-note-trace-detail-meta">进度 {Math.round(selectedTraceItem.progress)}%</div>
            )}
            <div className="ai-note-trace-detail-block">
              <div className="ai-note-trace-detail-block-title">日志文本</div>
              <pre className="ai-note-trace-detail-json">{selectedTraceItem.detailText}</pre>
            </div>
          </div>
        )}
      </Modal>

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
        .ai-note-format-btn.active { border-color: var(--color-primary-600); background: var(--color-primary-50); color: var(--color-primary-600); }
        .ai-note-format-btn[data-active="true"] { border-color: var(--color-primary-600); background: var(--color-primary-50); color: var(--color-primary-600); }
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
        .ai-note-modal-result-empty { display: flex; align-items: center; justify-content: center; min-height: 120px; font-size: 13px; color: var(--color-text-tertiary); }
        .ai-note-result-path-card { display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 12px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); }
        .ai-note-result-path-label { font-size: 12px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.08em; }
        .ai-note-result-path-value { font-size: 13px; color: var(--color-text-primary); line-height: 1.5; word-break: break-all; }
        .ai-note-result-path-copy { align-self: flex-start; padding: 8px 12px; border-radius: 8px; border: none; background: var(--color-primary-600); color: white; cursor: pointer; }
        .ai-note-modal-summary { padding: 12px 20px; border-top: 1px solid var(--color-border); }
        .ai-note-modal-summary h4 { margin: 0 0 6px; font-size: 14px; }
        .ai-note-modal-summary p { margin: 0; font-size: 13px; color: var(--color-text-secondary); }
        .ai-note-trace-timeline { position: relative; display: flex; align-items: flex-start; gap: 4px; padding: 12px 16px 14px; border-top: 1px solid var(--color-border); background: var(--color-bg-secondary); width: 100%; box-sizing: border-box; }
        .ai-note-trace-timeline-track { position: absolute; left: 24px; right: 24px; top: 26px; height: 2px; border-radius: 999px; background: linear-gradient(90deg, rgba(156,163,175,0.35), rgba(156,163,175,0.15)); pointer-events: none; }
        .ai-note-trace-timeline-node { position: relative; min-width: 0; padding: 10px 8px 8px; border: none; background: transparent; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; color: inherit; min-height: 56px; }
        .ai-note-trace-timeline-node-line { position: absolute; top: 12px; left: calc(50% + 8px); right: -50%; height: 2px; background: rgba(156,163,175,0.22); z-index: 0; }
        .ai-note-trace-timeline-node-line[data-status="running"] { background: rgba(59,130,246,0.38); }
        .ai-note-trace-timeline-node-line[data-status="done"] { background: rgba(22,163,74,0.38); }
        .ai-note-trace-timeline-node-line[data-status="error"] { background: rgba(220,38,38,0.38); }
        .ai-note-trace-timeline-node:last-child .ai-note-trace-timeline-node-line { display: none; }
        .ai-note-trace-timeline-node-dot { position: relative; z-index: 1; width: 12px; height: 12px; min-width: 12px; min-height: 12px; border-radius: 999px; border: 2px solid var(--color-bg-secondary); background: #9ca3af; box-shadow: 0 0 0 1px rgba(255,255,255,0.6); transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease; }
        .ai-note-trace-timeline-node-dot[data-status="running"] {
          background: var(--color-primary-600);
          animation: breathe 1.5s ease-in-out infinite;
        }
        @keyframes breathe {
          0%, 100% { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3); transform: scale(1); }
          50% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.15); transform: scale(1.15); }
        }
        .ai-note-trace-timeline-node-dot[data-status="done"] { background: var(--color-success); }
        .ai-note-trace-timeline-node-dot[data-status="done"]::after { content: '✓'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 8px; color: white; }
        .ai-note-trace-timeline-node-dot[data-status="error"] { background: var(--color-error-600); }
        .ai-note-trace-timeline-node-dot[data-selected="true"] { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.18); transform: scale(1.12); }
        .ai-note-trace-timeline-node:hover .ai-note-trace-timeline-node-dot { transform: scale(1.12); }
        .ai-note-trace-timeline-node:focus-visible { outline: 2px solid var(--color-primary-600); outline-offset: 3px; border-radius: 10px; }
        .ai-note-trace-timeline-node-label { font-size: 11px; line-height: 1.2; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .ai-note-trace-timeline-node[data-status="pending"] .ai-note-trace-timeline-node-label { color: var(--color-text-tertiary); }
        .ai-note-trace-timeline-node[data-status="running"] .ai-note-trace-timeline-node-label { color: var(--color-primary-600); }
        .ai-note-trace-timeline-node[data-status="done"] .ai-note-trace-timeline-node-label { color: var(--color-success); }
        .ai-note-trace-timeline-node[data-status="error"] .ai-note-trace-timeline-node-label { color: var(--color-error-600); }
        .ai-note-trace-detail { display: grid; gap: 14px; }
        .ai-note-trace-detail-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .ai-note-trace-detail-stage { font-size: 14px; font-weight: 700; color: var(--color-text-primary); }
        .ai-note-trace-detail-status { padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid var(--color-border); background: var(--color-bg-secondary); color: var(--color-text-secondary); }
        .ai-note-trace-detail-status[data-status="running"] { color: var(--color-primary-600); border-color: rgba(59, 130, 246, 0.28); background: rgba(59, 130, 246, 0.08); }
        .ai-note-trace-detail-status[data-status="done"] { color: var(--color-success); border-color: rgba(22, 163, 74, 0.28); background: rgba(22, 163, 74, 0.08); }
        .ai-note-trace-detail-status[data-status="error"] { color: var(--color-error-600); border-color: rgba(220, 38, 38, 0.28); background: rgba(220, 38, 38, 0.08); }
        .ai-note-trace-detail-summary { font-size: 14px; line-height: 1.6; color: var(--color-text-secondary); }
        .ai-note-trace-detail-meta { font-size: 12px; color: var(--color-text-tertiary); }
        .ai-note-trace-detail-block { display: grid; gap: 8px; }
        .ai-note-trace-detail-block-title { font-size: 12px; font-weight: 700; color: var(--color-text-primary); }
        .ai-note-trace-detail-json { margin: 0; padding: 12px; border-radius: 10px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); font-size: 12px; line-height: 1.55; white-space: pre-wrap; color: var(--color-text-secondary); overflow: auto; }
        .ai-note-trace-detail-copy,.ai-note-trace-detail-close { padding: 10px 14px; border-radius: 10px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: transform 0.15s ease, background 0.15s ease, opacity 0.15s ease; }
        .ai-note-trace-detail-copy { display: inline-flex; align-items: center; gap: 6px; background: var(--color-primary-600); color: white; }
        .ai-note-trace-detail-close { background: var(--color-bg-secondary); color: var(--color-text-primary); }
        .ai-note-trace-detail-copy:hover,.ai-note-trace-detail-close:hover { transform: translateY(-1px); }
      `}</style>
    </div>
  )
}
