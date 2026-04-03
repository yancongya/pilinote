import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 类型定义
export type TaskState = 'backlog' | 'pending' | 'active' | 'completed' | 'paused' | 'failed' | 'cancelled'
export type SchedulerState = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

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
  status: Record<string, any>
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

interface NewQueueState {
  // 数据
  tasks: Record<string, Task>
  schedulers: Record<string, Scheduler>

  // UI状态
  activeTab: 'downloads' | 'library'
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
  setActiveTab: (tab: 'downloads' | 'library') => void
  setFilterStatus: (status: TaskState | 'all') => void
  forceClearCache: () => void

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
          console.log('[NewQueue] WebSocket connected')
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
          console.log('[NewQueue] WebSocket disconnected, reconnecting in 3s...')
          setTimeout(() => get().connectWebSocket(), 3000)
        }

        newWs.onerror = (error) => {
          console.error('[NewQueue] WebSocket error:', error)
        }

        set({ ws: newWs })
      },

      // 强制清理所有本地缓存数据（用于解决持久化缓存不一致问题）
      forceClearCache: () => {
        console.log('[NewQueue] Force clearing all local cache')
        // 清除 persist 存储
        localStorage.removeItem('new-queue-storage')
        // 重置状态
        set({ tasks: {}, schedulers: {} })
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
                // 转换状态数字为字符串，并映射字段名
                const stateMap: Record<number, string> = {
                  0: 'backlog',
                  1: 'pending',
                  2: 'active',
                  3: 'completed',
                  4: 'paused',
                  5: 'failed',
                  6: 'cancelled'
                }
                const taskWithState = {
                  ...data.task,
                  state: stateMap[data.task.state as number] || data.task.state,
                  schedulerId: data.task.scheduler_id  // 映射 scheduler_id -> schedulerId
                }
                tasks[data.task.id] = taskWithState
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
                const stateMap: Record<number, string> = {
                  0: 'backlog',
                  1: 'pending',
                  2: 'active',
                  3: 'completed',
                  4: 'paused',
                  5: 'failed',
                  6: 'cancelled'
                }
                // 如果 state 是字符串，直接使用；如果是数字，映射为字符串
                let stateStr: string
                if (typeof data.state === 'string') {
                  stateStr = data.state
                } else {
                  stateStr = stateMap[data.state as number] || data.state
                }
                
                if (tasks[data.id]) {
                  tasks[data.id] = { ...tasks[data.id], state: stateStr }
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

          case 'schedulerCreated':
          case 'schedulerUpdated':
            set((state) => {
              const schedulers = { ...state.schedulers }
              if (data.scheduler) {
                // 调度器状态映射
                const schedulerStateMap: Record<number, SchedulerState> = {
                  0: 'idle',      // PENDING -> idle
                  1: 'running',   // ACTIVE -> running
                  2: 'completed', // COMPLETED -> completed
                  3: 'paused',    // PAUSED -> paused
                  4: 'failed',    // FAILED -> failed
                  5: 'cancelled'  // CANCELLED -> cancelled
                }
                const schedulerWithState = {
                  ...data.scheduler,
                  state: schedulerStateMap[data.scheduler.state as number] || 'idle'
                }
                schedulers[data.scheduler.id] = { ...schedulers[data.scheduler.id], ...schedulerWithState }
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
          const response = await fetch('http://localhost:8000/api/queue/tasks')
          if (response.ok) {
            const result = await response.json()
            const stateMap: Record<number, string> = {
              0: 'backlog',
              1: 'pending',
              2: 'active',
              3: 'completed',
              4: 'paused',
              5: 'failed',
              6: 'cancelled'
            }
            // 从新的API响应格式中获取数据
            const taskList = result.data || []
            const tasks: Record<string, Task> = {}
            taskList.forEach((task: any) => {
              // 转换状态数字为字符串，并映射字段名
              const taskWithState = {
                ...task,
                state: stateMap[task.state as number] || task.state,
                schedulerId: task.scheduler_id  // 映射 scheduler_id -> schedulerId
              }
              tasks[task.id] = taskWithState
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
          const response = await fetch('http://localhost:8000/api/queue/schedulers')
          if (response.ok) {
            const result = await response.json()
            const schedulers: Record<string, Scheduler> = {}
            
            // 调度器状态映射
            const schedulerStateMap: Record<number, SchedulerState> = {
              0: 'idle',      // PENDING -> idle
              1: 'running',   // ACTIVE -> running
              2: 'completed', // COMPLETED -> completed
              3: 'paused',    // PAUSED -> paused
              4: 'failed',    // FAILED -> failed
              5: 'cancelled'  // CANCELLED -> cancelled
            }
            
            // 从新的API响应格式中获取数据
            const schedulerList = result.data || []
            schedulerList.forEach((scheduler: any) => {
              // 转换状态数字为字符串
              const schedulerWithState = {
                ...scheduler,
                state: schedulerStateMap[scheduler.state as number] || 'idle'
              }
              schedulers[scheduler.id] = schedulerWithState
            })
            set({ schedulers })
          }
        } catch (error) {
          console.error('[NewQueue] Failed to fetch schedulers:', error)
        }
      },

      submitTask: async (task) => {
        try {
          const response = await fetch('http://localhost:8000/api/queue/tasks', {
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
            const response = await fetch(`http://localhost:8000/api/queue/tasks/${taskId}`, {
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

            const response = await fetch(`http://localhost:8000/api/queue/tasks/${taskId}`, {
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
          const response = await fetch(`http://localhost:8000/api/queue/schedulers/${sid}/${action}`, {
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
          const response = await fetch(`http://localhost:8000/api/queue/schedulers/${sid}`, {
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

      setActiveTab: (tab) => set({ activeTab: tab }),
      setFilterStatus: (status) => set({ filterStatus: status }),

      getTaskProgress: (taskId) => {
        const task = get().tasks[taskId]
        if (!task) return 0

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

        if (filterStatus === 'all') return taskList
        return taskList.filter(t => t.state === filterStatus)
      },
    }),
    {
      name: 'new-queue-storage',
      partialize: (state) => ({
        tasks: state.tasks,
        schedulers: state.schedulers,
      }),
    }
  )
)
