import { useNavigate } from 'react-router-dom'
import { Film, Eye, MessageSquare, ThumbsUp, Coins, Star, MessageCircle, Share2, Download, Plus, Play, Trash2, RefreshCw, Users, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { apiService } from '../../services/api'
import { getAvatarProxyUrl } from '../../config/api'

interface VideoCardProps {
  id: string
  bvid: string
  title: string
  cover: string
  duration: string
  uploader: string
  views: string
  comments: string
  time: string
  // 新增统计字段
  danmaku?: string
  likes?: string
  coins?: string
  favorites?: string
  shares?: string
  progress?: number
  watched?: string
  fileSize?: number  // 新增：文件大小（字节）
  seriesCount?: number // 新增：系列集数
  // 下载进度字段
  downloaded_bytes?: number
  total_bytes?: number
  download_speed?: number
  eta?: number
  // 视频详细信息字段（用于下载）
  cid?: number
  aid?: number
  originalDuration?: number
  owner?: { name: string; mid: number }
  pubtime?: number
  pic?: string
  onDownloadToggle?: (video: any, e: React.MouseEvent) => void
  downloadStatus?: 'none' | 'in_list' | 'downloaded'
  showDownloadButton?: boolean
  isSeries?: boolean
  onVideoClick?: (video: any) => void
  clickable?: boolean
  showActionButtons?: boolean
  onActionStart?: () => void
  onActionPause?: () => void
  onActionDelete?: () => void
  canStart?: boolean
  canPause?: boolean
  // 批量选择相关
  batchMode?: boolean
  // 是否显示下载进度（仅下载列表使用）
  showDownloadProgress?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

// Bilibili风格：格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 格式化下载速度
const formatDownloadSpeed = (bytesPerSecond: number): string => {
  if (!bytesPerSecond || bytesPerSecond === 0) return '0 B/s'
  return formatFileSize(bytesPerSecond) + '/s'
}

// 格式化ETA（预计剩余时间）
const formatETA = (seconds: number): string => {
  if (!seconds || seconds === 0 || seconds === Infinity) return '--'
  if (seconds < 60) return `${Math.floor(seconds)}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${Math.floor(seconds % 60)}秒`
  return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分`
}

export default function VideoListCard({
  id,
  bvid,
  title,
  cover,
  duration,
  uploader,
  views,
  comments,
  time,
  danmaku,
  likes,
  coins,
  favorites,
  shares,
  progress,
  watched,
  fileSize,
  seriesCount,
  downloaded_bytes,
  total_bytes,
  download_speed,
  eta,
  cid,
  aid,
  originalDuration,
  owner,
  pubtime,
  pic,
  onDownloadToggle,
  downloadStatus = 'none',
  showDownloadButton = true,
  isSeries = false,
  onVideoClick,
  clickable,
  showActionButtons = false,
  onActionStart,
  onActionPause,
  onActionDelete,
  canStart = false,
  canPause = false,
  batchMode = false,
  showDownloadProgress = false,
  selected = false,
  onToggleSelect,
}: VideoCardProps) {
  const navigate = useNavigate()
  
  // 批量模式下卡片始终可点击（用于选中），否则默认可点击除非明确设置为false
  const isClickable = batchMode || clickable !== false
  
  // 状态管理
  const [fetchedCoverUrl, setFetchedCoverUrl] = useState<string>('')
  
  // 从bvid获取封面URL
  const getCoverUrl = (): string => {
    if (cover && cover.trim()) {
      return cover
    }
    return fetchedCoverUrl
  }
  
  // 当没有封面且有bvid时，从B站API获取封面
  useEffect(() => {
    if (!cover || !cover.trim()) {
      if (bvid) {
        fetchVideoCover()
      }
    }
  }, [bvid, cover])
  
  const fetchVideoCover = async () => {
    try {
      const response = await apiService.getVideoDetail(bvid)
      if (response.success && response.data?.pic) {
        setFetchedCoverUrl(response.data.pic)
      }
    } catch (error) {
      console.error('获取视频封面失败:', error)
    }
  }

  const getProxyImageUrl = (url: string | null | undefined): string => {
    if (!url) return ''
    return getAvatarProxyUrl(url)
  }

  const handleVideoClick = () => {
    if (!isClickable) {
      // 不可点击，不执行任何操作
      return
    }

    // 批量模式下，点击卡片触发选择
    if (batchMode && onToggleSelect) {
      onToggleSelect()
      return
    }
    
    if (onVideoClick) {
      // 如果有自定义的点击处理，执行它并阻止默认行为
      onVideoClick({ id, bvid, title, cover, duration, uploader, views, comments, time })
      return
    }
    
    // 默认导航逻辑
    if (isSeries) {
      // 系列视频跳转到下载详情页
      navigate(`/downloads/${bvid}`)
    } else {
      // 单个视频跳转到视频详情页
      navigate(`/video/${bvid}`)
    }
  }

  // 获取封面URL
  const coverUrl = getCoverUrl()
  const hasCover = coverUrl && coverUrl.trim()

  return (
    <article 
      className={`video-card ${batchMode ? 'batch-mode' : ''} ${selected ? 'selected' : ''}`}
      onClick={isClickable ? handleVideoClick : undefined}
      style={{ cursor: isClickable ? 'pointer' : 'default' }}
    >
      <div className="video-card-cover">
        <div className="video-card-thumbnail">
          {!hasCover ? (
                <div className="thumbnail-placeholder">
                  <Film size={48} color="#42a5f5" />
                </div>
              ) : (
                <>
                  <img 
                    src={getProxyImageUrl(coverUrl)} 
                    alt={title} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      // 图片加载失败时显示占位符
                      e.currentTarget.style.display = 'none'
                      const placeholder = e.currentTarget.parentElement?.querySelector('.thumbnail-placeholder')
                      if (placeholder) {
                        (placeholder as HTMLElement).style.display = 'flex'
                      }
                    }}
                  />
                  <div className="thumbnail-placeholder" style={{ display: 'none' }}>
                    <Film size={48} color="#42a5f5" />
                  </div>
                </>
              )}
          {/* Bilibili风格：所有视频都显示时长（右下角） */}
          {duration && <div className="video-duration-overlay">{duration}</div>}
          {/* Bilibili风格：系列视频额外显示集数（左下角） */}
          {isSeries && seriesCount && (
            <div className="video-series-count-overlay">
              <Users size={12} />
              <span>{seriesCount}集</span>
            </div>
          )}
          {showDownloadProgress && progress !== undefined && progress > 0 && (
            <div className="video-progress-overlay">
              <div
                className="video-progress-bar"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}
        </div>
      </div>
      <div className="video-card-info">
        <h3 title={title}>{title}</h3>
        {/* 下载进度显示 - 仅在下载列表显示 */}
        {showDownloadProgress && progress !== undefined && progress > 0 && (
          <div className="video-download-progress">
            <div className="progress-text">
              下载中: {formatFileSize(downloaded_bytes || 0)} / {formatFileSize(total_bytes || 0)}
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="progress-stats">
              {download_speed !== undefined && download_speed > 0 && (
                <span className="progress-speed">{formatDownloadSpeed(download_speed)}</span>
              )}
              {eta !== undefined && eta > 0 && eta !== Infinity && (
                <span className="progress-eta">剩余{formatETA(eta)}</span>
              )}
            </div>
          </div>
        )}
        <div className="video-card-meta" title={`${uploader} · ${time}${watched ? ` · ${watched}` : ''}`}>
          {/* 下载列表：显示下载速度和进度 */}
          {showActionButtons ? (
            <>
              {download_speed !== undefined && download_speed > 0 && (
                <span className="video-card-download-speed" style={{ color: '#42a5f5', fontWeight: 'bold' }}>
                  {formatDownloadSpeed(download_speed)}
                </span>
              )}
              {showDownloadProgress && progress !== undefined && progress > 0 && (
                <span className="video-card-progress-text">
                  {Math.round(progress)}%
                </span>
              )}
              {fileSize !== undefined && !showDownloadProgress && (
                <span className="video-card-file-size">
                  {formatFileSize(fileSize)}
                </span>
              )}
              {eta !== undefined && eta > 0 && eta !== Infinity && (
                <span className="video-card-eta" style={{ color: '#666', fontSize: '12px' }}>
                  剩余{formatETA(eta)}
                </span>
              )}
            </>
          ) : (
            <>
              {/* 视频列表：显示上传者、时间等 */}
              <span className="video-card-uploader" title={`上传者：${uploader}`}>{uploader}</span>
              <span className="video-card-time" title={`发布时间：${time}`}>{time}</span>
              {watched && <span className="video-card-watched" title={`观看进度：${watched}`}>{watched}</span>}
              {fileSize !== undefined && (
                <span className="video-card-file-size" title={`文件大小：${formatFileSize(fileSize)}`}>
                  {formatFileSize(fileSize)}
                </span>
              )}
            </>
          )}
          {/* 操作按钮 - 在元数据行中显示 */}
          {showActionButtons && (
            <div className="video-card-actions-inline">
              {canStart && onActionStart && (
                <button 
                  className="action-icon-btn start-icon-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onActionStart()
                  }}
                  aria-label="开始下载"
                >
                  <Play size={14} />
                </button>
              )}
              {canPause && onActionPause && (
                <button 
                  className="action-icon-btn pause-icon-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onActionPause()
                  }}
                  aria-label="暂停下载"
                >
                  <RefreshCw size={14} />
                </button>
              )}
              {onActionDelete && (
                <button 
                  className="action-icon-btn delete-icon-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onActionDelete()
                  }}
                  aria-label="删除"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>
          
          {/* 只在非操作按钮模式下显示统计信息 */}
          {!showActionButtons && (
            <div className="video-card-stats">
              <Eye size={12} />
              <span>{views}</span>
              <MessageSquare size={12} />
              <span>{danmaku !== undefined ? danmaku : '0'}</span>
              <ThumbsUp size={12} />
              <span>{likes !== undefined ? likes : '0'}</span>
              <Coins size={12} />
              <span>{coins !== undefined ? coins : '0'}</span>
              <Star size={12} />
              <span>{favorites !== undefined ? favorites : '0'}</span>
              <MessageCircle size={12} />
              <span>{comments !== undefined ? comments : '0'}</span>
              <Share2 size={12} />
              <span>{shares !== undefined ? shares : '0'}</span>
              {(fileSize || (isSeries && seriesCount)) && (
                <span className="video-card-size">
                  {isSeries && seriesCount ? `${seriesCount}集` : formatFileSize(fileSize || 0)}
                </span>
              )}
            </div>
          )}
      </div>
      {/* 批量模式显示复选框，正常模式显示下载按钮 */}
      {batchMode && onToggleSelect && (
        <button
          className="video-card-checkbox-btn"
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect()
          }}
          aria-label={selected ? '取消选择' : '选择'}
          title={selected ? '取消选择' : '选择'}
          style={{
            backgroundColor: selected ? '#fb7299' : 'white',
            borderColor: selected ? '#fb7299' : '#ddd',
          }}
        >
          {selected && <Check size={18} color="white" />}
        </button>
      )}
      {!batchMode && showDownloadButton && onDownloadToggle && (
        <button
          className="video-card-download-btn"
          onClick={(e) => {
            e.stopPropagation()
            const videoData = {
              id, bvid, title, cover, duration, uploader, views, comments, time,
              cid, aid, originalDuration, owner, pubtime, pic: pic || cover
            }
            onDownloadToggle(videoData, e)
          }}
          aria-label={
            downloadStatus === 'in_list' ? '从下载列表移除' :
            downloadStatus === 'downloaded' ? '重新下载' :
            '添加到下载列表'
          }
          title={
            downloadStatus === 'in_list' ? '从下载列表移除' :
            downloadStatus === 'downloaded' ? '重新下载' :
            '添加到下载'
          }
          style={{
            backgroundColor: downloadStatus === 'in_list' ? '#fb7299' :
                         downloadStatus === 'downloaded' ? '#22c55e' :
                         'white',
            borderColor: downloadStatus === 'in_list' ? '#fb7299' :
                        downloadStatus === 'downloaded' ? '#22c55e' :
                        '#ddd',
            color: downloadStatus === 'in_list' ? 'white' :
                   downloadStatus === 'downloaded' ? 'white' :
                   '#999',
            cursor: 'pointer'
          }}
        >
          {downloadStatus === 'in_list' && <Download size={16} />}
          {downloadStatus === 'downloaded' && <Check size={16} />}
          {downloadStatus === 'none' && <Plus size={16} />}
        </button>
      )}
    </article>
  )
}
