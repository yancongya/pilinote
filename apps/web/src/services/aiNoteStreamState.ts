import type { AiTraceStep } from './aiNote'

export interface AiNoteStreamEvent {
  stage: string
  status: string
  data?: any
}

export interface AiNoteStageStreamState {
  status: 'pending' | 'processing' | 'completed' | 'error'
  logs: string[]
  lastEvent?: AiNoteStreamEvent
}

export interface AiNoteStreamState {
  activeStage: string | null
  stages: Record<string, AiNoteStageStreamState>
  trace: AiTraceStep[]
}

export const createAiNoteStreamState = (): AiNoteStreamState => ({
  activeStage: null,
  stages: {},
  trace: [],
})

function normalizeStageStatus(status: string): AiNoteStageStreamState['status'] {
  const normalized = (status || '').toLowerCase()
  if (normalized === 'completed') return 'completed'
  if (normalized === 'error') return 'error'
  if (normalized === 'processing') return 'processing'
  return 'pending'
}

function extractLogText(data: any): string {
  if (data == null) return ''
  if (typeof data === 'string') return data.trim()
  if (typeof data === 'number' || typeof data === 'boolean') return String(data)
  if (Array.isArray(data)) {
    return data
      .map(item => extractLogText(item))
      .filter(Boolean)
      .join('\n')
  }
  if (typeof data !== 'object') return ''

  const candidates = [
    data.log,
    data.summary,
    data.message,
    data.error,
    data.title,
    data.detail,
    data.text,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return ''
  }
}

function extractTraceTitle(stage: string, data: any): string {
  if (data && typeof data === 'object' && typeof data.title === 'string' && data.title.trim()) {
    return data.title.trim()
  }
  return stage
}

export function applyAiNoteStreamEvent(
  state: Partial<AiNoteStreamState>,
  event: AiNoteStreamEvent,
): AiNoteStreamState {
  const stage = (event.stage || '').trim()
  if (!stage) {
    return {
      activeStage: state.activeStage ?? null,
      stages: state.stages || {},
      trace: Array.isArray(state.trace) ? [...state.trace] : [],
    }
  }

  const nextState: AiNoteStreamState = {
    activeStage: state.activeStage ?? null,
    stages: {
      ...(state.stages || {}),
    },
    trace: Array.isArray(state.trace) ? [...state.trace] : [],
  }

  if (stage !== 'META' && stage !== 'INIT' && stage !== 'DONE') {
    nextState.activeStage = stage
  }

  const existing = nextState.stages[stage] || {
    status: 'pending',
    logs: [],
  }

  const logText = extractLogText(event.data)
  const nextLogs = logText
    ? (existing.logs[existing.logs.length - 1] === logText ? existing.logs : [...existing.logs, logText])
    : existing.logs

  nextState.stages[stage] = {
    status: normalizeStageStatus(event.status),
    logs: nextLogs,
    lastEvent: event,
  }

  if (stage !== 'META' && stage !== 'INIT' && stage !== 'DONE') {
    const detail = event.data && typeof event.data === 'object' && 'detail' in event.data
      ? (event.data as Record<string, any>).detail
      : event.data
    nextState.trace.push({
      stage,
      title: extractTraceTitle(stage, event.data),
      summary: logText || event.status || '处理中',
      detail: detail && typeof detail === 'object' ? detail : { value: detail },
      progress: typeof event.data?.progress === 'number' ? event.data.progress : undefined,
      ts: new Date().toISOString(),
    })
  }

  return nextState
}

export function getStageLogText(stageState?: AiNoteStageStreamState): string {
  if (!stageState) return ''
  return stageState.logs.join('\n')
}
