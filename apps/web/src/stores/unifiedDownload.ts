/**
 * 统一下载状态管理
 * 
 * 整合了原有的 download.ts、newQueue.ts、queue.ts 的功能
 * 提供统一的接口和 WebSocket 实时更新
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiService } from '../services/api'
import { getWebSocketUrl } from '../config/api'

// ========== 类型定义 ==========

// 任务状态（与后端保持一致）
export type TaskState = 'backlog' | 'pending' | 'active' | 'completed' | 'paused' | 'failed' | 'cancelled'

// 下载阶段
export type DownloadStage = 'preparing' | 'downloading' | 'moving' | 'post_processing' | 'completed'

// 子任务类型
export type SubTaskType = 'video' | 'subtitle' | 'danmaku' | 'cover' | 'avatar' | 'nfo'

// 错误类型
export type ErrorType = 'network' | 'authentication' | 'file_system' | 'server' | 'unknown'

// 错误信息
export interface ErrorInfo {
  type: ErrorType
  message: string
  code?: string
  details?: string
  timestamp: number
}

// 任务状态信息
export interface TaskStatus {
  progress: number          // 总体进度 0-100
  speed: number            // 下载速度 bytes/s
  eta: number              // 预计剩余时间 seconds
  stage: DownloadStage     // 当前阶段
  downloaded: number       // 已下载字节数
  total: number           // 总字节数
}

// 子任务信息
export interface SubTask {
  id: string
  task_id: string
  type: SubTaskType
  state: TaskState
  progress: number         // 子任务进度 0-100
  params: Record<string, any>
  output_path?: string
  file_size?: number
  error_detail?: any
  created_at: number
  updated_at: number
}

// 主任务信息
export interface Task {
  id: string
  media_type: string
  media_id: string         // bvid/epid等
  title: string
  cover?: string
  desc?: string
  meta: Record<string, any>
  status: TaskStatus
  state: TaskState
  scheduler_id?: string
  created_at: number
  updated_at: number
  
  // 子任务
  subtasks: SubTask[]
  
  // 扩展信息（兼容旧系统）
  bvid?: string           // 兼容字段
  thumbnail_url?: string  // 兼容字段
  duration?: number
  uploader?: string
  file_path?: string
  aid?: number
  cid?: number
  quality?: number
  audio_bitrate?: number
  codec?: string
}

// 队列状态
export interface QueueStatus {
  running: boolean
  max_concurrent: number
  active_tasks_count: number
  active_tasks: string[]
  queue_sizes: {
    backlog: number
    pending: number
    doing: number
    complete: number
  }
}

// WebSocket 消息类型
export interface WSMessage {
  type: string
  data: any
}

// ========== 状态接口 ==========

interface UnifiedDownloadState {
  // ========== 数据状态 ==========
  
  // 任务数据
  tasks: Map<string, Task>
  taskIds: string[]        // 按创建时间排序的任务ID列表
  
  // 队列状态
  queueStatus: QueueStatus | null
  
  // 同步状态
  loading: boolean
  syncing: boolean
  lastSyncTime: number | null
  error: string | null
  
  // ========== WebSocket 连接 ==========
  
  ws: WebSocket | null
  wsConnected: boolean
  wsReconnectAttempts: number
  wsMaxReconnectAttempts: number
  
  // ========== 基础操作 ==========
  
  // 初始化
  initialize: () => Promise<void>
  
  // 同步数据
  syncTasks: () => Promise<void>
  syncQueueStatus: () => Promise<void>
  
  // 任务管理
  submitTask: (taskData: {
    media_type: string
    media_id: string
    title?: string
    cover?: string
    desc?: string
    meta?: Record<string, any>
  }) => Promise<Task>
  
  // 任务控制
  pauseTask: (taskId: string) => Promise<boolean>
  resumeTask: (taskId: string) => Promise<boolean>
  cancelTask: (taskId: string) => Promise<boolean>
  retryTask: (taskId: string) => Promise<boolean>
  deleteTask: (taskId: string) => Promise<boolean>
  
  // 批量操作
  pauseAllTasks: () => Promise<void>
  resumeAllTasks: () => Promise<void>
  cancelAllTasks: () => Promise<void>
  clearCompletedTasks: () => Promise<void>
  
  // ========== WebSocket 操作 ==========
  
  connectWebSocket: () => void
  disconnectWebSocket: () => void
  handleWebSocketMessage: (message: WSMessage) => void
  
  // ========== 内部状态更新 ==========
  
  setTasks: (tasks: Task[]) => void
  updateTask: (taskId: string, updates: Partial<Task>) => void
  updateTaskStatus: (taskId: string, status: Partial<TaskStatus>) => void
  updateTaskState: (taskId: string, state: TaskState) => void
  updateSubTask: (taskId: string, subtaskId: string, updates: Partial<SubTask>) => void
  
  setQueueStatus: (status: QueueStatus) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // ========== 查询和过滤 ==========
  
  // 获取任务
  getTask: (taskId: string) => Task | undefined
  getTaskByMediaId: (mediaId: string) => Task | undefined
  
  // 过滤任务
  getTasksByState: (state: TaskState) => Task[]
  getActiveDownloads: () => Task[]
  getCompletedTasks: () => Task[]
  getFailedTasks: () => Task[]
  
  // 统计信息
  getTaskStats: () => {
    total: number
    backlog: number
    pending: number
    active: number
    completed: number
    paused: number
    failed: number
    cancelled: number
  }
  
  // ========== 兼容性方法 ==========
  
  // 兼容旧的 download.ts 接口
  addDownload: (item: any) => void
  removeDownload: (downloadId: string) => void
  updateDownloadProgress: (downloadId: string, progress: number, speed?: number, eta?: number) => void
}

// ========== 状态实现 ==========

export const useUnifiedDownloadStore = create<UnifiedDownloadState>()(
  persist(
    (set, get) => ({
      // ========== 初始状态 ==========
      
      tasks: new Map(),
      taskIds: [],
      queueStatus: null,
      loading: false,
      syncing: false,
      lastSyncTime: null,
      error: null,
      
      ws: null,
      wsConnected: false,
      wsReconnectAttempts: 0,
      wsMaxReconnectAttempts: 5,
      
      // ========== 基础操作实现 ==========
      
      initialize: async () => {
        const state = get()
        
        try {
          set({ loading: true, error: null })
          
          // 同步任务数据
          await state.syncTasks()
          
          // 同步队列状态
          await state.syncQueueStatus()
          
          // 连接 WebSocket
          state.connectWebSocket()
          
          set({ loading: false })
          
        } catch (error) {
          console.error('初始化失败:', error)
          set({ 
            loading: false, 
            error: error instanceof Error ? error.message : '初始化失败' 
          })
        }
      },
      
      syncTasks: async () => {
        try {
          set({ syncing: true })
          
          const response = await apiService.get<any[]>('/api/unified-queue/tasks')
          
          if (response.success && response.data) {
            const tasks = response.data.map((taskData: any) => normalizeTask(taskData))
            get().setTasks(tasks)
            set({ lastSyncTime: Date.now() })
          }
          
        } catch (error) {
          console.error('同步任务失败:', error)
          set({ error: '同步任务失败' })
        } finally {
          set({ syncing: false })
        }
      },
      
      syncQueueStatus: async () => {
        try {
          const response = await apiService.get<QueueStatus>('/api/unified-queue/status')
          
          if (response.success && response.data) {
            get().setQueueStatus(response.data)
          }
          
        } catch (error) {
          console.error('同步队列状态失败:', error)
        }
      },
      
      submitTask: async (taskData) => {
        try {
          set({ loading: true, error: null })
          
          const response = await apiService.post<{ task_id: string }>('/api/unified-queue/tasks', taskData)
          
          if (response.success && response.data) {
            // 刷新任务列表
            await get().syncTasks()
            
            // 返回新创建的任务
            const newTask = get().getTask(response.data.task_id)
            if (newTask) {
              return newTask
            }
          }
          
          throw new Error(response.message || '提交任务失败')
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '提交任务失败'
          set({ error: errorMessage })
          throw error
        } finally {
          set({ loading: false })
        }
      },
      
      pauseTask: async (taskId: string) => {
        return await controlTask(taskId, 'pause')
      },
      
      resumeTask: async (taskId: string) => {
        return await controlTask(taskId, 'resume')
      },
      
      cancelTask: async (taskId: string) => {
        return await controlTask(taskId, 'cancel')
      },
      
      retryTask: async (taskId: string) => {
        return await controlTask(taskId, 'retry')
      },
      
      deleteTask: async (taskId: string) => {
        try {
          const response = await apiService.delete(`/api/unified-queue/tasks/${taskId}`)
          
          if (response.success) {
            // 从本地状态中移除
            const state = get()
            const newTasks = new Map(state.tasks)
            newTasks.delete(taskId)
            const newTaskIds = state.taskIds.filter(id => id !== taskId)
            
            set({ 
              tasks: newTasks,
              taskIds: newTaskIds
            })
            
            return true
          }
          
          return false
          
        } catch (error) {
          console.error('删除任务失败:', error)
          return false
        }
      },
      
      pauseAllTasks: async () => {
        const activeTasks = get().getActiveDownloads()
        await Promise.all(activeTasks.map(task => get().pauseTask(task.id)))
      },
      
      resumeAllTasks: async () => {
        const pausedTasks = get().getTasksByState('paused')
        await Promise.all(pausedTasks.map(task => get().resumeTask(task.id)))
      },
      
      cancelAllTasks: async () => {
        const activeTasks = get().getActiveDownloads()
        await Promise.all(activeTasks.map(task => get().cancelTask(task.id)))
      },
      
      clearCompletedTasks: async () => {
        const completedTasks = get().getCompletedTasks()
        await Promise.all(completedTasks.map(task => get().deleteTask(task.id)))
      },
      
      // ========== WebSocket 实现 ==========
      
      connectWebSocket: () => {
        const state = get()
        
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
          return // 已经连接
        }
        
        try {
          // 构建 WebSocket URL
          const wsUrl = getWebSocketUrl('/ws/queue')
          
          const ws = new WebSocket(wsUrl)
          
          ws.onopen = () => {
            console.log('WebSocket 连接成功')
            set({ 
              ws,
              wsConnected: true,
              wsReconnectAttempts: 0
            })
          }
          
          ws.onmessage = (event) => {
            try {
              const message: WSMessage = JSON.parse(event.data)
              get().handleWebSocketMessage(message)
            } catch (error) {
              console.error('WebSocket 消息解析失败:', error)
            }
          }
          
          ws.onclose = () => {
            console.log('WebSocket 连接关闭')
            set({ wsConnected: false })
            
            // 自动重连
            const currentState = get()
            if (currentState.wsReconnectAttempts < currentState.wsMaxReconnectAttempts) {
              setTimeout(() => {
                set({ wsReconnectAttempts: currentState.wsReconnectAttempts + 1 })
                get().connectWebSocket()
              }, 3000) // 3秒后重连
            }
          }
          
          ws.onerror = (error) => {
            console.error('WebSocket 错误:', error)
            set({ wsConnected: false })
          }
          
          set({ ws })
          
        } catch (error) {
          console.error('WebSocket 连接失败:', error)
        }
      },
      
      disconnectWebSocket: () => {
        const state = get()
        
        if (state.ws) {
          state.ws.close()
          set({ 
            ws: null,
            wsConnected: false,
            wsReconnectAttempts: 0
          })
        }
      },
      
      handleWebSocketMessage: (message: WSMessage) => {
        console.log('收到 WebSocket 消息:', message)
        
        switch (message.type) {
          case 'task_created':
            // 任务创建，刷新列表
            get().syncTasks()
            break
            
          case 'task_started':
            // 任务开始
            get().updateTaskState(message.data.task_id, 'active')
            break
            
          case 'task_progress':
            // 任务进度更新
            get().updateTaskStatus(message.data.task_id, {
              progress: message.data.progress,
              speed: message.data.speed,
              eta: message.data.eta,
              downloaded: message.data.current,
              total: message.data.total
            })
            break
            
          case 'task_completed':
            // 任务完成
            get().updateTaskState(message.data.task_id, 'completed')
            get().updateTaskStatus(message.data.task_id, { progress: 100 })
            break
            
          case 'task_failed':
            // 任务失败
            get().updateTaskState(message.data.task_id, 'failed')
            break
            
          case 'subtask_started':
            // 子任务开始
            get().updateSubTask(message.data.task_id, message.data.subtask_id, {
              state: 'active'
            })
            break
            
          case 'subtask_progress':
            // 子任务进度
            get().updateSubTask(message.data.task_id, message.data.subtask_id, {
              progress: message.data.progress
            })
            break
            
          case 'subtask_completed':
            // 子任务完成
            get().updateSubTask(message.data.task_id, message.data.subtask_id, {
              state: 'completed',
              progress: 100
            })
            break
            
          case 'queue_updated':
            // 队列状态更新
            get().syncQueueStatus()
            break
            
          default:
            console.log('未知的 WebSocket 消息类型:', message.type)
        }
      },
      
      // ========== 内部状态更新 ==========
      
      setTasks: (tasks: Task[]) => {
        const taskMap = new Map<string, Task>()
        const taskIds: string[] = []
        
        // 按创建时间排序（最新的在前）
        const sortedTasks = [...tasks].sort((a, b) => b.created_at - a.created_at)
        
        sortedTasks.forEach(task => {
          taskMap.set(task.id, task)
          taskIds.push(task.id)
        })
        
        set({ tasks: taskMap, taskIds })
      },
      
      updateTask: (taskId: string, updates: Partial<Task>) => {
        const state = get()
        const task = state.tasks.get(taskId)
        
        if (task) {
          const updatedTask = { ...task, ...updates, updated_at: Date.now() }
          const newTasks = new Map(state.tasks)
          newTasks.set(taskId, updatedTask)
          
          set({ tasks: newTasks })
        }
      },
      
      updateTaskStatus: (taskId: string, status: Partial<TaskStatus>) => {
        const state = get()
        const task = state.tasks.get(taskId)
        
        if (task) {
          const updatedStatus = { ...task.status, ...status }
          get().updateTask(taskId, { status: updatedStatus })
        }
      },
      
      updateTaskState: (taskId: string, newState: TaskState) => {
        get().updateTask(taskId, { state: newState })
      },
      
      updateSubTask: (taskId: string, subtaskId: string, updates: Partial<SubTask>) => {
        const state = get()
        const task = state.tasks.get(taskId)
        
        if (task) {
          const updatedSubtasks = task.subtasks.map(subtask => 
            subtask.id === subtaskId 
              ? { ...subtask, ...updates, updated_at: Date.now() }
              : subtask
          )
          
          get().updateTask(taskId, { subtasks: updatedSubtasks })
        }
      },
      
      setQueueStatus: (status: QueueStatus) => {
        set({ queueStatus: status })
      },
      
      setLoading: (loading: boolean) => {
        set({ loading })
      },
      
      setError: (error: string | null) => {
        set({ error })
      },
      
      // ========== 查询和过滤 ==========
      
      getTask: (taskId: string) => {
        return get().tasks.get(taskId)
      },
      
      getTaskByMediaId: (mediaId: string) => {
        const tasks = Array.from(get().tasks.values())
        return tasks.find(task => task.media_id === mediaId || task.bvid === mediaId)
      },
      
      getTasksByState: (state: TaskState) => {
        const tasks = Array.from(get().tasks.values())
        return tasks.filter(task => task.state === state)
      },
      
      getActiveDownloads: () => {
        return get().getTasksByState('active')
      },
      
      getCompletedTasks: () => {
        return get().getTasksByState('completed')
      },
      
      getFailedTasks: () => {
        return get().getTasksByState('failed')
      },
      
      getTaskStats: () => {
        const tasks = Array.from(get().tasks.values())
        
        return {
          total: tasks.length,
          backlog: tasks.filter(t => t.state === 'backlog').length,
          pending: tasks.filter(t => t.state === 'pending').length,
          active: tasks.filter(t => t.state === 'active').length,
          completed: tasks.filter(t => t.state === 'completed').length,
          paused: tasks.filter(t => t.state === 'paused').length,
          failed: tasks.filter(t => t.state === 'failed').length,
          cancelled: tasks.filter(t => t.state === 'cancelled').length,
        }
      },
      
      // ========== 兼容性方法 ==========
      
      addDownload: (item: any) => {
        // 兼容旧的接口，转换为新的任务格式
        const task: Task = {
          id: item.id,
          media_type: 'video',
          media_id: item.bvid,
          title: item.title,
          cover: item.thumbnail_url,
          desc: '',
          meta: {
            aid: item.aid,
            cid: item.cid,
            quality: item.quality,
            audio_bitrate: item.audio_bitrate,
            codec: item.codec,
            duration: item.duration,
            uploader: item.uploader
          },
          status: {
            progress: item.statusInfo?.progress || 0,
            speed: item.statusInfo?.speed || 0,
            eta: item.statusInfo?.eta || 0,
            stage: item.statusInfo?.stage || 'preparing',
            downloaded: item.statusInfo?.downloaded_bytes || 0,
            total: item.statusInfo?.total_bytes || 0
          },
          state: mapDownloadStatusToTaskState(item.status),
          created_at: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
          updated_at: Date.now(),
          subtasks: [],
          
          // 兼容字段
          bvid: item.bvid,
          thumbnail_url: item.thumbnail_url,
          duration: item.duration,
          uploader: item.uploader,
          file_path: item.file_path,
          aid: item.aid,
          cid: item.cid,
          quality: item.quality,
          audio_bitrate: item.audio_bitrate,
          codec: item.codec
        }
        
        const state = get()
        const newTasks = new Map(state.tasks)
        newTasks.set(task.id, task)
        const newTaskIds = [task.id, ...state.taskIds.filter(id => id !== task.id)]
        
        set({ tasks: newTasks, taskIds: newTaskIds })
      },
      
      removeDownload: (downloadId: string) => {
        get().deleteTask(downloadId)
      },
      
      updateDownloadProgress: (downloadId: string, progress: number, speed?: number, eta?: number) => {
        get().updateTaskStatus(downloadId, {
          progress,
          speed: speed || 0,
          eta: eta || 0
        })
      }
    }),
    {
      name: 'unified-download-store',
      partialize: (state) => ({
        // 只持久化必要的数据
        lastSyncTime: state.lastSyncTime,
        wsMaxReconnectAttempts: state.wsMaxReconnectAttempts
      })
    }
  )
)

// ========== 辅助函数 ==========

/**
 * 规范化任务数据
 */
function normalizeTask(taskData: any): Task {
  return {
    id: taskData.id,
    media_type: taskData.media_type,
    media_id: taskData.media_id,
    title: taskData.title || '',
    cover: taskData.cover,
    desc: taskData.desc,
    meta: taskData.meta || {},
    status: {
      progress: taskData.status?.progress || 0,
      speed: taskData.status?.speed || 0,
      eta: taskData.status?.eta || 0,
      stage: taskData.status?.stage || 'preparing',
      downloaded: taskData.status?.downloaded || 0,
      total: taskData.status?.total || 0
    },
    state: normalizeTaskState(taskData.state),
    scheduler_id: taskData.scheduler_id,
    created_at: taskData.created_at,
    updated_at: taskData.updated_at,
    subtasks: (taskData.subtasks || []).map((st: any) => ({
      id: st.id,
      task_id: st.task_id,
      type: st.type,
      state: normalizeTaskState(st.state),
      progress: st.progress || 0,
      params: st.params || {},
      output_path: st.output_path,
      file_size: st.file_size,
      error_detail: st.error_detail,
      created_at: st.created_at,
      updated_at: st.updated_at
    })),
    
    // 兼容字段
    bvid: taskData.media_id,
    thumbnail_url: taskData.cover,
    duration: taskData.meta?.duration,
    uploader: taskData.meta?.uploader,
    aid: taskData.meta?.aid,
    cid: taskData.meta?.cid,
    quality: taskData.meta?.quality,
    audio_bitrate: taskData.meta?.audio_bitrate,
    codec: taskData.meta?.codec
  }
}

/**
 * 规范化任务状态
 */
function normalizeTaskState(state: any): TaskState {
  if (typeof state === 'number') {
    const stateMap: Record<number, TaskState> = {
      0: 'backlog',
      1: 'pending', 
      2: 'active',
      3: 'completed',
      4: 'paused',
      5: 'failed',
      6: 'cancelled'
    }
    return stateMap[state] || 'backlog'
  }
  
  if (typeof state === 'string') {
    return state as TaskState
  }
  
  return 'backlog'
}

/**
 * 映射旧的下载状态到新的任务状态
 */
function mapDownloadStatusToTaskState(status: string): TaskState {
  const statusMap: Record<string, TaskState> = {
    'pending': 'backlog',
    'downloading': 'active',
    'completed': 'completed',
    'failed': 'failed',
    'paused': 'paused',
    'cancelled': 'cancelled'
  }
  
  return statusMap[status] || 'backlog'
}

/**
 * 任务控制辅助函数
 */
async function controlTask(taskId: string, action: string): Promise<boolean> {
  try {
    const response = await apiService.post(`/api/unified-queue/tasks/${taskId}/control`, {
      action
    })
    
    return response.success
    
  } catch (error) {
    console.error(`任务控制失败 (${action}):`, error)
    return false
  }
}
