import { MessageCircle, ThumbsUp } from 'lucide-react'
import { MarkdownPreview } from '../../components/ai/MarkdownPreview'
import type { AiNoteKeypoint } from '../videoDetailKeypoints'
import type { VideoDetailData } from '../videoDetailCache'

export function VideoDetailSkeleton() {
  return (
    <div className="video-detail-page">
      <header className="video-detail-header">
        <div className="video-detail-header-inner">
          <div className="video-detail-skeleton-header-action" aria-hidden="true" />
          <div className="video-detail-skeleton-header-title" aria-hidden="true" />
          <div className="video-detail-skeleton-header-action video-detail-skeleton-header-action--right" aria-hidden="true" />
        </div>
      </header>
      <main className="video-detail-content">
        <div className="video-detail-skeleton" aria-hidden="true">
          <div className="video-detail-skeleton-media" />
          <div className="video-detail-skeleton-card">
            <div className="video-detail-skeleton-line video-detail-skeleton-line--short" />
            <div className="video-detail-skeleton-line" />
            <div className="video-detail-skeleton-line video-detail-skeleton-line--mid" />
          </div>
          <div className="video-detail-skeleton-card">
            <div className="video-detail-skeleton-line video-detail-skeleton-line--short" />
            <div className="video-detail-skeleton-comment" />
            <div className="video-detail-skeleton-comment" />
          </div>
        </div>
      </main>
    </div>
  )
}

type Comment = NonNullable<VideoDetailData['comments']>[number]

export function VideoDetailComments({
  comments,
  getAvatarImage,
  formatTime,
}: {
  comments?: Comment[]
  getAvatarImage: (author: string, index: number) => string
  formatTime: (timestamp: number | string) => string
}) {
  if (!comments || comments.length === 0) return null

  return (
    <section className="video-detail-comments">
      <div className="video-detail-card-header">
        <h3 className="video-detail-card-title">热门评论</h3>
      </div>
      <div className="video-detail-comment-list">
        {comments.slice(0, 3).map((comment, index) => {
          const isTop = comment.type === 'top'
          return (
            <article key={index} className={`video-detail-comment-item${isTop ? ' is-top' : ''}`}>
              <div className="video-detail-comment-avatar" aria-hidden="true">
                <img src={getAvatarImage(comment.author, index)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              </div>
              <div className="video-detail-comment-body">
                <div className="video-detail-comment-topline">
                  <div className="video-detail-comment-author-row">
                    <span className="video-detail-comment-author">{comment.author}</span>
                    {isTop && <span className="video-detail-comment-badge">置顶</span>}
                  </div>
                  <span className="video-detail-comment-time">{formatTime(comment.time)}</span>
                </div>
                <p className="video-detail-comment-content">{comment.content}</p>
                <div className="video-detail-comment-actions">
                  <span className="video-detail-comment-action">
                    <ThumbsUp size={13} />
                    {comment.like}
                  </span>
                  {comment.reply > 0 && (
                    <span className="video-detail-comment-action">
                      <MessageCircle size={13} />
                      {comment.reply}
                    </span>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export interface VideoDetailAiNotePanelProps {
  isOpus: boolean
  cardPadding: string
  cardRadius: string
  smallFontSize: string
  keypoints: AiNoteKeypoint[]
  durationSeconds: number
  loading: boolean
  error: string | null
  markdown: string
  folderPath: string | null
  onRefresh: () => void
  onOpenPanel: () => void
  onSeekToSeconds: (seconds: number) => void
}

export function VideoDetailAiNotePanel({
  isOpus,
  cardPadding,
  cardRadius,
  smallFontSize,
  keypoints,
  durationSeconds,
  loading,
  error,
  markdown,
  folderPath,
  onRefresh,
  onOpenPanel,
  onSeekToSeconds,
}: VideoDetailAiNotePanelProps) {
  if (isOpus) return null

  return (
    <section aria-label="AI 笔记" style={{ padding: cardPadding, background: 'var(--color-bg-tertiary)', borderRadius: cardRadius, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: keypoints.length > 0 ? '12px' : '10px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: smallFontSize, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: '1.2' }}>AI 笔记</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>点击时间戳即可跳转播放进度</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button type="button" onClick={onRefresh} disabled={loading} style={{ padding: '7px 10px', borderRadius: '999px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 650 }}>刷新</button>
          <button type="button" onClick={onOpenPanel} style={{ padding: '7px 10px', borderRadius: '999px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 650 }}>打开面板</button>
        </div>
      </div>

      {keypoints.length > 0 && durationSeconds > 0 && (
        <div className="video-detail-keypoint-bar-wrap" style={{ marginBottom: '12px' }}>
          <div className="video-detail-keypoint-bar" role="list" aria-label="关键点时间轴">
            {keypoints.map((item, index) => {
              const next = keypoints[index + 1]
              const safeStart = Math.max(0, Math.min(item.seconds, durationSeconds))
              const safeEnd = Math.max(safeStart, Math.min(next ? next.seconds : durationSeconds, durationSeconds))
              const left = (safeStart / durationSeconds) * 100
              const width = ((safeEnd - safeStart) / durationSeconds) * 100
              const hue = Math.round((index / Math.max(1, keypoints.length)) * 220)
              return (
                <button key={`${item.seconds}-${item.timestamp}`} type="button" role="listitem" className="video-detail-keypoint-segment" onClick={() => onSeekToSeconds(item.seconds)} title={`${item.timestamp}  ${item.title}`} style={{ left: `${left}%`, width: `${Math.max(1.5, width)}%`, background: `linear-gradient(90deg, hsla(${hue}, 85%, 62%, 0.75), hsla(${hue}, 85%, 62%, 0.55))`, borderColor: `hsla(${hue}, 85%, 72%, 0.55)` }} aria-label={`${item.timestamp} ${item.title}`}>
                  <span className="sr-only">{`${item.timestamp} ${item.title}`}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {loading && <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>加载中...</div>}
      {!loading && error && <div style={{ fontSize: '12px', color: 'var(--color-error-600)' }}>{error}</div>}
      {!loading && !error && !markdown.trim() && <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>当前分P暂无笔记</div>}
      {!loading && !error && markdown.trim() && (
        <div style={{ marginTop: '10px' }}>
          <MarkdownPreview content={markdown} sourceFolderPath={folderPath} onSeekToSeconds={onSeekToSeconds} className="video-detail-ai-markdown" />
        </div>
      )}
    </section>
  )
}
