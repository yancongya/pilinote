// components/NewDownload/TaskCard.tsx
import { useNewQueueStore, Task, DownloadStage } from '../../stores/newQueue'
import { Play, Pause, Trash2, RefreshCw, Film, Square } from 'lucide-react'
import { getApiBaseUrl, getAvatarProxyUrl } from '../../config/api'
import { useToast } from '../Toast'

interface Props {
  task: Task
  isBatchMode?: boolean
  isSelected?: boolean
  onSelect?: () => void
}

// 代理图片URL，避免403错误
const getProxyImageUrl = (url: string | null | undefined): string => {
  if (!url) return ''
  
  // 检查是否为本地文件路径（绝对路径）
  if (url.startsWith('/') || url.startsWith('file://')) {
    // 使用视频库图片代理
    const cleanPath = url.replace('file://', '')
    return `${getApiBaseUrl()}/api/library/image?file_path=${encodeURIComponent(cleanPath)}`
  }
  
  // 使用头像代理
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
  const { showToast } = useToast()

  const handleCardClick = () => {
    if (isBatchMode && onSelect) {
      onSelect()
    }
  }

  const statusConfig: Record<string, { label: string; color: string; icon?: string }> = {
    'backlog': { label: '待处理', color: 'var(--color-warning-500)' },
    'pending': { label: '已规划', color: 'var(--color-primary-500)' },
    'active': { label: '进行中', color: 'var(--color-success-500)' },
    'paused': { label: '已暂停', color: 'var(--color-warning-600)' },
    'failed': { label: '失败', color: 'var(--color-error-500)' },
    'cancelled': { label: '已取消', color: 'var(--color-secondary-500)' },
    'completed': { label: '已完成', color: 'var(--color-success-500)' },
  }

  const status = statusConfig[task.state] || { label: task.state, color: 'var(--color-secondary-500)' }
  const hasCover = task.cover && task.cover.trim()

  const handleControl = async (action: string) => {
    try {
      await controlTask(task.id, action)
    } catch (error) {
      console.error('Control failed:', error)
      const errorMessage = error instanceof Error ? error.message : '操作失败，请重试'
      showToast(errorMessage, 'error')
    }
  }

  // 计算文件大小信息（从元数据或状态中获取）
  const getFileSizeInfo = () => {
    if (task.state === 'active' && task.status?.total > 0) {
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
      className={`video-card ${isBatchMode ? 'cursor-pointer' : 'cursor-default'}`}
      data-selected={isSelected && isBatchMode}
      style={{
        borderLeft: `4px solid ${status.color}`,
        ...(isSelected && isBatchMode && { backgroundColor: 'var(--color-primary-50)' })
      }}
      onClick={handleCardClick}
    >
      {/* 批量选择复选框 */}
      {isBatchMode && (
        <div
          className="batch-checkbox absolute top-2 left-2 z-10 flex items-center justify-center cursor-pointer p-1 bg-white/90 rounded w-6 h-6 min-w-6"
          onClick={(e) => {
            e.stopPropagation()
            onSelect?.()
          }}
        >
          {isSelected ? (
            <div className="w-4 h-4 rounded-sm flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-500)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          ) : (
            <Square size={16} color="var(--color-text-secondary)" />
          )}
        </div>
      )}

      {/* 封面 */}
      <div className="video-card-cover">
        <div className="video-card-thumbnail">
          {!hasCover ? (
            <div className="thumbnail-placeholder">
              <Film size={40} color="var(--color-primary-500)" />
            </div>
          ) : (
            <img
              src={coverUrl}
              alt={task.title}
              className="w-full h-full object-cover"
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

        {/* 信息行1：状态/文件大小 或 下载进度信息 */}
        <div className="video-card-info-row">
          {/* 下载进度信息行 - 始终渲染，通过opacity控制显示 */}
          <div className={`info-row download-info-row ${task.state === 'active' ? 'visible' : 'hidden'}`}>
            <div className="download-details">
              {task.status?.stage && (
                <span className="detail-item stage-label">
                  {getStageText(task.status.stage)}
                </span>
              )}
              {task.status?.downloaded > 0 && task.status?.total > 0 && (
                <span className="detail-item size-label">
                  {formatFileSize(task.status.downloaded)} / {formatFileSize(task.status.total)}
                </span>
              )}
              <span className="detail-item progress-label">
                {progress.toFixed(1)}%
              </span>
              {task.status?.speed > 0 && (
                <span className="detail-item speed-label">
                  {formatSpeed(task.status.speed)}
                </span>
              )}
            </div>
          </div>

          {/* 元数据信息行 - 始终渲染，通过opacity控制显示 */}
          <div className={`info-row meta-info-row ${task.state !== 'active' ? 'visible' : 'hidden'}`}>
            {/* 状态标签 */}
            {task.state !== 'completed' && (
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

            {/* 文件夹信息（仅视频库中的文件夹任务显示） */}
            {task.meta?.file_count && (
              <span className="video-card-file-size">
                {task.meta.file_count} 个视频
                {fileSizeInfo && fileSizeInfo.total && ` | 总计: ${fileSizeInfo.total}`}
              </span>
            )}

            {/* 文件大小（非文件夹任务） */}
            {!task.meta?.file_count && fileSizeInfo && (
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
          </div>
        </div>

        {/* 信息行2：进度条 或 操作按钮 */}
        <div className="video-card-info-row">
          {/* 进度条行 - 始终渲染，通过opacity控制显示 */}
          <div className={`info-row progress-row ${task.state === 'active' ? 'visible' : 'hidden'}`}>
            <div className="progress-bar-with-action">
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: status.color
                  }}
                />
              </div>
              {/* 活跃状态下的操作按钮（和进度条同一行） */}
              <div className="video-card-actions-inline progress-actions">
                <button
                  className="action-icon-btn pause-icon-btn"
                  onClick={() => handleControl('paused')}
                  title="暂停"
                  aria-label="暂停下载"
                >
                  <Pause size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* 操作按钮行 - 始终渲染，通过opacity控制显示 */}
          <div className={`info-row actions-row ${task.state !== 'active' ? 'visible' : 'hidden'}`}>
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
      </div>
    </article>
  )
}
