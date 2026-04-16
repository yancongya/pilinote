import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { useNewQueueStore } from '../stores/newQueue'
import { Home, Heart, Clock, Download, User, Wifi, WifiOff, Moon, Sun, LogIn, Menu, X, ArrowLeftToLine, ArrowRightToLine, GripVertical } from 'lucide-react'
import { getAvatarProxyUrl } from '../config/api'
import { apiService } from '../services/api'
import { useTheme } from '../theme/context/ThemeContext'
import HomeContent from '../pages/components/HomeContent'
import FavoritesContent from '../pages/components/FavoritesContent'
import WatchLaterContent from '../pages/components/WatchLaterContent'
import NewDownloadContent from '../components/NewDownload'
import * as S from './styles/MainLayout.styles'

const navItems = [
  { id: 'home', label: '首页', path: '/home', icon: Home },
  { id: 'favorites', label: '收藏', path: '/favorites', icon: Heart },
  { id: 'watch-later', label: '稍后再看', path: '/watch-later', icon: Clock },
  { id: 'downloads', label: '新下载', path: '/downloads', icon: Download },
]

function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, isAuthenticated } = useAuthStore()
  const { connected } = useNewQueueStore()
  const { mode, toggleTheme } = useTheme()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [authStatus, setAuthStatus] = useState<'initialized' | 'pending' | 'error'>('pending')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [isDragging, setIsDragging] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const dragRef = useRef<HTMLDivElement>(null)

  // 检测移动端状态
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 拖拽调整侧边栏宽度
  useEffect(() => {
    const dragHandle = dragRef.current
    if (!dragHandle) return

    let isCurrentlyDragging = false

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault()
      isCurrentlyDragging = true
      setIsDragging(true)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isCurrentlyDragging) return
      
      // 计算新宽度（鼠标位置减去拖拽手柄在Sidebar内的偏移）
      const newWidth = e.clientX
      const minWidth = 180
      const maxWidth = 400
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setSidebarWidth(newWidth)
        setSidebarCollapsed(newWidth < 200)
      }
    }

    const handleMouseUp = () => {
      isCurrentlyDragging = false
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    dragHandle.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      dragHandle.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

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
    if (path === '/downloads') return 'downloads'
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

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => !prev)
    if (sidebarCollapsed) {
      setSidebarWidth(240)
    } else {
      setSidebarWidth(70)
    }
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  return (
    <S.MainContainer $activeTab={activeTab}>
      <S.Header>
        <S.HeaderLeft>
          <S.MobileMenuToggle
            onClick={toggleMobileMenu}
            title="菜单"
            aria-label="菜单"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </S.MobileMenuToggle>
          <S.Logo>PiliNote</S.Logo>
        </S.HeaderLeft>
        <S.HeaderRight>
          {user ? (
            <>
              <S.DarkModeToggle
                onClick={toggleTheme}
                title={mode === 'dark' ? '切换到浅色模式' : '切换到暗色模式'}
                aria-label={mode === 'dark' ? '切换到浅色模式' : '切换到暗色模式'}
              >
                {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </S.DarkModeToggle>
              <S.WsStatusIcon
                $connected={connected}
                title={connected ? 'WebSocket 已连接' : 'WebSocket 连接断开，正在重连...'}
              >
                {connected ? <Wifi size={18} /> : <WifiOff size={18} />}
              </S.WsStatusIcon>
              <S.UserInfo onClick={handleAvatarClick}>
                <S.UserAvatar
                  src={getAvatarUrl(user.avatar || '')}
                  alt={user.username}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect fill='%235CB67B' width='40' height='40'/><text x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='white' font-size='20'>${user.username?.[0]?.toUpperCase() || 'U'}</text></svg>`
                  }}
                />
                <S.UserName>{user.username}</S.UserName>
                <S.AuthStatus
                  $status={authStatus}
                  title={`认证系统状态: ${authStatus === 'initialized' ? '已启用' : authStatus === 'error' ? '异常' : '初始化中...'}`}
                >
                  {authStatus === 'initialized' && <span>✓</span>}
                  {authStatus === 'error' && <span>!</span>}
                </S.AuthStatus>
              </S.UserInfo>
              {showLogoutConfirm && (
                <S.LogoutOverlay onClick={() => setShowLogoutConfirm(false)}>
                  <S.LogoutPanel onClick={(e) => e.stopPropagation()}>
                    <S.LogoutMessage>确定要退出登录吗？</S.LogoutMessage>
                    <S.LogoutButtons>
                      <S.SecondaryButton onClick={cancelLogout}>取消</S.SecondaryButton>
                      <S.PrimaryButton onClick={confirmLogout}>确定</S.PrimaryButton>
                    </S.LogoutButtons>
                  </S.LogoutPanel>
                </S.LogoutOverlay>
              )}
            </>
          ) : (
            <S.UserInfo onClick={handleAvatarClick}>
              <S.GuestAvatar>
                <User size={20} />
              </S.GuestAvatar>
              <S.UserName>游客</S.UserName>
            </S.UserInfo>
          )}
        </S.HeaderRight>
      </S.Header>

      <S.MainContent>
        {/* 移动端侧边栏遮罩 */}
        {mobileMenuOpen && (
          <S.MobileSidebarOverlay onClick={() => setMobileMenuOpen(false)} />
        )}

        {/* 桌面端侧边栏或移动端侧边栏 */}
        {!isMobile && (
          <S.Sidebar 
            $width={sidebarWidth}
            $collapsed={sidebarCollapsed}
          >
            <S.SidebarNav role="tablist" aria-label="功能导航">
              {navItems.map((item) => (
                <S.SidebarTab
                  key={item.id}
                  role="tab"
                  aria-selected={activeTab === item.id}
                  aria-controls={`${item.id}-panel`}
                  $active={activeTab === item.id}
                  $collapsed={sidebarCollapsed}
                  onClick={() => {
                    handleTabChange(item.path)
                  }}
                  tabIndex={activeTab === item.id ? 0 : -1}
                >
                  <item.icon className="sidebar-icon" />
                  <span className="sidebar-label">{item.label}</span>
                </S.SidebarTab>
              ))}
            </S.SidebarNav>
            
            {/* 侧边栏折叠按钮 */}
            <S.SidebarCollapseButton
              onClick={toggleSidebarCollapsed}
              title={sidebarCollapsed ? '展开侧边栏' : '收缩侧边栏'}
              aria-label={sidebarCollapsed ? '展开侧边栏' : '收缩侧边栏'}
            >
              {sidebarCollapsed ? <ArrowRightToLine size={16} /> : <ArrowLeftToLine size={16} />}
            </S.SidebarCollapseButton>
            
            {/* 拖拽手柄 */}
            <S.SidebarDragHandle 
              ref={dragRef}
              $isDragging={isDragging}
              title="拖拽调整侧边栏宽度"
            >
              <GripVertical size={16} />
            </S.SidebarDragHandle>
          </S.Sidebar>
        )}

        <S.ContentArea>
          <S.ContentWrapper>
            <div className={activeTab === 'home' ? 'block' : 'hidden'}>
              <HomeContent />
            </div>
            <div className={activeTab === 'favorites' ? 'block' : 'hidden'}>
              {isAuthenticated ? (
                <FavoritesContent />
              ) : (
                <LoginPrompt message="登录后可以查看和管理您的收藏夹" />
              )}
            </div>
            <div className={activeTab === 'watch-later' ? 'block' : 'hidden'}>
              {isAuthenticated ? (
                <WatchLaterContent />
              ) : (
                <LoginPrompt message="登录后可以查看和管理您的稍后再看列表" />
              )}
            </div>
            <div className={activeTab === 'downloads' ? 'block' : 'hidden'}>
              <NewDownloadContent />
            </div>
          </S.ContentWrapper>
        </S.ContentArea>
      </S.MainContent>

      {/* 底部导航栏 - 仅移动端显示 */}
      {isMobile && (
        <S.BottomNav 
          role="navigation" 
          aria-label="底部导航"
        >
          {navItems.map((item) => (
            <S.NavItem
              key={item.id}
              $active={activeTab === item.id}
              onClick={() => handleTabChange(item.path)}
              aria-label={item.label}
              aria-current={activeTab === item.id ? 'page' : undefined}
            >
              <item.icon className="nav-icon" />
              <S.NavLabel $active={activeTab === item.id}>{item.label}</S.NavLabel>
            </S.NavItem>
          ))}
        </S.BottomNav>
      )}
    </S.MainContainer>
  )
}

function LoginPrompt({ message }: { message: string }) {
  const navigate = useNavigate()

  return (
    <S.LoginPromptContainer>
      <S.EmptyStateIcon as={LogIn} />
      <S.LoginPromptTitle>请先登录</S.LoginPromptTitle>
      <S.LoginPromptMessage>{message}</S.LoginPromptMessage>
      <S.LoginButton onClick={() => navigate('/login')}>
        去登录
      </S.LoginButton>
    </S.LoginPromptContainer>
  )
}

function AuthGuardWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  if (!isAuthenticated) {
    return (
      <S.LoginPromptContainer>
        <S.EmptyStateIcon as={LogIn} />
        <S.LoginPromptTitle>请先登录</S.LoginPromptTitle>
        <S.LoginPromptMessage>登录后可以查看和管理您的内容</S.LoginPromptMessage>
        <S.LoginButton onClick={() => navigate('/login')}>
          去登录
        </S.LoginButton>
      </S.LoginPromptContainer>
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

export function DownloadsPage() {
  return <NewDownloadContent />
}

export default MainLayout