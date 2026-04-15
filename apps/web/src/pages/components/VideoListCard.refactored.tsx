/**
 * 视频列表卡片组件（重构版）
 * Video List Card Component (Refactored)
 * 
 * 使用styled-components重构的视频卡片组件
 * 支持多种显示模式和主题切换
 */

import { useNavigate } from 'react-router-dom'
import { Film, Eye, MessageSquare, ThumbsUp, Coins, Star, MessageCircle, Share2, Download, Plus, Play, Trash2, RefreshCw, Users, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { apiService } from '../../services/api'
import { getAvatarProxyUrl } from '../../config/api'
import {
  VideoCard,
  VideoCardCover,
  VideoCardThumbnail,
  CoverImage,
  ThumbnailPlaceholder,
  VideoDurationOverlay,
  VideoSeriesCountOverlay,
  VideoProgressOverlay,
  VideoProgressBar,
  VideoCardInfo,
  VideoTitle,
  VideoDownloadProgress,
  VideoCardMeta,
  VideoUploader,
  VideoTime,
  VideoWatched,
  VideoFileSize,
  VideoCardActionsInline,
  ActionIconButton,
  VideoCardStats,
  VideoCardDownloadBtn,
  VideoCardCheckboxBtn,
  VideoDownloadSpeed,
  VideoProgressText,
  VideoETA
} from '../styles/VideoListCard.styles'

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
  fileSize?: number
  seriesCount?: number
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
  selected?: boolean
  onToggleSelect?: () => void
  showDownloadProgress?: boolean
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
      return
    }

    // 批量模式下，点击卡片触发选择
    if (batchMode && onToggleSelect) {
      onToggleSelect()
      return
    }
    
    if (onVideoClick) {
      onVideoClick({ id, bvid, title, cover, duration, uploader, views, comments, time })
      return
    }
    
    // 默认导航逻辑
    if (isSeries) {
      navigate(`/downloads/${bvid}`)
    } else {
      navigate(`/video/${bvid}`)
    }
  }

  // 获取封面URL
  const coverUrl = getCoverUrl()
  const hasCover = coverUrl && coverUrl.trim()

  return (
    <VideoCard 
      $batchMode={batchMode}
      $selected={selected}
      $clickable={isClickable}
      onClick={isClickable ? handleVideoClick : undefined}
    >
      <VideoCardCover>
        <VideoCardThumbnail>
          {!hasCover ? (
                <ThumbnailPlaceholder>
                  <Film size={48} className="film-icon" />
                </ThumbnailPlaceholder>
              ) : (
                <>
                  <CoverImage
                    src={getProxyImageUrl(coverUrl)}
                    alt={title}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const placeholder = e.currentTarget.parentElement?.querySelector('.thumbnail-placeholder')
                      if (placeholder) {
                        (placeholder as HTMLElement).style.display = 'flex'
                      }
                    }}
                  />
                  <ThumbnailPlaceholder className="hidden">
                    <Film size={48} className="film-icon" />
                  </ThumbnailPlaceholder>
                </>
              )}
          {duration && <VideoDurationOverlay>{duration}</VideoDurationOverlay>}
          {isSeries && seriesCount && (
            <VideoSeriesCountOverlay>
              <Users size={12} />
              <span>{seriesCount}集</span>
            </VideoSeriesCountOverlay>
          )}
          {showDownloadProgress && progress !== undefined && progress > 0 && (
            <VideoProgressOverlay>
              <VideoProgressBar $progress={progress} />
            </VideoProgressOverlay>
          )}
        </VideoCardThumbnail>
      </VideoCardCover>
      
      <VideoCardInfo>
        <VideoTitle title={title}>{title}</VideoTitle>
        
        {showDownloadProgress && progress !== undefined && progress > 0 && (
          <VideoDownloadProgress>
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
                <VideoDownloadSpeed>{formatDownloadSpeed(download_speed)}</VideoDownloadSpeed>
              )}
              {eta !== undefined && eta > 0 && eta !== Infinity && (
                <VideoETA>剩余{formatETA(eta)}</VideoETA>
              )}
            </div>
          </VideoDownloadProgress>
        )}
        
        <VideoCardMeta>
          {showActionButtons ? (
            <>
              {download_speed !== undefined && download_speed > 0 && (
                <VideoDownloadSpeed>{formatDownloadSpeed(download_speed)}</VideoDownloadSpeed>
              )}
              {showDownloadProgress && progress !== undefined && progress > 0 && (
                <VideoProgressText>{Math.round(progress)}%</VideoProgressText>
              )}
              {fileSize !== undefined && !showDownloadProgress && (
                <VideoFileSize>{formatFileSize(fileSize)}</VideoFileSize>
              )}
              {eta !== undefined && eta > 0 && eta !== Infinity && (
                <VideoETA>剩余{formatETA(eta)}</VideoETA>
              )}
            </>
          ) : (
            <>
              <VideoUploader title={`上传者：${uploader}`}>{uploader}</VideoUploader>
              <VideoTime title={`发布时间：${time}`}>{time}</VideoTime>
              {watched && <VideoWatched title={`观看进度：${watched}`}>{watched}</VideoWatched>}
              {fileSize !== undefined && (
                <VideoFileSize title={`文件大小：${formatFileSize(fileSize)}`}>
                  {formatFileSize(fileSize)}
                </VideoFileSize>
              )}
            </>
          )}
          
          {showActionButtons && (
            <VideoCardActionsInline>
              {canStart && onActionStart && (
                <ActionIconButton 
                  $variant="start"
                  onClick={(e) => {
                    e.stopPropagation()
                    onActionStart()
                  }}
                  aria-label="开始下载"
                >
                  <Play size={14} />
                </ActionIconButton>
              )}
              {canPause && onActionPause && (
                <ActionIconButton 
                  $variant="pause"
                  onClick={(e) => {
                    e.stopPropagation()
                    onActionPause()
                  }}
                  aria-label="暂停下载"
                >
                  <RefreshCw size={14} />
                </ActionIconButton>
              )}
              {onActionDelete && (
                <ActionIconButton 
                  $variant="delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    onActionDelete()
                  }}
                  aria-label="删除"
                >
                  <Trash2 size={14} />
                </ActionIconButton>
              )}
            </VideoCardActionsInline>
          )}
        </VideoCardMeta>
          
          {!showActionButtons && (
            <VideoCardStats>
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
            </VideoCardStats>
          )}
      </VideoCardInfo>
      
      {batchMode && onToggleSelect && (
        <VideoCardCheckboxBtn
          $selected={selected}
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect()
          }}
          aria-label={selected ? '取消选择' : '选择'}
          title={selected ? '取消选择' : '选择'}
        >
          {selected && <Check size={18} className="check-icon" />}
        </VideoCardCheckboxBtn>
      )}
      
      {!batchMode && showDownloadButton && onDownloadToggle && (
        <VideoCardDownloadBtn
          $status={downloadStatus}
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
        >
          {downloadStatus === 'in_list' && <Download size={16} />}
          {downloadStatus === 'downloaded' && <Check size={16} />}
          {downloadStatus === 'none' && <Plus size={16} />}
        </VideoCardDownloadBtn>
      )}
    </VideoCard>
  )
}