import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../../stores/auth'
import { apiService } from '../../services/api'
import { User, Trash2, RefreshCw, Info, X, Key, Cookie as CookieIcon, Shield } from 'lucide-react'
import Modal from '../../components/Modal'

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
    img_url: string
    sub_url: string
  }
}

export default function AccountsSettings() {
  const { user, setUser, logout } = useAuthStore()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingId, setRefreshingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [showSwitchConfirm, setShowSwitchConfirm] = useState<number | null>(null)
  const [switchingAccountId, setSwitchingAccountId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [credentialsModal, setCredentialsModal] = useState<{ accountId: number; data: CredentialsData } | null>(null)
  const [activeTab, setActiveTab] = useState<'basic' | 'cookies' | 'wbi'>('basic')
  const [nextRefreshTime, setNextRefreshTime] = useState<{ [key: number]: string }>({})

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    const updateCountdown = () => {
      const countdowns: { [key: number]: string } = {}
      const now = new Date().getTime()
      
      accounts.forEach(account => {
        if (account.last_refresh_time) {
          const lastRefresh = new Date(account.last_refresh_time).getTime()
          const refreshInterval = 60 * 60 * 1000 // 1小时
          const nextRefresh = lastRefresh + refreshInterval
          const remainingMs = nextRefresh - now
          
          if (remainingMs > 0) {
            const hours = Math.floor(remainingMs / (60 * 60 * 1000))
            const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000))
            const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000)
            
            if (hours > 0) {
              countdowns[account.id] = `${hours}小时${minutes}分`
            } else if (minutes > 0) {
              countdowns[account.id] = `${minutes}分${seconds}秒`
            } else {
              countdowns[account.id] = `${seconds}秒`
            }
          } else {
            countdowns[account.id] = '即将刷新'
          }
        }
      })
      
      setNextRefreshTime(countdowns)
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    
    return () => clearInterval(interval)
  }, [accounts])

  const loadAccounts = async () => {
    try {
      const response = await apiService.getAccounts()
      if (response.success && response.data) {
        setAccounts(response.data.accounts || [])
      } else {
        setError(response.message || '获取账号列表失败')
      }
    } catch (err) {
      setError('网络请求失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSwitchAccount = async (accountId: number) => {
    setShowSwitchConfirm(accountId)
  }

  const confirmSwitchAccount = async (accountId: number) => {
    setShowSwitchConfirm(null)
    setSwitchingAccountId(accountId)
    setError('')
    try {
      const targetAccount = accounts.find(a => a.id === accountId)
      const response = await apiService.switchAccount(accountId)
      if (response.success && response.data) {
        setUser({
          mid: response.data.mid,
          username: response.data.username,
          avatar: response.data.avatar,
          sessdata: response.data.sessdata,
        })
        await loadAccounts()
        setSuccessMessage(`已切换到账号: ${targetAccount?.username || '未知用户'}`)
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        // 显示详细的错误信息
        const errorMsg = response.message || response.detail || '切换账号失败'
        setError(errorMsg)
        console.error('切换账号失败:', response)
      }
    } catch (err) {
      setError('网络请求失败')
    } finally {
      setSwitchingAccountId(null)
    }
  }

  const cancelSwitchAccount = () => {
    setShowSwitchConfirm(null)
  }

  const handleRefreshAccount = async (accountId: number) => {
    setRefreshingId(accountId)
    setError('')
    try {
      const response = await apiService.refreshAccount(accountId)
      if (response.success && response.data) {
        // 如果刷新的是当前登录的账号，更新用户信息但保持sessdata
        if (user && user.mid === response.data.mid) {
          setUser({
            mid: response.data.mid,
            username: response.data.username,
            avatar: response.data.avatar,
            sessdata: user.sessdata,
          })
        }
        await loadAccounts()
      } else {
        setError(response.message || '刷新账号失败')
      }
    } catch (err) {
      setError('网络请求失败')
    } finally {
      setRefreshingId(null)
    }
  }

  const handleShowCredentials = async (accountId: number) => {
    try {
      const response = await apiService.request<any>(`/api/auth/accounts/${accountId}/credentials`, {
        method: 'GET',
      })
      if (response.success && response.data) {
        setCredentialsModal({ accountId, data: response.data })
        setActiveTab('basic')
      }
    } catch (err) {
      console.error('获取账号验证数据失败:', err)
    }
  }

  const handleDeleteAccount = async (accountId: number) => {
    setDeletingId(accountId)
    setError('')
    try {
      const response = await apiService.deleteAccount(accountId)
      if (response.success) {
        setShowDeleteConfirm(null)
        await loadAccounts()
        
        const deletedAccount = accounts.find(a => a.id === accountId)
        if (deletedAccount?.is_active) {
          logout()
        }
      } else {
        setError(response.message || '删除账号失败')
      }
    } catch (err) {
      setError('网络请求失败')
    } finally {
      setDeletingId(null)
    }
  }

  const confirmDeleteAccount = async () => {
    if (showDeleteConfirm) {
      await handleDeleteAccount(showDeleteConfirm)
    }
  }

  const getAvatarUrl = (avatar: string) => {
    if (!avatar) return ''
    let fullUrl = avatar
    if (avatar.startsWith('//')) {
      fullUrl = `https:${avatar}`
    }
    const encodedUrl = encodeURIComponent(fullUrl)
    return `http://localhost:8000/api/auth/proxy/avatar?url=${encodedUrl}`
  }

  const getDefaultAvatar = (username: string) => {
    const initial = username?.[0]?.toUpperCase() || 'U'
    return `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
        <defs>
          <linearGradient id="avatar-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#3B82F6"/>
            <stop offset="100%" stop-color="#2563EB"/>
          </linearGradient>
        </defs>
        <rect width="48" height="48" fill="url(#avatar-gradient)" rx="24"/>
        <text x="24" y="24" text-anchor="middle" dy=".3em" fill="white" font-size="24" font-family="system-ui, -apple-system, sans-serif" font-weight="600">${initial}</text>
      </svg>`
    )}`
  }

  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement>, username: string) => {
    const target = e.target as HTMLImageElement
    target.src = getDefaultAvatar(username)
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
    <div className="accounts-settings-new">
      <div className="accounts-header">
        <User className="accounts-header-icon" />
        <h2 className="accounts-header-title">多账号管理</h2>
      </div>

      {/* 错误消息 */}
      {error && (
        <div className="accounts-error-message" role="alert" aria-live="polite">
          {error}
        </div>
      )}

      {/* 成功消息 */}
      {successMessage && (
        <div className="accounts-success-message" role="status" aria-live="polite">
          {successMessage}
        </div>
      )}

      {loading ? (
        <div className="accounts-loading-state" role="status" aria-live="polite">
          <RefreshCw className="accounts-loading-spinner" />
          <p className="accounts-loading-text">加载中...</p>
        </div>
      ) : (
        <div className="accounts-list-new">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`accounts-card ${user && account.is_active ? 'active' : ''} ${switchingAccountId === account.id ? 'switching' : ''}`}
              onClick={() => (!user || (!account.is_active && switchingAccountId === null)) && handleSwitchAccount(account.id)}
              role="button"
              tabIndex={user && account.is_active ? -1 : 0}
              aria-label={`账号 ${account.username}${user && account.is_active ? '（当前使用）' : ''}`}
              aria-pressed={user && account.is_active}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && (!user || (!account.is_active && switchingAccountId === null))) {
                  e.preventDefault()
                  handleSwitchAccount(account.id)
                }
              }}
            >
              <button
                className="accounts-card-info-icon"
                onClick={(e) => {
                  e.stopPropagation()
                  handleShowCredentials(account.id)
                }}
                title="查看验证数据"
              >
                <Info className="accounts-card-info-icon-svg" />
              </button>

              <span className="accounts-card-refresh-time">
                上次刷新: {formatRefreshTime(account.last_refresh_time)} · 下次刷新: {nextRefreshTime[account.id] || '计算中...'}
              </span>

              <div className="accounts-card-main">
                <img
                  src={getAvatarUrl(account.avatar)}
                  alt={account.username}
                  className={`accounts-card-avatar ${account.is_active ? 'accounts-card-avatar-active' : ''}`}
                  onError={(e) => handleAvatarError(e, account.username)}
                />
                <div className="accounts-card-info">
                  <div className="accounts-card-name-row">
                    <span className="accounts-card-name">{account.username}</span>
                  </div>
                  <span className="accounts-card-id">MID: {account.mid}</span>
                </div>
              </div>

              <div className="accounts-card-actions-wrapper">
                <div className="accounts-card-actions">
                  <button
                    className="accounts-card-action-btn accounts-card-refresh-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRefreshAccount(account.id)
                    }}
                    disabled={refreshingId === account.id}
                    title="刷新账号"
                    aria-label={`刷新账号 ${account.username}`}
                    tabIndex={-1}
                  >
                    {refreshingId === account.id ? (
                      <RefreshCw className="accounts-card-action-icon accounts-card-action-icon-spinning" />
                    ) : (
                      <RefreshCw className="accounts-card-action-icon" />
                    )}
                  </button>
                  <button
                    className="accounts-card-action-btn accounts-card-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDeleteConfirm(account.id)
                    }}
                    disabled={deletingId === account.id}
                    title="删除账号"
                    aria-label={`删除账号 ${account.username}`}
                    tabIndex={-1}
                  >
                    {deletingId === account.id ? (
                      <RefreshCw className="accounts-card-action-icon accounts-card-action-icon-spinning" />
                    ) : (
                      <Trash2 className="accounts-card-action-icon" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* 游客模式卡片 */}
          {!user && (
            <div
              className="accounts-card accounts-card-guest active"
              onClick={() => {}}
              role="button"
              tabIndex={0}
              aria-label="游客模式"
              aria-pressed={true}
            >
              <div className="accounts-card-main">
                <div className="accounts-card-avatar accounts-card-avatar-guest">
                  <User className="accounts-card-guest-icon" />
                </div>
                <div className="accounts-card-info">
                  <div className="accounts-card-name-row">
                    <span className="accounts-card-name">游客模式</span>
                  </div>
                  <span className="accounts-card-id">未登录状态</span>
                </div>
              </div>
            </div>
          )}

          {user && (
            <div
              className="accounts-card accounts-card-guest"
              onClick={logout}
              role="button"
              tabIndex={0}
              aria-label="切换到游客模式"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  logout()
                }
              }}
            >
              <div className="accounts-card-main">
                <div className="accounts-card-avatar accounts-card-avatar-guest">
                  <User className="accounts-card-guest-icon" />
                </div>
                <div className="accounts-card-info">
                  <div className="accounts-card-name-row">
                    <span className="accounts-card-name">游客模式</span>
                  </div>
                  <span className="accounts-card-id">点击切换到未登录状态</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 验证数据模态窗口 */}
      <Modal
        isOpen={!!credentialsModal}
        onClose={() => setCredentialsModal(null)}
        title="账号验证数据"
        size="lg"
      >
        {credentialsModal && (
          <>
            {/* Tab 切换 */}
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

            {/* Tab 内容 */}
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

      {/* 删除确认对话框 */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="确认删除账号"
        size="sm"
      >
        <p className="confirm-modal-message">确定要删除此账号吗？删除后需要重新登录才能使用此账号。此操作不可撤销。</p>
        <div className="modal-footer">
          <button
            className="modal-btn modal-btn-cancel"
            onClick={() => setShowDeleteConfirm(null)}
          >
            取消
          </button>
          <button
            className="modal-btn modal-btn-danger"
            onClick={confirmDeleteAccount}
            disabled={deletingId === showDeleteConfirm}
          >
            {deletingId === showDeleteConfirm ? '删除中...' : '确定删除'}
          </button>
        </div>
      </Modal>

      {/* 切换账号确认对话框 */}
      <Modal
        isOpen={!!showSwitchConfirm}
        onClose={cancelSwitchAccount}
        title="确认切换账号"
        size="sm"
      >
        {(() => {
          const targetAccount = accounts.find(a => a.id === showSwitchConfirm)
          return (
            <p className="confirm-modal-message">
              确定要切换到账号 <strong>{targetAccount?.username || '未知用户'}</strong> 吗？
            </p>
          )
        })()}
        <div className="modal-footer">
          <button
            className="modal-btn modal-btn-cancel"
            onClick={cancelSwitchAccount}
          >
            取消
          </button>
          <button
            className="modal-btn modal-btn-primary"
            onClick={() => showSwitchConfirm && confirmSwitchAccount(showSwitchConfirm)}
            disabled={switchingAccountId !== null}
          >
            {switchingAccountId !== null ? '切换中...' : '确定切换'}
          </button>
        </div>
      </Modal>
    </div>
  )
}