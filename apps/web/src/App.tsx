import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import VideoDetailPage from './pages/VideoDetailPage'
import DownloadDetailPage from './pages/DownloadDetailPage'
import DownloadSeriesDetailPage from './pages/DownloadSeriesDetailPage'
import SettingsPage from './pages/SettingsPage'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth'
import { useNewQueueStore } from './stores/newQueue'
import { useEffect } from 'react'
import { ToastProvider } from './components/Toast'

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const location = useLocation()
  const navigate = useNavigate()
  const connectWebSocket = useNewQueueStore((state) => state.connectWebSocket)

  // 调试：打印认证状态
  useEffect(() => {
    useAuthStore.getState().user
  }, [isAuthenticated])

  // 连接 WebSocket
  useEffect(() => {
    console.log('[App] Connecting to WebSocket...')
    connectWebSocket()
  }, [connectWebSocket])

  // 如果用户已登录但仍在登录页面，自动跳转到首页
  useEffect(() => {
    if (isAuthenticated && location.pathname === '/login') {
      navigate('/home', { replace: true })
    }
  }, [isAuthenticated, location.pathname, navigate])

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
        <Route path="/download/series/:seriesId" element={<DownloadSeriesDetailPage />} />

        {/* 数据路由 - 可以访问页面，但未登录时显示空状态 */}
        <Route path="/favorites" element={<HomePage />} />
        <Route path="/favorites/:folderId" element={<HomePage />} />
        <Route path="/watch-later" element={<HomePage />} />
        <Route path="/downloads" element={<HomePage />} />
        <Route path="/downloads/:bvid" element={<DownloadDetailPage />} />
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
