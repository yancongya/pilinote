import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import { useAuthStore } from './stores/auth'

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  const handleLogin = () => {
    // 登录成功后，用户信息已经在LoginPage中通过setUser设置
    // 这里只需要确保isAuthenticated状态正确
    // 实际上isAuthenticated会在setUser时自动更新
  }

  return (
    <div className="app">
      {isAuthenticated ? (
        <HomePage />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </div>
  )
}

export default App
