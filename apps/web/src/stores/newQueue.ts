import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getApiUrl } from '../config/api'
import { videoLibraryService } from '../services/videoLibraryService'

// 类型定义
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

export interface SubTask {
  id: string
  type: string
}

export interface SubTaskStatus {
  content: number
  chunk: number
}

const getCompletedTaskIdentity = (task: Task): string => {
  const cid = task.meta?.cid
  if (cid !== undefined && cid !== null && String(cid).trim()) {
    return `${task.media_id}#cid:${String(cid)}`
  }

  const page = task.meta?.page
  if (page !== undefined && page !== null && String(page).trim()) {
    return `${task.media_id}#page:${String(page)}`
  }

  const outputSubdir = task.meta?.output_subdir
  if (typeof outputSubdir === 'string' && outputSubdir.trim()) {
    return `${task.media_id}#dir:${outputSubdir.trim()}`
  }

  return task.media_id
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
  0: 'backlog',
  1: 'pending',
  2: 'active',
  3: 'completed',
  4: 'paused',
  5: 'failed',
  6: 'cancelled',
}

const SCHEDULER_STATE_MAP: Record<number, SchedulerState> = {
  0: 'idle',
  1: 'running',
  2: 'completed',
  3: 'paused',
  4: 'failed',
  5: 'cancelled',
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

export function normalizeTaskState(state: unknown): TaskState {
  if (typeof state === 'string') {
    if (state.startsWith('TaskState.')) {
      const enumValue = state.split('.')[1]?.toLowerCase()
      return (enumValue as TaskState) || 'backlog'
    }

    if (/^\d+$/.test(state)) {
      const stateNum = parseInt(state, 10)
      return TASK_STATE_MAP[stateNum] || 'backlog'
    }

    const allowedStates: TaskState[] = ['backlog', 'pending', 'active', 'completed', 'paused', 'failed', 'cancelled']
    return allowedStates.includes(state as TaskState) ? (state as TaskState) : 'backlog'
  }

  return TASK_STATE_MAP[Number(state)] || 'backlog'
}

export function normalizeSchedulerState(state: unknown): SchedulerState {
  if (typeof state === 'string') {
    if (state.startsWith('SchedulerState.')) {
      const enumValue = state.split('.')[1]?.toLowerCase()
      return (enumValue as SchedulerState) || 'idle'
    }

    if (/^\d+$/.test(state)) {
      const stateNum = parseInt(state, 10)
      return SCHEDULER_STATE_MAP[stateNum] || 'idle'
    }

    const allowedStates: SchedulerState[] = ['idle', 'running', 'paused', 'completed', 'failed', 'cancelled']
    return allowedStates.includes(state as SchedulerState) ? (state as SchedulerState) : 'idle'
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

  const normalized: Record<string, SubTaskStatus> = {}
  Object.entries(subtaskStatus).forEach(([key, value]) => {
    const record = isRecord(value) ? value : {}
    normalized[key] = {
      content: toNumber(record.content, 0),
      chunk: toNumber(record.chunk, 0),
    }
  })

  return normalized
}

export function normalizeTask(task: unknown): Task {
  const data = isRecord(task) ? task : {}

  return {
    id: String(data.id ?? ''),
    ts: toNumber(data.ts, Date.now()),
    seq: toNumber(data.seq, 0),
    title: typeof data.title === 'string' ? data.title : '',
    cover: typeof data.cover === 'string' ? data.cover : '',
    desc: typeof data.desc === 'string' ? data.desc : '',
    duration: toNumber(data.duration, 0),
    pubtime: toNumber(data.pubtime, 0),
    media_type: typeof data.media_type === 'string' ? data.media_type : 'video',
    url: typeof data.url === 'string' ? data.url : '',
    media_id: typeof data.media_id === 'string' ? data.media_id : '',
    schedulerId: toOptionalString(data.schedulerId ?? data.scheduler_id),
    state: normalizeTaskState(data.state),
    status: normalizeTaskStatus(data.status),
    meta: isRecord(data.meta) ? data.meta : {},
    prepare: isRecord(data.prepare) ? data.prepare : {},
    subtasks: Array.isArray(data.subtasks) ? data.subtasks : [],
    subtaskStatus: normalizeSubTaskStatus(data.subtaskStatus),
    created_at: toNumber(data.created_at, Date.now()),
    updated_at: toNumber(data.updated_at, Date.now()),
  }
}

function normalizeSchedulerTaskIds(list: unknown): string[] {
  if (!Array.isArray(list)) return []

  const seen = new Set<string>()
  const taskIds: string[] = []
  list.forEach((value) => {
    const taskId = typeof value === 'string' ? value : String(value ?? '')
    if (!taskId || seen.has(taskId)) return
    seen.add(taskId)
    taskIds.push(taskId)
  })
  return taskIds
}

export function normalizeScheduler(scheduler: unknown): Scheduler {
  const data = isRecord(scheduler) ? scheduler : {}
  const list = normalizeSchedulerTaskIds(data.list)

  return {
    id: String(data.id ?? ''),
    title: typeof data.title === 'string' ? data.title : '',
    ts: toNumber(data.ts, Date.now()),
    list,
    count: list.length,
    queueType: typeof data.queueType === 'string'
      ? data.queueType
      : typeof data.queue_type === 'string'
        ? data.queue_type
        : '',
    state: normalizeSchedulerState(data.state),
    folder: typeof data.folder === 'string' ? data.folder : '',
    created_at: toNumber(data.created_at, Date.now()),
    updated_at: toNumber(data.updated_at, Date.now()),
  }
}

function normalizeTaskMap(tasks: Record<string, unknown> | undefined): Record<string, Task> {
  if (!tasks) return {}

  return Object.fromEntries(
    Object.entries(tasks).map(([id, task]) => [id, normalizeTask(task)])
  )
}

function normalizeSchedulerMap(schedulers: Record<string, unknown> | undefined): Record<string, Scheduler> {
  if (!schedulers) return {}

  return Object.fromEntries(
    Object.entries(schedulers).map(([id, scheduler]) => [id, normalizeScheduler(scheduler)])
  )
}

interface NewQueueState {
  // 数据
  tasks: Record<string, Task>
  schedulers: Record<string, Scheduler>

  // UI状态
  activeTab: 'downloads' | 'library' | 'scan'
  filterStatus: TaskState | 'all'

  // WebSocket
  ws: WebSocket | null
  connected: boolean

  // Actions
  connectWebSocket: () => void
  disconnectWebSocket: () => void
  handleEvent: (event: any) => void
  fetchTasks: () => Promise<void>
  fetchSchedulers: () => Promise<void>
  submitTask: (task: Partial<Task>) => Promise<void>
  controlTask: (taskId: string, action: string) => Promise<void>
  controlScheduler: (sid: string, action: string) => Promise<void>
  deleteScheduler: (sid: string) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  batchDeleteTasks: (taskIds: string[]) => Promise<void>
  batchStartTasks: (taskIds: string[]) => Promise<void>
  deleteAllTasks: () => Promise<void>
  setActiveTab: (tab: 'downloads' | 'library' | 'scan') => void
  setFilterStatus: (status: TaskState | 'all') => void
  forceClearCache: () => void
  cleanupDuplicateCompletedTasks: () => Promise<void>

  // 计算属性
  getTaskProgress: (taskId: string) => number
  getFilteredTasks: () => Task[]
}

export const useNewQueueStore = create<NewQueueState>()(
  persist(
    (set, get) => ({
      tasks: {},
      schedulers: {},
      activeTab: 'downloads',
      filterStatus: 'all',
      ws: null,
      connected: false,

      connectWebSocket: () => {
        const { ws } = get()
        if (ws && ws.readyState === WebSocket.OPEN) return

        const wsUrl = `ws://${window.location.hostname}:8000/ws/queue`
        const newWs = new WebSocket(wsUrl)

        newWs.onopen = () => {
          set({ connected: true })
        }

        newWs.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            get().handleEvent(data)
          } catch (e) {
            console.error('[NewQueue] Failed to parse message:', e)
          }
        }

        newWs.onclose = () => {
          set({ connected: false, ws: null })
          setTimeout(() => get().connectWebSocket(), 3000)
        }

        newWs.onerror = (error) => {
          console.error('[NewQueue] WebSocket error:', error)
        }

        set({ ws: newWs })
      },

forceClearCache: () => {
        localStorage.removeItem('new-queue-storage')
      },

      disconnectWebSocket: () => {
        const { ws } = get()
        if (ws) {
          ws.close()
          set({ ws: null, connected: false })
        }
      },

      handleEvent: (event) => {
        const { type, ...data } = event

        switch (type) {
          case 'taskCreated':
            set((state) => {
              const tasks = { ...state.tasks }
              if (data.task) {
                tasks[data.task.id] = normalizeTask(data.task)
              }
              return { tasks }
            })
            break

          case 'taskUpdated':
            set((state) => {
              const tasks = { ...state.tasks }
              if (data.cancelled && data.id) {
                // 任务被取消，从列表中移除
                delete tasks[data.id]
              } else if (data.id) {
                // 更新任务状态
                if (tasks[data.id]) {
                  const oldState = tasks[data.id].state
                  const newState = normalizeTaskState(data.state)
                  tasks[data.id] = normalizeTask({ ...tasks[data.id], state: newState })
                  
                  // 检测下载完成事件
                  if (oldState !== 'completed' && newState === 'completed') {
                    videoLibraryService.handleDownloadComplete()
                  }
                }
              }
              return { tasks }
            })
            break

          case 'progress':
            set((state) => {
              const task = state.tasks[data.task]
              if (task) {
                const subtaskStatus = { ...task.subtaskStatus }
                subtaskStatus[data.subtask] = {
                  content: data.content,
                  chunk: data.chunk,
                }
                return {
                  tasks: {
                    ...state.tasks,
                    [data.task]: { ...task, subtaskStatus }
                  }
                }
              }
              return state
            })
            break

          case 'taskProgress':
            set((state) => {
              const task = state.tasks[data.id]
              if (task) {
                const currentStatus = normalizeTaskStatus(task.status)
                const hasDownloaded = Object.prototype.hasOwnProperty.call(data, 'downloaded')
                const hasTotal = Object.prototype.hasOwnProperty.call(data, 'total')
                const hasSpeed = Object.prototype.hasOwnProperty.call(data, 'speed')
                const hasEta = Object.prototype.hasOwnProperty.call(data, 'eta')
                const hasProgress = Object.prototype.hasOwnProperty.call(data, 'progress')
                const hasStage = Object.prototype.hasOwnProperty.call(data, 'stage')
                const updatedTask = {
                  ...task,
                  status: {
                    ...currentStatus,
                    progress: hasProgress ? data.progress : currentStatus.progress,
                    speed: hasSpeed ? data.speed : currentStatus.speed,
                    eta: hasEta ? data.eta : currentStatus.eta,
                    stage: hasStage ? (data.stage || currentStatus.stage) : currentStatus.stage,
                    downloaded: hasDownloaded ? data.downloaded : currentStatus.downloaded,
                    total: hasTotal ? data.total : currentStatus.total
                  }
                }

                return {
                  tasks: {
                    ...state.tasks,
                    [data.id]: updatedTask
                  }
                }
              }
              return state
            })
            break

          case 'schedulerCreated':
          case 'schedulerUpdated':
            set((state) => {
              const schedulers = { ...state.schedulers }
              if (data.scheduler) {
                schedulers[data.scheduler.id] = normalizeScheduler({
                  ...schedulers[data.scheduler.id],
                  ...data.scheduler,
                })
              }
              return { schedulers }
            })
            break

          case 'queueUpdated':
            // 全量刷新
            get().fetchTasks()
            get().fetchSchedulers()
            break
        }
      },

      fetchTasks: async () => {
        try {
          const response = await fetch(getApiUrl('/api/queue/tasks'))
          if (response.ok) {
            const result = await response.json()
            // 从新的API响应格式中获取数据
            const taskList = result.data || []
            const tasks: Record<string, Task> = {}
            taskList.forEach((task: any) => {
              tasks[task.id] = normalizeTask(task)
            })
            
            // 检查并清理缓存中不存在的任务（防止缓存不一致）
            // 注意：必须在 set 之前获取旧的任务 ID
            const storedTaskIds = Object.keys(get().tasks)
            const apiTaskIds = new Set(taskList.map((t: any) => t.id))
            
            // 设置新的任务（这会覆盖旧的任务）
            set({ tasks })
            
            // 删除缓存中不存在但在数据库中也不存在的任务
            const invalidTaskIds = storedTaskIds.filter(id => !apiTaskIds.has(id))
            
            if (invalidTaskIds.length > 0) {
              const currentTasks = { ...get().tasks }
              invalidTaskIds.forEach(id => {
                delete currentTasks[id]
              })
              set({ tasks: currentTasks })
            }
          }
        } catch (error) {
          console.error('[NewQueue] 获取任务列表失败:', error)
        }
      },

      fetchSchedulers: async () => {
        try {
          const response = await fetch(getApiUrl('/api/queue/schedulers'))
          if (response.ok) {
            const result = await response.json()
            const schedulers: Record<string, Scheduler> = {}

            // 从新的API响应格式中获取数据
            const schedulerList = result.data || []
            schedulerList.forEach((scheduler: any) => {
              const normalized = normalizeScheduler(scheduler)
              schedulers[normalized.id] = normalized
            })
            set({ schedulers })
          }
        } catch (error) {
          console.error('[NewQueue] Failed to fetch schedulers:', error)
        }
      },

      submitTask: async (task) => {
        try {
          const response = await fetch(getApiUrl('/api/queue/tasks'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task),
          })
          if (!response.ok) {
            const errorText = await response.text()
            console.error('[NewQueue] Submit task failed:', response.status, errorText)
            throw new Error(`Submit failed (${response.status}): ${errorText}`)
          }
          await get().fetchTasks()
        } catch (error) {
          console.error('[NewQueue] Failed to submit task:', error)
          throw error
        }
      },

      controlTask: async (taskId, action) => {
        try {
          // 如果是删除操作，使用DELETE方法
          if (action === 'cancelled') {
            const response = await fetch(getApiUrl(`/api/queue/tasks/${taskId}`), {
              method: 'DELETE',
            })
            if (!response.ok) throw new Error('Delete failed')
            // 删除后强制刷新，确保状态同步
            await get().fetchTasks()
          } else {
            // 其他操作使用PUT方法
            const stateMap: Record<string, number> = {
              'backlog': 0,
              'pending': 1,
              'active': 2,
              'completed': 3,
              'paused': 4,
              'failed': 5,
              'cancelled': 6
            }

            const stateValue = stateMap[action]
            if (stateValue === undefined) {
              throw new Error(`Invalid action: ${action}`)
            }

            const response = await fetch(getApiUrl(`/api/queue/tasks/${taskId}`), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ state: stateValue }),
            })
            if (!response.ok) throw new Error('Control failed')
            await get().fetchTasks()
          }
        } catch (error) {
          console.error('[NewQueue] Failed to control task:', error)
          throw error
        }
      },

      controlScheduler: async (sid, action) => {
        try {
          const response = await fetch(getApiUrl(`/api/queue/schedulers/${sid}/${action}`), {
            method: 'POST',
          })
          if (!response.ok) throw new Error('Control failed')
          await get().fetchSchedulers()
        } catch (error) {
          console.error('[NewQueue] Failed to control scheduler:', error)
          throw error
        }
      },

      deleteScheduler: async (sid) => {
        try {
          const response = await fetch(getApiUrl(`/api/queue/schedulers/${sid}`), {
            method: 'DELETE',
          })
          if (!response.ok) throw new Error('Delete failed')
          await get().fetchTasks()
          await get().fetchSchedulers()
        } catch (error) {
          console.error('[NewQueue] Failed to delete scheduler:', error)
          throw error
        }
      },

      deleteTask: async (taskId) => {
        try {
          const response = await fetch(getApiUrl(`/api/queue/tasks/${taskId}`), {
            method: 'DELETE',
          })
          if (response.status === 404) {
            await get().fetchTasks()
            await get().fetchSchedulers()
            return
          }
          if (!response.ok) throw new Error('Delete failed')
          await get().fetchTasks()
          await get().fetchSchedulers()
        } catch (error) {
          console.error('[NewQueue] Failed to delete task:', error)
          throw error
        }
      },

      batchDeleteTasks: async (taskIds) => {
        try {
          const response = await fetch(getApiUrl('/api/queue/tasks/batch'), {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskIds),
          })
          if (!response.ok) throw new Error('Batch delete failed')
          await get().fetchTasks()
          await get().fetchSchedulers()
        } catch (error) {
          console.error('[NewQueue] Failed to batch delete tasks:', error)
          throw error
        }
      },

      batchStartTasks: async (taskIds) => {
        try {
          const stateMap: Record<string, number> = {
            'backlog': 0,
            'pending': 1,
            'active': 2,
            'completed': 3,
            'paused': 4,
            'failed': 5,
            'cancelled': 6
          }
          
          // 使用Promise.all批量开始下载
          await Promise.all(taskIds.map(taskId => 
            fetch(getApiUrl(`/api/queue/tasks/${taskId}`), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ state: stateMap.active }),
            })
          ))
          
          await get().fetchTasks()
          await get().fetchSchedulers()
        } catch (error) {
          console.error('[NewQueue] Failed to batch start tasks:', error)
          throw error
        }
      },

      deleteAllTasks: async () => {
        try {
          const response = await fetch(getApiUrl('/api/queue/tasks/all'), {
            method: 'DELETE',
          })
          if (!response.ok) throw new Error('Delete all failed')
          await get().fetchTasks()
          await get().fetchSchedulers()
        } catch (error) {
          console.error('[NewQueue] Failed to delete all tasks:', error)
          throw error
        }
      },

      // 清理重复的已完成任务（同一个media_id有多个completed任务）
      cleanupDuplicateCompletedTasks: async () => {
        const tasks = get().tasks
        const taskList = Object.values(tasks)
        
        // 找出所有已完成的任务
        const completedTasks = taskList.filter(t => t.state === 'completed')
        
        // 按媒体身份分组。多 P/合集同一个 BVID 会有多个 cid/page，不能只按 media_id 清理。
        const groupedByMediaId: Record<string, typeof completedTasks> = {}
        completedTasks.forEach(task => {
          const mediaIdentity = getCompletedTaskIdentity(task)
          if (!groupedByMediaId[mediaIdentity]) {
            groupedByMediaId[mediaIdentity] = []
          }
          groupedByMediaId[mediaIdentity].push(task)
        })
        
        // 找出重复的任务（同一个media_id有多个completed任务）
        const duplicateTasks = new Set<string>()
        Object.values(groupedByMediaId).forEach(tasks => {
          if (tasks.length > 1) {
            // 保留最新的一个，删除其他的
            const sortedTasks = tasks.sort((a, b) => b.updated_at - a.updated_at)
            sortedTasks.slice(1).forEach(task => {
              duplicateTasks.add(task.id)
            })
          }
        })
        
        // 删除重复的任务
        const duplicateTaskIds = Array.from(duplicateTasks)
        if (duplicateTaskIds.length > 0) {
          try {
            await get().batchDeleteTasks(duplicateTaskIds)
          } catch (error) {
            console.warn('[NewQueue] Batch duplicate cleanup failed, retrying individually:', error)
            await Promise.allSettled(duplicateTaskIds.map(taskId => get().deleteTask(taskId)))
          }
        }
      },

      setActiveTab: (tab) => set({ activeTab: tab }),
      setFilterStatus: (status) => set({ filterStatus: status }),

      getTaskProgress: (taskId) => {
        const task = get().tasks[taskId]
        if (!task) return 0

        // 优先使用 status.progress（来自 taskProgress 事件）
        if (task.status?.progress !== undefined && task.status.progress > 0) {
          return task.status.progress
        }

        // 其次使用 subtaskStatus 计算
        let total = 0
        let completed = 0
        for (const status of Object.values(task.subtaskStatus || {})) {
          total += status.content
          completed += status.chunk
        }
        return total > 0 ? (completed / total) * 100 : 0
      },

      getFilteredTasks: () => {
        const { tasks, filterStatus } = get()
        const taskList = Object.values(tasks)

        // 默认不显示已完成的任务（已完成的任务在视频库显示）
        const activeTaskList = taskList.filter(t => t.state !== 'completed')

        if (filterStatus === 'all') return activeTaskList
        return activeTaskList.filter(t => t.state === filterStatus)
      },
    }),
    {
      name: 'new-queue-storage',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<NewQueueState> | undefined
        return {
          ...currentState,
          ...persisted,
          tasks: normalizeTaskMap(persisted?.tasks as Record<string, unknown> | undefined),
          schedulers: normalizeSchedulerMap(persisted?.schedulers as Record<string, unknown> | undefined),
        }
      },
      partialize: (state) => ({
        tasks: state.tasks,
        schedulers: state.schedulers,
      }),
    }
  )
)
