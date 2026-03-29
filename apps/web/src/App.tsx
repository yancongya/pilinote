import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import VideoDetailPage from './pages/VideoDetailPage'
import DownloadSeriesDetailPage from './pages/DownloadSeriesDetailPage'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth'

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  const handleLogin = () => {
    // 登录成功后，用户信息已经在LoginPage中通过setUser设置
    // 这里只需要确保isAuthenticated状态正确
    // 实际上isAuthenticated会在setUser时自动更新
  }

  return isAuthenticated ? (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/favorites" element={<HomePage />} />
      <Route path="/favorites/:folderId" element={<HomePage />} />
      <Route path="/watch-later" element={<HomePage />} />
      <Route path="/downloads" element={<HomePage />} />
      <Route path="/video/:videoId" element={<VideoDetailPage />} />
      <Route path="/download/series/:seriesId" element={<DownloadSeriesDetailPage />} />
    </Routes>
  ) : (
    <Routes>
      <Route path="*" element={<LoginPage onLogin={handleLogin} />} />
    </Routes>
  )
}

export default App
