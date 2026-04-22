import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiService } from '../services/api'
import { useDownloadHistoryStore } from './downloadHistory'
import {
  ErrorClassifier,
  RetryManager,
  ErrorStatsCollector,
  DetailedError,
  RetryConfig,
  ErrorCategory
} from '../utils/errorHandler'

// ========== 类型定义 ==========

// 队列优先级
export type QueuePriority = 'high' | 'medium' | 'low'

// 队列状态
export type QueueStatus = 'idle' | 'running' | 'paused' | 'stopped'

// 任务状态（与download.ts保持一致）
export type TaskState = 'pending' | 'downloading' | 'completed' | 'failed' | 'paused' | 'cancelled'

// 下载阶段
export type DownloadStage = 'preparing' | 'downloading' | 'moving' | 'post_processing' | 'completed'

// 错误类型（保留兼容性）
export type ErrorType = 'network' | 'authentication' | 'file_system' | 'server' | 'unknown'

// 错误信息接口（保留兼容性）
export interface ErrorInfo {
  type: ErrorType
  message: string
  code?: string
  details?: string
  timestamp: number
  detailedError?: DetailedError  // 新增：详细错误信息
}

// 下载状态详细信息
export interface TaskStatusInfo {
  progress: number          // 0-100
  speed: number            // bytes/s
  eta: number              // seconds
  stage: DownloadStage
  downloaded_bytes: number
  total_bytes: number
  retry_count: number
  max_retries: number
  error: ErrorInfo | null
  last_updated: number
}

// 队列任务项
export interface QueueTask {
  id: string
  bvid: string
  title: string
  priority: QueuePriority
  state: TaskState
  statusInfo: TaskStatusInfo
  thumbnail_url: string | null
  duration: number | null
  uploader: string | null
  file_path: string | null
  created_at: string | null
  started_at: string | null
  completed_at: string | null
  aid: number | null
  cid: number | null
  quality: number | null
  audio_bitrate: number | null
  codec: string | null
  estimated_size: number | null  // 预计文件大小（bytes）
  queue_position: number         // 队列中的位置
}

// 队列配置
export interface QueueConfig {
  max_concurrent_downloads: number     // 最大并发下载数
  auto_start: boolean                  // 自动开始下载
  sort_strategy: 'priority' | 'created_at' | 'estimated_size' | 'manual'
  retry_failed: boolean                // 自动重试失败的下载
  retry_delay: number                  // 重试延迟（秒）
  max_retries: number                  // 最大重试次数
  retry_backoff: boolean               // 启用退避策略
  retry_backoff_multiplier: number     // 退避倍数
  clear_completed: boolean             // 自动清理完成的下载
}

// 队列统计信息
export interface QueueStats {
  total: number
  pending: number
  downloading: number
  completed: number
  failed: number
  paused: number
  cancelled: number
  total_size: number          // 总大小（bytes）
  downloaded_size: number     // 已下载大小（bytes）
  average_speed: number       // 平均速度（bytes/s）
}

// ========== 状态接口 ==========

interface QueueState {
  // 队列任务
  tasks: Map<string, QueueTask>
  taskOrder: string[]  // 按队列顺序排列的任务ID

  // 队列配置
  config: QueueConfig
  queueStatus: QueueStatus

  // 同步状态
  syncing: boolean
  lastSyncTime: number | null

  // WebSocket连接
  ws: WebSocket | null
  wsConnected: boolean

  // ========== 任务管理 ==========

  // 设置任务列表
  setTasks: (tasks: QueueTask[]) => void

  // 添加任务到队列
  addTask: (task: QueueTask) => void

  // 从队列中移除任务
  removeTask: (taskId: string) => void

  // 批量添加任务
  batchAddTasks: (tasks: QueueTask[]) => void

  // 批量移除任务
  batchRemoveTasks: (taskIds: string[]) => void

  // 清空队列
  clearQueue: () => void

  // ========== 优先级管理 ==========

  // 设置任务优先级
  setTaskPriority: (taskId: string, priority: QueuePriority) => void

  // 批量设置优先级
  batchSetPriority: (taskIds: string[], priority: QueuePriority) => void

  // ========== 排序管理 ==========

  // 对队列进行排序
  sortQueue: (strategy: QueueConfig['sort_strategy']) => void

  // 手动调整任务位置
  reorderTasks: (taskId: string, newPosition: number) => void

  // 批量重新排序（用于拖拽）
  batchReorderTasks: (taskIds: string[]) => void

  // ========== 并发控制 ==========

  // 获取可以启动的任务（考虑并发限制）
  getReadyTasks: () => QueueTask[]

  // 检查是否可以启动新任务
  canStartTask: () => boolean

  // 获取当前下载数量
  getDownloadingCount: () => number

  // ========== 自动调度 ==========

  // 自动调度下一个任务
  scheduleNextTask: () => Promise<boolean>

  // 批量启动任务（考虑并发限制）
  startAvailableTasks: () => Promise<void>

  // ========== 任务控制 ==========

  // 开始任务
  startTask: (taskId: string) => Promise<boolean>

  // 暂停任务
  pauseTask: (taskId: string) => Promise<boolean>

  // 恢复任务
  resumeTask: (taskId: string) => Promise<boolean>

  // 取消任务
  cancelTask: (taskId: string) => Promise<boolean>

  // 重试任务
  retryTask: (taskId: string) => Promise<boolean>

  // 批量开始任务
  batchStartTasks: (taskIds: string[]) => Promise<boolean>

  // 批量暂停任务
  batchPauseTasks: (taskIds: string[]) => Promise<boolean>

  // 批量恢复任务
  batchResumeTasks: (taskIds: string[]) => Promise<boolean>

  // 批量取消任务
  batchCancelTasks: (taskIds: string[]) => Promise<boolean>

  // ========== 队列控制 ==========

  // 暂停队列
  pauseQueue: () => void

  // 恢复队列
  resumeQueue: () => void

  // 停止队列
  stopQueue: () => void

  // ========== 状态更新 ==========

  // 更新任务状态
  updateTaskState: (taskId: string, state: TaskState) => void

  // 更新任务进度
  updateTaskProgress: (taskId: string, progress: number, speed?: number, eta?: number) => void

  // 更新任务阶段
  updateTaskStage: (taskId: string, stage: DownloadStage) => void

  // 更新任务字节信息
  updateTaskBytes: (taskId: string, downloaded: number, total: number) => void

  // 设置任务错误
  setTaskError: (taskId: string, error: ErrorInfo) => void

  // 清除任务错误
  clearTaskError: (taskId: string) => void

  // 增加重试次数
  incrementRetryCount: (taskId: string) => void

  // 重置重试次数
  resetRetryCount: (taskId: string) => void

  // ========== 查询方法 ==========

  // 获取所有任务
  getAllTasks: () => QueueTask[]

  // 根据状态获取任务
  getTasksByState: (state: TaskState) => QueueTask[]

  // 根据优先级获取任务
  getTasksByPriority: (priority: QueuePriority) => QueueTask[]

  // 根据bvid获取任务
  getTasksByBvid: (bvid: string) => QueueTask[]

  // 检查bvid是否在队列中
  isBvidInQueue: (bvid: string) => boolean

  // 获取队列统计信息
  getQueueStats: () => QueueStats

  // ========== 配置管理 ==========

  // 更新队列配置
  updateConfig: (config: Partial<QueueConfig>) => void

  // 重置配置为默认值
  resetConfig: () => void

  // ========== 服务器同步 ==========

  // 从服务器同步队列
  syncFromServer: () => Promise<void>

  // 添加任务到服务器
  addToServer: (taskData: any) => Promise<boolean>

  // 从服务器删除任务
  deleteFromServer: (taskId: string) => Promise<boolean>

  // 批量删除任务（通过bvid）
  batchDeleteByBvid: (bvids: string[]) => Promise<boolean>

  // ========== WebSocket连接 ==========

  connectWebSocket: () => void
  disconnectWebSocket: () => void
  handleWebSocketMessage: (event: MessageEvent) => void

  // ========== 实用方法 ==========

  // 检查任务是否可以重试
  isTaskRetryable: (taskId: string) => boolean

  // 获取队列头部任务
  getHeadTask: () => QueueTask | null

  // 移动任务到队列头部
  moveToHead: (taskId: string) => void

  // 移动任务到队列尾部
  moveToTail: (taskId: string) => void

  // ========== 错误处理和重试 ==========

  // 获取错误统计
  getErrorStats: () => ReturnType<typeof ErrorStatsCollector.getStats>

  // 获取最近错误
  getRecentErrors: (count?: number) => DetailedError[]

  // 清除错误统计
  clearErrorStats: () => void

  // 获取任务错误恢复建议
  getTaskRecoverySuggestions: (taskId: string) => string[]

  // 检查任务是否可以重试（使用新的重试管理器）
  canTaskRetry: (taskId: string, retryConfig?: Partial<RetryConfig>) => boolean

  // 计算任务重试延迟
  calculateTaskRetryDelay: (taskId: string, retryConfig?: Partial<RetryConfig>) => number

  // 手动触发重试（带自定义配置）
  retryTaskWithConfig: (taskId: string, retryConfig?: Partial<RetryConfig>) => Promise<boolean>

  // 批量重试失败的任务
  retryFailedTasks: (taskIds?: string[]) => Promise<number>

  // 获取可重试的任务列表
  getRetryableTasks: (retryConfig?: Partial<RetryConfig>) => QueueTask[]
}

// 默认配置
const DEFAULT_CONFIG: QueueConfig = {
  max_concurrent_downloads: 3,
  auto_start: true,
  sort_strategy: 'priority',
  retry_failed: true,
  retry_delay: 5,
  max_retries: 3,
  retry_backoff: true,
  retry_backoff_multiplier: 2,
  clear_completed: false
}

// ========== Store 创建 ==========

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      // ========== 初始状态 ==========

      tasks: new Map(),
      taskOrder: [],
      config: DEFAULT_CONFIG,
      queueStatus: 'idle',
      syncing: false,
      lastSyncTime: null,
      ws: null,
      wsConnected: false,

      // ========== 任务管理 ==========

      setTasks: (taskItems: QueueTask[]) => {
        const newTasks = new Map<string, QueueTask>()
        const newOrder: string[] = []

        taskItems.forEach(item => {
          newTasks.set(item.id, item)
          newOrder.push(item.id)
        })

        set({
          tasks: newTasks,
          taskOrder: newOrder
        })
      },

      addTask: (task: QueueTask) => {
        set((state) => {
          const newTasks = new Map(state.tasks)
          newTasks.set(task.id, task)

          const newOrder = [...state.taskOrder, task.id]

          return {
            tasks: newTasks,
            taskOrder: newOrder
          }
        })

        // 如果配置了自动开始且队列未暂停，尝试调度
        const { config, queueStatus } = get()
        if (config.auto_start && queueStatus !== 'paused') {
          get().scheduleNextTask()
        }
      },

      removeTask: (taskId: string) => {
        set((state) => {
          const newTasks = new Map(state.tasks)
          newTasks.delete(taskId)

          const newOrder = state.taskOrder.filter(id => id !== taskId)

          return {
            tasks: newTasks,
            taskOrder: newOrder
          }
        })
      },

      batchAddTasks: (tasks: QueueTask[]) => {
        set((state) => {
          const newTasks = new Map(state.tasks)
          const newOrder = [...state.taskOrder]

          tasks.forEach(task => {
            newTasks.set(task.id, task)
            newOrder.push(task.id)
          })

          return {
            tasks: newTasks,
            taskOrder: newOrder
          }
        })

        // 如果配置了自动开始且队列未暂停，尝试调度
        const { config, queueStatus } = get()
        if (config.auto_start && queueStatus !== 'paused') {
          get().startAvailableTasks()
        }
      },

      batchRemoveTasks: (taskIds: string[]) => {
        set((state) => {
          const newTasks = new Map(state.tasks)
          taskIds.forEach(id => newTasks.delete(id))

          const newOrder = state.taskOrder.filter(id => !taskIds.includes(id))

          return {
            tasks: newTasks,
            taskOrder: newOrder
          }
        })
      },

      clearQueue: () => {
        set({
          tasks: new Map(),
          taskOrder: []
        })
      },

      // ========== 优先级管理 ==========

      setTaskPriority: (taskId: string, priority: QueuePriority) => {
        set((state) => {
          const newTasks = new Map(state.tasks)
          const task = newTasks.get(taskId)

          if (task) {
            newTasks.set(taskId, {
              ...task,
              priority
            })
          }

          return {
            tasks: newTasks
          }
        })

        // 如果当前排序策略是按优先级，重新排序
        const { config } = get()
        if (config.sort_strategy === 'priority') {
          get().sortQueue('priority')
        }
      },

      batchSetPriority: (taskIds: string[], priority: QueuePriority) => {
        set((state) => {
          const newTasks = new Map(state.tasks)

          taskIds.forEach(taskId => {
            const task = newTasks.get(taskId)
            if (task) {
              newTasks.set(taskId, {
                ...task,
                priority
              })
            }
          })

          return {
            tasks: newTasks
          }
        })

        // 如果当前排序策略是按优先级，重新排序
        const { config } = get()
        if (config.sort_strategy === 'priority') {
          get().sortQueue('priority')
        }
      },

      // ========== 排序管理 ==========

      sortQueue: (strategy: QueueConfig['sort_strategy']) => {
        const { tasks, taskOrder } = get()
        const taskList = taskOrder.map(id => tasks.get(id)!).filter(Boolean)

        let sortedTasks: QueueTask[]

        switch (strategy) {
          case 'priority':
            // 按优先级排序：高 > 中 > 低
            const priorityOrder: Record<QueuePriority, number> = {
              high: 0,
              medium: 1,
              low: 2
            }
            sortedTasks = [...taskList].sort((a, b) => {
              if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority]
              }
              // 同优先级按创建时间排序
              const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
              const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
              return timeA - timeB
            })
            break

          case 'created_at':
            // 按创建时间排序（最早的优先）
            sortedTasks = [...taskList].sort((a, b) => {
              const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
              const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
              return timeA - timeB
            })
            break

          case 'estimated_size':
            // 按预计大小排序（小文件优先）
            sortedTasks = [...taskList].sort((a, b) => {
              const sizeA = a.estimated_size || 0
              const sizeB = b.estimated_size || 0
              return sizeA - sizeB
            })
            break

          case 'manual':
            // 手动排序，不改变顺序
            sortedTasks = taskList
            break

          default:
            sortedTasks = taskList
        }

        // 更新任务顺序和位置
        const newOrder = sortedTasks.map(task => task.id)
        const newTasks = new Map(tasks)

        sortedTasks.forEach((task, index) => {
          newTasks.set(task.id, {
            ...task,
            queue_position: index
          })
        })

        set({
          tasks: newTasks,
          taskOrder: newOrder
        })
      },

      reorderTasks: (taskId: string, newPosition: number) => {
        const { taskOrder } = get()
        const currentIndex = taskOrder.indexOf(taskId)

        if (currentIndex === -1 || currentIndex === newPosition) return

        const newOrder = [...taskOrder]
        newOrder.splice(currentIndex, 1)
        newOrder.splice(newPosition, 0, taskId)

        // 更新所有任务的位置
        const { tasks } = get()
        const newTasks = new Map(tasks)

        newOrder.forEach((id, index) => {
          const task = newTasks.get(id)
          if (task) {
            newTasks.set(id, {
              ...task,
              queue_position: index
            })
          }
        })

        set({
          tasks: newTasks,
          taskOrder: newOrder
        })

        // 更新配置为手动排序
        set((state) => ({
          config: {
            ...state.config,
            sort_strategy: 'manual'
          }
        }))
      },

      batchReorderTasks: (taskIds: string[]) => {
        const { tasks } = get()
        const newTasks = new Map(tasks)
        const newOrder: string[] = []

        taskIds.forEach((taskId, index) => {
          const task = newTasks.get(taskId)
          if (task) {
            newTasks.set(taskId, {
              ...task,
              queue_position: index
            })
            newOrder.push(taskId)
          }
        })

        set({
          tasks: newTasks,
          taskOrder: newOrder
        })

        // 更新配置为手动排序
        set((state) => ({
          config: {
            ...state.config,
            sort_strategy: 'manual'
          }
        }))
      },

      // ========== 并发控制 ==========

      getReadyTasks: () => {
        const { config } = get()
        const downloadingCount = get().getDownloadingCount()
        const availableSlots = config.max_concurrent_downloads - downloadingCount

        if (availableSlots <= 0) return []

        // 获取待处理状态的任务，按队列顺序排序
        const readyTasks = get().getTasksByState('pending')
          .filter(task => task.queue_position < availableSlots)

        return readyTasks.slice(0, availableSlots)
      },

      canStartTask: () => {
        const { config } = get()
        const downloadingCount = get().getDownloadingCount()
        return downloadingCount < config.max_concurrent_downloads
      },

      getDownloadingCount: () => {
        const { tasks } = get()
        return Array.from(tasks.values()).filter(
          task => task.state === 'downloading'
        ).length
      },

      // ========== 自动调度 ==========

      scheduleNextTask: async () => {
        const { queueStatus, config } = get()

        // 如果队列已暂停或停止，不调度
        if (queueStatus === 'paused' || queueStatus === 'stopped') {
          return false
        }

        // 检查是否可以启动新任务
        if (!get().canStartTask()) {
          return false
        }

        // 获取待处理任务
        const pendingTasks = get().getTasksByState('pending')

        if (pendingTasks.length === 0) {
          return false
        }

        // 根据排序策略获取下一个任务
        let nextTask: QueueTask | null = null

        if (config.sort_strategy === 'manual') {
          // 手动排序：取队列头部
          nextTask = pendingTasks.sort((a, b) => a.queue_position - b.queue_position)[0]
        } else {
          // 其他排序策略：按策略排序后取第一个
          const sortedTasks = [...pendingTasks].sort((a, b) => {
            switch (config.sort_strategy) {
              case 'priority':
                const priorityOrder: Record<QueuePriority, number> = {
                  high: 0,
                  medium: 1,
                  low: 2
                }
                if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                  return priorityOrder[a.priority] - priorityOrder[b.priority]
                }
                break
              case 'created_at':
                const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
                const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
                return timeA - timeB
              case 'estimated_size':
                const sizeA = a.estimated_size || 0
                const sizeB = b.estimated_size || 0
                return sizeA - sizeB
            }
            return a.queue_position - b.queue_position
          })
          nextTask = sortedTasks[0]
        }

        if (!nextTask) {
          return false
        }

        // 启动任务
        const success = await get().startTask(nextTask.id)
        return success
      },

      startAvailableTasks: async () => {
        const { config } = get()
        if (!config.auto_start) return

        while (get().canStartTask()) {
          const started = await get().scheduleNextTask()
          if (!started) break
        }
      },

      // ========== 任务控制 ==========

      startTask: async (taskId: string) => {
        try {
          const response = await apiService.startDownloadTask(taskId)

          if (response.success) {
            // 立即更新本地状态
            get().updateTaskState(taskId, 'downloading')
            get().clearTaskError(taskId)
            get().resetRetryCount(taskId)

            // 同步服务器状态
            get().syncFromServer()
            return true
          }

          return false
        } catch (error) {
          console.error('[QueueStore] Start task failed:', error)
          get().setTaskError(taskId, {
            type: 'network',
            message: error instanceof Error ? error.message : 'Start task failed',
            timestamp: Date.now()
          })
          return false
        }
      },

      pauseTask: async (taskId: string) => {
        try {
          const response = await apiService.pauseDownloadTask(taskId)

          if (response.success) {
            // 立即更新本地状态
            get().updateTaskState(taskId, 'paused')
            // 同步服务器状态
            get().syncFromServer()
            return true
          }

          return false
        } catch (error) {
          console.error('[QueueStore] Pause task failed:', error)
          return false
        }
      },

      resumeTask: async (taskId: string) => {
        try {
          const response = await apiService.resumeDownloadTask(taskId)

          if (response.success) {
            // 立即更新本地状态
            get().updateTaskState(taskId, 'downloading')
            // 同步服务器状态
            get().syncFromServer()
            return true
          }

          return false
        } catch (error) {
          console.error('[QueueStore] Resume task failed:', error)
          return false
        }
      },

      cancelTask: async (taskId: string) => {
        try {
          const response = await apiService.cancelDownloadTask(taskId)

          if (response.success) {
            // 立即更新本地状态
            get().updateTaskState(taskId, 'cancelled')
            // 同步服务器状态
            get().syncFromServer()
            return true
          }

          return false
        } catch (error) {
          console.error('[QueueStore] Cancel task failed:', error)
          return false
        }
      },

      retryTask: async (taskId: string) => {
        try {
          // 增加重试次数
          get().incrementRetryCount(taskId)

          // 检查是否超过最大重试次数
          const task = get().tasks.get(taskId)
          if (task && task.statusInfo.retry_count > task.statusInfo.max_retries) {
            console.error(`[QueueStore] Task ${taskId} exceeded max retries`)
            return false
          }

          // 清除错误信息并重新开始
          get().clearTaskError(taskId)
          get().updateTaskState(taskId, 'pending')

          // 调用开始下载
          return await get().startTask(taskId)
        } catch (error) {
          console.error('[QueueStore] Retry task failed:', error)
          return false
        }
      },

      batchStartTasks: async (taskIds: string[]) => {
        const { config } = get()
        const availableSlots = config.max_concurrent_downloads - get().getDownloadingCount()
        const tasksToStart = taskIds.slice(0, availableSlots)

        if (tasksToStart.length === 0) return false

        const results = await Promise.all(
          tasksToStart.map(id => get().startTask(id))
        )

        return results.some(result => result)
      },

      batchPauseTasks: async (taskIds: string[]) => {
        const results = await Promise.all(
          taskIds.map(id => get().pauseTask(id))
        )
        return results.some(result => result)
      },

      batchResumeTasks: async (taskIds: string[]) => {
        const results = await Promise.all(
          taskIds.map(id => get().resumeTask(id))
        )
        return results.some(result => result)
      },

      batchCancelTasks: async (taskIds: string[]) => {
        const results = await Promise.all(
          taskIds.map(id => get().cancelTask(id))
        )
        return results.some(result => result)
      },

      // ========== 队列控制 ==========

      pauseQueue: () => {
        set({ queueStatus: 'paused' })
      },

      resumeQueue: () => {
        set({ queueStatus: 'running' })
        // 恢复时尝试调度任务
        get().startAvailableTasks()
      },

      stopQueue: () => {
        set({ queueStatus: 'stopped' })
        // 停止所有正在下载的任务
        const downloadingTasks = get().getTasksByState('downloading')
        downloadingTasks.forEach(task => {
          get().pauseTask(task.id)
        })
      },

      // ========== 状态更新 ==========

      updateTaskState: (taskId: string, state: TaskState) => {
        set((stateStore) => {
          const newTasks = new Map(stateStore.tasks)
          const task = newTasks.get(taskId)

          if (task) {
            const now = Date.now()
            const updatedTask: QueueTask = {
              ...task,
              state,
              created_at: task.state === 'pending' && !task.created_at ? new Date(now).toISOString() : task.created_at,
              started_at: state === 'downloading' && !task.started_at ? new Date(now).toISOString() : task.started_at,
              completed_at: state === 'completed' ? new Date(now).toISOString() : task.completed_at,
              statusInfo: {
                ...task.statusInfo,
                last_updated: now
              }
            }
            newTasks.set(taskId, updatedTask)
          }

          return {
            tasks: newTasks
          }
        })

        // 如果任务完成，尝试调度下一个任务
        if (state === 'completed') {
          const { config, queueStatus } = get()
          if (config.auto_start && queueStatus !== 'paused') {
            get().scheduleNextTask()
          }
          
          // 通知历史记录store更新
          setTimeout(() => {
            useDownloadHistoryStore.getState().refreshHistory()
          }, 500)
        }
      },

      updateTaskProgress: (taskId: string, progress: number, speed?: number, eta?: number) => {
        set((state) => {
          const newTasks = new Map(state.tasks)
          const task = newTasks.get(taskId)

          if (task) {
            newTasks.set(taskId, {
              ...task,
              statusInfo: {
                ...task.statusInfo,
                progress: Math.min(100, Math.max(0, progress)),
                speed: speed !== undefined ? speed : task.statusInfo.speed,
                eta: eta !== undefined ? eta : task.statusInfo.eta,
                last_updated: Date.now()
              }
            })
          }

          return {
            tasks: newTasks
          }
        })
      },

      updateTaskStage: (taskId: string, stage: DownloadStage) => {
        set((state) => {
          const newTasks = new Map(state.tasks)
          const task = newTasks.get(taskId)

          if (task) {
            newTasks.set(taskId, {
              ...task,
              statusInfo: {
                ...task.statusInfo,
                stage,
                last_updated: Date.now()
              }
            })
          }

          return {
            tasks: newTasks
          }
        })
      },

      updateTaskBytes: (taskId: string, downloaded: number, total: number) => {
        set((state) => {
          const newTasks = new Map(state.tasks)
          const task = newTasks.get(taskId)

          if (task) {
            const progress = total > 0 ? (downloaded / total) * 100 : 0
            newTasks.set(taskId, {
              ...task,
              statusInfo: {
                ...task.statusInfo,
                progress,
                downloaded_bytes: downloaded,
                total_bytes: total,
                last_updated: Date.now()
              }
            })
          }

          return {
            tasks: newTasks
          }
        })
      },

      setTaskError: (taskId: string, error: ErrorInfo) => {
        // 使用新的错误分类器
        let detailedError: DetailedError
        try {
          detailedError = ErrorClassifier.classify(
            error.message,
            { taskId, code: error.code, details: error.details }
          )
        } catch (classifyError) {
          // 如果分类失败，创建一个基本的错误信息
          detailedError = {
            category: ErrorCategory.UNKNOWN,
            message: error.message,
            severity: 'medium' as any,
            timestamp: Date.now(),
            retryable: false,
            suggestions: []
          }
        }

        // 记录错误到统计器
        ErrorStatsCollector.record(detailedError)

        // 更新错误信息，包含详细错误
        const errorWithDetail: ErrorInfo = {
          ...error,
          detailedError
        }

        set((state) => {
          const newTasks = new Map(state.tasks)
          const task = newTasks.get(taskId)

          if (task) {
            newTasks.set(taskId, {
              ...task,
              state: 'failed',
              statusInfo: {
                ...task.statusInfo,
                error: errorWithDetail,
                last_updated: Date.now()
              }
            })
          }

          return {
            tasks: newTasks
          }
        })

        // 检查是否可以重试
        const { config } = get()
        const task = get().tasks.get(taskId)

        if (task && config.retry_failed) {
          // 使用新的重试管理器判断是否可以重试
          const retryConfig: Partial<RetryConfig> = {
            maxRetries: config.max_retries,
            initialDelay: config.retry_delay * 1000,
            maxDelay: config.retry_delay * 1000 * Math.pow(config.retry_backoff_multiplier || 2, config.max_retries),
            backoffMultiplier: config.retry_backoff_multiplier || 2,
            jitter: config.retry_backoff || false
          }

          const canRetry = RetryManager.isRetryable(
            detailedError,
            task.statusInfo.retry_count,
            retryConfig
          )

          if (canRetry) {
            // 计算重试延迟
            const retryDelay = RetryManager.calculateDelay(
              task.statusInfo.retry_count,
              retryConfig
            )

            console.log(`[QueueStore] Task ${taskId} will retry in ${retryDelay}ms (${task.statusInfo.retry_count + 1}/${config.max_retries})`)

            setTimeout(() => {
              get().retryTask(taskId)
            }, retryDelay)
          } else {
            console.log(`[QueueStore] Task ${taskId} is not retryable`)
          }
        }
      },

      clearTaskError: (taskId: string) => {
        set((state) => {
          const newTasks = new Map(state.tasks)
          const task = newTasks.get(taskId)

          if (task) {
            newTasks.set(taskId, {
              ...task,
              statusInfo: {
                ...task.statusInfo,
                error: null,
                last_updated: Date.now()
              }
            })
          }

          return {
            tasks: newTasks
          }
        })
      },

      incrementRetryCount: (taskId: string) => {
        set((state) => {
          const newTasks = new Map(state.tasks)
          const task = newTasks.get(taskId)

          if (task) {
            newTasks.set(taskId, {
              ...task,
              statusInfo: {
                ...task.statusInfo,
                retry_count: task.statusInfo.retry_count + 1,
                last_updated: Date.now()
              }
            })
          }

          return {
            tasks: newTasks
          }
        })
      },

      resetRetryCount: (taskId: string) => {
        set((state) => {
          const newTasks = new Map(state.tasks)
          const task = newTasks.get(taskId)

          if (task) {
            newTasks.set(taskId, {
              ...task,
              statusInfo: {
                ...task.statusInfo,
                retry_count: 0,
                last_updated: Date.now()
              }
            })
          }

          return {
            tasks: newTasks
          }
        })
      },

      // ========== 查询方法 ==========

      getAllTasks: () => {
        const { tasks, taskOrder } = get()
        return taskOrder.map(id => tasks.get(id)!).filter(Boolean)
      },

      getTasksByState: (state: TaskState) => {
        const { tasks } = get()
        return Array.from(tasks.values()).filter(task => task.state === state)
      },

      getTasksByPriority: (priority: QueuePriority) => {
        const { tasks } = get()
        return Array.from(tasks.values()).filter(task => task.priority === priority)
      },

      getTasksByBvid: (bvid: string) => {
        const { tasks } = get()
        return Array.from(tasks.values()).filter(task => task.bvid === bvid)
      },

      isBvidInQueue: (bvid: string) => {
        const { tasks } = get()
        for (const task of tasks.values()) {
          if (task.bvid === bvid) {
            return true
          }
        }
        return false
      },

      getQueueStats: () => {
        const { tasks } = get()
        const items = Array.from(tasks.values())

        const totalSize = items.reduce((sum, task) => sum + (task.statusInfo.total_bytes || 0), 0)
        const downloadedSize = items.reduce((sum, task) => sum + (task.statusInfo.downloaded_bytes || 0), 0)
        const totalSpeed = items.reduce((sum, task) => sum + (task.statusInfo.speed || 0), 0)
        const downloadingCount = items.filter(t => t.state === 'downloading').length

        return {
          total: items.length,
          pending: items.filter(t => t.state === 'pending').length,
          downloading: downloadingCount,
          completed: items.filter(t => t.state === 'completed').length,
          failed: items.filter(t => t.state === 'failed').length,
          paused: items.filter(t => t.state === 'paused').length,
          cancelled: items.filter(t => t.state === 'cancelled').length,
          total_size: totalSize,
          downloaded_size: downloadedSize,
          average_speed: downloadingCount > 0 ? totalSpeed / downloadingCount : 0
        }
      },

      // ========== 配置管理 ==========

      updateConfig: (configUpdates: Partial<QueueConfig>) => {
        set((state) => ({
          config: {
            ...state.config,
            ...configUpdates
          }
        }))
      },

      resetConfig: () => {
        set({
          config: DEFAULT_CONFIG
        })
      },

      // ========== 服务器同步 ==========

      syncFromServer: async () => {
        const { syncing } = get()
        if (syncing) return

        set({ syncing: true })

        try {
          const response = await apiService.getDownloadList()

          if (response.success && response.data?.downloads) {
            // 转换服务器数据格式到本地格式
            const convertedTasks: QueueTask[] = response.data.downloads.map((item: any, index: number) => ({
              id: item.id,
              bvid: item.bvid,
              title: item.title,
              priority: 'medium', // 默认中等优先级
              state: item.status as TaskState,
              statusInfo: {
                progress: item.progress || 0,
                speed: item.download_speed || 0,
                eta: item.eta || 0,
                stage: item.stage || 'preparing',
                downloaded_bytes: item.downloaded_bytes || 0,
                total_bytes: item.total_bytes || 0,
                retry_count: item.retry_count || 0,
                max_retries: item.max_retries || 3,
                error: item.error_message ? {
                  type: 'unknown',
                  message: item.error_message,
                  timestamp: Date.now()
                } : null,
                last_updated: Date.now()
              },
              thumbnail_url: item.thumbnail_url || null,
              duration: item.duration || null,
              uploader: item.uploader || null,
              file_path: item.file_path || null,
              created_at: item.created_at || null,
              started_at: item.started_at || null,
              completed_at: item.completed_at || null,
              aid: item.aid || null,
              cid: item.cid || null,
              quality: item.quality || null,
              audio_bitrate: item.audio_bitrate || null,
              codec: item.codec || null,
              estimated_size: item.total_bytes || null,
              queue_position: index
            }))

            get().setTasks(convertedTasks)
            set({ lastSyncTime: Date.now() })
          }
        } catch (error) {
          console.error('[QueueStore] Sync from server failed:', error)
        } finally {
          set({ syncing: false })
        }
      },

      addToServer: async (taskData: any) => {
        try {
          const response = await apiService.addToDownloadQueue(taskData)

          if (response.success && (response as any).download_id) {
            // 立即添加到本地状态，提供即时反馈
            const newItem: QueueTask = {
              id: (response as any).download_id,
              bvid: taskData.bvid,
              title: taskData.title,
              priority: 'medium', // 默认中等优先级
              state: 'pending',
              statusInfo: {
                progress: 0,
                speed: 0,
                eta: 0,
                stage: 'preparing',
                downloaded_bytes: 0,
                total_bytes: 0,
                retry_count: 0,
                max_retries: 3,
                error: null,
                last_updated: Date.now()
              },
              thumbnail_url: taskData.thumbnail_url || null,
              duration: taskData.duration || null,
              uploader: taskData.uploader || null,
              file_path: null,
              created_at: new Date().toISOString(),
              started_at: null,
              completed_at: null,
              aid: taskData.aid || null,
              cid: taskData.cid || null,
              quality: taskData.quality || null,
              audio_bitrate: taskData.audio_bitrate || null,
              codec: taskData.codec || null,
              estimated_size: null,
              queue_position: get().taskOrder.length
            }
            get().addTask(newItem)

            // 异步同步服务器状态
            get().syncFromServer()
            return true
          }

          console.error('[QueueStore] Add to server failed:', response.message)
          return false
        } catch (error) {
          console.error('[QueueStore] Add to server failed:', error)
          return false
        }
      },

      deleteFromServer: async (taskId: string) => {
        try {
          const response = await apiService.deleteDownload(taskId)

          if (response.success) {
            get().removeTask(taskId)
            return true
          }

          return false
        } catch (error) {
          console.error('[QueueStore] Delete from server failed:', error)
          return false
        }
      },

      batchDeleteByBvid: async (bvids: string[]) => {
        try {
          // 立即从本地状态移除，提供即时反馈
          bvids.forEach(bvid => {
            const tasks = get().getTasksByBvid(bvid)
            tasks.forEach(task => get().removeTask(task.id))
          })

          // 异步从服务器删除
          const results = await Promise.all(
            bvids.map(bvid => apiService.deleteDownloadByBvid(bvid))
          )

          const allSuccess = results.every(r => r.success)

          if (!allSuccess) {
            // 如果有失败，重新同步服务器状态
            get().syncFromServer()
          }

          return allSuccess
        } catch (error) {
          console.error('[QueueStore] Batch delete by bvid failed:', error)
          // 发生错误时，重新同步服务器状态
          get().syncFromServer()
          return false
        }
      },

      // ========== WebSocket连接 ==========

      connectWebSocket: () => {
        const { ws, wsConnected } = get()
        if (ws && wsConnected) return

        const wsUrl = `ws://${window.location.hostname}:8000/ws/queue`
        const newWs = new WebSocket(wsUrl)

        newWs.onopen = () => {
          console.log('[QueueStore] WebSocket connected')
          set({ wsConnected: true })
        }

        newWs.onmessage = (event) => {
          get().handleWebSocketMessage(event)
        }

        newWs.onclose = () => {
          console.log('[QueueStore] WebSocket disconnected')
          set({ wsConnected: false, ws: null })
          // 3秒后重连
          setTimeout(() => {
            const { ws: currentWs } = get()
            if (!currentWs) {
              get().connectWebSocket()
            }
          }, 3000)
        }

        newWs.onerror = (error) => {
          console.error('[QueueStore] WebSocket error:', error)
        }

        set({ ws: newWs })
      },

      disconnectWebSocket: () => {
        const { ws } = get()
        if (ws) {
          ws.close()
          set({ ws: null, wsConnected: false })
        }
      },

      handleWebSocketMessage: (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          const { type, ...payload } = data

          switch (type) {
            case 'download_progress':
              // 更新下载进度
              if (payload.download_id && payload.progress !== undefined) {
                get().updateTaskProgress(
                  payload.download_id,
                  payload.progress,
                  payload.speed,
                  payload.eta
                )
              }
              break

            case 'download_status':
              // 更新下载状态
              if (payload.download_id && payload.status) {
                get().updateTaskState(payload.download_id, payload.status)
              }
              break

            case 'download_stage':
              // 更新下载阶段
              if (payload.download_id && payload.stage) {
                get().updateTaskStage(payload.download_id, payload.stage)
              }
              break

            case 'download_bytes':
              // 更新下载字节
              if (payload.download_id && payload.downloaded !== undefined && payload.total !== undefined) {
                get().updateTaskBytes(payload.download_id, payload.downloaded, payload.total)
              }
              break

            case 'download_error':
              // 设置下载错误
              if (payload.download_id && payload.error) {
                get().setTaskError(payload.download_id, {
                  type: payload.error_type || 'unknown',
                  message: payload.error,
                  code: payload.error_code,
                  details: payload.error_details,
                  timestamp: Date.now()
                })
              }
              break

            case 'download_completed':
              // 下载完成
              if (payload.download_id) {
                get().updateTaskState(payload.download_id, 'completed')
                get().updateTaskProgress(payload.download_id, 100, 0, 0)
              }
              break

            case 'queue_sync':
              // 全量同步
              get().syncFromServer()
              break

            default:
              console.log('[QueueStore] Unknown message type:', type)
          }
        } catch (error) {
          console.error('[QueueStore] Failed to handle WebSocket message:', error)
        }
      },

      // ========== 实用方法 ==========

      isTaskRetryable: (taskId: string) => {
        const task = get().tasks.get(taskId)
        if (!task) return false

        return (
          task.state === 'failed' &&
          task.statusInfo.retry_count < task.statusInfo.max_retries
        )
      },

      getHeadTask: () => {
        const { tasks, taskOrder } = get()
        if (taskOrder.length === 0) return null
        return tasks.get(taskOrder[0]) || null
      },

      moveToHead: (taskId: string) => {
        get().reorderTasks(taskId, 0)
      },

      moveToTail: (taskId: string) => {
        const { taskOrder } = get()
        get().reorderTasks(taskId, taskOrder.length - 1)
      },

      // ========== 错误处理和重试 ==========

      getErrorStats: () => {
        return ErrorStatsCollector.getStats()
      },

      getRecentErrors: (count: number = 20) => {
        return ErrorStatsCollector.getRecentErrors(count)
      },

      clearErrorStats: () => {
        ErrorStatsCollector.clear()
      },

      getTaskRecoverySuggestions: (taskId: string) => {
        const task = get().tasks.get(taskId)
        if (!task || !task.statusInfo.error || !task.statusInfo.error.detailedError) {
          return []
        }

        const suggestions = task.statusInfo.error.detailedError.suggestions
        return suggestions.map(s => s.description)
      },

      canTaskRetry: (taskId: string, retryConfig?: Partial<RetryConfig>) => {
        const task = get().tasks.get(taskId)
        if (!task || task.state !== 'failed' || !task.statusInfo.error?.detailedError) {
          return false
        }

        const config = get().config
        const defaultRetryConfig: Partial<RetryConfig> = {
          maxRetries: config.max_retries,
          initialDelay: config.retry_delay * 1000,
          maxDelay: config.retry_delay * 1000 * Math.pow(config.retry_backoff_multiplier || 2, config.max_retries),
          backoffMultiplier: config.retry_backoff_multiplier || 2,
          jitter: config.retry_backoff || false
        }

        const finalRetryConfig = { ...defaultRetryConfig, ...retryConfig }

        return RetryManager.isRetryable(
          task.statusInfo.error.detailedError,
          task.statusInfo.retry_count,
          finalRetryConfig
        )
      },

      calculateTaskRetryDelay: (taskId: string, retryConfig?: Partial<RetryConfig>) => {
        const task = get().tasks.get(taskId)
        if (!task) {
          return 0
        }

        const config = get().config
        const defaultRetryConfig: Partial<RetryConfig> = {
          maxRetries: config.max_retries,
          initialDelay: config.retry_delay * 1000,
          maxDelay: config.retry_delay * 1000 * Math.pow(config.retry_backoff_multiplier || 2, config.max_retries),
          backoffMultiplier: config.retry_backoff_multiplier || 2,
          jitter: config.retry_backoff || false
        }

        const finalRetryConfig = { ...defaultRetryConfig, ...retryConfig }

        return RetryManager.calculateDelay(task.statusInfo.retry_count, finalRetryConfig)
      },

      retryTaskWithConfig: async (taskId: string, retryConfig?: Partial<RetryConfig>) => {
        const task = get().tasks.get(taskId)
        if (!task) {
          console.error('[QueueStore] Task not found:', taskId)
          return false
        }

        if (!get().canTaskRetry(taskId, retryConfig)) {
          console.error('[QueueStore] Task is not retryable:', taskId)
          return false
        }

        // 增加重试次数
        get().incrementRetryCount(taskId)

        // 清除错误信息并重新开始
        get().clearTaskError(taskId)
        get().updateTaskState(taskId, 'pending')

        // 计算重试延迟
        const delay = get().calculateTaskRetryDelay(taskId, retryConfig)

        // 延迟后开始下载
        await new Promise(resolve => setTimeout(resolve, delay))

        return await get().startTask(taskId)
      },

      retryFailedTasks: async (taskIds?: string[]) => {
        const failedTasks = taskIds
          ? taskIds.map(id => get().tasks.get(id)).filter(Boolean) as QueueTask[]
          : get().getTasksByState('failed')

        let successCount = 0

        for (const task of failedTasks) {
          if (get().canTaskRetry(task.id)) {
            const success = await get().retryTaskWithConfig(task.id)
            if (success) {
              successCount++
            }
          }
        }

        return successCount
      },

      getRetryableTasks: (retryConfig?: Partial<RetryConfig>) => {
        const failedTasks = get().getTasksByState('failed')
        return failedTasks.filter(task => get().canTaskRetry(task.id, retryConfig))
      }
    }),
    {
      name: 'pilinote-queue',
      partialize: (state) => ({
        tasks: Array.from(state.tasks.entries()),
        taskOrder: state.taskOrder,
        config: state.config,
        lastSyncTime: state.lastSyncTime
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.tasks) {
          // 将数组转换回Map
          state.tasks = new Map(state.tasks as any)
        }
        // 重新连接WebSocket
        if (state) {
          state.wsConnected = false
          state.ws = null
          // 延迟连接以确保store完全初始化
          setTimeout(() => {
            const store = useQueueStore.getState()
            if (!store.wsConnected) {
              store.connectWebSocket()
            }
          }, 1000)
        }
      }
    }
  )
)
