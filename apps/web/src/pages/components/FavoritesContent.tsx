import { useState } from 'react'

export default function FavoritesContent() {
  const [selectedFolder, setSelectedFolder] = useState<any>(null)
  const [folders, setFolders] = useState([
    { id: 1, name: '学习资料', count: 12, cover: '', upper: { name: '技术UP主' } },
    { id: 2, name: '娱乐视频', count: 8, cover: '', upper: { name: '搞笑博主' } },
    { id: 3, name: '技术教程', count: 15, cover: '', upper: { name: '编程达人' } },
    { id: 4, name: '音乐收藏', count: 6, cover: '', upper: { name: '音乐达人' } },
    { id: 5, name: '美食视频', count: 9, cover: '', upper: { name: '美食家' } },
    { id: 6, name: '运动健身', count: 5, cover: '', upper: { name: '健身教练' } }
  ])
  const [videos, setVideos] = useState([
    { id: 1, title: 'React入门教程', duration: '12:34', uploader: '前端小哥', views: '12.3万播放', favTime: '2024-01-15' },
    { id: 2, title: 'TypeScript基础', duration: '15:20', uploader: '技术宅', views: '8.5万播放', favTime: '2024-01-16' },
    { id: 3, title: 'CSS布局技巧', duration: '10:45', uploader: '设计师', views: '6.7万播放', favTime: '2024-01-17' },
    { id: 4, title: 'Vue3新特性', duration: '18:30', uploader: '全栈开发', views: '15.2万播放', favTime: '2024-01-18' }
  ])

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
          <span className="video-count">{selectedFolder ? `共${selectedFolder.count}条视频` : `${folders.length}个收藏夹`}</span>
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
                  <span className="fav-folder-upper">UP主：{folder.upper?.name || '未知'}</span>
                  <span className={`fav-folder-status ${folder.id % 3 === 0 ? 'private' : 'public'}`}>
                    {folder.id % 3 === 0 ? '私密' : '公开'}
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
                  <span className="video-number" aria-hidden="true">{video.id}</span>
                  <div className="video-duration-overlay">{video.duration}</div>
                </div>
              </div>
              <div className="fav-video-info">
                <h3>{video.title}</h3>
                <div className="fav-video-meta">
                  <span className="fav-video-time">{video.favTime}</span>
                  <span className="fav-video-uploader">{video.uploader}</span>
                  <span className="fav-video-views">{video.views}</span>
                </div>
                <div className="fav-video-stats">
                  <span className="stat-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    {video.views}
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
            </article>
          ))}
        </div>
      )}
    </section>
  )
}