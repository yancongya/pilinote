import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'
import { apiService } from '../../services/api'
import { User, Trash2, RefreshCw, Info, Key, Cookie as CookieIcon, Shield, Plus } from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmModal from '../../components/ConfirmModal'
import { useToast } from '../../components/Toast'
import { getAvatarProxyUrl } from '../../config/api'
import { SettingsActionRow, SettingsEmptyState, SettingsLoadingState, SettingsSection } from './shared'

interface Account {
  id: number
  mid: number
  username: string
  avatar: string
  is_active: boolean
  created_at: string
  last_refresh_time?: string | null
}

interface CredentialsData {
  mid: number
  username: string
  sessdata: string
  bili_jct?: string
  dedeuserid?: string
  access_token?: string
  cookies_count: number
  cookies: Record<string, string>
  wbi: {
    img_url?: string
    sub_url?: string
  }
}

function AccountsSettings() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { showToast } = useToast()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingId, setRefreshingId] = useState<number | null>(null)
  const [switchingAccountId, setSwitchingAccountId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [showSwitchConfirm, setShowSwitchConfirm] = useState<number | null>(null)
  const [credentialsModal, setCredentialsModal] = useState<{ id: number; data: CredentialsData } | null>(null)
  const [activeTab, setActiveTab] = useState<'basic' | 'cookies' | 'wbi'>('basic')

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const response = await apiService.request('/api/auth/accounts', { method: 'GET' })
      if (response.success && response.data) {
        const data = response.data as { accounts?: Account[]; total?: number }
        setAccounts(Array.isArray(data.accounts) ? data.accounts : [])
      }
    } catch (error) {
      console.error('加载账号列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement>, username: string) => {
    const target = e.target as HTMLImageElement
    const initial = username?.[0]?.toUpperCase() || 'U'
    target.src = `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
        <defs>
          <linearGradient id="avatar-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="var(--color-primary-500)"/>
            <stop offset="100%" stop-color="var(--color-primary-600)"/>
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="24" fill="url(#avatar-gradient)"/>
        <text x="24" y="32" text-anchor="middle" fill="white" font-family="system-ui" font-size="20" font-weight="600">${initial}</text>
      </svg>`
    )}`
  }

  const getAvatarUrl = (avatar: string) => {
    if (!avatar) return ''
    let fullUrl = avatar
    if (avatar.startsWith('//')) {
      fullUrl = `https:${avatar}`
    }
    return getAvatarProxyUrl(fullUrl)
  }

  const handleRefreshAccount = async (accountId: number) => {
    setRefreshingId(accountId)
    try {
      const response = await apiService.request(`/api/auth/accounts/${accountId}/refresh`, { method: 'POST' })
      if (response.success) {
        showToast('刷新成功', 'success')
        await loadAccounts()
      } else {
        showToast(response.message || '刷新失败', 'error')
      }
    } catch (error) {
      showToast('刷新失败', 'error')
    } finally {
      setRefreshingId(null)
    }
  }

  const handleDeleteAccount = async (accountId: number) => {
    setShowDeleteConfirm(accountId)
  }

  const confirmDeleteAccount = async () => {
    if (showDeleteConfirm === null) return
    setDeletingId(showDeleteConfirm)
    try {
      const response = await apiService.request(`/api/auth/accounts/${showDeleteConfirm}`, { method: 'DELETE' })
      if (response.success) {
        showToast('账号已删除', 'success')
        await loadAccounts()
      } else {
        showToast(response.message || '删除失败', 'error')
      }
    } catch (error) {
      showToast('删除失败', 'error')
    } finally {
      setDeletingId(null)
      setShowDeleteConfirm(null)
    }
  }

  const handleSwitchAccount = async (accountId: number) => {
    setShowSwitchConfirm(accountId)
  }

  const cancelSwitchAccount = () => {
    setShowSwitchConfirm(null)
  }

  const confirmSwitchAccount = async (accountId: number) => {
    setSwitchingAccountId(accountId)
    try {
      const response = await apiService.request(`/api/auth/accounts/${accountId}/switch`, { method: 'POST' })
      if (response.success) {
        showToast('账号切换成功', 'success')
        window.location.reload()
      } else {
        showToast(response.message || '切换失败', 'error')
      }
    } catch (error) {
      showToast('切换失败', 'error')
    } finally {
      setSwitchingAccountId(null)
      setShowSwitchConfirm(null)
    }
  }

  const handleShowCredentials = async (accountId: number) => {
    try {
      const response = await apiService.request(`/api/auth/accounts/${accountId}/credentials`, { method: 'GET' })
      if (response.success && response.data) {
        setCredentialsModal({ id: accountId, data: response.data as CredentialsData })
        setActiveTab('basic')
      } else {
        showToast('获取验证数据失败', 'error')
      }
    } catch (error) {
      showToast('获取验证数据失败', 'error')
    }
  }

  const formatRefreshTime = (refreshTime: string | null | undefined) => {
    if (!refreshTime) return '从未刷新'
    
    const date = new Date(refreshTime)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return (
    <div>
      <SettingsSection title="已登录账号" subtitle={`${accounts.length} 个账号`}>
        {loading ? (
          <SettingsLoadingState label="加载中..." />
        ) : accounts.length === 0 ? (
          <SettingsEmptyState
            icon={<User size={32} />}
            title="暂无已登录账号"
            description="点击下方按钮添加新账号"
          />
        ) : (
          <div className="accounts-list">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`account-row ${account.is_active ? 'is-active' : ''}`}
              >
                <div className="account-row-main">
                  <img
                    src={getAvatarUrl(account.avatar)}
                    alt={account.username}
                    className={`account-avatar ${account.is_active ? 'is-active' : ''}`}
                    onError={(e) => handleAvatarError(e, account.username)}
                  />
                  <div className="account-row-info">
                    <div className="account-row-name-line">
                      <span className="account-row-name">{account.username}</span>
                      {account.is_active && <span className="account-badge">当前</span>}
                    </div>
                    <span className="account-row-mid">MID: {account.mid}</span>
                    <span className="account-row-refresh">上次刷新: {formatRefreshTime(account.last_refresh_time)}</span>
                  </div>
                </div>

                <div className="account-row-actions">
                  {!account.is_active && (
                    <button
                      className="settings-button settings-button-secondary settings-button-block account-switch-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSwitchAccount(account.id)
                      }}
                      disabled={switchingAccountId !== null}
                    >
                      切换
                    </button>
                  )}
                  <button
                    className="settings-icon-button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRefreshAccount(account.id)
                    }}
                    disabled={refreshingId === account.id}
                    title="刷新账号"
                  >
                    {refreshingId === account.id ? (
                      <RefreshCw size={16} className="is-spinning" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                  </button>
                  <button
                    className="settings-icon-button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleShowCredentials(account.id)
                    }}
                    title="查看验证数据"
                  >
                    <Info size={16} />
                  </button>
                  <button
                    className="settings-icon-button is-danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteAccount(account.id)
                    }}
                    disabled={deletingId === account.id}
                    title="删除账号"
                  >
                    {deletingId === account.id ? (
                      <RefreshCw size={16} className="is-spinning" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      {user && (
        <SettingsSection title="其他">
          <div
            className="account-row account-row-guest"
            onClick={logout}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                logout()
              }
            }}
          >
            <div className="account-row-main">
              <div className="account-avatar-guest">
                <User size={20} />
              </div>
              <div className="account-row-info">
                <span className="account-row-name">游客模式</span>
                <span className="account-row-mid">点击切换到未登录状态</span>
              </div>
            </div>
          </div>
        </SettingsSection>
      )}

      <SettingsActionRow>
        <button
          className="settings-button settings-button-secondary settings-button-block"
          onClick={() => navigate('/login?mode=add')}
        >
          <Plus size={20} />
          <span>添加新账号</span>
        </button>
      </SettingsActionRow>

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
          onClick={logout}
          aria-label="退出登录"
        >
          <Trash2 className="settings-logout-icon" />
          <span className="settings-logout-text">退出登录</span>
        </button>
      </footer>

      {/* 验证数据模态窗口 */}
      <Modal
        isOpen={!!credentialsModal}
        onClose={() => setCredentialsModal(null)}
        title="账号验证数据"
        size="lg"
      >
        {credentialsModal && (
          <>
            <div className="credentials-tabs">
              <button
                className={`credentials-tab ${activeTab === 'basic' ? 'active' : ''}`}
                onClick={() => setActiveTab('basic')}
              >
                <Key className="credentials-tab-icon" />
                <span>基本信息</span>
              </button>
              <button
                className={`credentials-tab ${activeTab === 'cookies' ? 'active' : ''}`}
                onClick={() => setActiveTab('cookies')}
              >
                <CookieIcon className="credentials-tab-icon" />
                <span>Cookies</span>
                <span className="credentials-tab-badge">{credentialsModal.data.cookies_count}</span>
              </button>
              <button
                className={`credentials-tab ${activeTab === 'wbi' ? 'active' : ''}`}
                onClick={() => setActiveTab('wbi')}
              >
                <Shield className="credentials-tab-icon" />
                <span>WBI</span>
              </button>
            </div>

            <div className="credentials-tab-content">
              {activeTab === 'basic' && (
                <div className="credentials-content-basic">
                  <div className="credentials-field">
                    <label>SESSDATA</label>
                    <code>{credentialsModal.data.sessdata ? credentialsModal.data.sessdata.substring(0, 60) + '...' : 'N/A'}</code>
                  </div>
                  <div className="credentials-field">
                    <label>bili_jct</label>
                    <code>{credentialsModal.data.bili_jct || 'N/A'}</code>
                  </div>
                  <div className="credentials-field">
                    <label>DedeUserID</label>
                    <code>{credentialsModal.data.dedeuserid || 'N/A'}</code>
                  </div>
                  <div className="credentials-field">
                    <label>Access Token</label>
                    <code>{credentialsModal.data.access_token ? credentialsModal.data.access_token.substring(0, 60) + '...' : 'N/A'}</code>
                  </div>
                </div>
              )}

              {activeTab === 'cookies' && (
                <div className="credentials-content-cookies">
                  <div className="cookies-list">
                    {Object.entries(credentialsModal.data.cookies).map(([name, value]) => (
                      <div key={name} className="cookie-item">
                        <span className="cookie-name">{name}</span>
                        <code className="cookie-value">
                          {typeof value === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : value}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'wbi' && (
                <div className="credentials-content-wbi">
                  <div className="credentials-field">
                    <label>WBI 主图</label>
                    {credentialsModal.data.wbi.img_url ? (
                      <div className="wbi-url-container">
                        <code className="wbi-url-code">{credentialsModal.data.wbi.img_url}</code>
                        <a
                          href={credentialsModal.data.wbi.img_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="credentials-link"
                        >
                          打开链接
                        </a>
                      </div>
                    ) : (
                      <code>N/A</code>
                    )}
                  </div>
                  <div className="credentials-field">
                    <label>WBI 副图</label>
                    {credentialsModal.data.wbi.sub_url ? (
                      <div className="wbi-url-container">
                        <code className="wbi-url-code">{credentialsModal.data.wbi.sub_url}</code>
                        <a
                          href={credentialsModal.data.wbi.sub_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="credentials-link"
                        >
                          打开链接
                        </a>
                      </div>
                    ) : (
                      <code>N/A</code>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* 删除确认 */}
      <ConfirmModal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={confirmDeleteAccount}
        title="确认删除账号"
        message="确定要删除此账号吗？删除后需要重新登录才能使用此账号。此操作不可撤销。"
        confirmText="确定删除"
        cancelText="取消"
        confirmVariant="danger"
        loading={deletingId === showDeleteConfirm}
      />

      {/* 切换账号确认 */}
      <ConfirmModal
        isOpen={!!showSwitchConfirm}
        onClose={cancelSwitchAccount}
        onConfirm={() => showSwitchConfirm && confirmSwitchAccount(showSwitchConfirm)}
        title="确认切换账号"
        message={`确定要切换到账号 ${accounts.find(a => a.id === showSwitchConfirm)?.username || '未知用户'} 吗？`}
        confirmText="确定切换"
        cancelText="取消"
        confirmVariant="primary"
        loading={switchingAccountId !== null}
      />

    </div>
  )
}

export default AccountsSettings
