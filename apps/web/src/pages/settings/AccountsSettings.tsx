import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'
import { apiService } from '../../services/api'
import { User, Trash2, RefreshCw, Info, Key, Cookie as CookieIcon, Shield, Plus } from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmModal from '../../components/ConfirmModal'
import { getAvatarProxyUrl } from '../../config/api'

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
  const navigate = useNavigate()
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
          const refreshInterval = 60 * 60 * 1000
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
    setShowSwitchAccount(accountId)
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
        const errorMsg = response.message || response.detail || '切换账号失败'
        setError(errorMsg)
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
    return getAvatarProxyUrl(fullUrl)
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
    <div className="ac-panel">
      <div className="ac-content">
        {/* 错误消息 */}
        {error && (
          <div className="ac-error" role="alert" aria-live="polite">
            {error}
          </div>
        )}

      {/* 成功消息 */}
      {successMessage && (
        <div className="ac-success" role="status" aria-live="polite">
          {successMessage}
        </div>
      )}

      {/* 已登录账号列表 */}
      <div className="ac-group">
        <div className="ac-group-header">
          <span className="ac-group-title">已登录账号</span>
          <span className="ac-group-subtitle">{accounts.length} 个账号</span>
        </div>
        
        {loading ? (
          <div className="ac-loading">
            <RefreshCw className="ac-spinner" />
            <p>加载中...</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="ac-empty">
            <User size={32} className="ac-empty-icon" />
            <p className="ac-empty-text">暂无已登录账号</p>
            <p className="ac-empty-hint">点击下方按钮添加新账号</p>
          </div>
        ) : (
          <div className="ac-list">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`ac-item ${account.is_active ? 'ac-item-active' : ''}`}
              >
                {/* 主内容 */}
                <div className="ac-item-main">
                  <img
                    src={getAvatarUrl(account.avatar)}
                    alt={account.username}
                    className={`ac-item-avatar ${account.is_active ? 'ac-avatar-active' : ''}`}
                    onError={(e) => handleAvatarError(e, account.username)}
                  />
                  <div className="ac-item-info">
                    <div className="ac-item-name-row">
                      <span className="ac-item-name">{account.username}</span>
                      {account.is_active && <span className="ac-badge">当前</span>}
                    </div>
                    <span className="ac-item-mid">MID: {account.mid}</span>
                    <span className="ac-item-refresh">上次刷新: {formatRefreshTime(account.last_refresh_time)}</span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="ac-item-actions">
                  {!account.is_active && (
                    <button
                      className="ac-action-btn ac-switch-btn"
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
                    className="ac-action-btn ac-refresh-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRefreshAccount(account.id)
                    }}
                    disabled={refreshingId === account.id}
                    title="刷新账号"
                  >
                    {refreshingId === account.id ? (
                      <RefreshCw size={16} className="ac-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                  </button>
                  <button
                    className="ac-action-btn ac-info-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleShowCredentials(account.id)
                    }}
                    title="查看验证数据"
                  >
                    <Info size={16} />
                  </button>
                  <button
                    className="ac-action-btn ac-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDeleteConfirm(account.id)
                    }}
                    disabled={deletingId === account.id}
                    title="删除账号"
                  >
                    {deletingId === account.id ? (
                      <RefreshCw size={16} className="ac-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 游客模式 */}
      {user && (
        <div className="ac-group">
          <div className="ac-group-header">
            <span className="ac-group-title">其他</span>
          </div>
          <div className="ac-list">
            <div
              className="ac-item ac-item-guest"
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
              <div className="ac-item-main">
                <div className="ac-item-avatar ac-avatar-guest">
                  <User size={20} />
                </div>
                <div className="ac-item-info">
                  <span className="ac-item-name">游客模式</span>
                  <span className="ac-item-mid">点击切换到未登录状态</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 添加账号按钮 */}
      <div className="ac-add-group">
        <button
          className="ac-add-btn"
          onClick={() => navigate('/login?mode=add')}
        >
          <Plus size={20} />
          <span>添加新账号</span>
        </button>
      </div>
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

      {/* 切换账号确认 */}
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

      <style>{`
        .ac-panel {
          padding: 12px;
          background: #F8FAFC;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .ac-content {
          flex: 0 1 auto;
        }

        .settings-footer {
          margin-top: auto;
          flex-shrink: 0;
        }

        /* 错误/成功消息 */
        .ac-error {
          padding: 10px 14px;
          background: #FEF2F2;
          border: 1px solid #FECACA;
          border-radius: 8px;
          color: #DC2626;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 12px;
        }

        .ac-success {
          padding: 10px 14px;
          background: #F0FDF4;
          border: 1px solid #BBF7D0;
          border-radius: 8px;
          color: #16A34A;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 12px;
        }

        /* 分组 */
        .ac-group {
          background: white;
          border-radius: 12px;
          border: 1px solid #E2E8F0;
          margin-bottom: 12px;
          overflow: hidden;
        }

        .ac-group-header {
          padding: 12px 16px;
          background: #F8FAFC;
          border-bottom: 1px solid #E2E8F0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ac-group-title {
          font-size: 15px;
          font-weight: 600;
          color: #1E293B;
        }

        .ac-group-subtitle {
          font-size: 12px;
          color: #94A3B8;
        }

        /* 列表 */
        .ac-list {
          display: flex;
          flex-direction: column;
        }

        /* 列表项 */
        .ac-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-bottom: 1px solid #F1F5F9;
          min-height: 64px;
        }

        .ac-item:last-child {
          border-bottom: none;
        }

        .ac-item-active {
          background: #F8FAFC;
        }

        /* 主内容 */
        .ac-item-main {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }

        .ac-item-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          border: 2px solid #E2E8F0;
        }

        .ac-avatar-active {
          border-color: #2563EB;
        }

        .ac-avatar-guest {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #F1F5F9;
          color: #94A3B8;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 2px solid #E2E8F0;
        }

        .ac-item-info {
          flex: 1;
          min-width: 0;
        }

        .ac-item-name-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ac-item-name {
          font-size: 14px;
          font-weight: 600;
          color: #1E293B;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ac-item-mid {
          font-size: 12px;
          color: #94A3B8;
        }

        .ac-item-refresh {
          font-size: 11px;
          color: #CBD5E1;
          margin-top: 1px;
        }

        /* 徽章 */
        .ac-badge {
          display: inline-flex;
          align-items: center;
          padding: 1px 6px;
          background: #2563EB;
          color: white;
          font-size: 10px;
          font-weight: 600;
          border-radius: 4px;
          flex-shrink: 0;
        }

        /* 操作按钮 */
        .ac-item-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .ac-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          padding: 0;
          border: 1px solid #E2E8F0;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          color: #64748B;
        }

        .ac-action-btn:hover:not(:disabled) {
          background: #F8FAFC;
          border-color: #CBD5E1;
        }

        .ac-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ac-refresh-btn:hover:not(:disabled) {
          color: #2563EB;
          border-color: #BFDBFE;
        }

        .ac-delete-btn:hover:not(:disabled) {
          color: #DC2626;
          border-color: #FECACA;
        }

        .ac-info-btn:hover:not(:disabled) {
          color: #2563EB;
          border-color: #BFDBFE;
        }

        .ac-switch-btn {
          width: auto;
          padding: 0 10px;
          font-size: 12px;
          font-weight: 600;
          color: #2563EB;
          border-color: #BFDBFE;
        }

        .ac-switch-btn:hover:not(:disabled) {
          background: #EFF6FF;
        }

        /* 加载 */
        .ac-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 16px;
          color: #94A3B8;
        }

        .ac-spinner {
          width: 24px;
          height: 24px;
          animation: acSpin 1s linear infinite;
          color: #2563EB;
          margin-bottom: 8px;
        }

        .ac-loading p {
          font-size: 13px;
        }

        @keyframes acSpin {
          to { transform: rotate(360deg); }
        }

        .ac-spin {
          animation: acSpin 1s linear infinite;
        }

        /* 空状态 */
        .ac-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 16px;
        }

        .ac-empty-icon {
          color: #CBD5E1;
          margin-bottom: 12px;
        }

        .ac-empty-text {
          font-size: 14px;
          font-weight: 500;
          color: #64748B;
          margin: 0 0 4px;
        }

        .ac-empty-hint {
          font-size: 12px;
          color: #94A3B8;
          margin: 0;
        }

        /* 游客模式 */
        .ac-item-guest {
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .ac-item-guest:hover {
          background: #F8FAFC;
        }

        .ac-item-guest .ac-item-name {
          color: #64748B;
        }

        /* 添加账号按钮 */
        .ac-add-group {
          margin-top: 4px;
        }

        .ac-add-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px 16px;
          border: 2px dashed #E2E8F0;
          border-radius: 12px;
          background: transparent;
          color: #64748B;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .ac-add-btn:hover {
          border-color: #2563EB;
          color: #2563EB;
          background: #EFF6FF;
        }

        .ac-add-btn:active {
          background: #DBEAFE;
          transform: scale(0.98);
        }
      `}</style>
    </div>
  )
}
