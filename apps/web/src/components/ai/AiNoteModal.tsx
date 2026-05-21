import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Sparkles, Loader2, RotateCcw, Copy, Pause, Play, ChevronDown, ChevronRight } from 'lucide-react'
import {
  aiNoteService,
  AI_NOTE_REANALYZE_STAGE_TEMPLATES,
  AI_NOTE_TRACE_STAGE_TEMPLATES,
  type NoteResponse,
  type AiTraceStep,
  type AiNotePipelineMode,
  type AiNoteTraceStageTemplate,
} from '../../services/aiNote'
import {
  applyAiNoteStreamEvent,
  createAiNoteStreamState,
  getStageLogText,
  type AiNoteStreamState,
} from '../../services/aiNoteStreamState'
import {
  buildAiNoteModalCacheKey,
  readAiNoteModalCache,
  writeAiNoteModalCache,
  type AiNoteModalCacheSnapshot,
} from '../../services/aiNoteModalCache'
import { aiPromptTemplatesService } from '../../services/aiPromptTemplates'
import { buildPromptStyleOptions, normalizePromptStyleValue } from '../../services/promptCatalog'
import { useToast } from '../Toast'
import { useSettingsStore } from '../../stores/settings'
import { localAsrModelService } from '../../services/localAsrModels'
import { useAiRuntimeState } from '../../hooks/useAiRuntimeState'
import { aiRuntimeStateService } from '../../services/aiRuntimeState'
import {
  buildSeriesEpisodeStates,
  calculateSeriesQueueSummary,
  getSeriesEpisodeStatusLabel,
  sortSeriesEpisodes,
  type SeriesEpisodeInput,
  type SeriesEpisodeState,
  type SeriesQueueSummary,
} from './seriesAnalysis'
import Modal from '../Modal'
import { apiService } from '../../services/api'

interface AiNoteModalProps {
  videoId: string
  videoTitle: string
  existingNote?: NoteResponse | null
  pipelineModeOverride?: AiNotePipelineMode
  aiRoutePath?: string
  seriesEpisodes?: SeriesEpisodeInput[]
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
  detailPreview: string
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
  if (semanticStage === 'DOC.READ') return 'DOC.READ'
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
const SUBTITLE_PRIORITY = [
  '.zh-CN.ai.srt',
  '.ai-zh.srt',
  '.zh-CN.srt',
  '.srt',
]

const getPipelineMode = (
  note?: NoteResponse | null,
  trace?: AiTraceStep[] | null,
  videoId?: string,
  overrideMode?: AiNotePipelineMode,
): AiNotePipelineMode => {
  if (overrideMode) {
    return overrideMode
  }
  if (note?.pipeline_mode === 'video' || note?.pipeline_mode === 'series' || note?.pipeline_mode === 'image_text') {
    return note.pipeline_mode
  }

  const metaMode = note?.meta?.pipeline_mode
  if (metaMode === 'video' || metaMode === 'series' || metaMode === 'image_text') {
    return metaMode
  }

  const firstStage = trace?.[0]?.stage?.toLowerCase?.() || ''
  if (firstStage.includes('ocr') || firstStage.includes('image') || firstStage.includes('doc')) return 'image_text'
  if (firstStage.includes('series') || firstStage.includes('season') || firstStage.includes('episode')) return 'series'
  
  const vid = videoId?.toLowerCase() || ''
  if (vid.startsWith('cv') || vid.match(/^\d{10,}/)) {
    return 'image_text'
  }
  return DEFAULT_PIPELINE_MODE
}

const getStageTemplates = (mode: AiNotePipelineMode): AiNoteTraceStageTemplate[] => {
  return AI_NOTE_TRACE_STAGE_TEMPLATES[mode] || AI_NOTE_TRACE_STAGE_TEMPLATES.video
}

const resolvePreferredSubtitleFilename = async (
  videoId: string,
  preferredFilename?: string,
): Promise<string | undefined> => {
  const filesResponse: any = await apiService.getSubtitleFiles(videoId)
  if (!filesResponse.success || !filesResponse.data) {
    return preferredFilename
  }

  const srtFiles = (filesResponse.data || [])
    .map((file: any) => (typeof file === 'string' ? file : file?.name || ''))
    .filter((name: string) => name.endsWith('.srt'))

  if (srtFiles.length === 0) {
    return preferredFilename
  }

  if (preferredFilename && srtFiles.includes(preferredFilename)) {
    return preferredFilename
  }

  return SUBTITLE_PRIORITY
    .map((suffix) => srtFiles.find((name: string) => name.endsWith(suffix)))
    .find(Boolean) || srtFiles[0]
}

const getEffectiveStageTemplates = (
  mode: AiNotePipelineMode,
  trace: AiTraceStep[],
): AiNoteTraceStageTemplate[] => {
  const normalizedStages = new Set(
    trace
      .map((step) => normalizeStage(step.stage))
      .filter(Boolean),
  )
  const hasAudioOrSubtitleTrace =
    normalizedStages.has(normalizeStage(`${mode}.AUDIO.FETCH`)) ||
    normalizedStages.has(normalizeStage(`${mode}.SUBTITLE.GENERATE`))

  if (!hasAudioOrSubtitleTrace && normalizedStages.size > 0) {
    return AI_NOTE_REANALYZE_STAGE_TEMPLATES[mode] || AI_NOTE_REANALYZE_STAGE_TEMPLATES.video
  }

  return getStageTemplates(mode)
}

const getTraceStatus = (step: AiTraceStep, nextStep?: AiTraceStep): TraceDotStatus => {
  const stage = step.stage.toUpperCase()
  const parts = stage.split('.')
  const stageRoot = parts[parts.length - 1] || stage
  const title = step.title || ''
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

const buildDetailPreview = (detail: AiTraceStep['detail']): string => {
  if (!detail || typeof detail !== 'object') return '暂无补充字段'

  const lines: string[] = []
  const pushLine = (label: string, value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      lines.push(`${label}: ${value.trim()}`)
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${label}: ${String(value)}`)
    }
  }

  pushLine('摘要补充', (detail as any).summary || (detail as any).message || (detail as any).text)
  pushLine('Prompt 预览', (detail as any).prompt_preview)
  pushLine('响应预览', (detail as any).response_preview)
  pushLine('状态', (detail as any).status)
  pushLine('Provider', (detail as any).provider)
  pushLine('Model', (detail as any).model)
  pushLine('长度', (detail as any).prompt_length || (detail as any).response_length)

  return lines.length ? lines.join('\n') : '暂无补充字段'
}

const pruneCompletedPlaceholderStages = (
  note: NoteResponse | null,
  templates: AiNoteTraceStageTemplate[],
  trace: AiTraceStep[],
): AiNoteTraceStageTemplate[] => {
  if (!note || note.status !== 'completed') {
    return templates
  }

  const normalizedStages = new Set(
    trace.map((step) => normalizeStage(step.stage)).filter(Boolean),
  )

  return templates.filter((item) => {
    const stage = normalizeStage(item.stage)
    if (stage === 'CONTENT.GENERATE' && !normalizedStages.has(stage)) {
      return false
    }
    return true
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
    detailText: '暂无日志',
    detailPreview: '暂无原始详情',
    steps: [],
    progress: 0,
  }))
}

const hydrateTraceWithCurrentStage = (
  note: NoteResponse | null,
  trace: AiTraceStep[],
): AiTraceStep[] => {
  if (!note) return trace
  const currentStage =
    note.current_stage ||
    (typeof note.meta?.control === 'object' ? (note.meta?.control as any)?.current_stage : undefined)
  const controlState =
    note.control_state ||
    (typeof note.meta?.control === 'object' ? (note.meta?.control as any)?.state : undefined)

  if (!currentStage || controlState !== 'running') {
    return trace
  }

  const exists = trace.some((step) => step.stage === currentStage)
  if (exists) {
    return trace
  }

  return [
    ...trace,
    {
      stage: currentStage,
      title: currentStage,
      summary: '处理中...',
      detail: { message: '处理中...' },
      progress: undefined,
      ts: new Date().toISOString(),
    },
  ]
}

const hydrateTraceWithArtifactState = (
  note: NoteResponse | null,
  trace: AiTraceStep[],
  videoId?: string,
  overrideMode?: AiNotePipelineMode,
): AiTraceStep[] => {
  if (!note || !note.meta || typeof note.meta !== 'object') {
    return trace
  }

  const artifactState = (note.meta as Record<string, any>).artifact_state
  if (!artifactState || typeof artifactState !== 'object') {
    return trace
  }

  const mode = getPipelineMode(note, trace, videoId, overrideMode)
  const nextTrace = [...trace]
  const seen = new Set(nextTrace.map((step) => normalizeStage(step.stage)))

  const pushSynthetic = (stage: string, title: string, summary: string, progress: number, detail: Record<string, any>) => {
    const normalized = normalizeStage(stage)
    if (seen.has(normalized)) return
    seen.add(normalized)
    nextTrace.push({
      stage,
      title,
      summary,
      detail,
      progress,
      ts: new Date().toISOString(),
    })
  }

  if (mode !== 'image_text' && artifactState.audio_exists) {
    pushSynthetic(
      `${mode}.AUDIO.FETCH`,
      '音频获取',
      '已发现本地音频文件',
      10,
      {
        audio_path: artifactState.audio_path,
        source: 'local-artifact',
      },
    )
  }

  if (mode !== 'image_text' && artifactState.subtitle_exists) {
    pushSynthetic(
      `${mode}.SUBTITLE.GENERATE`,
      '字幕复用',
      '已发现本地字幕文件',
      55,
      {
        subtitle_files: artifactState.subtitle_files || [],
        source: 'local-artifact',
      },
    )
  }

  if (artifactState.nfo_exists) {
    pushSynthetic(
      `${mode}.NFO.READ`,
      mode === 'image_text' ? '元数据读取' : 'NFO 读取',
      '已发现本地元数据文件',
      70,
      {
        nfo_path: artifactState.nfo_path,
        source: 'local-artifact',
      },
    )
  }

  return nextTrace
}

export const buildTraceDotItemsForNote = (
  note: NoteResponse | null,
  trace: AiTraceStep[],
  videoId?: string,
  overrideMode?: AiNotePipelineMode,
): TraceDotItem[] => {
  const hydratedTrace = hydrateTraceWithArtifactState(note, trace, videoId, overrideMode)
  const mode = getPipelineMode(note, hydratedTrace, videoId, overrideMode)
  if (!hydratedTrace.length) {
    return buildDefaultTraceDotItems(mode)
  }

  const templates = pruneCompletedPlaceholderStages(
    note,
    getEffectiveStageTemplates(mode, hydratedTrace),
    hydratedTrace,
  )

  const grouped = new Map<string, AiTraceStep[]>()
  templates.forEach(item => grouped.set(normalizeStage(item.stage), []))
  hydratedTrace.forEach(step => {
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
        detailText: '暂无日志',
        detailPreview: '暂无原始详情',
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
        const ts = step.ts ? `\n时间: ${step.ts}` : ''
        const summaryText = step.summary?.trim() || '暂无摘要'
        const detailLine = step.detail ? buildDetailPreview(step.detail) : '暂无补充字段'
        return `步骤 ${idx + 1}: ${step.title || step.stage}${ts}\n摘要: ${summaryText}\n${detailLine}`
      })
      .join('\n\n')

    const detailPreview = items
      .map(step => buildDetailPreview(step.detail))
      .filter(Boolean)
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
      detailText: detailText || '暂无日志',
      detailPreview: detailPreview || '暂无原始详情',
      steps: items,
      progress: last.progress,
    }
  })
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

export function AiNoteModal({
  videoId,
  videoTitle: _videoTitle,
  existingNote,
  pipelineModeOverride,
  aiRoutePath,
  seriesEpisodes,
  isOpen,
  onClose,
  onComplete,
}: AiNoteModalProps) {
  const navigate = useNavigate()
  const { settings, fetchSettings } = useSettingsStore()
  const runtimeState = useAiRuntimeState()
  const { showToast } = useToast()
  const isSeriesMode = Boolean(seriesEpisodes?.length)
  const effectivePipelineModeOverride = isSeriesMode ? 'video' : pipelineModeOverride
  const [viewState, setViewState] = useState<ViewState>('config')
  const [selectedModel, setSelectedModel] = useState('')
  const [isRefreshingModels, setIsRefreshingModels] = useState(false)
  const [detailLevel, setDetailLevel] = useState<'simple' | 'detailed'>('detailed')
  const [enableTimestamps, setEnableTimestamps] = useState(false)
  const [enableScreenshots, setEnableScreenshots] = useState(false)
  const [enablePageOutput, setEnablePageOutput] = useState(false)
  const [enableImageOutput, setEnableImageOutput] = useState(false)
  const [style, setStyle] = useState('detailed')
  const [promptExtras, setPromptExtras] = useState('')
  const [seriesListCollapsed, setSeriesListCollapsed] = useState(false)
  const [note, setNote] = useState<NoteResponse | null>(existingNote || null)
  const [error, setError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [trace, setTrace] = useState<AiTraceStep[]>([])
  const [streamState, setStreamState] = useState<AiNoteStreamState>(() => createAiNoteStreamState())
  const [localAsrReady, setLocalAsrReady] = useState(true)
  const [styleOptions, setStyleOptions] = useState<StyleOption[]>([])
  const [selectedTraceItem, setSelectedTraceItem] = useState<TraceDotItem | null>(null)
  const [controlState, setControlState] = useState<'running' | 'paused' | 'cancelled' | 'completed'>('running')
  const [seriesEpisodeStates, setSeriesEpisodeStates] = useState<SeriesEpisodeState[]>([])
  const [seriesEpisodeRuntimeStates, setSeriesEpisodeRuntimeStates] = useState<Record<string, AiNoteStreamState>>({})
  const [seriesRunSummary, setSeriesRunSummary] = useState<SeriesQueueSummary>(() => calculateSeriesQueueSummary([]))
  const [activeSeriesEpisodeId, setActiveSeriesEpisodeId] = useState<string | null>(null)
  const activeNoteIdRef = useRef<string | null>(null)
  const analysisAbortRef = useRef<AbortController | null>(null)
  const streamStateRef = useRef<AiNoteStreamState>(createAiNoteStreamState())
  const seriesContextKeyRef = useRef<string>('')
  const skipNextCacheWriteRef = useRef(false)
  const modalCacheKey = useMemo(() => {
    const seriesFingerprint = isSeriesMode
      ? (seriesEpisodes || [])
        .map(item => [
          item.id,
          item.title,
          item.available === false ? '0' : '1',
          item.order ?? '',
          item.subtitleFilename ?? '',
        ].join(':'))
        .join('|')
      : ''

    return buildAiNoteModalCacheKey({
      videoId,
      pipelineMode: isSeriesMode ? 'series' : (pipelineModeOverride || DEFAULT_PIPELINE_MODE),
      seriesFingerprint: isSeriesMode ? seriesFingerprint : undefined,
    })
  }, [isSeriesMode, pipelineModeOverride, seriesEpisodes, videoId])
  const currentRequestRef = useRef<{ video_id: string; style: string; model_provider: string; model_name: string; extras: string; pipeline_mode: AiNotePipelineMode } | null>(null)
  const activeQueueTokenRef = useRef(0)
  const suppressLookupRef = useRef(false)
  const settingsFetchRequestedRef = useRef(false)

  useEffect(() => {
    suppressLookupRef.current = isAnalyzing
  }, [isAnalyzing])

  useEffect(() => {
    streamStateRef.current = streamState
  }, [streamState])

  useEffect(() => {
    setSeriesRunSummary(calculateSeriesQueueSummary(seriesEpisodeStates))
  }, [seriesEpisodeStates])

  useEffect(() => {
    if (!isOpen) {
      settingsFetchRequestedRef.current = false
      setPromptExtras('')
      return
    }

    if (settings) {
      settingsFetchRequestedRef.current = false
      return
    }

    if (settingsFetchRequestedRef.current) {
      return
    }

    settingsFetchRequestedRef.current = true
    if (isOpen && !settings) {
      fetchSettings()
    }
  }, [settings, fetchSettings, isOpen])

  useEffect(() => {
    if (!isOpen) return
    try {
      const raw = window.localStorage.getItem('pilinote.aiNote.enableTimestamps')
      if (raw === null) return
      setEnableTimestamps(raw === '1' || raw === 'true')
    } catch {
      // ignore
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    try {
      const raw = window.localStorage.getItem('pilinote.aiNote.enableScreenshots')
      if (raw === null) return
      setEnableScreenshots(raw === '1' || raw === 'true')
    } catch {
      // ignore
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    try {
      const raw = window.localStorage.getItem('pilinote.aiNote.enablePageOutput')
      if (raw === null) return
      setEnablePageOutput(raw === '1' || raw === 'true')
    } catch {
      // ignore
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    try {
      const raw = window.localStorage.getItem('pilinote.aiNote.enableImageOutput')
      if (raw === null) return
      setEnableImageOutput(raw === '1' || raw === 'true')
    } catch {
      // ignore
    }
  }, [isOpen])

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
    if (!isOpen || !isSeriesMode) return

    const nextContextKey = [
      videoId,
      ...(seriesEpisodes || []).map(item => [
        item.id,
        item.title,
        item.available === false ? '0' : '1',
        item.order ?? '',
        item.subtitleFilename ?? '',
      ].join(':')),
    ].join('|')

    if (seriesContextKeyRef.current === nextContextKey) {
      return
    }

    seriesContextKeyRef.current = nextContextKey
    skipNextCacheWriteRef.current = true

    const cached = readAiNoteModalCache(modalCacheKey)
    if (cached && cached.kind === 'series') {
      setViewState(cached.viewState)
      setNote(cached.note)
      setError(cached.error)
      setTrace(cached.trace || [])
      setControlState(cached.controlState)
      setSelectedTraceItem(null)
      activeNoteIdRef.current = cached.activeNoteId

      const nextStreamState = cached.streamState || createAiNoteStreamState()
      streamStateRef.current = nextStreamState
      setStreamState(nextStreamState)

      setSeriesEpisodeStates(cached.seriesEpisodeStates || buildSeriesEpisodeStates(seriesEpisodes || []))
      setSeriesEpisodeRuntimeStates(cached.seriesEpisodeRuntimeStates || {})
      setSeriesRunSummary(cached.seriesRunSummary || calculateSeriesQueueSummary(cached.seriesEpisodeStates || []))
      setActiveSeriesEpisodeId(cached.activeSeriesEpisodeId || null)
      currentRequestRef.current = null
      return
    }

    const initialStates = buildSeriesEpisodeStates(seriesEpisodes || [])
    const initialRuntimeStates = Object.fromEntries(
      initialStates.map(item => [item.id, createAiNoteStreamState()]),
    )
    setSeriesEpisodeStates(initialStates)
    setSeriesEpisodeRuntimeStates(initialRuntimeStates)
    setActiveSeriesEpisodeId(initialStates.find(item => item.selected && item.available)?.id || initialStates.find(item => item.available)?.id || null)
    setSeriesRunSummary(calculateSeriesQueueSummary(initialStates))
    setNote(null)
    setTrace([])
    setError(null)
    setSelectedTraceItem(null)
    setControlState('running')
    const nextStreamState = createAiNoteStreamState()
    streamStateRef.current = nextStreamState
    setStreamState(nextStreamState)
    activeNoteIdRef.current = null
    currentRequestRef.current = null
  }, [isOpen, isSeriesMode, modalCacheKey, seriesEpisodes, videoId])

  useEffect(() => {
    if (!isOpen || isSeriesMode) return
    if (!existingNote) return

    setNote(existingNote)
    setTrace(hydrateTraceWithCurrentStage(existingNote, (existingNote.meta?.trace as AiTraceStep[]) || []))
    const nextStreamState = createAiNoteStreamState()
    streamStateRef.current = nextStreamState
    setStreamState(nextStreamState)
    activeNoteIdRef.current = existingNote.id
    setControlState(existingNote.control_state || (existingNote.meta?.control?.state as any) || 'running')
    if (existingNote.style) {
      setStyle(normalizePromptStyleValue(existingNote.style))
    }
    if (existingNote.status === 'failed') {
      showToast(existingNote.error || '分析失败', 'error')
    }
    setViewState('config')
  }, [existingNote, isOpen, isSeriesMode, showToast])

  useEffect(() => {
    if (!isOpen || isSeriesMode) return

    const cached = readAiNoteModalCache(modalCacheKey)
    if (!cached || cached.kind !== 'single' || cached.videoId !== videoId) {
      return
    }

    skipNextCacheWriteRef.current = true
    setViewState(cached.viewState)
    setNote(cached.note)
    setError(cached.error)
    setTrace(cached.trace || [])
    setControlState(cached.controlState)
    setSelectedTraceItem(null)
    activeNoteIdRef.current = cached.activeNoteId

    const nextStreamState = cached.streamState || createAiNoteStreamState()
    streamStateRef.current = nextStreamState
    setStreamState(nextStreamState)
  }, [isOpen, isSeriesMode, modalCacheKey, videoId])

  useEffect(() => {
    if (!isOpen) return
    if (skipNextCacheWriteRef.current) {
      skipNextCacheWriteRef.current = false
      return
    }

    const snapshot: AiNoteModalCacheSnapshot = isSeriesMode
      ? {
          version: 1,
          kind: 'series',
          videoId,
          pipelineMode: 'series',
          seriesFingerprint: seriesEpisodes?.length
            ? seriesEpisodes
              .map(item => [
                item.id,
                item.title,
                item.available === false ? '0' : '1',
                item.order ?? '',
                item.subtitleFilename ?? '',
              ].join(':'))
              .join('|')
            : '',
          updatedAt: Date.now(),
          viewState,
          note,
          error,
          trace,
          streamState,
          controlState,
          activeNoteId: activeNoteIdRef.current || note?.id || null,
          selectedTraceItemId: selectedTraceItem?.id || null,
          seriesEpisodeStates,
          seriesEpisodeRuntimeStates,
          seriesRunSummary,
          activeSeriesEpisodeId,
        }
      : {
          version: 1,
          kind: 'single',
          videoId,
          pipelineMode: pipelineModeOverride || DEFAULT_PIPELINE_MODE,
          updatedAt: Date.now(),
          viewState,
          note,
          error,
          trace,
          streamState,
          controlState,
          activeNoteId: activeNoteIdRef.current || note?.id || null,
          selectedTraceItemId: selectedTraceItem?.id || null,
        }

    writeAiNoteModalCache(modalCacheKey, snapshot)
  }, [
    activeSeriesEpisodeId,
    controlState,
    error,
    isOpen,
    isSeriesMode,
    modalCacheKey,
    note,
    pipelineModeOverride,
    selectedTraceItem,
    seriesEpisodeRuntimeStates,
    seriesEpisodeStates,
    seriesEpisodes,
    seriesRunSummary,
    streamState,
    trace,
    viewState,
    videoId,
  ])

  // Lookup latest note on open. Never treat HTTP 404 (or any success=false response) as "no note".
  useEffect(() => {
    if (!isOpen) return
    if (isSeriesMode) return
    if (!videoId) return

    let cancelled = false
    const run = async () => {
      const cached = readAiNoteModalCache(modalCacheKey)
      try {
        const raw = await aiNoteService.lookupNoteByVideo(videoId)
        if (cancelled || suppressLookupRef.current) return

        const derived = deriveAiNoteModalStateFromLookup(raw)

        if (derived.note) {
          setNote(derived.note)
          setTrace(hydrateTraceWithCurrentStage(derived.note, (derived.note.meta?.trace as AiTraceStep[]) || []))
          activeNoteIdRef.current = derived.note.id
          setControlState(derived.note.control_state || (derived.note.meta?.control?.state as any) || 'running')
          if (derived.note.style) {
            setStyle(normalizePromptStyleValue(derived.note.style))
          }
        } else {
          if (cached && cached.kind === 'single' && cached.videoId === videoId) {
            skipNextCacheWriteRef.current = true
            setViewState(cached.viewState)
            setNote(cached.note)
            setError(cached.error)
            setTrace(cached.trace || [])
            setControlState(cached.controlState)
            activeNoteIdRef.current = cached.activeNoteId
            const nextStreamState = cached.streamState || createAiNoteStreamState()
            streamStateRef.current = nextStreamState
            setStreamState(nextStreamState)
            return
          }
          setNote(null)
          setTrace([])
          const nextStreamState = createAiNoteStreamState()
          streamStateRef.current = nextStreamState
          setStreamState(nextStreamState)
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
        const cached = readAiNoteModalCache(modalCacheKey)
        if (cached && cached.kind === 'single' && cached.videoId === videoId) {
          skipNextCacheWriteRef.current = true
          setViewState(cached.viewState)
          setNote(cached.note)
          setError(cached.error)
          setTrace(cached.trace || [])
          setControlState(cached.controlState)
          activeNoteIdRef.current = cached.activeNoteId
          const nextStreamState = cached.streamState || createAiNoteStreamState()
          streamStateRef.current = nextStreamState
          setStreamState(nextStreamState)
          return
        }
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
  const pageOutputModel = (settings as any)?.ai_note?.outputs?.page?.llm?.model || ''
  const pageOutputProvider = (settings as any)?.ai_note?.outputs?.page?.llm?.provider || ''
  const imageOutputModel = (settings as any)?.ai_note?.outputs?.image?.llm?.model || ''
  const imageOutputProvider = (settings as any)?.ai_note?.outputs?.image?.llm?.provider || ''
  const canEnablePageOutput = Boolean(pageOutputProvider && pageOutputModel)
  const canEnableImageOutput = Boolean(imageOutputProvider && imageOutputModel)

  useEffect(() => {
    if (!canEnablePageOutput && enablePageOutput) {
      setEnablePageOutput(false)
      try { window.localStorage.setItem('pilinote.aiNote.enablePageOutput', '0') } catch {}
    }
  }, [canEnablePageOutput, enablePageOutput])

  useEffect(() => {
    if (!canEnableImageOutput && enableImageOutput) {
      setEnableImageOutput(false)
      try { window.localStorage.setItem('pilinote.aiNote.enableImageOutput', '0') } catch {}
    }
  }, [canEnableImageOutput, enableImageOutput])

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

  const sortedSeriesEpisodeStates = useMemo(() => {
    return sortSeriesEpisodes(seriesEpisodeStates)
  }, [seriesEpisodeStates])

  const selectedSeriesEpisodes = useMemo(() => {
    return sortedSeriesEpisodeStates.filter(item => item.selected && item.available)
  }, [sortedSeriesEpisodeStates])

  const activeSeriesEpisode = useMemo(() => {
    if (!activeSeriesEpisodeId) return null
    return sortedSeriesEpisodeStates.find(item => item.id === activeSeriesEpisodeId) || null
  }, [activeSeriesEpisodeId, sortedSeriesEpisodeStates])

  const activeSeriesRuntimeState = useMemo(() => {
    if (!activeSeriesEpisodeId) return null
    return seriesEpisodeRuntimeStates[activeSeriesEpisodeId] || null
  }, [activeSeriesEpisodeId, seriesEpisodeRuntimeStates])

  const noteMetaTrace = (note?.meta?.trace as AiTraceStep[]) || []
  // Prefer the richer trace from note.meta once available (especially after completion),
  // because SSE/local stream state can lag behind and miss late-stage trace entries.
  const currentTrace = useMemo(() => {
    const local = Array.isArray(trace) ? trace : []
    const meta = Array.isArray(noteMetaTrace) ? noteMetaTrace : []
    if (meta.length && local.length) {
      return meta.length >= local.length ? meta : local
    }
    return meta.length ? meta : local
  }, [noteMetaTrace, trace])
  const effectiveControlState = controlState || (note?.control_state || (note?.meta?.control?.state as any) || 'running')
  const activeSeriesTrace = useMemo(() => {
    if (!isSeriesMode) return currentTrace
    if (activeSeriesRuntimeState?.trace?.length) return activeSeriesRuntimeState.trace
    if (activeSeriesEpisode?.trace?.length) return activeSeriesEpisode.trace
    return currentTrace
  }, [activeSeriesEpisode, activeSeriesRuntimeState?.trace, currentTrace, isSeriesMode])
  const traceDots = useMemo(() => {
    return buildTraceDotItemsForNote(note, activeSeriesTrace, videoId, effectivePipelineModeOverride)
  }, [activeSeriesTrace, effectivePipelineModeOverride, note, videoId])
  const liveTraceLogText = useMemo(() => {
    if (selectedTraceItem) {
      const selectedStageState = activeSeriesRuntimeState?.stages?.[selectedTraceItem.stage] || streamState.stages[selectedTraceItem.stage]
      const stageLogText = getStageLogText(selectedStageState)
      if (stageLogText) {
        return stageLogText
      }
      const selectedSeriesStageState = activeSeriesTrace.find(step => step.stage === selectedTraceItem.stage)
      if (selectedSeriesStageState?.detail) {
        try {
          return JSON.stringify(selectedSeriesStageState.detail, null, 2)
        } catch {
          return selectedSeriesStageState.summary || selectedTraceItem.detailText || '暂无日志'
        }
      }
      if (selectedTraceItem.detailText) {
        return selectedTraceItem.detailText
      }
    }
    if (isSeriesMode && activeSeriesTrace.length) {
      return activeSeriesTrace
        .map(step => {
          const detail = step.detail ? (() => {
            try {
              return JSON.stringify(step.detail, null, 2)
            } catch {
              return ''
            }
          })() : ''
          return `${step.stage}\n${step.title}\n${step.summary}${detail ? `\n${detail}` : ''}`
        })
        .join('\n\n')
    }
    const activeStageState = streamState.activeStage ? streamState.stages[streamState.activeStage] : undefined
    const logText = getStageLogText(activeStageState)
    return logText || '暂无日志'
  }, [activeSeriesRuntimeState, activeSeriesTrace, isSeriesMode, selectedTraceItem, streamState.activeStage, streamState.stages])

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

  const resetLiveState = () => {
    setViewState('config')
    setNote(null)
    setError(null)
    setTrace([])
    const nextStreamState = createAiNoteStreamState()
    streamStateRef.current = nextStreamState
    setStreamState(nextStreamState)
    setSelectedTraceItem(null)
    setControlState('running')
    activeNoteIdRef.current = null
  }

  const resetSeriesState = () => {
    const nextStates = buildSeriesEpisodeStates(seriesEpisodes || [])
    const nextRuntimeStates = Object.fromEntries(
      nextStates.map(item => [item.id, createAiNoteStreamState()]),
    )
    setSeriesEpisodeStates(nextStates)
    setSeriesEpisodeRuntimeStates(nextRuntimeStates)
    setSeriesRunSummary(calculateSeriesQueueSummary(nextStates))
    setActiveSeriesEpisodeId(nextStates.find(item => item.selected && item.available)?.id || nextStates.find(item => item.available)?.id || null)
    activeQueueTokenRef.current += 1
  }

  const updateSeriesEpisodeState = (
    episodeId: string,
    patch: Partial<SeriesEpisodeState>,
  ) => {
    setSeriesEpisodeStates(prev =>
      prev.map(item => (
        item.id === episodeId
          ? {
              ...item,
              ...patch,
            }
          : item
      )),
    )
  }

  const setAvailableSeriesSelection = (selected: boolean) => {
    setSeriesEpisodeStates(prev =>
      prev.map(item => (
        item.available
          ? {
              ...item,
              selected,
            }
          : item
      )),
    )
  }

  const runSingleAnalysis = async (params: {
    videoIdToAnalyze: string
    queueEpisodeId?: string
    subtitleFilename?: string
    queueToken?: number
    showSuccessToast?: boolean
  }): Promise<NoteResponse> => {
    const { videoIdToAnalyze, queueEpisodeId, subtitleFilename, queueToken, showSuccessToast = true } = params

    resetLiveState()

    if (!localAsrReady) {
      throw new Error('请先在 AI 笔记设置中下载并启用本地 ASR 模型')
    }

    if (!selectedModel) {
      throw new Error('请先在设置面板测试并保存可用模型')
    }

    const abortController = new AbortController()
    analysisAbortRef.current = abortController

    const currentMode = isSeriesMode ? 'video' : (getPipelineMode(note, trace, videoIdToAnalyze, effectivePipelineModeOverride) || 'video')
    const resolvedSubtitleFilename = currentMode !== 'image_text'
      ? await resolvePreferredSubtitleFilename(videoIdToAnalyze, subtitleFilename)
      : undefined
    const request = {
      video_id: videoIdToAnalyze,
      style,
      model_provider: activeProvider,
      model_name: selectedModel,
      level: detailLevel,
      pipeline_mode: currentMode,
      subtitle_filename: resolvedSubtitleFilename,
      extras: promptExtras.trim() || undefined,
      generate_page: Boolean(enablePageOutput),
      generate_image: Boolean(enableImageOutput),
      formats: (() => {
        const formats: string[] = []
        if (enableScreenshots) formats.push('screenshot')
        if (enableTimestamps) formats.push('timestamps')
        if (formats.length === 0) return undefined
        // Keep `summary` on by default when any advanced formats are selected.
        return ['summary', ...formats]
      })(),
    }

    currentRequestRef.current = {
      video_id: videoIdToAnalyze,
      style,
      model_provider: activeProvider,
      model_name: selectedModel,
      extras: promptExtras.trim(),
      pipeline_mode: currentMode,
    }

    let completed = false
    let completedNote: NoteResponse | null = null
    let completionResolve!: (note: NoteResponse) => void
    let completionReject!: (error: unknown) => void
    const completionPromise = new Promise<NoteResponse>((resolve, reject) => {
      completionResolve = resolve
      completionReject = reject
    })

    const finishQueueEpisode = (patch: Partial<SeriesEpisodeState>) => {
      if (!queueEpisodeId) return
      if (queueToken !== undefined && queueToken !== activeQueueTokenRef.current) return
      updateSeriesEpisodeState(queueEpisodeId, patch)
    }

    const finalizeCompletedNote = async (noteId: string) => {
      const finalNote = await aiNoteService.getNote(noteId)
      completedNote = finalNote
      setNote(finalNote)
      onComplete?.(finalNote)
      if (!isSeriesMode) {
        setViewState('result')
      }
      return finalNote
    }

    try {
      await aiNoteService.analyzeStream(
        '/api/note/pipeline-analyze',
        request,
        (event) => {
          const next = applyAiNoteStreamEvent(streamStateRef.current, event)
          streamStateRef.current = next
          setStreamState(next)
          setTrace(next.trace)

          if (queueEpisodeId) {
            setSeriesEpisodeRuntimeStates(prev => ({
              ...prev,
              [queueEpisodeId]: next,
            }))
          }

          if (queueEpisodeId) {
            finishQueueEpisode({
              status: event.stage === 'DONE' && event.status === 'completed' ? 'completed' : 'running',
              progress: typeof event.data?.progress === 'number' ? event.data.progress : undefined,
              currentStage: typeof event.data?.current_stage === 'string'
                ? event.data.current_stage
                : (event.stage || undefined),
              error: undefined,
              trace: next.trace,
            })
          }

          if (event.stage === 'INIT' && event.data?.note_id) {
            activeNoteIdRef.current = event.data.note_id
            return
          }

          if (event.stage === 'DONE' && event.status === 'completed') {
            const noteId = activeNoteIdRef.current || event.data?.note_id || note?.id
            if (!noteId) {
              completionReject(new Error('未获取到 note_id'))
              return
            }

            void finalizeCompletedNote(noteId)
              .then((finalNote) => {
                const finalTrace = (finalNote.meta?.trace as AiTraceStep[]) || next.trace
                // Prefer the full trace persisted in note.meta once the pipeline is done.
                setTrace(finalTrace)
                if (queueEpisodeId) {
                  setSeriesEpisodeRuntimeStates(prev => ({
                    ...prev,
                    [queueEpisodeId]: {
                      ...next,
                      trace: finalTrace,
                    },
                  }))
                }
                if (queueEpisodeId) {
                  finishQueueEpisode({
                    status: 'completed',
                    progress: 100,
                    currentStage: '已完成',
                    error: undefined,
                    trace: finalTrace,
                    noteId: finalNote.id,
                  })
                }
                completed = true
                completionResolve(finalNote)
                if (showSuccessToast && !isSeriesMode) {
                  showToast('AI 笔记生成完成', 'success')
                }
              })
              .catch((err) => {
                const message = err instanceof Error ? err.message : '获取笔记失败'
                if (queueEpisodeId) {
                  finishQueueEpisode({
                    status: 'failed',
                    error: message,
                    currentStage: '失败',
                    trace: next.trace,
                  })
                }
                completionReject(err)
              })
            return
          }

          if (event.stage === 'DONE' && event.status === 'error') {
            const message = event.data?.error || '分析失败'
            if (queueEpisodeId) {
              finishQueueEpisode({
                status: 'failed',
                error: message,
                currentStage: '失败',
                trace: next.trace,
              })
            }
            setError(message)
            completionReject(new Error(message))
          }
        },
        abortController.signal,
      )

      if (!completed) {
        const noteResult = await completionPromise
        return noteResult
      }

      return completedNote ?? await completionPromise
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err
      }

      const failedNoteId = activeNoteIdRef.current || note?.id
      let failedTrace: AiTraceStep[] = []
      if (failedNoteId) {
        try {
          const failedNote = await aiNoteService.getNote(failedNoteId)
          setNote(failedNote)
          failedTrace = (failedNote.meta?.trace as AiTraceStep[]) || []
          setTrace(failedTrace)
          if (failedNote.error) {
            setError(failedNote.error)
          }
        } catch {
          try {
            const status = await aiNoteService.getStatus(failedNoteId)
            failedTrace = (status.trace as AiTraceStep[]) || []
            setTrace(failedTrace)
            if (status.error) {
              setError(status.error)
            }
          } catch {
            // ignore secondary fetch failures; the original error still propagates
          }
        }
      }

      if (queueEpisodeId) {
        setSeriesEpisodeStates(prev =>
          prev.map(item => (
            item.id === queueEpisodeId
              ? {
                  ...item,
                  trace: failedTrace.length ? failedTrace : item.trace,
                }
              : item
          )),
        )
        finishQueueEpisode({
          status: 'failed',
          error: err instanceof Error ? err.message : '分析失败',
          currentStage: '失败',
          trace: failedTrace.length ? failedTrace : streamStateRef.current.trace,
        })
        setSeriesEpisodeRuntimeStates(prev => ({
          ...prev,
          [queueEpisodeId]: failedTrace.length
            ? {
                ...streamStateRef.current,
                trace: failedTrace,
              }
            : streamStateRef.current,
        }))
      }
      throw err
    } finally {
      analysisAbortRef.current = null
    }
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
      const currentMode = isSeriesMode
        ? 'video'
        : getPipelineMode(note, trace, videoId, effectivePipelineModeOverride)
      const response = await aiNoteService.reanalyze(noteId, currentMode)
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

  const startSingleAnalyze = async () => {
    if (!localAsrReady) {
      setError('请先在 AI 笔记设置中下载并启用本地 ASR 模型')
      showToast('请先在 AI 笔记设置中下载并启用本地 ASR 模型', 'warning')
      return
    }

    if (!selectedModel) {
      setError('请先在设置面板测试并保存可用模型')
      return
    }

    setIsAnalyzing(true)
    try {
      await runSingleAnalysis({
        videoIdToAnalyze: videoId,
        showSuccessToast: true,
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        showToast('已取消 AI 笔记重新生成', 'info')
        return
      }
      setError(err instanceof Error ? err.message : '分析失败')
      showToast(err instanceof Error ? err.message : '分析失败', 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const startSeriesAnalyze = async (episodeIds?: string[]) => {
    const availableSelections = seriesEpisodeStates.filter(item => item.selected && item.available)
    const selectedEpisodes = sortSeriesEpisodes(
      episodeIds && episodeIds.length > 0
        ? seriesEpisodeStates.filter(item => episodeIds.includes(item.id) && item.available)
        : availableSelections,
    )

    if (selectedEpisodes.length === 0) {
      setError('请先选择要分析的集数')
      showToast('请先选择要分析的集数', 'warning')
      return
    }

    if (!localAsrReady) {
      setError('请先在 AI 笔记设置中下载并启用本地 ASR 模型')
      showToast('请先在 AI 笔记设置中下载并启用本地 ASR 模型', 'warning')
      return
    }

    if (!selectedModel) {
      setError('请先在设置面板测试并保存可用模型')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setViewState('config')
    activeQueueTokenRef.current += 1
    const queueToken = activeQueueTokenRef.current
    const selectedEpisodeIdSet = new Set(selectedEpisodes.map(item => item.id))

    setSeriesEpisodeStates(prev =>
      prev.map(item => (
        selectedEpisodeIdSet.has(item.id)
          ? {
              ...item,
              status: 'queued',
              progress: 0,
              currentStage: undefined,
              error: undefined,
            }
          : item
      )),
    )

    let completedCount = 0
    let failedCount = 0

    try {
      for (const episode of selectedEpisodes) {
        if (queueToken !== activeQueueTokenRef.current) {
          break
        }

        setActiveSeriesEpisodeId(episode.id)
        updateSeriesEpisodeState(episode.id, {
          status: 'running',
          progress: 0,
          currentStage: '开始分析',
          error: undefined,
        })

        try {
          const completedNote = await runSingleAnalysis({
            videoIdToAnalyze: episode.id,
            queueEpisodeId: episode.id,
            subtitleFilename: episode.subtitleFilename,
            queueToken,
            showSuccessToast: false,
          })

          if (queueToken !== activeQueueTokenRef.current) {
            break
          }

          completedCount += 1
          updateSeriesEpisodeState(episode.id, {
            status: 'completed',
            progress: 100,
            currentStage: '已完成',
            error: undefined,
          })
          onComplete?.(completedNote)
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            break
          }
          failedCount += 1
          updateSeriesEpisodeState(episode.id, {
            status: 'failed',
            error: err instanceof Error ? err.message : '分析失败',
            currentStage: '失败',
          })
        }
      }

      if (queueToken === activeQueueTokenRef.current) {
        if (failedCount > 0) {
          showToast(`系列分析完成，${completedCount} 集成功，${failedCount} 集失败`, 'warning')
        } else {
          showToast(`系列分析完成，共 ${completedCount} 集`, 'success')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '系列分析失败')
      showToast(err instanceof Error ? err.message : '系列分析失败', 'error')
    } finally {
      if (queueToken === activeQueueTokenRef.current) {
        setActiveSeriesEpisodeId(null)
        setIsAnalyzing(false)
      }
    }
  }

  const handleAnalyze = async () => {
    if (isSeriesMode) {
      await startSeriesAnalyze()
      return
    }
    await startSingleAnalyze()
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
      activeQueueTokenRef.current += 1
      analysisAbortRef.current?.abort()
      if (noteId) {
        await aiNoteService.cancelNote(noteId)
      }
      if (isSeriesMode) {
        resetLiveState()
        resetSeriesState()
        setSeriesEpisodeStates(buildSeriesEpisodeStates(seriesEpisodes || []))
        setIsAnalyzing(false)
        setViewState('config')
        return
      }
      resetLiveState()
      if (currentRequestRef.current) {
        await startSingleAnalyze()
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '重置失败', 'error')
    }
  }

  const handleSeriesToggleEpisode = (episodeId: string) => {
    if (isAnalyzing) return
    setSeriesEpisodeStates(prev =>
      prev.map(item => (
        item.id === episodeId && item.available
          ? {
              ...item,
              selected: !item.selected,
            }
          : item
      )),
    )
  }

  const handleSeriesSelectAll = () => {
    if (isAnalyzing) return
    setAvailableSeriesSelection(true)
  }

  const handleSeriesClearSelection = () => {
    if (isAnalyzing) return
    setAvailableSeriesSelection(false)
  }

  const focusSeriesEpisode = (episodeId: string) => {
    const episode = sortedSeriesEpisodeStates.find(item => item.id === episodeId)
    if (!episode) return

    setActiveSeriesEpisodeId(episodeId)
    setSelectedTraceItem(null)
  }

  const handleSeriesRetryEpisode = async (episodeId: string) => {
    if (isAnalyzing) return
    focusSeriesEpisode(episodeId)
    await startSeriesAnalyze([episodeId])
  }

  const copyTraceItem = async (item: TraceDotItem) => {
    const text = item.detailText && item.detailText !== '暂无日志'
      ? item.detailText
      : item.detailPreview && item.detailPreview !== '暂无原始详情'
        ? item.detailPreview
        : item.summary

    try {
      await navigator.clipboard.writeText(text)
      showToast('已复制日志', 'success')
    } catch {
      showToast('复制日志失败', 'error')
    }
  }

  const renderTraceDetailSections = (detail?: Record<string, any> | null) => {
    if (!detail || typeof detail !== 'object') return null

    const sections: Array<{ key: string; title: string; value: any }> = []
    if (typeof (detail as any).t0_text === 'string' && (detail as any).t0_text.trim()) {
      sections.push({ key: 't0_text', title: 'NFO 整理结果（T0）', value: (detail as any).t0_text })
    }
    if (typeof (detail as any).prompt === 'string' && (detail as any).prompt.trim()) {
      sections.push({ key: 'prompt', title: '完整 Prompt', value: (detail as any).prompt })
    }
    if (Array.isArray((detail as any).messages) && (detail as any).messages.length) {
      sections.push({ key: 'messages', title: '发送给模型的消息（messages）', value: (detail as any).messages })
    }
    if (typeof (detail as any).response === 'string' && (detail as any).response.trim()) {
      sections.push({ key: 'response', title: '模型原始返回（未后处理）', value: (detail as any).response })
    }
    // Cache/meta fields: always helpful but not huge.
    const cacheFields: Record<string, any> = {}
    for (const k of ['cache_hit', 'cache_fingerprint', 'input_fingerprint', 'generated_markdown_path', 'markdown_path', 'transcript_language', 't0_length', 't1_length', 'prompt_length', 'response_length', 'provider', 'model', 'base_url']) {
      if ((detail as any)[k] !== undefined && (detail as any)[k] !== null && String((detail as any)[k]).trim?.() !== '') {
        cacheFields[k] = (detail as any)[k]
      }
    }
    if (Object.keys(cacheFields).length) {
      sections.push({ key: 'meta', title: '关键信息', value: cacheFields })
    }

    if (!sections.length) return null

    return (
      <div className="ai-note-trace-detail-block">
        <div className="ai-note-trace-detail-block-title">完整日志</div>
        <div className="ai-note-trace-detail-sections">
          {sections.map((section) => {
            const text = typeof section.value === 'string'
              ? section.value
              : (() => { try { return JSON.stringify(section.value, null, 2) } catch { return String(section.value) } })()
            return (
              <details key={section.key} className="ai-note-trace-detail-section" open={section.key === 'meta'}>
                <summary className="ai-note-trace-detail-section-summary">{section.title}</summary>
                <pre className="ai-note-trace-detail-json">{text}</pre>
              </details>
            )
          })}
        </div>
      </div>
    )
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

  const renderSeriesEpisodeRow = (item: SeriesEpisodeState) => {
    const isActive = item.id === activeSeriesEpisodeId
    const statusLabel = getSeriesEpisodeStatusLabel(item)
    const progress = Math.max(0, Math.min(100, item.progress || 0))

    return (
      <div
        key={item.id}
        className="ai-note-series-episode"
        data-status={item.status}
        data-selected={item.selected ? 'true' : 'false'}
        data-active={isActive ? 'true' : 'false'}
      >
        <label className="ai-note-series-episode-checkbox">
          <input
            type="checkbox"
            checked={Boolean(item.selected && item.available)}
            disabled={!item.available || isAnalyzing}
            onChange={() => handleSeriesToggleEpisode(item.id)}
          />
          <span />
        </label>

        <button
          type="button"
          className="ai-note-series-episode-main"
          disabled={!item.available || isAnalyzing}
          onClick={() => focusSeriesEpisode(item.id)}
        >
          <div className="ai-note-series-episode-head">
            <div className="ai-note-series-episode-title">{item.title}</div>
            <span className="ai-note-series-episode-badge">{statusLabel}</span>
          </div>
          <div className="ai-note-series-episode-meta">
            <span>{item.subtitle || item.id}</span>
            {item.currentStage && <span>· {item.currentStage}</span>}
          </div>
          <div className="ai-note-series-episode-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
          {item.error && <div className="ai-note-series-episode-error">{item.error}</div>}
        </button>

        <div className="ai-note-series-episode-actions">
          <button
            type="button"
            className="ai-note-series-episode-retry"
            onClick={() => {
              void handleSeriesRetryEpisode(item.id)
            }}
            disabled={isAnalyzing || !item.available}
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  const handleRefreshModels = async () => {
    if (isRefreshingModels) return

    setIsRefreshingModels(true)
    try {
      const nextState = await aiRuntimeStateService.refresh()
      const refreshedModels = nextState.testedModels[activeProvider] || []
      if (refreshedModels.length > 0) {
        showToast(`已刷新 ${refreshedModels.length} 个模型`, 'success')
      } else {
        showToast('未读取到已测试通过的模型，请先在设置面板重新测试并保存', 'warning')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '刷新模型列表失败', 'error')
    } finally {
      setIsRefreshingModels(false)
    }
  }

  const renderAnalysisConfig = () => (
    <div className="ai-note-modal-config">
      <div className="ai-note-select-group">
        <div className="ai-note-select-group-head">
          <label>模型</label>
          <button
            type="button"
            className="ai-note-select-refresh"
            onClick={() => {
              void handleRefreshModels()
            }}
            disabled={isRefreshingModels}
          >
            {isRefreshingModels ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            刷新
          </button>
        </div>
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
          {availableStyles.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="ai-note-select-group">
          <div className="ai-note-select-group-head">
            <label>补充要求</label>
            <div className="ai-note-select-group-actions">
              <label className="ai-note-option-row" title="根据字幕时间码生成关键点时间戳">
              <input
                type="checkbox"
                checked={enableTimestamps}
                disabled={isAnalyzing || effectivePipelineModeOverride === 'image_text'}
                onChange={(e) => {
                  const enabled = e.target.checked
                  setEnableTimestamps(enabled)
                  try {
                    window.localStorage.setItem('pilinote.aiNote.enableTimestamps', enabled ? '1' : '0')
                  } catch {
                    // ignore
                  }
                }}
              />
              <span>关键点时间戳</span>
              </label>
              <label className="ai-note-option-row" title="在笔记中插入原片关键帧截图（需要模型输出 Screenshot 标记，后端用 ffmpeg 生成）">
                <input
                  type="checkbox"
                  checked={enableScreenshots}
                  disabled={isAnalyzing || effectivePipelineModeOverride === 'image_text'}
                  onChange={(e) => {
                    const enabled = e.target.checked
                    setEnableScreenshots(enabled)
                    try {
                      window.localStorage.setItem('pilinote.aiNote.enableScreenshots', enabled ? '1' : '0')
                    } catch {
                      // ignore
                    }
                  }}
                />
                <span>原片截图</span>
              </label>
              <label className="ai-note-option-row" title="生成网页展示产物（使用设置中配置的网页模型）">
                <input
                  type="checkbox"
                  checked={enablePageOutput}
                  disabled={isAnalyzing || effectivePipelineModeOverride === 'image_text' || !canEnablePageOutput}
                  onChange={(e) => {
                    const enabled = e.target.checked
                    setEnablePageOutput(enabled)
                    try {
                      window.localStorage.setItem('pilinote.aiNote.enablePageOutput', enabled ? '1' : '0')
                    } catch {
                      // ignore
                    }
                  }}
                />
                <span>网页</span>
              </label>
              <label className="ai-note-option-row" title="生成图解图片产物（使用设置中配置的图片模型）">
                <input
                  type="checkbox"
                  checked={enableImageOutput}
                  disabled={isAnalyzing || effectivePipelineModeOverride === 'image_text' || !canEnableImageOutput}
                  onChange={(e) => {
                    const enabled = e.target.checked
                    setEnableImageOutput(enabled)
                    try {
                      window.localStorage.setItem('pilinote.aiNote.enableImageOutput', enabled ? '1' : '0')
                    } catch {
                      // ignore
                    }
                  }}
                />
                <span>图片</span>
              </label>
            </div>
          </div>
        <textarea
          value={promptExtras}
          onChange={e => setPromptExtras(e.target.value)}
          className="ai-note-textarea"
          rows={4}
          placeholder="例如：更关注工作流步骤、保留英文术语、提取插件名和快捷键。本内容仅对本次分析生效。"
        />
        <div className="ai-note-input-hint">仅对本次分析生效，关闭弹窗后自动清空。</div>
      </div>
    </div>
  )

  const renderSingleContent = () => (
    <>
      {viewState === 'config' && (
        <>
          <div className="ai-note-modal-content">
            {renderAnalysisConfig()}
          </div>

          {error && <div className="ai-note-modal-error">{error}</div>}
        </>
      )}

      {viewState === 'result' && note && (
        <>
          <div className="ai-note-modal-content">
            {renderAnalysisConfig()}
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
        </>
      )}
    </>
  )

  const showHeaderPauseAction = viewState === 'config' && (!isSeriesMode || Boolean(activeNoteIdRef.current) || effectiveControlState === 'paused')
  const showHeaderAnalyzeAction = viewState === 'config'
  const resetActionLabel = isSeriesMode ? '重置选集' : (viewState === 'result' ? '重新分析' : '重置')
  const analyzeActionLabel = isAnalyzing ? '分析中...' : (localAsrReady ? '开始分析' : '模型未就绪')
  const analyzeActionDisabled = isSeriesMode
    ? (isAnalyzing || !localAsrReady || selectedSeriesEpisodes.length === 0)
    : (isAnalyzing || !localAsrReady)

  const renderSeriesContent = () => (
    <>
      <div className="ai-note-modal-content ai-note-series-content">
        {renderAnalysisConfig()}
        <div
          className="ai-note-series-summary"
          role="button"
          tabIndex={0}
          aria-expanded={seriesListCollapsed ? 'false' : 'true'}
          title={seriesListCollapsed ? '展开列表' : '折叠列表'}
          onClick={() => setSeriesListCollapsed(prev => !prev)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setSeriesListCollapsed(prev => !prev)
            }
          }}
        >
          <div className="ai-note-series-summary-head">
            <div>
              <div className="ai-note-series-summary-title">系列任务</div>
              <div className="ai-note-series-summary-subtitle">
                选中后会按顺序逐集执行现有单视频流水线
              </div>
            </div>
            <div className="ai-note-series-summary-head-right">
              <div className="ai-note-series-summary-chip">
                {seriesRunSummary.selected} / {seriesRunSummary.available} 已选
              </div>
              <span className="ai-note-series-summary-chevron" aria-hidden="true">
                {seriesListCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              </span>
            </div>
          </div>
          <div className="ai-note-series-summary-stats">
            <span>总集数 {seriesRunSummary.total}</span>
            <span>完成 {seriesRunSummary.completed}</span>
            <span>失败 {seriesRunSummary.failed}</span>
          </div>
          <div className="ai-note-series-summary-progress">
            <span style={{ width: `${seriesRunSummary.progress}%` }} />
          </div>
          {activeSeriesEpisode && (
            <div className="ai-note-series-current">
              当前分析：{activeSeriesEpisode.title}
              {activeSeriesEpisode.currentStage ? ` · ${activeSeriesEpisode.currentStage}` : ''}
            </div>
          )}
        </div>

        {!seriesListCollapsed && (
          <>
            <div className="ai-note-series-actions">
              <button type="button" className="ai-note-series-action" onClick={handleSeriesSelectAll} disabled={isAnalyzing}>
                全选可用
              </button>
              <button type="button" className="ai-note-series-action" onClick={handleSeriesClearSelection} disabled={isAnalyzing}>
                清空选择
              </button>
            </div>

            <div className="ai-note-series-list">
              {sortedSeriesEpisodeStates.map(renderSeriesEpisodeRow)}
            </div>
          </>
        )}
      </div>

      {error && <div className="ai-note-modal-error">{error}</div>}
    </>
  )

  return (
    <div className="ai-note-modal-overlay" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
      <div
        className="ai-note-modal-panel"
        data-series-mode={isSeriesMode ? 'true' : 'false'}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <div className="ai-note-modal-header">
          <button
            type="button"
            className="ai-note-modal-title ai-note-modal-title-link"
            onClick={() => {
              if (aiRoutePath) {
                navigate(aiRoutePath)
                onClose()
              }
            }}
            disabled={!aiRoutePath}
            aria-label={aiRoutePath ? '打开 AI 路由' : undefined}
            title={aiRoutePath ? '打开 AI 路由' : undefined}
          >
            <Sparkles size={20} />
            <span>AI 笔记</span>
          </button>
          <div className="ai-note-modal-header-actions">
            <button
              type="button"
              className="ai-note-modal-icon-btn"
              onClick={handleResetAnalyze}
              title={resetActionLabel}
              aria-label={resetActionLabel}
            >
              <RotateCcw size={18} />
            </button>
            {showHeaderPauseAction && (
              <button
                type="button"
                className="ai-note-modal-icon-btn"
                onClick={handlePauseOrResume}
                disabled={!activeNoteIdRef.current || (!isAnalyzing && effectiveControlState !== 'paused')}
                title={effectiveControlState === 'paused' ? '继续分析' : '暂停分析'}
                aria-label={effectiveControlState === 'paused' ? '继续分析' : '暂停分析'}
              >
                {effectiveControlState === 'paused' ? <Play size={18} /> : <Pause size={18} />}
              </button>
            )}
            {showHeaderAnalyzeAction && (
              <button
                type="button"
                className="ai-note-modal-icon-btn ai-note-modal-icon-btn-primary"
                onClick={handleAnalyze}
                disabled={analyzeActionDisabled}
                title={analyzeActionLabel}
                aria-label={analyzeActionLabel}
              >
                {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              </button>
            )}
            <button className="ai-note-modal-close" onClick={onClose} title="关闭" aria-label="关闭">
              <X size={20} />
            </button>
          </div>
        </div>

        {isSeriesMode ? renderSeriesContent() : renderSingleContent()}

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
            {(() => {
              const steps = selectedTraceItem.steps || []
              const lastStep = steps.length ? steps[steps.length - 1] : null
              const history = steps.length > 1 ? steps.slice(0, -1) : []
              const historyText = history.length
                ? history
                    .map((step, idx) => {
                      const ts = step.ts ? `\n时间: ${step.ts}` : ''
                      const summaryText = step.summary?.trim() || '暂无摘要'
                      const detail = step.detail ? (() => { try { return JSON.stringify(step.detail, null, 2) } catch { return '' } })() : ''
                      return `步骤 ${idx + 1}: ${step.title || step.stage}${ts}\n摘要: ${summaryText}${detail ? `\n${detail}` : ''}`
                    })
                    .join('\n\n')
                : ''

              return (
                <>
                  {historyText && (
                    <details className="ai-note-trace-detail-history">
                      <summary className="ai-note-trace-detail-history-summary">展开历史步骤（{history.length}）</summary>
                      <pre className="ai-note-trace-detail-json">{historyText}</pre>
                    </details>
                  )}
                  {lastStep?.detail ? (
                    renderTraceDetailSections(lastStep.detail)
                  ) : null}
                </>
              )
            })()}
            <div className="ai-note-trace-detail-head">
              <div className="ai-note-trace-detail-stage">{selectedTraceItem.stage}</div>
              <span className="ai-note-trace-detail-status" data-status={selectedTraceItem.status}>
                {selectedTraceItem.statusLabel}
              </span>
            </div>
            <div className="ai-note-trace-detail-block">
              <div className="ai-note-trace-detail-block-title">节点摘要</div>
              <pre className="ai-note-trace-detail-summary-box">{selectedTraceItem.summary}</pre>
            </div>
            <div className="ai-note-trace-detail-block">
              <div className="ai-note-trace-detail-block-title">实时日志</div>
              <pre className="ai-note-trace-detail-json">{liveTraceLogText}</pre>
            </div>
            {typeof selectedTraceItem.progress === 'number' && (
              <div className="ai-note-trace-detail-meta">进度 {Math.round(selectedTraceItem.progress)}%</div>
            )}
          </div>
        )}
      </Modal>

      <style>{`
        .ai-note-modal-overlay { position: fixed; inset: 0; z-index: 12000; display: flex; align-items: center; justify-content: center; padding: max(16px, env(safe-area-inset-top, 0px) + 12px) 16px max(16px, env(safe-area-inset-bottom, 0px) + 12px); background: rgba(0,0,0,0.52); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); pointer-events: auto; box-sizing: border-box; overflow: hidden; }
        .ai-note-modal-panel { width: min(100%, 460px); max-width: 460px; max-height: calc(100dvh - max(32px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px) + 24px)); background: var(--color-bg-primary); border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--color-border); box-shadow: 0 24px 60px rgba(0,0,0,0.42); }
        .ai-note-modal-panel[data-series-mode="true"] { width: min(100%, 700px); max-width: 700px; }
        .ai-note-modal-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
        .ai-note-modal-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; }
        .ai-note-modal-title-link { padding: 0; border: none; background: transparent; color: inherit; cursor: pointer; }
        .ai-note-modal-title-link:disabled { cursor: default; opacity: 1; }
        .ai-note-modal-header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-left: auto; }
        .ai-note-modal-icon-btn, .ai-note-modal-close { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border: none; background: transparent; color: var(--color-text-secondary); border-radius: 10px; cursor: pointer; transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease; }
        .ai-note-modal-icon-btn:hover, .ai-note-modal-close:hover { background: var(--color-bg-secondary); color: var(--color-text-primary); }
        .ai-note-modal-icon-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .ai-note-modal-icon-btn-primary { background: rgba(59,130,246,0.12); color: var(--color-primary-600); }
        .ai-note-modal-icon-btn-primary:hover { background: rgba(59,130,246,0.18); color: var(--color-primary-600); }
        .ai-note-modal-video-info { padding: 12px 20px; background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border); font-size: 14px; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ai-note-modal-content { flex: 1; overflow-y: auto; padding: 16px; }
        .ai-note-select-group { margin-bottom: 14px; }
        .ai-note-select-group-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
        .ai-note-select-group-actions { display: inline-flex; align-items: center; gap: 10px; }
        .ai-note-select-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; }
        .ai-note-select-group-head label { margin-bottom: 0; }
        .ai-note-select-refresh { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-bg-secondary); color: var(--color-text-secondary); font-size: 12px; font-weight: 600; cursor: pointer; }
        .ai-note-select-refresh:disabled { opacity: 0.65; cursor: not-allowed; }
        .ai-note-select { width: 100%; padding: 10px 14px; border-radius: 10px; font-size: 13px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); color: var(--color-text-primary); }
        .ai-note-textarea { width: 100%; min-height: 96px; padding: 10px 14px; border-radius: 10px; font-size: 13px; line-height: 1.6; resize: vertical; background: var(--color-bg-secondary); border: 1px solid var(--color-border); color: var(--color-text-primary); box-sizing: border-box; }
        .ai-note-input-hint { margin-top: 6px; font-size: 12px; color: var(--color-text-tertiary); line-height: 1.5; }
        .ai-note-empty-hint { padding: 10px 12px; border-radius: 10px; background: var(--color-bg-secondary); border: 1px dashed var(--color-border); color: var(--color-text-tertiary); font-size: 12px; }
        .ai-note-summary-chip { display: inline-flex; align-items: center; padding: 8px 12px; border-radius: 999px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); color: var(--color-text-primary); font-size: 13px; font-weight: 600; }
        .ai-note-modal-error { padding: 10px 16px; background: var(--color-error-50); font-size: 13px; color: var(--color-error-600); }
        .ai-note-empty-hint { margin-top: 8px; padding: 10px 12px; border-radius: 10px; background: var(--color-bg-secondary); border: 1px dashed var(--color-border); color: var(--color-text-tertiary); font-size: 12px; }
        .ai-note-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--color-border); background: var(--color-bg-secondary); }
        .ai-note-modal-btn-secondary,.ai-note-modal-btn-primary { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; }
        .ai-note-modal-btn-secondary { background: var(--color-bg-tertiary); color: var(--color-text-primary); border: none; }
        .ai-note-modal-btn-primary { background: var(--color-primary-600); color: white; border: none; }
        .ai-note-option-row { margin-top: 10px; display: inline-flex; align-items: center; gap: 8px; color: var(--color-text-secondary); font-size: 12px; user-select: none; cursor: pointer; }
        .ai-note-option-row input { width: 15px; height: 15px; accent-color: var(--color-primary-600); cursor: pointer; }
        .ai-note-option-row:has(input:disabled) { opacity: 0.55; cursor: not-allowed; }
        .ai-note-select-group-head .ai-note-option-row { margin-top: 0; }
        .ai-note-series-content { display: grid; gap: 14px; }
        .ai-note-series-summary { display: grid; gap: 10px; padding: 12px; border-radius: 12px; background: linear-gradient(180deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02)); border: 1px solid rgba(59,130,246,0.16); }
        .ai-note-series-summary { cursor: pointer; }
        .ai-note-series-summary:focus-visible { outline: 2px solid rgba(59,130,246,0.55); outline-offset: 2px; }
        .ai-note-series-summary-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .ai-note-series-summary-head-right { display: inline-flex; align-items: center; gap: 10px; }
        .ai-note-series-summary-chevron { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; border: 1px solid rgba(148, 163, 184, 0.18); background: rgba(2, 6, 23, 0.12); color: var(--color-text-secondary); }
        .ai-note-series-summary-title { font-size: 15px; font-weight: 700; color: var(--color-text-primary); }
        .ai-note-series-summary-subtitle { margin-top: 3px; font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; }
        .ai-note-series-summary-chip { flex: 0 0 auto; padding: 6px 10px; border-radius: 999px; background: var(--color-bg-primary); border: 1px solid var(--color-border); font-size: 12px; color: var(--color-text-primary); font-weight: 600; }
        .ai-note-series-summary-stats { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; color: var(--color-text-secondary); }
        .ai-note-series-summary-progress { height: 7px; border-radius: 999px; background: rgba(148,163,184,0.18); overflow: hidden; }
        .ai-note-series-summary-progress span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--color-primary-600), var(--color-success)); }
        .ai-note-series-current { font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; }
        .ai-note-series-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .ai-note-series-action { padding: 7px 10px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-bg-secondary); color: var(--color-text-primary); cursor: pointer; font-size: 12px; }
        .ai-note-series-action:disabled { opacity: 0.6; cursor: not-allowed; }
        .ai-note-series-list { display: grid; gap: 8px; }
        .ai-note-series-episode { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; gap: 10px; align-items: stretch; padding: 10px; border-radius: 12px; background: var(--color-bg-primary); border: 1px solid var(--color-border); }
        .ai-note-series-episode[data-status="running"] { border-color: rgba(59,130,246,0.35); box-shadow: 0 0 0 1px rgba(59,130,246,0.08) inset; }
        .ai-note-series-episode[data-status="completed"] { border-color: rgba(22,163,74,0.28); }
        .ai-note-series-episode[data-status="failed"] { border-color: rgba(220,38,38,0.28); }
        .ai-note-series-episode[data-active="true"] { background: linear-gradient(180deg, rgba(59,130,246,0.05), rgba(59,130,246,0.02)); }
        .ai-note-series-episode-checkbox { display: flex; align-items: flex-start; justify-content: center; padding-top: 1px; }
        .ai-note-series-episode-checkbox input { width: 15px; height: 15px; accent-color: var(--color-primary-600); cursor: pointer; }
        .ai-note-series-episode-checkbox span { display: none; }
        .ai-note-series-episode-main { display: grid; gap: 6px; padding: 0; border: none; background: transparent; text-align: left; cursor: pointer; color: inherit; }
        .ai-note-series-episode-main:disabled { cursor: not-allowed; opacity: 0.7; }
        .ai-note-series-episode-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .ai-note-series-episode-title { font-size: 13px; font-weight: 600; color: var(--color-text-primary); line-height: 1.4; }
        .ai-note-series-episode-badge { flex: 0 0 auto; padding: 3px 7px; border-radius: 999px; font-size: 11px; font-weight: 600; background: var(--color-bg-secondary); color: var(--color-text-secondary); border: 1px solid var(--color-border); }
        .ai-note-series-episode[data-status="running"] .ai-note-series-episode-badge { color: var(--color-primary-600); border-color: rgba(59,130,246,0.26); background: rgba(59,130,246,0.08); }
        .ai-note-series-episode[data-status="completed"] .ai-note-series-episode-badge { color: var(--color-success); border-color: rgba(22,163,74,0.26); background: rgba(22,163,74,0.08); }
        .ai-note-series-episode[data-status="failed"] .ai-note-series-episode-badge { color: var(--color-error-600); border-color: rgba(220,38,38,0.26); background: rgba(220,38,38,0.08); }
        .ai-note-series-episode-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; color: var(--color-text-tertiary); line-height: 1.5; }
        .ai-note-series-episode-progress { height: 5px; border-radius: 999px; background: rgba(148,163,184,0.16); overflow: hidden; }
        .ai-note-series-episode-progress span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--color-primary-600), rgba(59,130,246,0.7)); }
        .ai-note-series-episode-error { font-size: 11px; color: var(--color-error-600); line-height: 1.5; }
        .ai-note-series-episode-actions { display: flex; align-items: flex-start; }
        .ai-note-series-episode-retry { padding: 7px 10px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-bg-secondary); color: var(--color-text-primary); cursor: pointer; font-size: 11px; }
        .ai-note-series-episode-retry:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 768px) {
          .ai-note-modal-overlay { align-items: stretch; padding: max(12px, env(safe-area-inset-top, 0px) + 8px) 12px max(12px, env(safe-area-inset-bottom, 0px) + 8px); }
          .ai-note-modal-panel { width: 100%; max-height: calc(100dvh - max(24px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px) + 16px)); border-radius: 16px; }
          .ai-note-modal-header { padding: 12px 14px; }
          .ai-note-modal-header-actions { gap: 6px; }
          .ai-note-modal-content { padding: 14px; }
          .ai-note-modal-footer { padding: 12px 14px; }
        }
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
	        .ai-note-trace-detail-summary-box { margin: 0; padding: 12px; border-radius: 10px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); font-size: 13px; line-height: 1.6; white-space: pre-wrap; color: var(--color-text-secondary); overflow: auto; }
	        .ai-note-trace-detail-sections { display: flex; flex-direction: column; gap: 10px; }
	        .ai-note-trace-detail-section { border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-bg-secondary); overflow: hidden; }
	        .ai-note-trace-detail-section-summary { cursor: pointer; padding: 10px 12px; font-size: 12px; font-weight: 700; color: var(--color-text-secondary); list-style: none; }
        .ai-note-trace-detail-section-summary::-webkit-details-marker { display: none; }
        .ai-note-trace-detail-section[open] .ai-note-trace-detail-section-summary { color: var(--color-text-primary); }
        .ai-note-trace-detail-history { border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-bg-secondary); overflow: hidden; margin-bottom: 10px; }
        .ai-note-trace-detail-history-summary { cursor: pointer; padding: 10px 12px; font-size: 12px; font-weight: 700; color: var(--color-text-secondary); list-style: none; }
        .ai-note-trace-detail-history-summary::-webkit-details-marker { display: none; }
        .ai-note-trace-detail-history[open] .ai-note-trace-detail-history-summary { color: var(--color-text-primary); }
        .ai-note-trace-detail-copy,.ai-note-trace-detail-close { padding: 10px 14px; border-radius: 10px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: transform 0.15s ease, background 0.15s ease, opacity 0.15s ease; }
        .ai-note-trace-detail-copy { display: inline-flex; align-items: center; gap: 6px; background: var(--color-primary-600); color: white; }
        .ai-note-trace-detail-close { background: var(--color-bg-secondary); color: var(--color-text-primary); }
        .ai-note-trace-detail-copy:hover,.ai-note-trace-detail-close:hover { transform: translateY(-1px); }
      `}</style>
    </div>
	  )
	}
