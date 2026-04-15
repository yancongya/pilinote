import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { useNewQueueStore } from '../stores/newQueue'
import { Home, Heart, Clock, Download, User, Wifi, WifiOff, Moon, Sun } from 'lucide-react'
import { getAvatarProxyUrl } from '../config/api'
import { apiService } from '../services/api'
import HomeContent from '../pages/components/HomeContent'
import FavoritesContent from '../pages/components/FavoritesContent'
import WatchLaterContent from '../pages/components/WatchLaterContent'
import NewDownloadContent from '../components/NewDownload'
import { LogIn } from 'lucide-react'

const navItems = [
  { id: 'home', label: '首页', path: '/home', icon: Home },
  { id: 'favorites', label: '收藏', path: '/favorites', icon: Heart },
  { id: 'watch-later', label: '稍后再看', path: '/watch-later', icon: Clock },
  { id: 'new-downloads', label: '新下载', path: '/new-downloads', icon: Download },
]

function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, isAuthenticated } = useAuthStore()
  const { connected } = useNewQueueStore()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [authStatus, setAuthStatus] = useState<'initialized' | 'pending' | 'error'>('pending')
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
  }, [user])

  // 初始化暗色模式
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initialDarkMode = savedMode ? savedMode === 'true' : prefersDark
    setDarkMode(initialDarkMode)
    if (initialDarkMode) {
      document.documentElement.classList.add('dark')
    }
  }, [])

  // 切换暗色模式
  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    if (!darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('darkMode', 'true')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('darkMode', 'false')
    }
  }

  useEffect(() => {
    if (!user) return

    const initAuthSystem = async () => {
      try {
        const response = await apiService.refreshCookies()
        if (response.success) {
          setAuthStatus('initialized')
        } else {
          setAuthStatus('error')
        }
      } catch {
        setAuthStatus('error')
      }
    }

    initAuthSystem()

    const checkCookieInterval = setInterval(async () => {
      try {
        const response = await apiService.refreshCookies()
        if (response.success) {
          setAuthStatus('initialized')
        } else {
          setAuthStatus('error')
        }
      } catch {
        setAuthStatus('error')
      }
    }, 24 * 60 * 60 * 1000)

    return () => clearInterval(checkCookieInterval)
  }, [user])

  const getActiveTabFromPath = () => {
    const path = location.pathname
    if (path === '/favorites' || path.startsWith('/favorites/')) return 'favorites'
    if (path === '/watch-later') return 'watch-later'
    if (path === '/new-downloads') return 'new-downloads'
    return 'home'
  }

  const activeTab = getActiveTabFromPath()

  const handleTabChange = (path: string) => {
    navigate(path)
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
              <button
                onClick={toggleDarkMode}
                className="dark-mode-toggle"
                title={darkMode ? '切换到浅色模式' : '切换到暗色模式'}
                aria-label={darkMode ? '切换到浅色模式' : '切换到暗色模式'}
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <div
                className={`ws-status-icon ${connected ? 'ws-connected' : 'ws-disconnected'}`}
                title={connected ? 'WebSocket 已连接' : 'WebSocket 连接断开，正在重连...'}
              >
                {connected ? <Wifi size={18} /> : <WifiOff size={18} />}
              </div>
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
        <aside className="home-sidebar">
          <nav className="sidebar-nav" role="tablist" aria-label="功能导航">
            {navItems.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={activeTab === item.id}
                aria-controls={`${item.id}-panel`}
                className={`sidebar-tab ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => handleTabChange(item.path)}
                tabIndex={activeTab === item.id ? 0 : -1}
              >
                <item.icon className="sidebar-icon" />
                <span className="sidebar-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="home-content">
          <div className="content-wrapper">
            <div style={{ display: activeTab === 'home' ? 'block' : 'none' }}>
              <HomeContent />
            </div>
            <div style={{ display: activeTab === 'favorites' ? 'block' : 'none' }}>
              {isAuthenticated ? (
                <FavoritesContent />
              ) : (
                <LoginPrompt message="登录后可以查看和管理您的收藏夹" />
              )}
            </div>
            <div style={{ display: activeTab === 'watch-later' ? 'block' : 'none' }}>
              {isAuthenticated ? (
                <WatchLaterContent />
              ) : (
                <LoginPrompt message="登录后可以查看和管理您的稍后再看列表" />
              )}
            </div>
            <div style={{ display: activeTab === 'new-downloads' ? 'block' : 'none' }}>
              <NewDownloadContent />
            </div>
          </div>
        </main>
      </div>

      <nav className="bottom-nav" role="navigation" aria-label="底部导航">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => handleTabChange(item.path)}
            aria-label={item.label}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            <item.icon className="nav-icon" />
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function LoginPrompt({ message }: { message: string }) {
  const navigate = useNavigate()
  
  return (
    <section className="content-section" style={{ textAlign: 'center', padding: '80px 20px' }}>
      <LogIn className="empty-state-icon" style={{ width: '64px', height: '64px', color: 'var(--color-text-secondary)', marginBottom: '20px' }} />
      <h3 className="dark:text-secondary-100" style={{ fontSize: '20px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '12px' }}>请先登录</h3>
      <p className="dark:text-secondary-400" style={{ fontSize: '16px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>{message}</p>
      <button
        onClick={() => navigate('/login')}
        className="dark:bg-primary-700 dark:hover:bg-primary-800"
        style={{
          padding: '12px 24px',
          background: 'var(--color-primary-600)',
          color: 'var(--color-white)',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '500',
          cursor: 'pointer',
        }}
      >
        去登录
      </button>
    </section>
  )
}

function AuthGuardWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  
  if (!isAuthenticated) {
    return (
      <section className="content-section" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <LogIn className="empty-state-icon" style={{ width: '64px', height: '64px', color: 'var(--color-text-secondary)', marginBottom: '20px' }} />
        <h3 className="dark:text-secondary-100" style={{ fontSize: '20px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '12px' }}>请先登录</h3>
        <p className="dark:text-secondary-400" style={{ fontSize: '16px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>登录后可以查看和管理您的内容</p>
        <button
          onClick={() => navigate('/login')}
          className="dark:bg-primary-700 dark:hover:bg-primary-800"
          style={{
            padding: '12px 24px',
            background: 'var(--color-primary-600)',
            color: 'var(--color-white)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-primary-700)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'var(--color-primary-600)'}
        >
          去登录
        </button>
      </section>
    )
  }
  
  return <>{children}</>
}

export function HomePageContent() {
  return <HomeContent />
}

export function FavoritesPage() {
  return (
    <AuthGuardWrapper>
      <FavoritesContent />
    </AuthGuardWrapper>
  )
}

export function WatchLaterPage() {
  return (
    <AuthGuardWrapper>
      <WatchLaterContent />
    </AuthGuardWrapper>
  )
}

export function NewDownloadsPage() {
  return <NewDownloadContent />
}

export default MainLayout
