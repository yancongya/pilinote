// components/NewDownload/SchedulerCard.tsx
import { useState, useMemo } from 'react'
import { useNewQueueStore, Scheduler, Task } from '../../stores/newQueue'
import { Play, Pause, Trash2, ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, Loader2, X, Film, Square } from 'lucide-react'
import ConfirmModal from '../ConfirmModal'
import { getAvatarProxyUrl } from '../../config/api'

interface Props {
  scheduler: Scheduler
  isBatchMode?: boolean
  selectedTasks?: Set<string>
  onTaskSelect?: (taskId: string) => void
}

// 代理图片URL，避免403错误
const getProxyImageUrl = (url: string | null | undefined): string => {
  if (!url) return ''
  return getAvatarProxyUrl(url)
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 格式化时间戳
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 计算调度器进度
const calculateSchedulerProgress = (scheduler: Scheduler, tasks: Record<string, Task>): number => {
  if (!scheduler.list || scheduler.list.length === 0) return 0

  const taskIds = scheduler.list
  let totalProgress = 0
  let completedCount = 0

  taskIds.forEach(taskId => {
    const task = tasks[taskId]
    if (task) {
      if (task.state === 'completed') {
        totalProgress += 100
        completedCount++
      } else if (task.state === 'active') {
        // 从status中获取进度
        const progress = task.status?.progress || 0
        totalProgress += progress
      }
    }
  })

  return Math.round(totalProgress / taskIds.length)
}

// 计算合集总大小
const calculateSchedulerTotalSize = (scheduler: Scheduler, tasks: Record<string, Task>): number => {
  if (!scheduler.list || scheduler.list.length === 0) return 0

  const taskIds = scheduler.list
  let totalSize = 0

  taskIds.forEach(taskId => {
    const task = tasks[taskId]
    if (task && task.state === 'completed') {
      // 从 meta.totalSize 获取已完成任务的总大小
      if (task.meta?.totalSize) {
        totalSize += task.meta.totalSize
      }
      // 或者从 meta.fileSize 获取（兼容旧数据）
      else if (task.meta?.fileSize) {
        totalSize += task.meta.fileSize
      }
      // 或者从 status.total 获取
      else if (task.status?.total) {
        totalSize += task.status.total
      }
    }
  })

  return totalSize
}

// 计算合集视频总大小
const calculateSchedulerVideoSize = (scheduler: Scheduler, tasks: Record<string, Task>): number => {
  if (!scheduler.list || scheduler.list.length === 0) return 0

  const taskIds = scheduler.list
  let videoSize = 0

  taskIds.forEach(taskId => {
    const task = tasks[taskId]
    if (task && task.state === 'completed') {
      if (task.meta?.videoSize) {
        videoSize += task.meta.videoSize
      }
    }
  })

  return videoSize
}

// 计算合集元数据总大小
const calculateSchedulerMetadataSize = (scheduler: Scheduler, tasks: Record<string, Task>): number => {
  if (!scheduler.list || scheduler.list.length === 0) return 0

  const taskIds = scheduler.list
  let metadataSize = 0

  taskIds.forEach(taskId => {
    const task = tasks[taskId]
    if (task && task.state === 'completed') {
      if (task.meta?.metadataSize) {
        metadataSize += task.meta.metadataSize
      }
    }
  })

  return metadataSize
}

export default function SchedulerCard({ scheduler, isBatchMode = false, selectedTasks = new Set(), onTaskSelect }: Props) {
  const { tasks, controlScheduler, deleteScheduler } = useNewQueueStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })

  const progress = useMemo(() => calculateSchedulerProgress(scheduler, tasks), [scheduler, tasks])
  const totalSize = useMemo(() => calculateSchedulerTotalSize(scheduler, tasks), [scheduler, tasks])
  const videoSize = useMemo(() => calculateSchedulerVideoSize(scheduler, tasks), [scheduler, tasks])
  const metadataSize = useMemo(() => calculateSchedulerMetadataSize(scheduler, tasks), [scheduler, tasks])
  const schedulerTasks = useMemo(() => {
    return scheduler.list
      .map(taskId => tasks[taskId])
      .filter(Boolean) as Task[]
  }, [scheduler.list, tasks])

  // 获取调度器封面（使用第一个有封面的任务）
  const schedulerCover = useMemo(() => {
    const taskWithCover = schedulerTasks.find(t => t.cover && t.cover.trim())
    return taskWithCover ? getProxyImageUrl(taskWithCover.cover) : ''
  }, [schedulerTasks])

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    'idle': { label: '待处理', color: 'var(--color-warning-500)', icon: Clock },
    'running': { label: '执行中', color: 'var(--color-success-500)', icon: Loader2 },
    'paused': { label: '已暂停', color: 'var(--color-warning-600)', icon: Pause },
    'completed': { label: '已完成', color: 'var(--color-success-500)', icon: CheckCircle },
    'failed': { label: '失败', color: 'var(--color-error-500)', icon: XCircle },
    'cancelled': { label: '已取消', color: 'var(--color-secondary-500)', icon: XCircle },
  }

  const taskStatusConfig: Record<string, { label: string; color: string }> = {
    'backlog': { label: '待办', color: 'var(--color-secondary-400)' },
    'pending': { label: '待处理', color: 'var(--color-warning-500)' },
    'active': { label: '下载中', color: 'var(--color-success-500)' },
    'completed': { label: '已完成', color: 'var(--color-success-500)' },
    'paused': { label: '已暂停', color: 'var(--color-warning-600)' },
    'failed': { label: '失败', color: 'var(--color-error-500)' },
    'cancelled': { label: '已取消', color: 'var(--color-secondary-500)' },
  }

  const status = statusConfig[scheduler.state] || { label: '未知', color: 'var(--color-text-tertiary)', icon: Clock }
  const StatusIcon = status.icon

  const completedCount = schedulerTasks.filter(t => t.state === 'completed').length
  const totalCount = schedulerTasks.length
  
  const handleControl = async (action: string) => {
    try {
      await controlScheduler(scheduler.id, action)
    } catch (error) {
      console.error('Control failed:', error)
      const errorMessage = error instanceof Error ? error.message : '操作失败，请重试'
      alert(errorMessage)
    }
  }

  const handleDelete = () => {
    setConfirmModal({
      show: true,
      title: '删除合集',
      message: '确定要删除这个合集及其所有任务吗？此操作不可恢复。',
      onConfirm: async () => {
        try {
          await deleteScheduler(scheduler.id)
        } catch (error) {
          console.error('Delete failed:', error)
          const errorMessage = error instanceof Error ? error.message : '删除失败，请重试'
          alert(errorMessage)
        }
      }
    })
  }
  
  return (
    <article
      className="scheduler-card mb-3"
      style={{
        borderLeft: `4px solid ${status.color}`
      }}
    >
      {/* 调度器头部 */}
      <div className="scheduler-header">
        {/* 封面区域 */}
        {schedulerCover && (
          <div className="scheduler-cover">
            <div className="scheduler-cover-thumbnail">
              <img
                src={schedulerCover}
                alt={scheduler.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const placeholder = e.currentTarget.parentElement?.querySelector('.cover-placeholder')
                  if (placeholder) {
                    (placeholder as HTMLElement).style.display = 'flex'
                  }
                }}
              />
              <div className="cover-placeholder hidden">
                <Film size={32} color="var(--color-primary-500)" />
              </div>
            </div>
          </div>
        )}

        <div className="scheduler-info">
          <button
            className="expand-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? '折叠' : '展开'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          <div className="scheduler-title">
            <h3>{scheduler.title}</h3>
            <div className="scheduler-meta">
              {/* 状态标签（仅在非完成状态时显示） */}
              {scheduler.state !== 'completed' && (
                <span className="status-badge" style={{ backgroundColor: `${status.color}20`, color: status.color }}>
                  <StatusIcon size={12} />
                  {status.label}
                </span>
              )}
              <span className="task-count">
                {completedCount}/{totalCount} 视频
              </span>
              {(totalSize > 0 || videoSize > 0 || metadataSize > 0) && (
                <span className="task-count">
                  {totalSize > 0 && formatFileSize(totalSize)}
                  {videoSize > 0 && metadataSize > 0 && ' | '}
                  {videoSize > 0 && `视频: ${formatFileSize(videoSize)}`}
                  {metadataSize > 0 && ` | 元数据: ${formatFileSize(metadataSize)}`}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="scheduler-controls">
          {scheduler.state === 'idle' && (
            <button
              onClick={() => handleControl('start')}
              title="开始下载"
              aria-label="开始下载调度器"
              className="control-btn primary"
            >
              <Play size={18} />
            </button>
          )}
          {scheduler.state === 'running' && (
            <button
              onClick={() => handleControl('pause')}
              title="暂停"
              aria-label="暂停调度器"
              className="control-btn"
            >
              <Pause size={18} />
            </button>
          )}
          {scheduler.state === 'paused' && (
            <button
              onClick={() => handleControl('resume')}
              title="恢复"
              aria-label="恢复调度器"
              className="control-btn primary"
            >
              <Play size={18} />
            </button>
          )}
          {(scheduler.state === 'running' || scheduler.state === 'paused') && (
            <button
              onClick={() => handleControl('cancel')}
              title="取消"
              aria-label="取消调度器"
              className="control-btn"
            >
              <X size={18} />
            </button>
          )}
          {scheduler.state !== 'cancelled' && (
            <button
              onClick={handleDelete}
              title="删除"
              aria-label="删除调度器"
              className="control-btn danger"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
      
      {/* 进度条 */}
      <div className="scheduler-progress">
        <div 
          className="progress-bar"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* 创建时间 */}
      <div className="scheduler-time">
        创建时间: {formatTimestamp(scheduler.created_at)}
      </div>
      
      {/* 任务列表（展开时显示） */}
      {isExpanded && (
        <div className="scheduler-tasks">
          {schedulerTasks.length === 0 ? (
            <div className="empty-tasks">暂无任务</div>
          ) : (
            schedulerTasks.map(task => {
              const coverUrl = getProxyImageUrl(task.cover)
              const hasCover = task.cover && task.cover.trim()
              return (
                <div key={task.id} className="scheduler-task-item" data-selected={selectedTasks.has(task.id)}>
                  {/* 批量选择复选框 */}
                  {isBatchMode && (
                    <div
                      className="batch-checkbox flex items-center justify-center cursor-pointer p-1 flex-shrink-0 w-6 h-6 min-w-6 rounded"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)'
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onTaskSelect?.(task.id)
                      }}
                    >
                      {selectedTasks.has(task.id) ? (
                        <div className="w-4 h-4 flex items-center justify-center rounded-sm" style={{
                          backgroundColor: 'var(--color-primary-500)'
                        }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                      ) : (
                        <Square size={16} color="var(--color-text-secondary)" />
                      )}
                    </div>
                  )}

                  {/* 任务封面 */}
                  {hasCover && (
                    <div className="task-cover">
                      <div className="task-cover-thumbnail">
                        <img
                          src={coverUrl}
                          alt={task.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            const placeholder = e.currentTarget.parentElement?.querySelector('.cover-placeholder')
                            if (placeholder) {
                              (placeholder as HTMLElement).style.display = 'flex'
                            }
                          }}
                        />
                        <div className="cover-placeholder hidden">
                          <Film size={24} color="var(--color-primary-500)" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="task-info">
                    <span className="task-title">{task.title}</span>
                    <div className="task-meta">
                      {/* 状态标签（仅在非完成状态时显示） */}
                      {task.state !== 'completed' && (
                        <span className="task-state" style={{ color: taskStatusConfig[task.state]?.color || 'var(--color-text-tertiary)' }}>
                          {taskStatusConfig[task.state]?.label || task.state}
                        </span>
                      )}
                      {task.state === 'completed' && (task.meta?.totalSize || task.meta?.videoSize || task.meta?.metadataSize) && (
                        <>
                          <span className="task-divider">·</span>
                          <span className="task-size">
                            {task.meta.totalSize && formatFileSize(task.meta.totalSize)}
                            {task.meta.videoSize && task.meta.metadataSize && ' | '}
                            {task.meta.videoSize && `视频: ${formatFileSize(task.meta.videoSize)}`}
                            {task.meta.metadataSize && ` | 元数据: ${formatFileSize(task.meta.metadataSize)}`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {task.state === 'active' && task.status?.progress !== undefined && (
                    <div className="task-progress">
                      <div
                        className="task-progress-bar"
                        style={{ width: `${task.status.progress}%` }}
                      >
                        <div />
                      </div>
                      <span className="task-progress-text">{task.status.progress}%</span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ConfirmModal */}
      <ConfirmModal
        isOpen={confirmModal.show}
        onClose={() => setConfirmModal({ ...confirmModal, show: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />
    </article>
  )
}