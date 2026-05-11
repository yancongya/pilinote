import LoginPage from './pages/LoginPage'
import VideoDetailPage from './pages/VideoDetailPage'
import SettingsPage from './pages/SettingsPage'
import MainLayout from './components/MainLayout.refactored'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth'
import { useSettingsStore } from './stores/settings'
import { useNewQueueStore } from './stores/newQueue'
import { useEffect } from 'react'
import { ToastProvider } from './components/Toast'
import AiNotePanel from './pages/components/AiNotePanel'

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const fetchUser = useAuthStore((state) => state.fetchUser)
  const setIsLoading = useAuthStore((state) => state.setIsLoading)
  const location = useLocation()
  const navigate = useNavigate()
  const connectWebSocket = useNewQueueStore((state) => state.connectWebSocket)
  const fetchSettings = useSettingsStore((state) => state.fetchSettings)

  useEffect(() => {
    const restoreUserData = async () => {
      try {
        setIsLoading(false)
        await fetchUser()
        await fetchSettings()
      } catch (err) {
        console.error('[App] 数据恢复失败:', err)
      }
    }

    restoreUserData()
  }, [])

  useEffect(() => {
    useAuthStore.getState().user
  }, [isAuthenticated])

  useEffect(() => {
    connectWebSocket()
  }, [connectWebSocket])

  useEffect(() => {
    if (isAuthenticated && location.pathname === '/login') {
      const searchParams = new URLSearchParams(location.search)
      const mode = searchParams.get('mode')
      
      if (mode !== 'add') {
        navigate('/home', { replace: true })
      }
    }
  }, [isAuthenticated, location.pathname, location.search, navigate])

  const handleLogin = () => {
    navigate('/home')
  }

  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<MainLayout />} />
        <Route path="/favorites" element={<MainLayout />} />
        <Route path="/favorites/:folderId" element={<MainLayout />} />
        <Route path="/watch-later" element={<MainLayout />} />
        <Route path="/history" element={<MainLayout />} />
        <Route path="/subscriptions" element={<MainLayout />} />
        <Route path="/subscriptions/:sourceType/:sourceId" element={<MainLayout />} />
        <Route path="/downloads" element={<MainLayout />} />
        <Route path="/opus/:opusId" element={<VideoDetailPage type="opus" />} />
        <Route path="/opus/:opusId/ai" element={<AiNotePanel />} />
        <Route path="/video/:videoId" element={<VideoDetailPage />} />
        <Route path="/video/:videoId/ai" element={<AiNotePanel />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </ToastProvider>
  )
}

export default App
