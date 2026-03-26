import { useState } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useAuthStore } from '../stores/auth'
import HomeContent from './components/HomeContent'
import FavoritesContent from './components/FavoritesContent'
import WatchLaterContent from './components/WatchLaterContent'
import DownloadsContent from './components/DownloadsContent'

function HomePage() {
  const [activeTab, setActiveTab] = useState('home')
  const { user, logout } = useAuthStore()
  const [animationParent] = useAutoAnimate({ duration: 150, easing: 'linear' })
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
  }

  const handleLogout = () => {
    setShowLogoutConfirm(true)
  }

  const confirmLogout = () => {
    logout()
    setShowLogoutConfirm(false)
  }

  const cancelLogout = () => {
    setShowLogoutConfirm(false)
  }

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="header-left">
          <h1>PiliNote</h1>
        </div>
        <div className="header-right">
          {user ? (
            <>
              <div className="user-info">
                <img
                  src={`/api/auth/proxy/avatar?url=${encodeURIComponent(user.avatar || `https://i2.hdslb.com/bfs/face/${user.mid}.jpg`)}`}
                  alt="用户头像"
                  className="user-avatar"
                />
                <span className="user-name">{user.username}</span>
              </div>
              <button
                className="logout-btn"
                onClick={handleLogout}
                aria-label="退出登录"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
              {showLogoutConfirm && (
                <div className="logout-confirm">
                  <div className="logout-confirm-content">
                    <p>确定要退出登录吗？</p>
                    <div className="logout-confirm-buttons">
                      <button onClick={() => setShowLogoutConfirm(false)}>取消</button>
                      <button onClick={logout}>确定</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button className="login-btn" aria-label="登录">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
            </button>
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
          <span className="tab-label">收藏</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'watch-later'}
          aria-controls="watch-later-panel"
          className={`home-tab ${activeTab === 'watch-later' ? 'active' : ''}`}
          onClick={() => handleTabChange('watch-later')}
          tabIndex={activeTab === 'watch-later' ? 0 : -1}
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
        {activeTab === 'home' && <HomeContent />}
        {activeTab === 'favorites' && <FavoritesContent />}
        {activeTab === 'watch-later' && <WatchLaterContent />}
        {activeTab === 'downloads' && <DownloadsContent />}
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
          aria-label="收藏"
          aria-current={activeTab === 'favorites' ? 'page' : undefined}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span className="nav-label">收藏</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'watch-later' ? 'active' : ''}`}
          onClick={() => handleTabChange('watch-later')}
          aria-label="稍后再看"
          aria-current={activeTab === 'watch-later' ? 'page' : undefined}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span className="nav-label">稍后再看</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'downloads' ? 'active' : ''}`}
          onClick={() => handleTabChange('downloads')}
          aria-label="下载"
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