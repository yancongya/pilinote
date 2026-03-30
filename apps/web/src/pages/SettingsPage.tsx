import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useAuthStore } from '../stores/auth'
import { apiService } from '../services/api'
import { 
  ArrowLeft, 
  User, 
  Trash2, 
  LogOut, 
  Settings,
  ShieldCheck,
  RefreshCw
} from 'lucide-react'

interface Account {
  id: number
  mid: number
  username: string
  avatar: string
  is_active: boolean
  created_at: string
}

function SettingsPage() {
  const navigate = useNavigate()
  const { user, setUser, logout } = useAuthStore()
  const [animationParent] = useAutoAnimate({ duration: 200, easing: 'ease-out' })
  
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingId, setRefreshingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
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

  const handleDeleteAccount = async (accountId: number) => {
    setDeletingId(accountId)
    setError('')

    try {
      const response = await apiService.deleteAccount(accountId)
      if (response.success) {
        setShowDeleteConfirm(null)
        await loadAccounts()
        
        // 如果删除的是当前账号，清除登录状态
        const deletedAccount = accounts.find(a => a.id === accountId)
        if (deletedAccount?.is_active) {
          logout()
          navigate('/')
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

  const handleLogout = async () => {
    
    try {
      const response = await apiService.logout()
      if (response.success) {
        logout()
        
        // 检查localStorage数据
        const localStorageData = localStorage.getItem('pilinote-auth')
        
        navigate('/')
      } else {
        setError(response.message || '退出登录失败')
      }
    } catch (err) {
      setError('网络请求失败')
    }
  }

  const getAvatarUrl = (avatarUrl: string) => {
    if (!avatarUrl) return ''
    return `http://localhost:8000/api/auth/proxy/avatar?url=${encodeURIComponent(avatarUrl)}`
  }

  return (
    <div className="settings-container">
      <header className="settings-header">
        <button
          className="back-button"
          onClick={() => navigate(-1)}
          aria-label="返回"
        >
          <ArrowLeft />
        </button>
        <h1>设置</h1>
      </header>

      <main className="settings-main" ref={animationParent}>
        {/* 当前账号信息 */}
        <section className="settings-section">
          <h2 className="section-title">
            <User className="section-icon" />
            当前账号
          </h2>
          <div className="current-account-card">
            <img
              src={getAvatarUrl(user?.avatar || '')}
              alt={user?.username}
              className="account-avatar"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><rect fill='%232563EB' width='60' height='60'/><text x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='white' font-size='30'>${user?.username?.[0]?.toUpperCase() || 'U'}</text></svg>`
              }}
            />
            <div className="account-info">
              <p className="account-username">{user?.username || '未登录'}</p>
              <p className="account-mid">MID: {user?.mid || '-'}</p>
            </div>
          </div>
        </section>

        {/* 账号管理 */}
        <section className="settings-section">
          <h2 className="section-title">
            <ShieldCheck className="section-icon" />
            多账号管理
          </h2>
          
          {error && (
            <div className="error-message" role="alert" aria-live="polite">
              {error}
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
                        handleDeleteAccount(account.id)
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
        </section>

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
      </main>

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

      {/* 删除账号确认 */}
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
                className="modal-btn danger-btn"
                onClick={() => handleDeleteAccount(showDeleteConfirm)}
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

export default SettingsPage