import { useState } from 'react'

export default function FavoritesContent() {
  const [selectedFolder, setSelectedFolder] = useState<any>(null)
  const [downloadList, setDownloadList] = useState<any[]>([])
  const [folders, setFolders] = useState([
    { id: 1, name: '学习资料', count: 12, cover: '', isPrivate: false },
    { id: 2, name: '娱乐视频', count: 8, cover: '', isPrivate: true },
    { id: 3, name: '技术教程', count: 15, cover: '', isPrivate: true },
    { id: 4, name: '音乐收藏', count: 6, cover: '', isPrivate: false },
    { id: 5, name: '美食视频', count: 9, cover: '', isPrivate: false },
    { id: 6, name: '运动健身', count: 5, cover: '', isPrivate: true }
  ])
  const [videos, setVideos] = useState([
    { id: 1, title: 'React入门教程', duration: '12:34', uploader: '前端小哥', views: '12.3万', comments: 1, time: '4小时前' },
    { id: 2, title: 'TypeScript基础', duration: '15:20', uploader: '技术宅', views: '8.5万', comments: 0, time: '昨天' },
    { id: 3, title: 'CSS布局技巧', duration: '10:45', uploader: '设计师', views: '6.7万', comments: 3, time: '3天前' },
    { id: 4, title: 'Vue3新特性', duration: '18:30', uploader: '全栈开发', views: '15.2万', comments: 5, time: '1周前' }
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
      id="favorites-panel"
      role="tabpanel"
      aria-labelledby="favorites-tab"
      className="content-section"
    >
      <div className="section-header">
        <div
          className={`section-title ${selectedFolder ? 'cursor-pointer' : ''}`}
          onClick={() => selectedFolder && setSelectedFolder(null)}
        >
          {selectedFolder && (
            <button
              className="back-btn"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedFolder(null)
              }}
              aria-label="返回收藏夹列表"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5"/>
                <path d="M12 19l-7-7 7-7"/>
              </svg>
            </button>
          )}
          <h2>{selectedFolder ? selectedFolder.name : '我的收藏'}</h2>
          <span className="video-count">{selectedFolder ? `共${selectedFolder.count}条视频 · ${selectedFolder.isPrivate ? '私密' : '公开'}` : `${folders.length}个收藏夹`}</span>
        </div>
      </div>

      {!selectedFolder ? (
        <div className="fav-folder-list" role="list" aria-label="收藏夹列表">
          {folders.map(folder => (
            <article
              key={folder.id}
              className="fav-folder-item"
              onClick={() => setSelectedFolder(folder)}
              role="listitem"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelectedFolder(folder)
                }
              }}
            >
              <div className="fav-folder-cover">
                <div className="fav-folder-thumbnail">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
              </div>
              <div className="fav-folder-info">
                <h3>{folder.name}</h3>
                <div className="fav-folder-meta">
                  <span className="fav-folder-count">{folder.count}个内容</span>
                  <span className={`fav-folder-status ${folder.isPrivate ? 'private' : 'public'}`}>
                    {folder.isPrivate ? '私密' : '公开'}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="fav-video-list" role="list" aria-label="视频列表">
          {videos.map(video => (
            <article key={video.id} className="fav-video-item" role="listitem">
              <div className="fav-video-cover">
                <div className="fav-video-thumbnail">
                  <div className="video-duration-overlay">{video.duration}</div>
                </div>
              </div>
              <div className="fav-video-info">
                <h3>{video.title}</h3>
                <div className="fav-video-meta">
                  <span className="fav-video-uploader">{video.uploader}</span>
                  <span className="fav-video-time">{video.time}</span>
                </div>
                <div className="fav-video-stats">
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
                className="fav-video-remove-btn"
                aria-label="取消收藏"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
              <button
                className="fav-video-download-btn"
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
      )}
    </section>
  )
}