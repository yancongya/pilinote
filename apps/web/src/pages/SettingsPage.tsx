import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  ArrowLeft, 
  User, 
  Download,
  Database,
  Save,
  RefreshCw,
  Cloud,
  Clock,
  Sparkles
} from 'lucide-react'
import AccountsSettings from './settings/AccountsSettings'
import DownloadSettings from './settings/DownloadSettings'
import StorageSettings from './settings/StorageSettings'
import BackupSettings from './settings/BackupSettings'
import AutoDownloadSettings from './settings/AutoDownloadSettings'
import VideoLibrarySettings from './settings/VideoLibrarySettings'
import AiNoteSettings from './settings/AiNoteSettings'
import { SettingsPageShell, SettingsTabPanel } from './settings/shared'
import { useToast } from '../components/Toast'
import '../settings-page.css'

type TabType = 'accounts' | 'download' | 'storage' | 'backup' | 'auto-download' | 'video-library' | 'ai-note'

// 定义ref类型
interface SettingsComponentRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

function SettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  
  const tabs = [
    { id: 'accounts' as TabType, label: '账号', icon: User },
    { id: 'download' as TabType, label: '下载', icon: Download },
    { id: 'storage' as TabType, label: '数据', icon: Database },
    { id: 'backup' as TabType, label: '备份', icon: Cloud },
    { id: 'auto-download' as TabType, label: '定时', icon: Clock },
    { id: 'video-library' as TabType, label: '视频库', icon: Database },
    { id: 'ai-note' as TabType, label: 'AI笔记', icon: Sparkles }
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
  const [tabMotionDirection, setTabMotionDirection] = useState<'forward' | 'backward'>('forward')
  const storageSettingsRef = useRef<SettingsComponentRef>(null)
  const downloadSettingsRef = useRef<SettingsComponentRef>(null)
  const backupSettingsRef = useRef<SettingsComponentRef>(null)
  const autoDownloadSettingsRef = useRef<SettingsComponentRef>(null)
  const videoLibrarySettingsRef = useRef<SettingsComponentRef>(null)
  const aiNoteSettingsRef = useRef<SettingsComponentRef>(null)
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
      const currentIndex = tabs.findIndex(tab => tab.id === activeTab)
      const nextIndex = tabs.findIndex(tab => tab.id === hash)
      setTabMotionDirection(nextIndex >= currentIndex ? 'forward' : 'backward')
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
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab)
    const nextIndex = tabs.findIndex(tab => tab.id === tabId)
    setTabMotionDirection(nextIndex >= currentIndex ? 'forward' : 'backward')
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
    if (targetTab === 'video-library' && videoLibrarySettingsRef.current) {
      return videoLibrarySettingsRef.current.hasUnsavedChanges()
    }
    if (targetTab === 'ai-note' && aiNoteSettingsRef.current) {
      return aiNoteSettingsRef.current.hasUnsavedChanges()
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
      } else if (activeTab === 'video-library' && videoLibrarySettingsRef.current) {
        await videoLibrarySettingsRef.current.saveSettings()
      } else if (activeTab === 'ai-note' && aiNoteSettingsRef.current) {
        await aiNoteSettingsRef.current.saveSettings()
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

  const header = (
    <header className="s-header">
      <div className="s-header-inner">
        <button
          className="s-back-btn"
          onClick={() => navigate(-1)}
          aria-label="返回"
        >
          <ArrowLeft size={22} />
        </button>

        <h1 className="s-title">设置</h1>

        <div className="s-spacer" />
      </div>

      <div className="s-tab-bar" ref={tabBarRef}>
        <div
          className="s-tab-indicator"
          style={{
            transform: `translateX(${indicatorStyle.left}px)`,
            width: `${indicatorStyle.width}px`,
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
            {hasUnsavedChanges(tab.id) && <span className="s-tab-dot" />}
          </button>
        ))}
      </div>
    </header>
  )

  const footer = (activeTab === 'storage' || activeTab === 'download' || activeTab === 'backup' || activeTab === 'auto-download' || activeTab === 'video-library' || activeTab === 'ai-note') ? (
    <button
      className={`settings-fab-save-btn ${hasUnsavedChanges() ? 'has-changes' : ''} ${saving ? 'saving' : ''}`}
      onClick={handleSave}
      disabled={saving}
      aria-label="保存设置"
      title={hasUnsavedChanges() ? '点击保存所有修改的设置' : '当前没有需要保存的修改'}
    >
      {saving ? <RefreshCw className="settings-fab-icon spinning" /> : <Save className="settings-fab-icon" />}
    </button>
  ) : null

  return (
    <SettingsPageShell header={header} footer={footer}>
      <div
        className="settings-content-new"
        id="settings-content"
        role="tabpanel"
        aria-label={`${tabs.find(t => t.id === activeTab)?.label}内容`}
      >
        <SettingsTabPanel key={activeTab} tabId={activeTab} direction={tabMotionDirection}>
        {activeTab === 'accounts' && <AccountsSettings />}
        {activeTab === 'download' && <DownloadSettings ref={downloadSettingsRef} />}
        {activeTab === 'storage' && <StorageSettings ref={storageSettingsRef} />}
        {activeTab === 'backup' && <BackupSettings ref={backupSettingsRef} />}
        {activeTab === 'auto-download' && <AutoDownloadSettings ref={autoDownloadSettingsRef} />}
        {activeTab === 'video-library' && <VideoLibrarySettings ref={videoLibrarySettingsRef} />}
        {activeTab === 'ai-note' && <AiNoteSettings ref={aiNoteSettingsRef} />}
        </SettingsTabPanel>
      </div>
    </SettingsPageShell>
  )
}

export default SettingsPage
