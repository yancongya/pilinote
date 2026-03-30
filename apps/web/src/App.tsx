import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import VideoDetailPage from './pages/VideoDetailPage'
import DownloadDetailPage from './pages/DownloadDetailPage'
import DownloadSeriesDetailPage from './pages/DownloadSeriesDetailPage'
import SettingsPage from './pages/SettingsPage'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth'
import { useEffect } from 'react'

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

  return isAuthenticated ? (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/favorites" element={<HomePage />} />
      <Route path="/favorites/:folderId" element={<HomePage />} />
      <Route path="/watch-later" element={<HomePage />} />
      <Route path="/downloads" element={<HomePage />} />
      <Route path="/downloads/:bvid" element={<DownloadDetailPage />} />
      <Route path="/video/:videoId" element={<VideoDetailPage />} />
      <Route path="/download/series/:seriesId" element={<DownloadSeriesDetailPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/login" element={<Navigate to="/home" replace />} />
    </Routes>
  ) : (
    <Routes>
      <Route path="*" element={<LoginPage onLogin={handleLogin} />} />
    </Routes>
  )
}

export default App
