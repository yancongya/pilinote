import { useState } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useAuthStore } from '../stores/auth'

function HomePage() {
  const [activeTab, setActiveTab] = useState('home')
  const [refreshing, setRefreshing] = useState(false)
  // pageTransition 已移除
  const [urlInput, setUrlInput] = useState('')
  const [urlList, setUrlList] = useState<string[]>([])
  const { user, logout } = useAuthStore()
  const [animationParent] = useAutoAnimate({ duration: 150, easing: 'linear' })
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isDark, setIsDark] = useState(true)

  const toggleTheme = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    if (newIsDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    // 模拟刷新
    await new Promise(resolve => setTimeout(resolve, 1000))
    setRefreshing(false)
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
  }

  const handleAddUrl = () => {
    if (urlInput.trim()) {
      setUrlList([...urlList, urlInput.trim()])
      setUrlInput('')
    }
  }

  const handleRemoveUrl = (index: number) => {
    setUrlList(urlList.filter((_, i) => i !== index))
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
        </div>
        <div className="header-right">
          <button
            className="icon-btn theme-toggle"
            onClick={toggleTheme}
            aria-label={isDark ? '切换到亮色模式' : '切换到暗色模式'}
          >
            {isDark ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          {user && (
            <div className="user-info" onClick={() => setShowLogoutConfirm(true)}>
              <img src={getAvatarUrl(user.avatar || '')} alt={user.username} className="user-avatar" />
              <span className="user-name">{user.username}</span>
            </div>
          )}
          {/* 退出确认面板 */}
          {showLogoutConfirm && (
            <div className="logout-confirm-overlay" onClick={() => setShowLogoutConfirm(false)}>
              <div className="logout-confirm-panel" onClick={(e) => e.stopPropagation()}>
                <p>确定要退出登录吗？</p>
                <div className="logout-confirm-buttons">
                  <button onClick={() => setShowLogoutConfirm(false)}>取消</button>
                  <button onClick={logout}>确定</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <nav className="home-tabs" role="tablist" aria-label="功能导航">
        <button
          role="tab"
          aria-selected={activeTab === 'home'}
          aria-controls="home-panel"
          className={`home-tab ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => handleTabChange('home')}
          tabIndex={activeTab === 'home' ? 0 : -1}
        >
          <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span className="tab-label">首页</span>
        </button>
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

      <main ref={animationParent} className="home-content">
        {activeTab === 'home' && (
          <section
            id="home-panel"
            role="tabpanel"
            aria-labelledby="home-tab"
            className="content-section"
          >
            <div className={`home-input-section ${urlList.length > 0 ? 'has-content' : ''}`}>
              <div className="url-input-container">
                <label htmlFor="url-input" className="visually-hidden">
                  视频链接
                </label>
                <input
                  id="url-input"
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="粘贴B站视频链接，如：https://www.bilibili.com/video/BV..."
                  className="url-input"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddUrl()
                    }
                  }}
                />
                <button
                  className="add-url-btn"
                  onClick={handleAddUrl}
                  disabled={!urlInput.trim()}
                  aria-label="添加链接"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  <span className="btn-text">添加</span>
                </button>
              </div>
            </div>
            {urlList.length > 0 && (
              <div className="url-list-section">
                <h3 className="url-list-title">待处理视频 ({urlList.length})</h3>
                <div className="url-list" role="list" aria-label="待处理视频列表">
                  {urlList.map((url, index) => (
                    <div key={index} className="url-item" role="listitem">
                      <div className="url-content">
                        <svg className="url-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                        </svg>
                        <span className="url-text">{url}</span>
                      </div>
                      <button
                        className="remove-url-btn"
                        onClick={() => handleRemoveUrl(index)}
                        aria-label={`删除链接 ${index + 1}`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

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
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => handleTabChange('home')}
          aria-label="首页"
          aria-current={activeTab === 'home' ? 'page' : undefined}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span className="nav-label">首页</span>
        </button>
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
