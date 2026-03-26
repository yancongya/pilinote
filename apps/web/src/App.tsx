import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import { useAuthStore } from './stores/auth'

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <div className="app">
      {isAuthenticated ? (
        <HomePage />
      ) : (
        <LoginPage />
      )}
    </div>
  )
}

export default App
