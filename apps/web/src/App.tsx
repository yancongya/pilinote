import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import VideoDetailPage from './pages/VideoDetailPage'
import SettingsPage from './pages/SettingsPage'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth'
import { useSettingsStore } from './stores/settings'
import { useNewQueueStore } from './stores/newQueue'
import { useEffect } from 'react'
import { ToastProvider } from './components/Toast'
import { apiService } from './services/api'

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const fetchUser = useAuthStore((state) => state.fetchUser)
  const location = useLocation()
  const navigate = useNavigate()
  const connectWebSocket = useNewQueueStore((state) => state.connectWebSocket)
  const fetchSettings = useSettingsStore((state) => state.fetchSettings)

  // 数据恢复逻辑：从后端获取用户信息和设置信息
  useEffect(() => {
    const restoreUserData = async () => {
      try {
        console.log('[App] 正在从后端验证会话状态...')
        await fetchUser()
        console.log('[App] fetchUser完成，当前登录状态:', isAuthenticated)
        console.log('[App] 当前用户信息:', user)
        await fetchSettings()

        console.log('[App] 数据恢复完成')
      } catch (err) {
        console.error('[App] 数据恢复失败:', err)
      }
    }

    restoreUserData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 调试：打印认证状态
  useEffect(() => {
    useAuthStore.getState().user
  }, [isAuthenticated])

  // 连接 WebSocket
  useEffect(() => {
    connectWebSocket()
  }, [connectWebSocket])

  // 如果用户已登录但仍在登录页面，自动跳转到首页
  useEffect(() => {
    if (isAuthenticated && location.pathname === '/login') {
      // 如果是添加账号模式，不自动跳转
      const searchParams = new URLSearchParams(location.search)
      const mode = searchParams.get('mode')
      
      if (mode !== 'add') {
        navigate('/home', { replace: true })
      }
    }
  }, [isAuthenticated, location.pathname, location.search, navigate])

  const handleLogin = () => {
    // 登录成功后，跳转到首页
    // 注意：用户信息已经在LoginPage中通过setUser设置，isAuthenticated会自动更新为true
    navigate('/home')
  }

  return (
    <ToastProvider>
      <Routes>
        {/* 默认路由跳转到首页 */}
        <Route path="/" element={<Navigate to="/home" replace />} />

        {/* 公开路由 - 游客也可以访问 */}
        <Route path="/home" element={<HomePage />} />
        <Route path="/video/:videoId" element={<VideoDetailPage />} />

        {/* 数据路由 - 可以访问页面，但未登录时显示空状态 */}
        <Route path="/favorites" element={<HomePage />} />
        <Route path="/favorites/:folderId" element={<HomePage />} />
        <Route path="/watch-later" element={<HomePage />} />
        <Route path="/new-downloads" element={<HomePage />} />

        {/* 受保护路由 - 需要登录 */}
        <Route path="/settings" element={<SettingsPage />} />

        {/* 登录页面 - 游客可以选择进入 */}
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />

        {/* 404 路由 */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </ToastProvider>
  )
}

export default App
