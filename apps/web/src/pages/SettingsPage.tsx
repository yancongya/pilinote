import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { 
  ArrowLeft, 
  User, 
  Download,
  Database,
  Save,
  RefreshCw,
  Cloud,
  Clock
} from 'lucide-react'
import AccountsSettings from './settings/AccountsSettings'
import DownloadSettings from './settings/DownloadSettings'
import StorageSettings from './settings/StorageSettings'
import BackupSettings from './settings/BackupSettings'
import AutoDownloadSettings from './settings/AutoDownloadSettings'
import { useToast } from '../components/Toast'
import '../settings-page.css'

type TabType = 'accounts' | 'download' | 'storage' | 'backup' | 'auto-download'

// 定义ref类型
interface SettingsComponentRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

function SettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [animationParent] = useAutoAnimate({ duration: 200, easing: 'ease-out' })
  const { showToast } = useToast()
  
  const tabs = [
    { id: 'accounts' as TabType, label: '账号', icon: User },
    { id: 'download' as TabType, label: '下载', icon: Download },
    { id: 'storage' as TabType, label: '数据', icon: Database },
    { id: 'backup' as TabType, label: '备份', icon: Cloud },
    { id: 'auto-download' as TabType, label: '定时', icon: Clock }
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
  const backupSettingsRef = useRef<SettingsComponentRef>(null)
  const autoDownloadSettingsRef = useRef<SettingsComponentRef>(null)
  const tabBarRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  
  const [saving, setSaving] = useState(false)

  // 更新指示器位置
  useEffect(() => {
    const updateIndicator = () => {
      if (tabBarRef.current) {
        const activeBtn = tabBarRef.current.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement
        if (activeBtn) {
          setIndicatorStyle({
            left: activeBtn.offsetLeft,
            width: activeBtn.offsetWidth
          })
        }
      }
    }
    
    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [activeTab])

  // 监听hash变化（通过浏览器前进/后退按钮）
  useEffect(() => {
    const hash = location.hash.slice(1)
    if (hash && tabs.some(tab => tab.id === hash) && hash !== activeTab) {
      setActiveTab(hash as TabType)
    }
  }, [location.hash, activeTab, tabs])

  // 更新hash（当activeTab变化时）
  useEffect(() => {
    const currentHash = location.hash.slice(1)
    if (currentHash !== activeTab) {
      navigate(`#${activeTab}`, { replace: true })
    }
  }, [activeTab, navigate])

  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId)
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
    if (targetTab === 'backup' && backupSettingsRef.current) {
      return backupSettingsRef.current.hasUnsavedChanges()
    }
    if (targetTab === 'auto-download' && autoDownloadSettingsRef.current) {
      return autoDownloadSettingsRef.current.hasUnsavedChanges()
    }
    return false
  }

  // 保存当前Tab的设置
  const handleSave = async () => {
    setSaving(true)

    try {
      if (activeTab === 'storage' && storageSettingsRef.current) {
        await storageSettingsRef.current.saveSettings()
      } else if (activeTab === 'download' && downloadSettingsRef.current) {
        await downloadSettingsRef.current.saveSettings()
      } else if (activeTab === 'backup' && backupSettingsRef.current) {
        await backupSettingsRef.current.saveSettings()
      } else if (activeTab === 'auto-download' && autoDownloadSettingsRef.current) {
        await autoDownloadSettingsRef.current.saveSettings()
      }
      
      showToast('设置已保存', 'success')
    } catch (err) {
      if (err instanceof Error && err.message === '没有需要保存的修改') {
        showToast('没有需要保存的修改', 'info')
      } else {
        showToast('保存失败', 'error')
      }
      console.error('保存设置失败:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="settings-page-new">
      {/* 顶部导航栏 */}
      <header className="s-header">
        <div className="s-header-inner">
          {/* 返回按钮 */}
          <button
            className="s-back-btn"
            onClick={() => navigate('/home')}
            aria-label="返回首页"
          >
            <ArrowLeft size={22} />
          </button>

          {/* 标题 */}
          <h1 className="s-title">设置</h1>

          {/* 占位保持标题居中 */}
          <div className="s-spacer" />
        </div>

        {/* Tab 栏 */}
        <div className="s-tab-bar" ref={tabBarRef}>
          <div 
            className="s-tab-indicator" 
            style={{ 
              transform: `translateX(${indicatorStyle.left}px)`,
              width: `${indicatorStyle.width}px`
            }} 
          />
          {tabs.map((tab) => (
            <button
              key={tab.id}
              data-tab={tab.id}
              className={`s-tab ${activeTab === tab.id ? 's-tab-active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
              aria-label={tab.label}
              aria-pressed={activeTab === tab.id}
            >
              <tab.icon size={18} className="s-tab-icon" />
              <span className="s-tab-label">{tab.label}</span>
              {hasUnsavedChanges(tab.id) && (
                <span className="s-tab-dot" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Tab 内容区域 */}
      <div 
        className="settings-content-new"
        ref={animationParent}
        id="settings-content"
        role="tabpanel"
        aria-label={`${tabs.find(t => t.id === activeTab)?.label}内容`}
      >
        {activeTab === 'accounts' && <AccountsSettings />}
        {activeTab === 'download' && (
          <DownloadSettings ref={downloadSettingsRef} />
        )}
        {activeTab === 'storage' && <StorageSettings ref={storageSettingsRef} />}
        {activeTab === 'backup' && <BackupSettings ref={backupSettingsRef} />}
        {activeTab === 'auto-download' && <AutoDownloadSettings ref={autoDownloadSettingsRef} />}
      </div>

      {/* 悬浮保存按钮 */}
      {(activeTab === 'storage' || activeTab === 'download' || activeTab === 'backup' || activeTab === 'auto-download') && (
        <button
          className={`settings-fab-save-btn ${hasUnsavedChanges() ? 'has-changes' : ''} ${saving ? 'saving' : ''}`}
          onClick={handleSave}
          disabled={saving}
          aria-label="保存设置"
          title={hasUnsavedChanges() ? "保存设置" : "没有需要保存的修改"}
        >
          {saving ? (
            <RefreshCw className="settings-fab-icon spinning" />
          ) : (
            <Save className="settings-fab-icon" />
          )}
        </button>
      )}

      <style>{`
        /* 顶部导航栏 */
        .s-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: #fff;
          border-bottom: 1px solid #f0f0f0;
        }

        .s-header-inner {
          display: flex;
          align-items: center;
          height: 52px;
          padding: 0 16px;
          padding-top: env(safe-area-inset-top, 0px);
        }

        /* 返回按钮 */
        .s-back-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          padding: 0;
          border: none;
          background: transparent;
          color: #1E293B;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s ease;
          flex-shrink: 0;
          -webkit-tap-highlight-color: transparent;
        }

        .s-back-btn:active {
          background: #f5f5f5;
        }

        /* 标题 */
        .s-title {
          flex: 1;
          margin: 0;
          font-size: 17px;
          font-weight: 600;
          color: #1E293B;
          text-align: center;
          letter-spacing: -0.01em;
        }

        .s-spacer {
          width: 36px;
          flex-shrink: 0;
        }

        /* Tab 栏 */
        .s-tab-bar {
          display: flex;
          position: relative;
          padding: 0 16px;
          gap: 0;
        }

        .s-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 12px 8px 10px;
          border: none;
          background: transparent;
          color: #94A3B8;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.2s ease;
          position: relative;
          -webkit-tap-highlight-color: transparent;
        }

        .s-tab-active {
          color: #2563EB;
          font-weight: 600;
        }

        .s-tab-icon {
          flex-shrink: 0;
        }

        .s-tab-label {
          white-space: nowrap;
        }

        /* 滑动指示器 */
        .s-tab-indicator {
          position: absolute;
          bottom: 0;
          height: 2.5px;
          background: #2563EB;
          border-radius: 2.5px 2.5px 0 0;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                      width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* 未保存指示点 */
        .s-tab-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #F59E0B;
          flex-shrink: 0;
        }

        /* 桌面端适配 */
        @media (min-width: 768px) {
          .s-header-inner {
            padding: 0 24px;
            height: 56px;
          }

          .s-title {
            font-size: 18px;
          }

          .s-tab-bar {
            padding: 0 24px;
          }

          .s-tab {
            padding: 14px 12px 12px;
            font-size: 14px;
          }
        }
      `}</style>
    </main>
  )
}

export default SettingsPage
