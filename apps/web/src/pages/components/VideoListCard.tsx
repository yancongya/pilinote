import { useNavigate } from 'react-router-dom'
import { Film, Eye, MessageCircle, Heart } from 'lucide-react'

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
  progress?: number
  durationSeconds?: number
  watched?: string
  onDownloadToggle?: (video: any, e: React.MouseEvent) => void
  isDownloaded?: boolean
  showDownloadButton?: boolean
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
  progress,
  durationSeconds,
  watched,
  onDownloadToggle,
  isDownloaded = false,
  showDownloadButton = true
}: VideoCardProps) {
  const navigate = useNavigate()

  const getProxyImageUrl = (url: string | null | undefined): string => {
    if (!url) return ''
    return `http://localhost:8000/api/auth/proxy/avatar?url=${encodeURIComponent(url)}`
  }

  const handleVideoClick = () => {
    navigate(`/video/${bvid}`)
  }

  return (
    <article 
      className="video-card"
      onClick={handleVideoClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="video-card-cover">
        <div className="video-card-thumbnail">
          {cover ? (
            <img src={getProxyImageUrl(cover)} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Film />
          )}
          <div className="video-duration-overlay">{duration}</div>
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
        </div>
        <div className="video-card-stats">
          <span className="stat-item">
            <Eye />
            {views}
          </span>
          {(comments !== '0' && comments !== 0) && (
            <span className="stat-item">
              <MessageCircle />
              {comments}
            </span>
          )}
        </div>
      </div>
      {showDownloadButton && onDownloadToggle && (
        <button
          className="video-card-download-btn"
          onClick={(e) => onDownloadToggle({ id, bvid, title, cover, duration, uploader, views, comments, time }, e)}
          aria-label={isDownloaded ? '从下载列表移除' : '添加到下载列表'}
          title={isDownloaded ? '已添加' : '添加到下载'}
        >
          <Heart fill={isDownloaded ? "currentColor" : "none"} />
        </button>
      )}
    </article>
  )
}