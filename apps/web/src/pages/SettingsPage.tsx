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
  Database,
  Info
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

  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId)
    setError('')
  }

  return (
    <main className="settings-page-new">
      {/* 顶部导航栏 */}
      <header className="settings-header-new">
        <button
          className="settings-back-button"
          onClick={() => navigate('/home')}
          aria-label="返回首页"
          tabIndex={0}
        >
          <ArrowLeft className="settings-back-icon" />
          <span className="settings-back-text">返回</span>
        </button>
        <h1 className="settings-title-new">
          <Settings className="settings-title-icon" />
          <span>设置</span>
        </h1>
        <div className="settings-header-spacer" />
      </header>

      {/* 分段控制器 Tab 导航 */}
      <div className="settings-segmented-control">
        <div className="settings-segmented-track">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              className={`settings-segment-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
              aria-label={tab.label}
              aria-pressed={activeTab === tab.id}
              aria-controls="settings-content"
              role="tab"
              tabIndex={activeTab === tab.id ? 0 : -1}
            >
              <tab.icon className="settings-segment-icon" />
              <span className="settings-segment-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab 内容区域 */}
      <div 
        className="settings-content-new" 
        ref={animationParent}
        id="settings-content"
        role="tabpanel"
        aria-label={`${tabs.find(t => t.id === activeTab)?.label}内容`}
      >
        {error && (
          <div 
            className="settings-error-toast"
            role="alert"
            aria-live="assertive"
          >
            <span className="settings-error-text">{error}</span>
            <button 
              className="settings-error-close"
              onClick={() => setError('')}
              aria-label="关闭错误提示"
            >
              ✕
            </button>
          </div>
        )}

        {activeTab === 'accounts' && <AccountsSettings />}
        {activeTab === 'download' && <DownloadSettings />}
        {activeTab === 'storage' && <StorageSettings />}
      </div>

      {/* 底部操作区域 */}
      <footer className="settings-footer">
        {/* 应用信息卡片 */}
        <div className="settings-info-card">
          <div className="settings-info-item">
            <Info className="settings-info-icon" />
            <div className="settings-info-content">
              <span className="settings-info-label">应用版本</span>
              <span className="settings-info-value">1.0.0</span>
            </div>
          </div>
        </div>

        {/* 退出登录按钮 */}
        <button
          className="settings-logout-button"
          onClick={() => setShowLogoutConfirm(true)}
          aria-label="退出登录"
        >
          <LogOut className="settings-logout-icon" />
          <span className="settings-logout-text">退出登录</span>
        </button>
      </footer>

      {/* 退出登录确认对话框 */}
      {showLogoutConfirm && (
        <div 
          className="settings-modal-overlay"
          onClick={() => setShowLogoutConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
        >
          <div 
            className="settings-modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-modal-header">
              <h3 id="logout-confirm-title" className="settings-modal-title">确认退出登录</h3>
            </div>
            <div className="settings-modal-body">
              <p className="settings-modal-text">确定要退出登录吗？</p>
            </div>
            <div className="settings-modal-footer">
              <button
                className="settings-modal-button settings-modal-button-cancel"
                onClick={() => setShowLogoutConfirm(false)}
                aria-label="取消退出登录"
              >
                取消
              </button>
              <button
                className="settings-modal-button settings-modal-button-confirm"
                onClick={handleLogout}
                aria-label="确认退出登录"
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