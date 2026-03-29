import { useState } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useAuthStore } from '../stores/auth'
import { useLocation, useNavigate } from 'react-router-dom'
import { LogIn, Home, Heart, Clock, Download } from 'lucide-react'
import HomeContent from './components/HomeContent'
import FavoritesContent from './components/FavoritesContent'
import WatchLaterContent from './components/WatchLaterContent'
import DownloadsContent from './components/DownloadsContent'

function HomePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [animationParent] = useAutoAnimate({ duration: 150, easing: 'linear' })
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  // 根据路径确定当前activeTab
  const getActiveTabFromPath = () => {
    const path = location.pathname
    if (path === '/favorites' || path.startsWith('/favorites/')) return 'favorites'
    if (path === '/watch-later') return 'watch-later'
    if (path === '/downloads') return 'downloads'
    return 'home'
  }

  const activeTab = getActiveTabFromPath()

  const handleTabChange = (tab: string) => {
    const routes: Record<string, string> = {
      home: '/home',
      favorites: '/favorites',
      'watch-later': '/watch-later',
      downloads: '/downloads'
    }
    navigate(routes[tab] || '/home')
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

  const getAvatarUrl = (avatarUrl: string) => {
    if (!avatarUrl) return ''
    return `http://localhost:8000/api/auth/proxy/avatar?url=${encodeURIComponent(avatarUrl)}`
  }

  return (
    <div className={`home-container ${activeTab === 'home' ? 'has-tabs' : ''}`}>
      <header className="home-header">
        <div className="header-left">
          <h1>PiliNote</h1>
        </div>
        <div className="header-right">
          {user ? (
            <>
              <div className="user-info" onClick={() => setShowLogoutConfirm(true)}>
                <img
                  src={getAvatarUrl(user.avatar || '')}
                  alt={user.username}
                  className="user-avatar"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect fill='%235CB67B' width='40' height='40'/><text x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='white' font-size='20'>${user.username?.[0]?.toUpperCase() || 'U'}</text></svg>`
                  }}
                />
                <span className="user-name">{user.username}</span>
              </div>
              {showLogoutConfirm && (
                <div className="logout-confirm-overlay" onClick={() => setShowLogoutConfirm(false)}>
                  <div className="logout-confirm-panel" onClick={(e) => e.stopPropagation()}>
                    <p>确定要退出登录吗？</p>
                    <div className="logout-confirm-buttons">
                      <button onClick={cancelLogout}>取消</button>
                      <button onClick={confirmLogout}>确定</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button className="login-btn" aria-label="登录">
              <LogIn />
            </button>
          )}
        </div>
      </header>

      <div className="home-main">
        <nav className="home-tabs" role="tablist" aria-label="功能导航">
          <button
            role="tab"
            aria-selected={activeTab === 'home'}
            aria-controls="home-panel"
            className={`home-tab ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => handleTabChange('home')}
            tabIndex={activeTab === 'home' ? 0 : -1}
          >
            <Home className="tab-icon" />
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
            <Heart className="tab-icon" />
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
            <Clock className="tab-icon" />
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
              <Download className="tab-icon" />
              <span className="tab-label">下载管理</span>
            </button>
          </nav>

        <main ref={animationParent} className="home-content">
          {activeTab === 'home' && <HomeContent />}
          {activeTab === 'favorites' && <FavoritesContent />}
          {activeTab === 'watch-later' && <WatchLaterContent />}
          {activeTab === 'downloads' && <DownloadsContent />}
        </main>
      </div>

      <nav className="bottom-navigation" role="navigation" aria-label="底部导航">
        <button
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => handleTabChange('home')}
          aria-label="首页"
          aria-current={activeTab === 'home' ? 'page' : undefined}
        >
          <Home className="nav-icon" />
          <span className="nav-label">首页</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => handleTabChange('favorites')}
          aria-label="收藏"
          aria-current={activeTab === 'favorites' ? 'page' : undefined}
        >
          <Heart className="nav-icon" />
          <span className="nav-label">收藏</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'watch-later' ? 'active' : ''}`}
          onClick={() => handleTabChange('watch-later')}
          aria-label="稍后再看"
          aria-current={activeTab === 'watch-later' ? 'page' : undefined}
        >
          <Clock className="nav-icon" />
          <span className="nav-label">稍后再看</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'downloads' ? 'active' : ''}`}
          onClick={() => handleTabChange('downloads')}
          aria-label="下载"
          aria-current={activeTab === 'downloads' ? 'page' : undefined}
        >
          <Download className="nav-icon" />
          <span className="nav-label">下载</span>
        </button>
      </nav>
    </div>
  )
}

export default HomePage