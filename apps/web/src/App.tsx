import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import VideoDetailPage from './pages/VideoDetailPage'
import DownloadDetailPage from './pages/DownloadDetailPage'
import DownloadSeriesDetailPage from './pages/DownloadSeriesDetailPage'
import SettingsPage from './pages/SettingsPage'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth'
import { useEffect } from 'react'
import { ToastProvider } from './components/Toast'

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const location = useLocation()
  const navigate = useNavigate()

  // 调试：打印认证状态
  useEffect(() => {
    const user = useAuthStore.getState().user
  }, [isAuthenticated])

  const handleLogin = () => {
    // 登录成功后，用户信息已经在LoginPage中通过setUser设置
    // 这里只需要确保isAuthenticated状态正确
    // 实际上isAuthenticated会在setUser时自动更新
    
    // 如果是从Settings页面跳转过来的（新增账号），登录成功后返回首页
    if (location.state?.fromSettings) {
      navigate('/home')
    }
  }

  // 定义需要登录的路由
  const protectedRoutes = ['/settings']
  
  // 定义可以无登录访问的路由
  const publicRoutes = ['/home', '/video/:videoId', '/download/series/:seriesId']
  
  // 定义需要登录才能显示数据的路由（但在未登录时可以访问页面）
  const dataRoutes = ['/favorites', '/favorites/:folderId', '/watch-later', '/downloads', '/downloads/:bvid']

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
