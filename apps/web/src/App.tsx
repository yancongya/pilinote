import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  return (
    <div className="app">
      {isLoggedIn ? (
        <HomePage onLogout={() => setIsLoggedIn(false)} />
      ) : (
        <LoginPage onLogin={() => setIsLoggedIn(true)} />
      )}
    </div>
  )
}

export default App
