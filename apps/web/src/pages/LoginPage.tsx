import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { apiService } from '../services/api'
import { useAuthStore } from '../stores/auth'

interface LoginPageProps {
  onLogin: () => void
}

function LoginPage({ onLogin }: LoginPageProps) {
  const [activeTab, setActiveTab] = useState('qrcode')
  const [qrcodeUrl, setQrcodeUrl] = useState('')
  const [qrcodeStatus, setQrcodeStatus] = useState<'loading' | 'waiting' | 'scanned' | 'success' | 'expired'>('loading')
  const [sessdata, setSessdata] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const pollIntervalRef = useRef<number | null>(null)
  const { setUser } = useAuthStore()

  useEffect(() => {
    if (activeTab === 'qrcode') {
      fetchQrcode()
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [activeTab])

  const fetchQrcode = async () => {
    try {
      const response = await apiService.getQrcode()
      if (response.success && response.data) {
        setQrcodeUrl(response.data.url)
        setQrcodeStatus('waiting')
        startPolling(response.data.qrcode_key || '')
      } else {
        setError(response.message || '获取二维码失败')
      }
    } catch (err) {
      setError('网络请求失败')
    }
  }

  const startPolling = (key: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    pollIntervalRef.current = window.setInterval(async () => {
      try {
        const response = await apiService.queryQrcodeStatus(key)
        console.log('二维码状态:', response)

        if (response.success && response.data) {
          // 登录成功
          if (response.data.code === 0) {
            setQrcodeStatus('success')
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current)
            }

            // 保存用户信息
            const userInfo = {
              mid: response.data.mid,
              username: response.data.username,
              avatar: response.data.avatar,
              level: response.data.level,
              vip_status: response.data.vip_status,
              sessdata: response.data.sessdata || ''
            }
            setUser(userInfo)
            onLogin()
          }
        } else {
          // 处理错误状态
          const code = response.code
          if (code === 86090) {
            setQrcodeStatus('scanned')
          } else if (code === 86038) {
            setQrcodeStatus('expired')
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current)
            }
          } else if (code === 86101) {
            setQrcodeStatus('waiting')
          }
        }
      } catch (err) {
        console.error('轮询二维码状态失败:', err)
      }
    }, 2000)
  }

  const handleSessdataLogin = async () => {
    if (!sessdata.trim()) {
      setError('请输入SESSDATA')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await apiService.loginBySessdata(sessdata.trim())
      if (response.success && response.data) {
        setUser({
          ...response.data,
          sessdata: sessdata.trim(),
        })
        onLogin()
      } else {
        setError(response.message || '登录失败')
      }
    } catch (err) {
      setError('网络请求失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshQrcode = () => {
    fetchQrcode()
  }

  return (
    <div className="login-container" role="main">
      <div className="login-card" role="dialog" aria-labelledby="login-title">
        <div className="login-header">
          <h1 id="login-title" className="login-title">PiliNote</h1>
          <p className="login-subtitle">B站视频下载管理</p>
        </div>

        <div className="login-tabs" role="tablist" aria-label="登录方式选择">
          <button
            role="tab"
            aria-selected={activeTab === 'qrcode'}
            aria-controls="qrcode-panel"
            className={`tab ${activeTab === 'qrcode' ? 'active' : ''}`}
            onClick={() => setActiveTab('qrcode')}
            tabIndex={activeTab === 'qrcode' ? 0 : -1}
          >
            扫码登录
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'sessdata'}
            aria-controls="sessdata-panel"
            className={`tab ${activeTab === 'sessdata' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessdata')}
            tabIndex={activeTab === 'sessdata' ? 0 : -1}
          >
            SESSDATA
          </button>
        </div>

        <div className="login-content">
          {activeTab === 'qrcode' && (
            <div
              id="qrcode-panel"
              role="tabpanel"
              aria-labelledby="qrcode-tab"
              className="qrcode-section"
            >
              <div className="qrcode-container" aria-label="二维码登录区域">
                {qrcodeStatus === 'loading' && (
                  <div className="qrcode-loading">
                    <p>加载中...</p>
                  </div>
                )}
                {qrcodeStatus === 'waiting' && qrcodeUrl && (
                  <div className="qrcode-display">
                    <div className="qrcode-image">
                      <QRCodeSVG
                        value={qrcodeUrl}
                        size={200}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    <p className="qrcode-hint">请使用B站APP扫码登录</p>
                  </div>
                )}
                {qrcodeStatus === 'scanned' && (
                  <div className="qrcode-scanned">
                    <div className="qrcode-scanned-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p>已扫码，请确认登录</p>
                  </div>
                )}
                {qrcodeStatus === 'expired' && (
                  <div className="qrcode-expired">
                    <p>二维码已过期</p>
                    <button
                      className="refresh-btn"
                      onClick={handleRefreshQrcode}
                      aria-label="刷新二维码"
                    >
                      刷新二维码
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'sessdata' && (
            <div
              id="sessdata-panel"
              role="tabpanel"
              aria-labelledby="sessdata-tab"
              className="sessdata-section"
            >
              <label htmlFor="sessdata-input" className="visually-hidden">
                SESSDATA
              </label>
              <input
                id="sessdata-input"
                type="text"
                value={sessdata}
                onChange={(e) => setSessdata(e.target.value)}
                placeholder="请输入SESSDATA"
                className="input-field"
                aria-required="true"
                disabled={loading}
              />
              <button
                className="login-btn"
                onClick={handleSessdataLogin}
                disabled={loading}
                aria-label="使用SESSDATA登录"
              >
                {loading ? '登录中...' : '登录'}
              </button>
              <p className="hint-text">
                在浏览器开发者工具中找到SESSDATA cookie
              </p>
            </div>
          )}

          {error && (
            <div className="error-message" role="alert" aria-live="polite">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LoginPage
