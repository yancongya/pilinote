export default function DownloadsContent() {
  return (
    <section
      id="downloads-panel"
      role="tabpanel"
      aria-labelledby="downloads-tab"
      className="content-section"
    >
      <div className="section-header">
        <div className="section-title">
          <h2>下载管理</h2>
          <span className="video-count">0个任务</span>
        </div>
      </div>

      <div className="download-stats">
        <div className="stat-card">
          <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <div className="stat-info">
            <span className="stat-number">0</span>
            <span className="stat-label">下载中</span>
          </div>
        </div>

        <div className="stat-card">
          <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <div className="stat-info">
            <span className="stat-number">0</span>
            <span className="stat-label">已完成</span>
          </div>
        </div>

        <div className="stat-card">
          <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 7l-7 5 7 5V7z"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          <div className="stat-info">
            <span className="stat-number">0</span>
            <span className="stat-label">已保存</span>
          </div>
        </div>
      </div>

      <div className="empty-state">
        <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <p className="empty-text">暂无下载任务</p>
      </div>
    </section>
  )
}