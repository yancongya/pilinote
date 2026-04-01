import { useNavigate } from 'react-router-dom'
import { Film, Eye, MessageCircle, Download, Plus, Play, Trash2, ThumbsUp, Coins, Star, Share2, MessageSquare, RefreshCw, Users, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { apiService } from '../../services/api'

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
  onDownloadToggle?: (video: any, e: React.MouseEvent) => void
  downloadStatus?: 'none' | 'in_list'
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
    return `http://localhost:8000/api/auth/proxy/avatar?url=${encodeURIComponent(url)}`
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
          {progress !== undefined && progress > 0 && (
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
        <h3>{title}</h3>
        <div className="video-card-meta">
          <span className="video-card-uploader">{uploader}</span>
          <span className="video-card-time">{time}</span>
          {watched && <span className="video-card-watched">{watched}</span>}
          {/* Bilibili风格：显示文件大小 */}
          {showActionButtons && (
            <span className="video-card-file-size">
              {fileSize !== undefined ? formatFileSize(fileSize) : views}
            </span>
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
              <span className="stat-item" title="播放量">
                <Eye />
                {views}
              </span>
              {danmaku !== undefined && (
                <span className="stat-item" title="弹幕数">
                  <MessageSquare />
                  {danmaku}
                </span>
              )}
              {comments !== undefined && (
                <span className="stat-item" title="评论数">
                  <MessageCircle />
                  {comments}
                </span>
              )}
              {likes !== undefined && (
                <span className="stat-item" title="点赞数">
                  <ThumbsUp />
                  {likes}
                </span>
              )}
              {coins !== undefined && (
                <span className="stat-item" title="投币数">
                  <Coins />
                  {coins}
                </span>
              )}
              {favorites !== undefined && (
                <span className="stat-item" title="收藏数">
                  <Star />
                  {favorites}
                </span>
              )}
              {shares !== undefined && (
                <span className="stat-item" title="转发数">
                  <Share2 />
                  {shares}
                </span>
              )}
              {/* Bilibili风格：在底部显示文件大小 */}
              {(fileSize || (isSeries && seriesCount)) && (
                <div className="video-card-size">
                  {isSeries && seriesCount ? (
                    <>{seriesCount}集</>
                  ) : (
                    formatFileSize(fileSize || 0)
                  )}
                </div>
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
          onClick={(e) => onDownloadToggle({ id, bvid, title, cover, duration, uploader, views, comments, time, cid, aid, originalDuration, owner, pubtime, pic: cover }, e)}
          aria-label={downloadStatus === 'in_list' ? '从下载列表移除' : '添加到下载列表'}
          title={downloadStatus === 'in_list' ? '从下载列表移除' : '添加到下载'}
          style={{
            backgroundColor: downloadStatus === 'in_list' ? '#fb7299' : 'white',
            borderColor: downloadStatus === 'in_list' ? '#fb7299' : '#ddd',
            color: downloadStatus === 'in_list' ? 'white' : '#999',
            cursor: 'pointer'
          }}
        >
          {downloadStatus === 'in_list' && <Download size={16} />}
          {downloadStatus === 'none' && <Plus size={16} />}
        </button>
      )}
    </article>
  )
}
