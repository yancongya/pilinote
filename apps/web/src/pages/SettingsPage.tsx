import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useAuthStore } from '../stores/auth'
import { apiService } from '../services/api'
import { 
  ArrowLeft, 
  User, 
  LogOut, 
  Settings,
  Download,
  Database
} from 'lucide-react'
import AccountsSettings from './settings/AccountsSettings'
import DownloadSettings from './settings/DownloadSettings'
import StorageSettings from './settings/StorageSettings'

type TabType = 'accounts' | 'download' | 'storage'

function SettingsPage() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const [animationParent] = useAutoAnimate({ duration: 200, easing: 'ease-out' })
  const [activeTab, setActiveTab] = useState<TabType>('accounts')
  
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [error, setError] = useState('')

  const tabs = [
    { id: 'accounts' as TabType, label: '账号管理', icon: User },
    { id: 'download' as TabType, label: '下载设置', icon: Download },
    { id: 'storage' as TabType, label: '数据管理', icon: Database }
  ]

  const handleLogout = async () => {
    try {
      await apiService.logout()
      logout()
      setShowLogoutConfirm(false)
      navigate('/')
    } catch (err) {
      setError('退出登录失败')
    }
  }

  return (
    <main className="settings-page">
      <div className="settings-header">
        <button
          className="back-button"
          onClick={() => navigate('/home')}
          aria-label="返回首页"
        >
          <ArrowLeft />
          <span>返回</span>
        </button>
        <h1>
          <Settings />
          <span>设置</span>
        </h1>
      </div>

      {/* Tab导航 */}
      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-label={tab.label}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            <tab.icon />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab内容 */}
      <div className="settings-content" ref={animationParent}>
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        {activeTab === 'accounts' && <AccountsSettings />}
        {activeTab === 'download' && <DownloadSettings />}
        {activeTab === 'storage' && <StorageSettings />}
      </div>

      {/* 退出登录 */}
      <section className="settings-section">
        <button
          className="logout-button"
          onClick={() => setShowLogoutConfirm(true)}
          aria-label="退出登录"
        >
          <LogOut />
          <span>退出登录</span>
        </button>
      </section>

      {/* 应用信息 */}
      <section className="settings-section">
        <div className="app-info">
          <div className="app-info-item">
            <Settings className="app-info-icon" />
            <div className="app-info-text">
              <p className="app-info-label">应用版本</p>
              <p className="app-info-value">1.0.0</p>
            </div>
          </div>
        </div>
      </section>

      {/* 退出登录确认 */}
      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>确认退出登录</h3>
            </div>
            <div className="modal-body">
              <p>确定要退出登录吗？</p>
            </div>
            <div className="modal-footer">
              <button
                className="modal-btn cancel-btn"
                onClick={() => setShowLogoutConfirm(false)}
              >
                取消
              </button>
              <button
                className="modal-btn confirm-btn"
                onClick={handleLogout}
              >
                确定退出
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default SettingsPage