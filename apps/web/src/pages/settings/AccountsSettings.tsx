import { useState, useEffect } from 'react'
import { useAuthStore } from '../../stores/auth'
import { apiService } from '../../services/api'
import { User, Trash2, RefreshCw } from 'lucide-react'

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
    return avatar.startsWith('http') ? avatar : `https:${avatar}`
  }

  return (
    <div className="accounts-settings">
      <h2 className="settings-title">
        <User />
        多账号管理
      </h2>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <RefreshCw className="loading-spinner" />
          <p>加载中...</p>
        </div>
      ) : (
        <div className="accounts-list">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`account-item ${account.is_active ? 'active' : ''}`}
              onClick={() => !account.is_active && handleSwitchAccount(account.id)}
              role="button"
              tabIndex={0}
              aria-label={`账号 ${account.username}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (!account.is_active) {
                    handleSwitchAccount(account.id)
                  }
                }
              }}
            >
              <img
                src={getAvatarUrl(account.avatar)}
                alt={account.username}
                className="account-avatar"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect fill='%233B82F6' width='40' height='40'/><text x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='white' font-size='20'>${account.username?.[0]?.toUpperCase() || 'U'}</text></svg>`
                }}
              />
              <div className="account-info">
                <span className="account-name">{account.username}</span>
                <span className="account-id">MID: {account.mid}</span>
              </div>
              <div className="account-actions">
                <button
                  className="account-refresh-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRefreshAccount(account.id)
                  }}
                  disabled={refreshingId === account.id}
                  title="刷新账号"
                  aria-label={`刷新账号 ${account.username}`}
                >
                  {refreshingId === account.id ? (
                    <RefreshCw className="animate-spin" />
                  ) : (
                    <RefreshCw />
                  )}
                </button>
                <button
                  className="account-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDeleteConfirm(account.id)
                  }}
                  disabled={deletingId === account.id}
                  title="删除账号"
                  aria-label={`删除账号 ${account.username}`}
                >
                  {deletingId === account.id ? (
                    <RefreshCw className="animate-spin" />
                  ) : (
                    <Trash2 />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>确认删除账号</h3>
            </div>
            <div className="modal-body">
              <p>确定要删除此账号吗？此操作不可撤销。</p>
            </div>
            <div className="modal-footer">
              <button
                className="modal-btn cancel-btn"
                onClick={() => setShowDeleteConfirm(null)}
              >
                取消
              </button>
              <button
                className="modal-btn confirm-btn"
                onClick={confirmDeleteAccount}
              >
                确定删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}