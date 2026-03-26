export default function WatchLaterContent() {
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
          <span className="video-count">0个视频</span>
        </div>
      </div>

      <div className="empty-state">
        <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <p className="empty-text">暂无稍后再看视频</p>
      </div>
    </section>
  )
}