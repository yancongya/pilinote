// components/NewDownload/TaskCard.tsx
import { Film, CheckCircle } from 'lucide-react'
import { Task } from '../../stores/newQueue'

interface Props {
  task: Task
}

// 代理图片URL，避免403错误
const getProxyImageUrl = (url: string | null | undefined): string => {
  if (!url) return ''
  return `http://localhost:8000/api/auth/proxy/avatar?url=${encodeURIComponent(url)}`
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

export default function TaskCard({ task }: Props) {
  const coverUrl = getProxyImageUrl(task.cover)
  const hasCover = task.cover && task.cover.trim()

  return (
    <article 
      className="scheduler-card"
      style={{
        borderLeft: `4px solid #22c55e`,
        marginBottom: '12px'
      }}
    >
      {/* 任务头部 */}
      <div className="scheduler-header">
        {/* 封面区域 */}
        {hasCover && (
          <div className="scheduler-cover">
            <div className="scheduler-cover-thumbnail">
              <img
                src={coverUrl}
                alt={task.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const placeholder = e.currentTarget.parentElement?.querySelector('.cover-placeholder')
                  if (placeholder) {
                    (placeholder as HTMLElement).style.display = 'flex'
                  }
                }}
              />
              <div className="cover-placeholder" style={{ display: 'none' }}>
                <Film size={32} color="#42a5f5" />
              </div>
            </div>
          </div>
        )}

        <div className="scheduler-info">
          <div className="scheduler-title">
            <h3>{task.title}</h3>
            <div className="scheduler-meta">
              <span className="status-badge" style={{ backgroundColor: '#22c55e20', color: '#22c55e' }}>
                <CheckCircle size={12} />
                已完成
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* 创建时间 */}
      <div className="scheduler-time">
        完成时间: {formatTimestamp(task.updated_at)}
      </div>
    </article>
  )
}