// components/NewDownload/TaskCard.tsx
import { useNewQueueStore, Task, DownloadStage } from '../../stores/newQueue'
import { Play, Pause, Trash2, RefreshCw, Film, Square } from 'lucide-react'
import { getAvatarProxyUrl } from '../../config/api'

interface Props {
  task: Task
  isBatchMode?: boolean
  isSelected?: boolean
  onSelect?: () => void
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

// 格式化下载速度
const formatSpeed = (bytes: number): string => {
  if (!bytes || bytes === 0) return '--'
  return formatFileSize(bytes) + '/s'
}

// 获取阶段显示文本
const getStageText = (stage: DownloadStage): string => {
  const stageMap: Record<DownloadStage, string> = {
    'preparing': '准备中',
    'downloading': '下载视频',
    'moving': '移动文件',
    'post_processing': '后处理中',
    'completed': '已完成'
  }
  return stageMap[stage] || stage
}

export default function TaskCard({ task, isBatchMode = false, isSelected = false, onSelect }: Props) {
  const { controlTask, getTaskProgress } = useNewQueueStore()
  const progress = getTaskProgress(task.id)
  const coverUrl = getProxyImageUrl(task.cover)

  const handleCardClick = () => {
    if (isBatchMode && onSelect) {
      onSelect()
    }
  }

  const statusConfig: Record<string, { label: string; color: string; icon?: string }> = {
    'backlog': { label: '待处理', color: '#f59e0b' },
    'pending': { label: '已规划', color: '#3b82f6' },
    'active': { label: '进行中', color: '#10b981' },
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

  // 计算文件大小信息（从元数据或状态中获取）
  const getFileSizeInfo = () => {
    if (task.state === 'active' && task.status.total > 0) {
      return {
        total: formatFileSize(task.status.total),
        video: formatFileSize(task.status.downloaded),
        metadata: null
      }
    }
    if (task.meta?.totalSize || task.meta?.videoSize || task.meta?.metadataSize) {
      return {
        total: task.meta.totalSize ? formatFileSize(task.meta.totalSize) : null,
        video: task.meta.videoSize ? formatFileSize(task.meta.videoSize) : null,
        metadata: task.meta.metadataSize ? formatFileSize(task.meta.metadataSize) : null
      }
    }
    return null
  }

  const fileSizeInfo = getFileSizeInfo()

  return (
    <article
      className="video-card"
      data-selected={isSelected && isBatchMode}
      style={{
        borderLeft: `4px solid ${status.color}`,
        cursor: isBatchMode ? 'pointer' : 'default',
        ...(isSelected && isBatchMode && { backgroundColor: '#f0f9ff' })
      }}
      onClick={handleCardClick}
    >
      {/* 批量选择复选框 */}
      {isBatchMode && (
        <div 
          className="batch-checkbox"
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '4px',
            width: '24px',
            height: '24px',
            minWidth: '24px'
          }}
          onClick={(e) => {
            e.stopPropagation()
            onSelect?.()
          }}
        >
          {isSelected ? (
            <div style={{
              width: '16px',
              height: '16px',
              backgroundColor: '#3b82f6',
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          ) : (
            <Square size={16} color="#64748b" />
          )}
        </div>
      )}

      {/* 封面 */}
      <div className="video-card-cover">
        <div className="video-card-thumbnail">
          {!hasCover ? (
            <div className="thumbnail-placeholder">
              <Film size={40} color="#42a5f5" />
            </div>
          ) : (
            <img
              src={coverUrl}
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

        {/* 下载进度显示（仅在下载中时显示） */}
        {task.state === 'active' && (progress > 0 || task.status.stage) && (
          <div className="video-download-progress">
            <div className="download-details">
              {/* 只显示当前阶段，不重复显示"下载中" */}
              {task.status.stage && (
                <span className="detail-item stage-label">
                  {getStageText(task.status.stage)}
                </span>
              )}
              {task.status.downloaded > 0 && task.status.total > 0 && (
                <span className="detail-item size-label">
                  {formatFileSize(task.status.downloaded)} / {formatFileSize(task.status.total)}
                </span>
              )}
              <span className="detail-item progress-label">
                {progress.toFixed(1)}%
              </span>
              {task.status.speed > 0 && (
                <span className="detail-item speed-label">
                  {formatSpeed(task.status.speed)}
                </span>
              )}
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

        {/* 元数据区域 */}
        <div className="video-card-meta">
          {/* 状态标签（仅在非活跃状态时显示，避免重复） */}
          {task.state !== 'completed' && task.state !== 'active' && (
            <span
              className="video-card-status-badge"
              style={{ 
                color: status.color,
                backgroundColor: `${status.color}15`
              }}
            >
              {status.label}
            </span>
          )}

          {/* 文件大小（仅在非活跃状态或下载完成时显示） */}
          {fileSizeInfo && task.state !== 'active' && (
            <span className="video-card-file-size">
              {fileSizeInfo.total && (
                <>
                  {fileSizeInfo.total}
                  {fileSizeInfo.video && fileSizeInfo.metadata && ' | '}
                  {fileSizeInfo.video && `视频: ${fileSizeInfo.video}`}
                  {fileSizeInfo.metadata && ` | 元数据: ${fileSizeInfo.metadata}`}
                </>
              )}
              {!fileSizeInfo.total && fileSizeInfo.video && `视频: ${fileSizeInfo.video}`}
            </span>
          )}

          {/* 操作按钮区域 */}
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
              <>
                <button
                  className="action-icon-btn start-icon-btn"
                  onClick={() => handleControl('backlog')}
                  title="重试"
                  aria-label="重试下载"
                >
                  <RefreshCw size={14} />
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

            {task.state === 'completed' && (
              <>
                <button
                  className="action-icon-btn start-icon-btn"
                  onClick={() => handleControl('backlog')}
                  title="重新下载"
                  aria-label="重新下载"
                >
                  <RefreshCw size={14} />
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
          </div>
        </div>
      </div>
    </article>
  )
}
