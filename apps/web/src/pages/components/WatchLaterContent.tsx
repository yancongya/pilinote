import { useState } from 'react'

export default function WatchLaterContent() {
  const [downloadList, setDownloadList] = useState<any[]>([])
  const [videos, setVideos] = useState([
    {
      id: 1,
      title: '爆降75%token！我在清华分享 openclaw的graph-memory',
      duration: '12:53',
      watched: '01:56',
      uploader: 'AGI_Ananas',
      views: '1.8万',
      comments: 2,
      thumbnail: 'openclaw'
    },
    {
      id: 2,
      title: 'Obsidian 补完计划：像 Notion 一样丝滑拖拽文本块',
      duration: '02:18',
      watched: '00:52',
      uploader: 'flyand987',
      views: '1.7万',
      comments: 18,
      thumbnail: 'obsidian'
    },
    {
      id: 3,
      title: 'Imagen | 全方位的图片管理｜其他插件可以卸载了',
      duration: '03:25',
      watched: '00:51',
      uploader: '鱼先生的模块化Obsidian',
      views: '3211',
      comments: 0,
      thumbnail: 'imagen'
    },
    {
      id: 4,
      title: 'Agent Reach让AI轻松获取互联网内容',
      duration: '01:30',
      watched: '00:42',
      uploader: 'AI视频总结',
      views: '2802',
      comments: 0,
      thumbnail: 'agent'
    }
  ])

  const isAddedToDownload = (videoId: number) => {
    return downloadList.some(item => item.id === videoId)
  }

  const handleAddToDownload = (video: any, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isAddedToDownload(video.id)) {
      setDownloadList([...downloadList, video])
    }
  }

  const handleRemoveFromDownload = (videoId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setDownloadList(downloadList.filter(item => item.id !== videoId))
  }

  return (
    <section
      id="watch-later-panel"
      role="tabpanel"
      aria-labelledby="watch-later-tab"
      className="content-section"
    >
      <div className="section-header">
        <div className="section-title">
          <h2>稍后再看</h2>
          <span className="video-count">{videos.length}个视频</span>
        </div>
      </div>

      {videos.length > 0 ? (
        <>
          <div className="watch-later-list" role="list" aria-label="稍后再看列表">
            {videos.map(video => (
              <article key={video.id} className="watch-later-item" role="listitem">
                <div className="watch-later-cover">
                  <div className="watch-later-thumbnail">
                    <div className="video-progress-overlay">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <div className="video-duration">{video.duration}</div>
                    <div className="video-progress-text">{video.watched}/{video.duration}</div>
                  </div>
                </div>
                <div className="watch-later-info">
                  <h3>{video.title}</h3>
                  <div className="watch-later-meta">
                    <span className="watch-later-uploader">{video.uploader}</span>
                  </div>
                  <div className="watch-later-stats">
                    <span className="stat-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      {video.views}
                    </span>
                    <span className="stat-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8.9L12 2.5a8.38 8.38 0 0 1 3.8.9 8.5 8.5 0 0 1 4.7 7.6z"/>
                      </svg>
                      {video.comments}
                    </span>
                  </div>
                </div>
                <button
                  className="watch-later-remove-btn"
                  aria-label="移除"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
                <button
                  className="watch-later-download-btn"
                  onClick={(e) => handleAddToDownload(video, e)}
                  aria-label={isAddedToDownload(video.id) ? '从下载列表移除' : '添加到下载列表'}
                  title={isAddedToDownload(video.id) ? '已添加' : '添加到下载'}
                >
                  <svg viewBox="0 0 24 24" fill={isAddedToDownload(video.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
              </article>
            ))}
          </div>
          <button className="play-all-btn" aria-label="播放全部">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5"/>
              <path d="M12 19l7-7-7-7"/>
            </svg>
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 19 3"/>
            </svg>
            <span>播放全部</span>
          </button>
        </>
      ) : (
        <div className="empty-state">
          <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <p className="empty-text">暂无稍后再看视频</p>
        </div>
      )}
    </section>
  )
}