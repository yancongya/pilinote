import { useState, useEffect } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useAuthStore } from '../stores/auth'
import { useLocation, useNavigate } from 'react-router-dom'
import { LogIn, Home, Heart, Clock, Download, User } from 'lucide-react'
import HomeContent from './components/HomeContent'
import FavoritesContent from './components/FavoritesContent'
import WatchLaterContent from './components/WatchLaterContent'
import NewDownloadContent from '../components/NewDownload'
import { getAvatarProxyUrl } from '../config/api'
import { apiService } from '../services/api'

function HomePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [animationParent] = useAutoAnimate({ duration: 150, easing: 'linear' })
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [authStatus, setAuthStatus] = useState<'initialized' | 'pending' | 'error'>('pending')
  
  // 调试：打印用户状态
  useEffect(() => {
  }, [user])
  
  // Week 2: 定期检查并刷新cookie
  useEffect(() => {
    if (!user || !user.sessdata) return

    // 初始化认证系统状态
    const initAuthSystem = async () => {
      try {
        const response = await apiService.refreshCookies()
        if (response.success) {
          setAuthStatus('initialized')
          console.log('认证系统状态:', response.message)
        } else {
          setAuthStatus('error')
          console.warn('认证系统状态检查失败:', response.message)
        }
      } catch (err) {
        setAuthStatus('error')
        console.error('认证系统状态检查异常:', err)
      }
    }

    initAuthSystem()

    // 每24小时检查一次cookie状态
    const checkCookieInterval = setInterval(async () => {
      try {
        const response = await apiService.refreshCookies()
        if (response.success) {
          console.log('Cookie刷新成功:', response.message)
          setAuthStatus('initialized')
        } else {
          console.warn('Cookie刷新失败:', response.message)
          setAuthStatus('error')
        }
      } catch (err) {
        console.error('Cookie刷新异常:', err)
        setAuthStatus('error')
      }
    }, 24 * 60 * 60 * 1000) // 24小时

    return () => clearInterval(checkCookieInterval)
  }, [user])

  // 根据路径确定当前activeTab
  const getActiveTabFromPath = () => {
    const path = location.pathname
    if (path === '/favorites' || path.startsWith('/favorites/')) return 'favorites'
    if (path === '/watch-later') return 'watch-later'
    if (path === '/new-downloads') return 'new-downloads'
    return 'home'
  }

  const activeTab = getActiveTabFromPath()

  const handleTabChange = (tab: string) => {
    const routes: Record<string, string> = {
      home: '/home',
      favorites: '/favorites',
      'watch-later': '/watch-later',
      'new-downloads': '/new-downloads'
    }
    navigate(routes[tab] || '/home')
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
    return getAvatarProxyUrl(avatarUrl)
  }

  const handleAvatarClick = () => {
    navigate('/settings')
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
              <div className="user-info" onClick={handleAvatarClick}>
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
                {/* Week 1 & 2: 认证系统状态指示器 */}
                <div
                  className={`auth-status ${authStatus}`}
                  title={`认证系统状态: ${authStatus === 'initialized' ? '已启用' : authStatus === 'error' ? '异常' : '初始化中...'}`}
                >
                  {authStatus === 'initialized' && <span>✓</span>}
                  {authStatus === 'error' && <span>!</span>}
                </div>
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
            <div className="user-info guest-info" onClick={handleAvatarClick}>
              <div className="user-avatar guest-avatar">
                <User className="guest-avatar-icon" />
              </div>
              <span className="user-name">游客</span>
            </div>
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
              aria-selected={activeTab === 'new-downloads'}
              aria-controls="new-downloads-panel"
              className={`home-tab ${activeTab === 'new-downloads' ? 'active' : ''}`}
              onClick={() => handleTabChange('new-downloads')}
              tabIndex={activeTab === 'new-downloads' ? 0 : -1}
            >
              <Download className="tab-icon" />
              <span className="tab-label">新下载</span>
            </button>
          </nav>

        <main ref={animationParent} className="home-content">
          <div style={{ display: activeTab === 'home' ? 'block' : 'none' }}>
            <HomeContent />
          </div>
          <div style={{ display: activeTab === 'favorites' ? 'block' : 'none' }}>
            {user?.sessdata ? (
              <FavoritesContent />
            ) : (
              <section className="content-section" style={{ textAlign: 'center', padding: '80px 20px' }}>
                <LogIn className="empty-state-icon" style={{ width: '64px', height: '64px', color: '#94A3B8', marginBottom: '20px' }} />
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1E293B', marginBottom: '12px' }}>请先登录</h3>
                <p style={{ fontSize: '16px', color: '#64748B', marginBottom: '24px' }}>登录后可以查看和管理您的收藏夹</p>
                <button
                  onClick={() => navigate('/login')}
                  style={{
                    padding: '12px 24px',
                    background: '#2563EB',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#1D4ED8'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#2563EB'}
                >
                  去登录
                </button>
              </section>
            )}
          </div>
          <div style={{ display: activeTab === 'watch-later' ? 'block' : 'none' }}>
            {user?.sessdata ? (
              <WatchLaterContent />
            ) : (
              <section className="content-section" style={{ textAlign: 'center', padding: '80px 20px' }}>
                <LogIn className="empty-state-icon" style={{ width: '64px', height: '64px', color: '#94A3B8', marginBottom: '20px' }} />
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1E293B', marginBottom: '12px' }}>请先登录</h3>
                <p style={{ fontSize: '16px', color: '#64748B', marginBottom: '24px' }}>登录后可以查看和管理您的稍后再看列表</p>
                <button
                  onClick={() => navigate('/login')}
                  style={{
                    padding: '12px 24px',
                    background: '#2563EB',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#1D4ED8'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#2563EB'}
                >
                  去登录
                </button>
              </section>
            )}
          </div>
          <div style={{ display: activeTab === 'new-downloads' ? 'block' : 'none' }}>
            <NewDownloadContent />
          </div>
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
          className={`nav-item ${activeTab === 'new-downloads' ? 'active' : ''}`}
          onClick={() => handleTabChange('new-downloads')}
          aria-label="新下载"
          aria-current={activeTab === 'new-downloads' ? 'page' : undefined}
        >
          <Download className="nav-icon" />
          <span className="nav-label">新下载</span>
        </button>
      </nav>
    </div>
  )
}

export default HomePage