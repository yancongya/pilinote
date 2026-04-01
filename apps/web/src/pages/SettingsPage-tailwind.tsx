import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
  Info,
  Save,
  RefreshCw,
  Check
} from 'lucide-react'
import AccountsSettings from './settings/AccountsSettings'
import DownloadSettings from './settings/DownloadSettings'
import StorageSettings from './settings/StorageSettings'
import { ConfirmModal } from '../components/Modal'
import '../settings-tailwind.css'
import '../settings-components.css'

type TabType = 'accounts' | 'download' | 'storage'

// 定义ref类型
interface SettingsComponentRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

function SettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuthStore()
  const [animationParent] = useAutoAnimate({ duration: 200, easing: 'ease-out' })
  
  const tabs = [
    { id: 'accounts' as TabType, label: '账号管理', icon: User },
    { id: 'download' as TabType, label: '下载设置', icon: Download },
    { id: 'storage' as TabType, label: '数据管理', icon: Database }
  ]

  // 从hash初始化activeTab
  const getInitialTab = (): TabType => {
    const hash = location.hash.slice(1)
    if (hash && tabs.some(tab => tab.id === hash)) {
      return hash as TabType
    }
    return 'accounts'
  }
  
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab)
  const storageSettingsRef = useRef<SettingsComponentRef>(null)
  const downloadSettingsRef = useRef<SettingsComponentRef>(null)
  
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // 监听hash变化（通过浏览器前进/后退按钮）
  useEffect(() => {
    const hash = location.hash.slice(1)
    if (hash && tabs.some(tab => tab.id === hash) && hash !== activeTab) {
      setActiveTab(hash as TabType)
    }
  }, [location.hash])

  // 更新hash（当activeTab变化时）
  useEffect(() => {
    const currentHash = location.hash.slice(1)
    if (currentHash !== activeTab) {
      navigate(`#${activeTab}`, { replace: true })
    }
  }, [activeTab, navigate])

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

  // 检查是否有未保存的修改
  const hasUnsavedChanges = (tabId?: TabType) => {
    const targetTab = tabId || activeTab
    if (targetTab === 'storage' && storageSettingsRef.current) {
      return storageSettingsRef.current.hasUnsavedChanges()
    }
    if (targetTab === 'download' && downloadSettingsRef.current) {
      return downloadSettingsRef.current.hasUnsavedChanges()
    }
    return false
  }

  // 保存当前Tab的设置
  const handleSave = async () => {
    setSaving(true)
    setSavedStatus('saving')

    try {
      if (activeTab === 'storage' && storageSettingsRef.current) {
        await storageSettingsRef.current.saveSettings()
      } else if (activeTab === 'download' && downloadSettingsRef.current) {
        await downloadSettingsRef.current.saveSettings()
      }
      
      setSavedStatus('saved')
      // 2秒后重置状态
      setTimeout(() => {
        setSavedStatus('idle')
      }, 2000)
    } catch (err) {
      setSavedStatus('error')
      setError('保存失败')
      console.error('保存设置失败:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-secondary-50 to-secondary-100 flex flex-col pb-6">
      {/* 集成式顶部导航栏 */}
      <div className="sticky top-0 z-50 bg-white/98 backdrop-blur-settings border-b border-secondary-200 shadow-navbar px-4 pt-4 pb-4 md:px-5">
        <div className="max-w-settings-xl mx-auto flex items-center gap-4 md:gap-5">
          {/* 左侧：返回操作区 */}
          <div className="flex-shrink-0 flex items-center gap-3">
            <button
              className="flex items-center justify-center gap-2 px-3 py-3 bg-gradient-to-r from-white to-secondary-100 text-secondary-600 border-2 border-secondary-200 rounded-lg min-h-touch min-w-touch transition-all duration-300 hover:from-secondary-100 hover:to-secondary-200 hover:text-primary-600 hover:border-secondary-300 hover:-translate-y-0.5 hover:shadow-settings focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              onClick={() => navigate('/home')}
              aria-label="返回首页"
              tabIndex={0}
            >
              <ArrowLeft className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" />
              <span className="text-sm font-semibold hidden sm:inline">返回</span>
            </button>
          </div>
          
          {/* 右侧：标签导航区 */}
          <div className="flex-1 min-w-0">
            <div className="w-full bg-gradient-to-r from-secondary-100 to-secondary-200 rounded-xl p-1 shadow-inner">
              <div className="flex w-full gap-1 items-center justify-between">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-sm font-semibold min-h-navbar transition-all duration-300 ${
                      activeTab === tab.id 
                        ? 'bg-white text-primary-600 shadow-settings font-bold -translate-y-0.5' 
                        : 'text-secondary-500 hover:text-primary-600 hover:bg-white/60 hover:-translate-y-px'
                    }`}
                    onClick={() => handleTabChange(tab.id)}
                    aria-label={tab.label}
                    aria-pressed={activeTab === tab.id}
                    aria-controls="settings-content"
                    role="tab"
                    tabIndex={activeTab === tab.id ? 0 : -1}
                  >
                    <tab.icon className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* 状态指示器 */}
        <div className="flex items-center justify-center mt-2 min-h-5">
          {hasUnsavedChanges() && savedStatus === 'idle' && (
            <span className="status-indicator bg-warning-100 text-warning-600 animate-fade-in">
              有未保存的更改
            </span>
          )}
          {savedStatus === 'saving' && (
            <span className="status-indicator bg-secondary-100 text-secondary-600 animate-pulse-slow">
              保存中...
            </span>
          )}
          {savedStatus === 'saved' && (
            <span className="status-indicator bg-success-100 text-success-600 animate-fade-in">
              已保存
            </span>
          )}
        </div>
      </div>

      {/* Tab 内容区域 */}
      <div 
        className="flex-1 px-4 py-6 md:px-5 md:pb-40 max-w-settings mx-auto w-full"
        ref={animationParent}
        id="settings-content"
        role="tabpanel"
        aria-label={`${tabs.find(t => t.id === activeTab)?.label}内容`}
      >
        {error && (
          <div 
            className="flex items-center justify-between gap-4 p-4 bg-gradient-to-r from-error-50 to-error-100 border border-error-200 rounded-xl mb-6 shadow-settings animate-slide-up"
            role="alert"
            aria-live="assertive"
          >
            <span className="flex-1 text-base font-medium text-error-600 leading-relaxed">{error}</span>
            <button 
              className="flex items-center justify-center w-8 h-8 min-w-8 min-h-8 bg-transparent border-none text-error-600 rounded-lg cursor-pointer transition-colors duration-200 hover:bg-error-100 focus:outline-none focus:ring-2 focus:ring-error-500"
              onClick={() => setError('')}
              aria-label="关闭错误提示"
            >
              ✕
            </button>
          </div>
        )}

        {activeTab === 'accounts' && <AccountsSettings />}
        {activeTab === 'download' && (
          <DownloadSettings ref={downloadSettingsRef} />
        )}
        {activeTab === 'storage' && <StorageSettings ref={storageSettingsRef} />}
      </div>

      {/* 底部操作区域 */}
      {activeTab === 'accounts' && (
        <footer className="px-4 py-6 md:px-5 max-w-settings mx-auto w-full space-y-5">
          {/* 应用信息卡片 */}
          <div className="settings-card rounded-xl overflow-hidden shadow-settings">
            <div className="flex items-center gap-4 p-5">
              <Info className="w-6 h-6 text-secondary-500 flex-shrink-0" />
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm font-medium text-secondary-500">应用版本</span>
                <span className="text-xl font-bold text-secondary-800">1.0.0</span>
              </div>
            </div>
          </div>

          {/* 退出登录按钮 */}
          <button
            className="settings-button-danger w-full flex items-center justify-center gap-3 px-6 py-5 rounded-xl text-xl font-semibold min-h-[60px] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2"
            onClick={() => setShowLogoutConfirm(true)}
            aria-label="退出登录"
          >
            <LogOut className="w-6 h-6" />
            <span>退出登录</span>
          </button>
        </footer>
      )}

      {/* 悬浮保存按钮 */}
      {(activeTab === 'storage' || activeTab === 'download') && (
        <button
          className={`fab-save-btn flex items-center justify-center rounded-2xl border-none cursor-pointer transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            hasUnsavedChanges() 
              ? 'bg-gradient-to-r from-warning-500 to-warning-600 text-white shadow-fab hover:-translate-y-1 hover:shadow-fab-hover animate-pulse-slow' 
              : savedStatus === 'saving'
                ? 'bg-gradient-to-r from-secondary-400 to-secondary-500 text-white shadow-fab cursor-not-allowed'
                : savedStatus === 'saved'
                  ? 'bg-gradient-to-r from-success-500 to-success-600 text-white shadow-fab'
                  : 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-fab hover:-translate-y-1 hover:shadow-fab-hover'
          }`}
          onClick={handleSave}
          disabled={saving}
          aria-label="保存设置"
          title={hasUnsavedChanges() ? "保存设置" : "没有需要保存的修改"}
        >
          {savedStatus === 'saving' ? (
            <RefreshCw className="w-6 h-6 animate-spin" />
          ) : savedStatus === 'saved' ? (
            <Check className="w-6 h-6" />
          ) : (
            <Save className="w-6 h-6" />
          )}
        </button>
      )}

      {/* 退出登录确认对话框 */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="确认退出登录"
        message="确定要退出登录吗？退出后需要重新登录才能使用。"
        confirmText="确定退出"
        cancelText="取消"
        confirmVariant="primary"
        loading={saving}
      />
    </main>
  )
}

export default SettingsPage