// components/NewDownload/TaskCard.tsx
import { useNewQueueStore, Task } from '../../stores/newQueue'
import { Play, Pause, Trash2, RefreshCw, Film } from 'lucide-react'

interface Props {
  task: Task
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 格式化ETA（预计剩余时间）
const formatETA = (seconds: number): string => {
  if (!seconds || seconds === 0 || seconds === Infinity) return '--'
  if (seconds < 60) return `${Math.floor(seconds)}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${Math.floor(seconds % 60)}秒`
  return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分`
}

export default function TaskCard({ task }: Props) {
  const { controlTask, getTaskProgress } = useNewQueueStore()
  const progress = getTaskProgress(task.id)

  const statusConfig: Record<string, { label: string; color: string }> = {
    'backlog': { label: '待处理', color: '#f59e0b' },
    'pending': { label: '已规划', color: '#3b82f6' },
    'active': { label: '下载中', color: '#10b981' },
    'paused': { label: '已暂停', color: '#f97316' },
    'failed': { label: '失败', color: '#ef4444' },
    'cancelled': { label: '已取消', color: '#6b7280' },
    'completed': { label: '已完成', color: '#22c55e' },
  }

  const status = statusConfig[task.state] || { label: task.state, color: '#6b7280' }
  const hasCover = task.cover && task.cover.trim()

  const handleControl = async (action: string) => {
    try {
      await controlTask(task.id, action)
    } catch (error) {
      console.error('Control failed:', error)
      const errorMessage = error instanceof Error ? error.message : '操作失败，请重试'
      alert(errorMessage)
    }
  }

  return (
    <article 
      className="video-card"
      style={{
        borderLeft: `4px solid ${status.color}`,
        cursor: 'default'
      }}
    >
      {/* 封面 */}
      <div className="video-card-cover">
        <div className="video-card-thumbnail">
          {!hasCover ? (
            <div className="thumbnail-placeholder">
              <Film size={40} color="#42a5f5" />
            </div>
          ) : (
            <img 
              src={task.cover} 
              alt={task.title} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const placeholder = e.currentTarget.parentElement?.querySelector('.thumbnail-placeholder')
                if (placeholder) {
                  (placeholder as HTMLElement).style.display = 'flex'
                }
              }}
            />
          )}
          {/* 进度叠加层 */}
          {task.state === 'active' && progress > 0 && (
            <div className="video-progress-overlay">
              <div
                className="video-progress-bar"
                style={{ 
                  width: `${progress}%`,
                  backgroundColor: status.color
                }}
              />
            </div>
          )}
          {/* 时长显示 */}
          {task.duration > 0 && (
            <div className="video-duration-overlay">
              {Math.floor(task.duration / 60)}:{(task.duration % 60).toString().padStart(2, '0')}
            </div>
          )}
        </div>
      </div>

      {/* 信息区域 */}
      <div className="video-card-info">
        <h3>{task.title}</h3>
        
        {/* 下载进度显示 */}
        {task.state === 'active' && progress > 0 && (
          <div className="video-download-progress">
            <div className="progress-text">
              下载中: {progress.toFixed(1)}%
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ 
                  width: `${progress}%`,
                  backgroundColor: status.color
                }}
              />
            </div>
          </div>
        )}

        {/* 元数据 */}
        <div className="video-card-meta">
          {/* 状态标签 */}
          <span 
            className="video-card-progress-text"
            style={{ color: status.color }}
          >
            {status.label}
          </span>
          
          {/* 进度百分比 */}
          {progress > 0 && (
            <span className="video-card-progress-text">
              {progress.toFixed(1)}%
            </span>
          )}

          {/* 文件大小 */}
          {task.meta?.fileSize && (
            <span className="video-card-file-size">
              {formatFileSize(task.meta.fileSize)}
            </span>
          )}

          {/* ETA */}
          {task.meta?.eta && task.state === 'active' && (
            <span className="video-card-eta">
              剩余{formatETA(task.meta.eta)}
            </span>
          )}

          {/* 操作按钮 */}
          <div className="video-card-actions-inline">
            {task.state === 'backlog' && (
              <>
                <button 
                  className="action-icon-btn start-icon-btn"
                  onClick={() => handleControl('active')}
                  title="开始下载"
                  aria-label="开始下载"
                >
                  <Play size={14} fill="currentColor" />
                </button>
                <button 
                  className="action-icon-btn delete-icon-btn"
                  onClick={() => handleControl('cancelled')}
                  title="删除"
                  aria-label="删除"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
            
            {task.state === 'active' && (
              <button 
                className="action-icon-btn pause-icon-btn"
                onClick={() => handleControl('paused')}
                title="暂停"
                aria-label="暂停下载"
              >
                <Pause size={14} />
              </button>
            )}
            
            {task.state === 'paused' && (
              <>
                <button 
                  className="action-icon-btn start-icon-btn"
                  onClick={() => handleControl('active')}
                  title="继续"
                  aria-label="继续下载"
                >
                  <Play size={14} fill="currentColor" />
                </button>
                <button 
                  className="action-icon-btn delete-icon-btn"
                  onClick={() => handleControl('cancelled')}
                  title="删除"
                  aria-label="删除"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
            
            {task.state === 'failed' && (
              <button 
                className="action-icon-btn start-icon-btn"
                onClick={() => handleControl('backlog')}
                title="重试"
                aria-label="重试下载"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
