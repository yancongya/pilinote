import { useState } from 'react'
import { useAuthStore } from '../stores/auth'

function HomePage() {
  const [activeTab, setActiveTab] = useState('favorites')
  const [refreshing, setRefreshing] = useState(false)
  const [pageTransition, setPageTransition] = useState('')
  const { user, logout } = useAuthStore()

  const handleRefresh = async () => {
    setRefreshing(true)
    // 模拟刷新
    await new Promise(resolve => setTimeout(resolve, 1000))
    setRefreshing(false)
  }

  const handleTabChange = (tab: string) => {
    setPageTransition('fade-out')
    setTimeout(() => {
      setActiveTab(tab)
      setPageTransition('fade-in')
    }, 150)
  }

  // 获取头像代理URL
  const getAvatarUrl = (avatarUrl: string) => {
    if (!avatarUrl) return ''
    return `http://localhost:8000/api/auth/proxy/avatar?url=${encodeURIComponent(avatarUrl)}`
  }

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="header-left">
          <h1>PiliNote</h1>
          {user && (
            <div className="user-info">
              <img src={getAvatarUrl(user.avatar)} alt={user.username} className="user-avatar" />
              <span className="user-name">{user.username}</span>
            </div>
          )}
        </div>
        <div className="header-right">
          <button
            className="icon-btn header-icon"
            onClick={logout}
            aria-label="退出登录"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      <nav className="home-tabs" role="tablist" aria-label="功能导航">
        <button
          role="tab"
          aria-selected={activeTab === 'favorites'}
          aria-controls="favorites-panel"
          className={`home-tab ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => handleTabChange('favorites')}
          tabIndex={activeTab === 'favorites' ? 0 : -1}
        >
          <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span className="tab-label">收藏夹</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'later'}
          aria-controls="later-panel"
          className={`home-tab ${activeTab === 'later' ? 'active' : ''}`}
          onClick={() => handleTabChange('later')}
          tabIndex={activeTab === 'later' ? 0 : -1}
        >
          <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span className="tab-label">稍后再看</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'downloads'}
          aria-controls="downloads-panel"
          className={`home-tab ${activeTab === 'downloads' ? 'active' : ''}`}
          onClick={() => handleTabChange('downloads')}
          tabIndex={activeTab === 'downloads' ? 0 : -1}
        >
          <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span className="tab-label">下载管理</span>
        </button>
      </nav>

      <main className={`home-content ${pageTransition}`}>
        {activeTab === 'favorites' && (
          <section
            id="favorites-panel"
            role="tabpanel"
            aria-labelledby="favorites-tab"
            className="content-section"
          >
            <div className="section-header">
              <div className="section-title">
                <h2>收藏夹</h2>
                <span className="video-count">6个视频</span>
              </div>
              <button
                className="refresh-btn"
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="刷新收藏夹"
              >
                <svg
                  className={`refresh-icon ${refreshing ? 'spinning' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
                </svg>
              </button>
            </div>
            <div className="video-grid" role="list" aria-label="收藏夹视频列表">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <article key={i} className="video-card" role="listitem" aria-label={`视频 ${i}`}>
                  <div className="video-placeholder">
                    <span className="video-number" aria-hidden="true">{i}</span>
                    <div className="video-duration-overlay">12:34</div>
                  </div>
                  <div className="video-info">
                    <h3>视频标题 {i}</h3>
                    <div className="video-meta">
                      <p className="uploader">UP主名称</p>
                      <span className="views">12.3万播放</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'later' && (
          <section
            id="later-panel"
            role="tabpanel"
            aria-labelledby="later-tab"
            className="content-section"
          >
            <div className="section-header">
              <div className="section-title">
                <h2>稍后再看</h2>
                <span className="video-count">5个视频</span>
              </div>
              <button
                className="refresh-btn"
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="刷新稍后再看"
              >
                <svg
                  className={`refresh-icon ${refreshing ? 'spinning' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
                </svg>
              </button>
            </div>
            <div className="video-list" role="list" aria-label="稍后再看视频列表">
              {[1, 2, 3, 4, 5].map((i) => (
                <article key={i} className="video-item" role="listitem">
                  <div className="video-thumbnail">
                    <span className="video-number" aria-hidden="true">{i}</span>
                    <div className="video-duration-overlay">12:34</div>
                  </div>
                  <div className="video-details">
                    <h3>视频标题 {i}</h3>
                    <div className="video-meta">
                      <p className="uploader">UP主名称</p>
                      <span className="views">12.3万播放</span>
                      <span className="upload-time">3天前</span>
                    </div>
                  </div>
                  <button className="download-btn" aria-label={`下载视频 ${i}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <span className="btn-text">下载</span>
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'downloads' && (
          <section
            id="downloads-panel"
            role="tabpanel"
            aria-labelledby="downloads-tab"
            className="content-section"
          >
            <div className="section-header">
              <div className="section-title">
                <h2>下载管理</h2>
              </div>
            </div>
            <div className="download-stats" role="region" aria-label="下载统计">
              <div className="stat-card">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </div>
                <span className="stat-number">0</span>
                <span className="stat-label">下载中</span>
              </div>
              <div className="stat-card">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <span className="stat-number">0</span>
                <span className="stat-label">已完成</span>
              </div>
              <div className="stat-card">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </div>
                <span className="stat-number">0</span>
                <span className="stat-label">失败</span>
              </div>
            </div>
            <div className="download-list">
              <div className="empty-state">
                <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <p className="empty-text">暂无下载任务</p>
                <p className="empty-hint">开始下载您的第一个视频吧</p>
              </div>
            </div>
          </section>
        )}
      </main>

      <nav className="bottom-navigation" role="navigation" aria-label="底部导航">
        <button
          className={`nav-item ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => handleTabChange('favorites')}
          aria-label="收藏夹"
          aria-current={activeTab === 'favorites' ? 'page' : undefined}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span className="nav-label">收藏</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'later' ? 'active' : ''}`}
          onClick={() => handleTabChange('later')}
          aria-label="稍后再看"
          aria-current={activeTab === 'later' ? 'page' : undefined}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span className="nav-label">稍后</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'downloads' ? 'active' : ''}`}
          onClick={() => handleTabChange('downloads')}
          aria-label="下载管理"
          aria-current={activeTab === 'downloads' ? 'page' : undefined}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span className="nav-label">下载</span>
        </button>
      </nav>
    </div>
  )
}

export default HomePage
