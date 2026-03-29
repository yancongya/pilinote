import { useNavigate } from 'react-router-dom'

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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
              <line x1="7" y1="2" x2="7" y2="22"/>
              <line x1="17" y1="2" x2="17" y2="22"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <line x1="2" y1="7" x2="7" y2="7"/>
              <line x1="2" y1="17" x2="7" y2="17"/>
              <line x1="17" y1="17" x2="22" y2="17"/>
              <line x1="17" y1="7" x2="22" y2="7"/>
            </svg>
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            {views}
          </span>
          <span className="stat-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8.9L12 2.5a8.38 8.38 0 0 1 3.8.9 8.5 8.5 0 0 1 4.7 7.6z"/>
            </svg>
            {comments}
          </span>
        </div>
      </div>
      {showDownloadButton && onDownloadToggle && (
        <button
          className="video-card-download-btn"
          onClick={(e) => onDownloadToggle({ id, bvid, title, cover, duration, uploader, views, comments, time }, e)}
          aria-label={isDownloaded ? '从下载列表移除' : '添加到下载列表'}
          title={isDownloaded ? '已添加' : '添加到下载'}
        >
          <svg viewBox="0 0 24 24" fill={isDownloaded ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      )}
    </article>
  )
}