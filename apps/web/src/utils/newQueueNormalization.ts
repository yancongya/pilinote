export type TaskState = 'backlog' | 'pending' | 'active' | 'completed' | 'paused' | 'failed' | 'cancelled'
export type SchedulerState = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
export type DownloadStage = 'preparing' | 'downloading' | 'moving' | 'post_processing' | 'completed'

export interface TaskStatus {
  progress: number
  speed: number
  eta: number
  stage: DownloadStage
  downloaded: number
  total: number
}

export interface SubTask {
  id: string
  type: string
}

export interface SubTaskStatus {
  content: number
  chunk: number
}

export interface Task {
  id: string
  ts: number
  seq: number
  title: string
  cover: string
  desc: string
  duration: number
  pubtime: number
  media_type: string
  url: string
  media_id: string
  schedulerId?: string
  state: TaskState
  status: TaskStatus
  meta: Record<string, any>
  prepare: Record<string, any>
  subtasks: SubTask[]
  subtaskStatus: Record<string, SubTaskStatus>
  created_at: number
  updated_at: number
}

export interface Scheduler {
  id: string
  title: string
  ts: number
  list: string[]
  count: number
  queueType: string
  state: SchedulerState
  folder: string
  created_at: number
  updated_at: number
}

const DEFAULT_TASK_STATUS: TaskStatus = {
  progress: 0,
  speed: 0,
  eta: 0,
  stage: 'preparing',
  downloaded: 0,
  total: 0,
}

const TASK_STATE_MAP: Record<number, TaskState> = {
  0: 'backlog', 1: 'pending', 2: 'active', 3: 'completed', 4: 'paused', 5: 'failed', 6: 'cancelled',
}

const SCHEDULER_STATE_MAP: Record<number, SchedulerState> = {
  0: 'idle', 1: 'running', 2: 'completed', 3: 'paused', 4: 'failed', 5: 'cancelled',
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return undefined
  return String(value)
}

export function getCompletedTaskIdentity(task: Task): string {
  const cid = task.meta?.cid
  if (cid !== undefined && cid !== null && String(cid).trim()) return `${task.media_id}#cid:${String(cid)}`

  const page = task.meta?.page
  if (page !== undefined && page !== null && String(page).trim()) return `${task.media_id}#page:${String(page)}`

  const outputSubdir = task.meta?.output_subdir
  if (typeof outputSubdir === 'string' && outputSubdir.trim()) return `${task.media_id}#dir:${outputSubdir.trim()}`

  return task.media_id
}

export function normalizeTaskState(state: unknown): TaskState {
  if (typeof state === 'string') {
    if (state.startsWith('TaskState.')) return (state.split('.')[1]?.toLowerCase() as TaskState) || 'backlog'
    if (/^\d+$/.test(state)) return TASK_STATE_MAP[parseInt(state, 10)] || 'backlog'
    const allowedStates: TaskState[] = ['backlog', 'pending', 'active', 'completed', 'paused', 'failed', 'cancelled']
    return allowedStates.includes(state as TaskState) ? state as TaskState : 'backlog'
  }

  return TASK_STATE_MAP[Number(state)] || 'backlog'
}

export function normalizeSchedulerState(state: unknown): SchedulerState {
  if (typeof state === 'string') {
    if (state.startsWith('SchedulerState.')) return (state.split('.')[1]?.toLowerCase() as SchedulerState) || 'idle'
    if (/^\d+$/.test(state)) return SCHEDULER_STATE_MAP[parseInt(state, 10)] || 'idle'
    const allowedStates: SchedulerState[] = ['idle', 'running', 'paused', 'completed', 'failed', 'cancelled']
    return allowedStates.includes(state as SchedulerState) ? state as SchedulerState : 'idle'
  }

  return SCHEDULER_STATE_MAP[Number(state)] || 'idle'
}

export function normalizeTaskStatus(status: unknown): TaskStatus {
  const taskStatus = isRecord(status) ? status : {}
  return {
    progress: toNumber(taskStatus.progress, DEFAULT_TASK_STATUS.progress),
    speed: toNumber(taskStatus.speed, DEFAULT_TASK_STATUS.speed),
    eta: toNumber(taskStatus.eta, DEFAULT_TASK_STATUS.eta),
    stage: (taskStatus.stage as DownloadStage) || DEFAULT_TASK_STATUS.stage,
    downloaded: toNumber(taskStatus.downloaded, DEFAULT_TASK_STATUS.downloaded),
    total: toNumber(taskStatus.total, DEFAULT_TASK_STATUS.total),
  }
}

function normalizeSubTaskStatus(subtaskStatus: unknown): Record<string, SubTaskStatus> {
  if (!isRecord(subtaskStatus)) return {}
  return Object.fromEntries(Object.entries(subtaskStatus).map(([key, value]) => {
    const record = isRecord(value) ? value : {}
    return [key, { content: toNumber(record.content, 0), chunk: toNumber(record.chunk, 0) }]
  }))
}

export function normalizeTask(task: unknown): Task {
  const data = isRecord(task) ? task : {}
  return {
    id: String(data.id ?? ''), ts: toNumber(data.ts, Date.now()), seq: toNumber(data.seq, 0),
    title: typeof data.title === 'string' ? data.title : '', cover: typeof data.cover === 'string' ? data.cover : '',
    desc: typeof data.desc === 'string' ? data.desc : '', duration: toNumber(data.duration, 0), pubtime: toNumber(data.pubtime, 0),
    media_type: typeof data.media_type === 'string' ? data.media_type : 'video', url: typeof data.url === 'string' ? data.url : '',
    media_id: typeof data.media_id === 'string' ? data.media_id : '', schedulerId: toOptionalString(data.schedulerId ?? data.scheduler_id),
    state: normalizeTaskState(data.state), status: normalizeTaskStatus(data.status), meta: isRecord(data.meta) ? data.meta : {},
    prepare: isRecord(data.prepare) ? data.prepare : {}, subtasks: Array.isArray(data.subtasks) ? data.subtasks : [],
    subtaskStatus: normalizeSubTaskStatus(data.subtaskStatus), created_at: toNumber(data.created_at, Date.now()), updated_at: toNumber(data.updated_at, Date.now()),
  }
}

function normalizeSchedulerTaskIds(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  return list.reduce<string[]>((taskIds, value) => {
    const taskId = typeof value === 'string' ? value : String(value ?? '')
    if (taskId && !seen.has(taskId)) { seen.add(taskId); taskIds.push(taskId) }
    return taskIds
  }, [])
}

export function normalizeScheduler(scheduler: unknown): Scheduler {
  const data = isRecord(scheduler) ? scheduler : {}
  const list = normalizeSchedulerTaskIds(data.list)
  return {
    id: String(data.id ?? ''), title: typeof data.title === 'string' ? data.title : '', ts: toNumber(data.ts, Date.now()), list, count: list.length,
    queueType: typeof data.queueType === 'string' ? data.queueType : typeof data.queue_type === 'string' ? data.queue_type : '',
    state: normalizeSchedulerState(data.state), folder: typeof data.folder === 'string' ? data.folder : '',
    created_at: toNumber(data.created_at, Date.now()), updated_at: toNumber(data.updated_at, Date.now()),
  }
}

export function normalizeTaskMap(tasks: Record<string, unknown> | undefined): Record<string, Task> {
  if (!tasks) return {}
  return Object.fromEntries(Object.entries(tasks).map(([id, task]) => [id, normalizeTask(task)]))
}

export function normalizeSchedulerMap(schedulers: Record<string, unknown> | undefined): Record<string, Scheduler> {
  if (!schedulers) return {}
  return Object.fromEntries(Object.entries(schedulers).map(([id, scheduler]) => [id, normalizeScheduler(scheduler)]))
}
