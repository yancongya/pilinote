import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './theme/context/ThemeContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <ThemeProvider>
      <div className="app">
        <App />
      </div>
    </ThemeProvider>
  </BrowserRouter>,
)
