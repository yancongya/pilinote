// components/NewDownload/SchedulerCard.tsx
import { useState, useMemo } from 'react'
import { useNewQueueStore, Scheduler, Task } from '../../stores/newQueue'
import { Play, Pause, Trash2, ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'

interface Props {
  scheduler: Scheduler
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

export default function SchedulerCard({ scheduler }: Props) {
  const { tasks, controlScheduler } = useNewQueueStore()
  const [isExpanded, setIsExpanded] = useState(false)
  
  const progress = useMemo(() => calculateSchedulerProgress(scheduler, tasks), [scheduler, tasks])
  const schedulerTasks = useMemo(() => {
    return scheduler.list
      .map(taskId => tasks[taskId])
      .filter(Boolean) as Task[]
  }, [scheduler.list, tasks])
  
  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    'idle': { label: '待处理', color: '#f59e0b', icon: Clock },
    'running': { label: '执行中', color: '#10b981', icon: Loader2 },
    'paused': { label: '已暂停', color: '#f97316', icon: Pause },
    'completed': { label: '已完成', color: '#22c55e', icon: CheckCircle },
    'failed': { label: '失败', color: '#ef4444', icon: XCircle },
    'cancelled': { label: '已取消', color: '#6b7280', icon: XCircle },
  }
  
  const status = statusConfig[scheduler.state] || { label: '未知', color: '#6b7280', icon: Clock }
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
  
  return (
    <article 
      className="scheduler-card"
      style={{
        borderLeft: `4px solid ${status.color}`,
        marginBottom: '12px'
      }}
    >
      {/* 调度器头部 */}
      <div className="scheduler-header">
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
              <span className="status-badge" style={{ backgroundColor: `${status.color}20`, color: status.color }}>
                <StatusIcon size={12} />
                {status.label}
              </span>
              <span className="task-count">
                {completedCount}/{totalCount} 任务
              </span>
            </div>
          </div>
        </div>
        
        <div className="scheduler-controls">
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
          {scheduler.state !== 'completed' && scheduler.state !== 'cancelled' && (
            <button 
              onClick={() => handleControl('cancel')}
              title="取消"
              aria-label="取消调度器"
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
            schedulerTasks.map(task => (
              <div key={task.id} className="scheduler-task-item">
                <div className="task-info">
                  <span className="task-title">{task.title}</span>
                  <span className="task-state" style={{ color: status.color }}>
                    {statusConfig[task.state]?.label || task.state}
                  </span>
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
            ))
          )}
        </div>
      )}
    </article>
  )
}