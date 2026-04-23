import type { AiTraceStep } from '../../services/aiNote'

export type SeriesEpisodeStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed'

export interface SeriesEpisodeInput {
  id: string
  title: string
  available?: boolean
  subtitle?: string
  subtitleFilename?: string
  order?: number
}

export interface SeriesEpisodeState extends SeriesEpisodeInput {
  selected: boolean
  status: SeriesEpisodeStatus
  progress: number
  currentStage?: string
  error?: string
  noteId?: string
  trace: AiTraceStep[]
}

export interface SeriesQueueSummary {
  total: number
  available: number
  selected: number
  queued: number
  running: number
  completed: number
  failed: number
  progress: number
}

const STATUS_ORDER: Record<SeriesEpisodeStatus, number> = {
  idle: 0,
  queued: 1,
  running: 2,
  completed: 3,
  failed: 4,
}

export const SERIES_STATUS_LABELS: Record<SeriesEpisodeStatus, string> = {
  idle: '未选中',
  queued: '排队中',
  running: '分析中',
  completed: '已完成',
  failed: '失败',
}

export function getSeriesEpisodeStatusLabel(item: SeriesEpisodeState): string {
  if (item.status === 'idle' && item.selected && item.available) {
    return '待分析'
  }
  return SERIES_STATUS_LABELS[item.status]
}

export function isSeriesEpisodeAvailable(item: SeriesEpisodeInput): boolean {
  return item.available !== false && Boolean(item.id && item.id.trim())
}

export function sortSeriesEpisodes<T extends SeriesEpisodeInput>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftOrder = typeof left.order === 'number' ? left.order : Number.MAX_SAFE_INTEGER
    const rightOrder = typeof right.order === 'number' ? right.order : Number.MAX_SAFE_INTEGER
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }
    return left.title.localeCompare(right.title, 'zh')
  })
}

export function deriveSeriesEpisodeSelection(items: SeriesEpisodeInput[]): Set<string> {
  return new Set(
    items
      .filter(isSeriesEpisodeAvailable)
      .map(item => item.id)
  )
}

export function buildSeriesEpisodeStates(items: SeriesEpisodeInput[]): SeriesEpisodeState[] {
  const selectedIds = deriveSeriesEpisodeSelection(items)
  return sortSeriesEpisodes(items).map(item => ({
    ...item,
    available: isSeriesEpisodeAvailable(item),
    selected: selectedIds.has(item.id),
    status: 'idle',
    progress: 0,
    trace: [],
  }))
}

export function calculateSeriesQueueSummary(states: SeriesEpisodeState[]): SeriesQueueSummary {
  const total = states.length
  const available = states.filter(item => isSeriesEpisodeAvailable(item)).length
  const selected = states.filter(item => item.selected && isSeriesEpisodeAvailable(item)).length
  const queued = states.filter(item => item.status === 'queued').length
  const running = states.filter(item => item.status === 'running').length
  const completed = states.filter(item => item.status === 'completed').length
  const failed = states.filter(item => item.status === 'failed').length
  const processed = completed + failed
  const progress = selected > 0 ? Math.round((processed / selected) * 100) : 0

  return {
    total,
    available,
    selected,
    queued,
    running,
    completed,
    failed,
    progress,
  }
}

export function getSeriesEpisodeStatusRank(status: SeriesEpisodeStatus): number {
  return STATUS_ORDER[status] ?? 0
}
