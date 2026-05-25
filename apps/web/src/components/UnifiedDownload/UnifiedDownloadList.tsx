/**
 * 统一下载列表组件
 * 
 * 使用新的统一状态管理，支持实时更新和 WebSocket
 */

import React, { useEffect, useState } from 'react'
import { useUnifiedDownloadStore, Task, TaskState } from '../../stores/unifiedDownload'
import { formatDuration, formatSpeed } from '../../utils/format'
import { Button } from '../Button'
import Modal from '../Modal'

interface UnifiedDownloadListProps {
  className?: string
}

export const UnifiedDownloadList: React.FC<UnifiedDownloadListProps> = ({ 
  className = '' 
}) => {
  const {
    taskIds,
    tasks,
    queueStatus,
    loading,
    error,
    wsConnected,
    initialize,
    syncTasks,
    pauseTask,
    resumeTask,
    cancelTask,
    retryTask,
    deleteTask,
    getTaskStats,
    disconnectWebSocket
  } = useUnifiedDownloadStore()

  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)

  // 初始化
  useEffect(() => {
    initialize()
    
    return () => {
      disconnectWebSocket()
    }
  }, [])

  // 定期同步数据
  useEffect(() => {
    const interval = setInterval(() => {
      if (!wsConnected) {
        syncTasks()
      }
    }, 10000) // 10秒同步一次

    return () => clearInterval(interval)
  }, [wsConnected, syncTasks])

  // 获取任务列表
  const taskList = taskIds.map(id => tasks.get(id)).filter(Boolean) as Task[]
  const stats = getTaskStats()

  // 任务控制处理
  const handlePauseTask = async (taskId: string) => {
    await pauseTask(taskId)
  }

  const handleResumeTask = async (taskId: string) => {
    await resumeTask(taskId)
  }

  const handleCancelTask = async (taskId: string) => {
    await cancelTask(taskId)
  }

  const handleRetryTask = async (taskId: string) => {
    await retryTask(taskId)
  }

  const handleDeleteTask = (taskId: string) => {
    setTaskToDelete(taskId)
    setShowDeleteModal(true)
  }

  const confirmDeleteTask = async () => {
    if (taskToDelete) {
      await deleteTask(taskToDelete)
      setTaskToDelete(null)
      setShowDeleteModal(false)
    }
  }

  // 任务选择
  const handleSelectTask = (taskId: string, selected: boolean) => {
    const newSelected = new Set(selectedTasks)
    if (selected) {
      newSelected.add(taskId)
    } else {
      newSelected.delete(taskId)
    }
    setSelectedTasks(newSelected)
  }

  // 获取状态显示文本
  const getStateText = (state: TaskState): string => {
    const stateMap: Record<TaskState, string> = {
      'backlog': '等待中',
      'pending': '准备中',
      'active': '下载中',
      'completed': '已完成',
      'paused': '已暂停',
      'failed': '失败',
      'cancelled': '已取消'
    }
    return stateMap[state] || state
  }

  // 获取状态颜色
  const getStateColor = (state: TaskState): string => {
    const colorMap: Record<TaskState, string> = {
      'backlog': 'text-gray-500',
      'pending': 'text-blue-500',
      'active': 'text-green-500',
      'completed': 'text-green-600',
      'paused': 'text-yellow-500',
      'failed': 'text-red-500',
      'cancelled': 'text-gray-400'
    }
    return colorMap[state] || 'text-gray-500'
  }

  if (loading && taskList.length === 0) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      {/* 头部状态栏 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h2 className="text-lg font-semibold text-gray-900">下载管理</h2>
            
            {/* 连接状态 */}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {wsConnected ? '实时连接' : '离线模式'}
              </span>
            </div>

            {/* 队列状态 */}
            {queueStatus && (
              <div className="text-sm text-gray-600">
                运行中: {queueStatus.active_tasks_count}/{queueStatus.max_concurrent}
              </div>
            )}
          </div>

          {/* 统计信息 */}
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>总计: {stats.total}</span>
            <span>活跃: {stats.active}</span>
            <span>完成: {stats.completed}</span>
            <span>失败: {stats.failed}</span>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* 任务列表 */}
      <div className="bg-white">
        {taskList.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-gray-400 text-lg mb-2">📥</div>
            <p className="text-gray-500">暂无下载任务</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {taskList.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                selected={selectedTasks.has(task.id)}
                onSelect={(selected) => handleSelectTask(task.id, selected)}
                onPause={() => handlePauseTask(task.id)}
                onResume={() => handleResumeTask(task.id)}
                onCancel={() => handleCancelTask(task.id)}
                onRetry={() => handleRetryTask(task.id)}
                onDelete={() => handleDeleteTask(task.id)}
                getStateText={getStateText}
                getStateColor={getStateColor}
              />
            ))}
          </div>
        )}
      </div>

      {/* 删除确认模态框 */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="确认删除"
      >
        <div className="p-6">
          <p className="text-gray-600 mb-4">
            确定要删除这个下载任务吗？此操作无法撤销。
          </p>
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
            >
              取消
            </Button>
            <Button
              variant="danger"
              onClick={confirmDeleteTask}
            >
              删除
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// 任务项组件
interface TaskItemProps {
  task: Task
  selected: boolean
  onSelect: (selected: boolean) => void
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  onRetry: () => void
  onDelete: () => void
  getStateText: (state: TaskState) => string
  getStateColor: (state: TaskState) => string
}

const TaskItem: React.FC<TaskItemProps> = ({
  task,
  selected,
  onSelect,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onDelete,
  getStateText,
  getStateColor
}) => {
  const progress = task.status.progress || 0
  const speed = task.status.speed || 0
  const eta = task.status.eta || 0

  return (
    <div className="p-4 hover:bg-gray-50">
      <div className="flex items-start space-x-4">
        {/* 选择框 */}
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300"
        />

        {/* 封面 */}
        <div className="flex-shrink-0">
          {task.cover ? (
            <img
              src={task.cover}
              alt={task.title}
              className="w-16 h-12 object-cover rounded"
            />
          ) : (
            <div className="w-16 h-12 bg-gray-200 rounded flex items-center justify-center">
              <span className="text-gray-400 text-xs">📺</span>
            </div>
          )}
        </div>

        {/* 任务信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {task.title}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {task.media_id} • {task.media_type}
              </p>
            </div>

            {/* 状态和操作 */}
            <div className="flex items-center space-x-2 ml-4">
              <span className={`text-xs font-medium ${getStateColor(task.state)}`}>
                {getStateText(task.state)}
              </span>

              {/* 操作按钮 */}
              <div className="flex space-x-1">
                {task.state === 'active' && (
                  <button
                    onClick={onPause}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="暂停"
                  >
                    ⏸️
                  </button>
                )}
                
                {task.state === 'paused' && (
                  <button
                    onClick={onResume}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="继续"
                  >
                    ▶️
                  </button>
                )}
                
                {(task.state === 'active' || task.state === 'pending') && (
                  <button
                    onClick={onCancel}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="取消"
                  >
                    ⏹️
                  </button>
                )}
                
                {task.state === 'failed' && (
                  <button
                    onClick={onRetry}
                    className="p-1 text-gray-400 hover:text-blue-600"
                    title="重试"
                  >
                    🔄
                  </button>
                )}
                
                <button
                  onClick={onDelete}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="删除"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>

          {/* 进度条 */}
          {task.state === 'active' && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>{progress.toFixed(1)}%</span>
                <div className="flex items-center space-x-2">
                  {speed > 0 && <span>{formatSpeed(speed)}</span>}
                  {eta > 0 && <span>剩余 {formatDuration(eta)}</span>}
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* 子任务状态 */}
          {task.subtasks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {task.subtasks.map((subtask) => (
                <span
                  key={subtask.id}
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    subtask.state === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : subtask.state === 'active'
                      ? 'bg-blue-100 text-blue-800'
                      : subtask.state === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {subtask.type}
                  {subtask.state === 'active' && subtask.progress > 0 && (
                    <span className="ml-1">({subtask.progress}%)</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
