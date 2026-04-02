// components/NewDownload/SchedulerCard.tsx
import { useNewQueueStore, Task } from '../../stores/newQueue'
import TaskCard from './TaskCard'
import { Play, Pause, Square } from 'lucide-react'

interface Props {
  schedulerId: string
  tasks: Task[]
}

export default function SchedulerCard({ schedulerId, tasks }: Props) {
  const { schedulers, controlScheduler } = useNewQueueStore()
  const scheduler = schedulers[schedulerId]

  if (!scheduler) return null

  const statusConfig: Record<string, { label: string; color: string }> = {
    'idle': { label: '空闲', color: '#6b7280' },
    'running': { label: '运行中', color: '#10b981' },
    'paused': { label: '已暂停', color: '#f97316' },
    'completed': { label: '已完成', color: '#22c55e' },
    'failed': { label: '失败', color: '#ef4444' },
    'cancelled': { label: '已取消', color: '#6b7280' },
  }

  const status = statusConfig[scheduler.state] || { label: scheduler.state, color: '#6b7280' }

  const handleControl = async (action: string) => {
    try {
      await controlScheduler(schedulerId, action)
    } catch (error) {
      console.error('Control failed:', error)
    }
  }

  return (
    <div className="scheduler-card">
      <div className="scheduler-header">
        <div className="scheduler-info">
          <h3 className="scheduler-title">{scheduler.title}</h3>
          <div className="scheduler-meta">
            <span className="status" style={{ color: status.color }}>{status.label}</span>
            <span className="task-count">{tasks.length} 个任务</span>
          </div>
        </div>
        <div className="scheduler-actions">
          {scheduler.state === 'idle' && (
            <button onClick={() => handleControl('start')} title="开始">
              <Play size={16} />
            </button>
          )}
          {scheduler.state === 'running' && (
            <button onClick={() => handleControl('pause')} title="暂停">
              <Pause size={16} />
            </button>
          )}
          {scheduler.state === 'paused' && (
            <button onClick={() => handleControl('resume')} title="继续">
              <Play size={16} />
            </button>
          )}
          {['running', 'paused'].includes(scheduler.state) && (
            <button onClick={() => handleControl('cancel')} title="取消">
              <Square size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="scheduler-tasks">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}
