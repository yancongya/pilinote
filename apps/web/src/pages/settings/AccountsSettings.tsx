import { useState, useEffect } from 'react'
import { useAuthStore } from '../../stores/auth'
import { apiService } from '../../services/api'
import { User, Trash2, RefreshCw, Check } from 'lucide-react'
import { ConfirmModal } from '../../components/Modal'

interface Account {
  id: number
  mid: number
  username: string
  avatar: string
  is_active: boolean
  created_at: string
}

export default function AccountsSettings() {
  const { user, setUser, logout } = useAuthStore()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingId, setRefreshingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAccounts()
  }, [])

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
    setError('')
    try {
      const response = await apiService.switchAccount(accountId)
      if (response.success && response.data) {
        setUser({
          mid: response.data.mid,
          username: response.data.username,
          avatar: response.data.avatar,
          sessdata: user?.sessdata,
        })
        await loadAccounts()
      } else {
        setError(response.message || '切换账号失败')
      }
    } catch (err) {
      setError('网络请求失败')
    }
  }

  const handleRefreshAccount = async (accountId: number) => {
    setRefreshingId(accountId)
    setError('')
    try {
      const response = await apiService.switchAccount(accountId)
      if (response.success && response.data) {
        setUser({
          mid: response.data.mid,
          username: response.data.username,
          avatar: response.data.avatar,
          sessdata: user?.sessdata,
        })
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
    // B 站头像 URL 可能是 // 开头的相对 URL
    let fullUrl = avatar
    if (avatar.startsWith('//')) {
      fullUrl = `https:${avatar}`
    }
    // 使用后端代理API来加载头像，解决CORS和403问题
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

  return (
    <div className="accounts-settings-new">
      {/* 页面标题 */}
      <div className="accounts-header">
        <User className="accounts-header-icon" />
        <h2 className="accounts-header-title">多账号管理</h2>
      </div>

      {loading ? (
        <div 
          className="accounts-loading-state"
          role="status"
          aria-live="polite"
        >
          <RefreshCw className="accounts-loading-spinner" />
          <p className="accounts-loading-text">加载中...</p>
        </div>
      ) : (
        <div className="accounts-list-new">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`accounts-card ${account.is_active ? 'active' : ''}`}
              onClick={() => !account.is_active && handleSwitchAccount(account.id)}
              role="button"
              tabIndex={0}
              aria-label={`账号 ${account.username}${account.is_active ? '（当前使用）' : ''}`}
              aria-pressed={account.is_active}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (!account.is_active) {
                    handleSwitchAccount(account.id)
                  }
                }
              }}
            >
              {/* 账号信息 */}
              <div className="accounts-card-main">
                <img
                  src={getAvatarUrl(account.avatar)}
                  alt={account.username}
                  className="accounts-card-avatar"
                  onError={(e) => handleAvatarError(e, account.username)}
                />
                <div className="accounts-card-info">
                  <div className="accounts-card-name-row">
                    <span className="accounts-card-name">{account.username}</span>
                    {account.is_active && (
                      <span className="accounts-card-active-badge">
                        <Check className="accounts-card-active-icon" />
                        <span>当前</span>
                      </span>
                    )}
                  </div>
                  <span className="accounts-card-id">MID: {account.mid}</span>
                </div>
              </div>

              {/* 操作按钮 */}
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
          ))}
        </div>
      )}

      {/* 删除确认对话框 */}
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
    </div>
  )
}