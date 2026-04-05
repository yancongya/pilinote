import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { apiService } from '../services/api'
import { useAuthStore } from '../stores/auth'
import { Check, Smartphone, User } from 'lucide-react'
import GeetestCaptcha from '../components/GeetestCaptcha'
import { getAvatarProxyUrl } from '../config/api'

interface LoginPageProps {
  onLogin: () => void
}

interface Account {
  id: number
  mid: number
  username: string
  avatar: string
  is_active: boolean
  created_at: string
}

function LoginPage({ onLogin }: LoginPageProps) {
  const navigate = useNavigate()
  
  const [activeTab, setActiveTab] = useState('qrcode')
  const [qrcodeUrl, setQrcodeUrl] = useState('')
  const [qrcodeStatus, setQrcodeStatus] = useState<'loading' | 'waiting' | 'scanned' | 'success' | 'expired'>('loading')
  const [sessdata, setSessdata] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const pollIntervalRef = useRef<number | null>(null)
  const { setUser } = useAuthStore()
  
  // 短信登录状态
  const [showCaptcha, setShowCaptcha] = useState(false)
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [smsSent, setSmsSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [captchaData, setCaptchaData] = useState<{ token: string; gt: string; challenge: string; validate?: string; seccode?: string } | null>(null)
  const [smsCaptchaKey, setSmsCaptchaKey] = useState('')
  const countryCode = '86'

  // 账号列表
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [switchingAccountId, setSwitchingAccountId] = useState<number | null>(null)

  useEffect(() => {
    if (activeTab === 'qrcode') {
      fetchQrcode()
    }
    // 切换标签页时重置验证码相关状态
    if (activeTab !== 'sms') {
      setSmsSent(false)
      setCountdown(0)
      setSmsCaptchaKey('')
      setSmsCode('')
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [activeTab])

  // 加载账号列表
  useEffect(() => {
    loadAccounts()
  }, [])

  // 验证码倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => prev - 1)
      }, 1000)
      return () => clearInterval(timer)
    } else if (countdown === 0 && smsSent) {
      // 倒计时结束，允许重新获取验证码
      setSmsSent(false)
    }
  }, [countdown, smsSent])

  const loadAccounts = async () => {
    setAccountsLoading(true)
    try {
      const response = await apiService.getAccounts()
      if (response.success && response.data) {
        setAccounts(response.data.accounts || [])
      }
    } catch (err) {
      console.error('获取账号列表失败:', err)
    } finally {
      setAccountsLoading(false)
    }
  }

  const handleSwitchAccount = async (accountId: number) => {
    setSwitchingAccountId(accountId)
    setError('')

    try {
      const response = await apiService.switchAccount(accountId)
      if (response.success && response.data) {
        setUser({
          mid: response.data.mid,
          username: response.data.username,
          avatar: response.data.avatar,
          sessdata: response.data.sessdata,
        })
        onLogin()
      } else {
        setError(response.message || '切换账号失败')
      }
    } catch (err) {
      setError('网络请求失败')
    } finally {
      setSwitchingAccountId(null)
    }
  }

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

        if (response.success && response.data) {
          // 登录成功
          if (response.data.code === 0) {
            console.log('登录成功:', response.data.username)
            setQrcodeStatus('success')
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current)
            }

            // 保存用户信息（包含refresh_token）
            const userInfo = {
              mid: response.data.mid,
              username: response.data.username,
              avatar: response.data.avatar,
              level: response.data.level,
              vip_status: response.data.vip_status,
              sessdata: response.data.sessdata
            }
            
            setUser(userInfo)
            onLogin()
          } 
          // 二维码已扫码
          else if (response.data.code === 86090) {
            setQrcodeStatus('scanned')
          }
          // 二维码已过期
          else if (response.data.code === 86038) {
            setQrcodeStatus('expired')
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current)
            }
          }
        }
      } catch (err) {
        console.error('轮询二维码状态失败:', err)
      }
    }, 2000)
  }

  const handleRefreshQrcode = () => {
    fetchQrcode()
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
        setUser(response.data)

        // 初始化指纹系统
        try {
          await apiService.initFingerprint()
          console.log('指纹系统初始化成功')
        } catch (err) {
          console.warn('指纹系统初始化失败:', err)
        }

        onLogin()
      } else {
        // 显示详细的错误信息
        const errorMsg = response.message || 'SESSDATA登录失败'
        const errorCode = response.code ? ` (错误码: ${response.code})` : ''
        setError(`${errorMsg}${errorCode}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络请求失败')
    } finally {
      setLoading(false)
    }
  }

  // Week 3: 处理短信验证码发送
  const handleSendSmsCode = async () => {
    if (!phone.trim()) {
      setError('请输入手机号码')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 首先获取验证码参数（包含token）
      const captchaParamsResponse = await apiService.getCaptchaParams()
      if (!captchaParamsResponse.success || !captchaParamsResponse.data) {
        throw new Error(captchaParamsResponse.message || '获取验证码参数失败')
      }

      const { token, gt, challenge } = captchaParamsResponse.data

      // 保存完整的验证码参数
      setCaptchaData({ token, gt, challenge })

      // 显示Geetest验证码
      setShowCaptcha(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送短信验证码失败')
      setLoading(false)
    }
  }

  // Week 3: 处理短信Geetest验证成功
  const handleSmsCaptchaSuccess = async (captchaResult: { challenge: string; validate: string; seccode: string }) => {
    try {
      const response = await apiService.sendSmsCodeWithCaptcha(
        countryCode,
        phone.trim(),
        captchaData?.token || '',
        captchaResult.challenge,
        captchaResult.validate,
        captchaResult.seccode
      )

      if (response.success) {
        setSmsSent(true)
        setShowCaptcha(false)
        setSmsCaptchaKey(response.data?.captcha_key || '')
        setError('')
        // 启动倒计时（验证码有效期通常为5分钟，这里设置为60秒提醒用户尽快输入）
        setCountdown(60)
      } else {
        setError(response.message || '发送短信验证码失败')
        setShowCaptcha(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送短信验证码失败')
      setShowCaptcha(false)
    } finally {
      setLoading(false)
    }
  }

  // Week 3: 处理短信登录
  const handleSmsLogin = async () => {
    if (!phone.trim() || !smsCode.trim()) {
      setError('请输入手机号码和验证码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await apiService.loginBySms({
        phone: phone.trim(),
        code: smsCode.trim(),
        captcha_key: smsCaptchaKey
      })

      if (response.success && response.data) {
        setUser({
          ...response.data,
        })

        // 初始化指纹系统
        try {
          await apiService.initFingerprint()
          console.log('指纹系统初始化成功')
        } catch (err) {
          console.warn('指纹系统初始化失败:', err)
        }

        onLogin()
      } else {
        // 显示详细的错误信息
        const errorMsg = response.message || '短信登录失败'
        const errorCode = response.code ? ` (错误码: ${response.code})` : ''
        setError(`${errorMsg}${errorCode}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络请求失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <button
          className="guest-mode-icon-btn"
          onClick={() => navigate('/home')}
          title="以游客身份进入"
          aria-label="以游客身份进入"
        >
          <User className="guest-mode-icon" />
        </button>
        <div className="login-header">
          <h1 className="login-title">PiliNote</h1>
          <p className="login-subtitle">B站视频下载管理系统</p>
        </div>

        <div className="login-tabs">
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
            aria-selected={activeTab === 'sms'}
            aria-controls="sms-panel"
            className={`tab ${activeTab === 'sms' ? 'active' : ''}`}
            onClick={() => setActiveTab('sms')}
            tabIndex={activeTab === 'sms' ? 0 : -1}
          >
            短信登录
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

        {/* 账号列表 */}
        <div className="login-accounts">
          {accountsLoading ? (
            <div className="accounts-loading">加载中...</div>
          ) : accounts.length === 0 ? null : (
            <div className="accounts-list">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className={`account-item ${switchingAccountId === account.id ? 'switching' : ''}`}
                  onClick={() => handleSwitchAccount(account.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleSwitchAccount(account.id)
                    }
                  }}
                >
                  <img
                    src={getAvatarProxyUrl(account.avatar)}
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
                  {switchingAccountId === account.id && (
                    <div className="account-switching">
                      <Check />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="login-content">
          {activeTab === 'qrcode' && (
            <div
              id="qrcode-panel"
              role="tabpanel"
              aria-labelledby="qrcode-tab"
              className={`qrcode-section ${activeTab === 'qrcode' ? 'active' : ''}`}
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
                      <Check />
                    </div>
                    <p>已扫码，请在手机上确认登录</p>
                  </div>
                )}
                {qrcodeStatus === 'success' && (
                  <div className="qrcode-success">
                    <div className="qrcode-success-icon">
                      <Check />
                    </div>
                    <p>登录成功，正在跳转...</p>
                  </div>
                )}
                {qrcodeStatus === 'expired' && (
                  <div className="qrcode-expired">
                    <p>二维码已过期，请刷新重试</p>
                    <button
                      onClick={handleRefreshQrcode}
                      className="refresh-btn"
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
              className={`sessdata-section ${activeTab === 'sessdata' ? 'active' : ''}`}
            >
              <div className="input-group">
                <Smartphone className="input-icon" />
                <input
                  type="text"
                  value={sessdata}
                  onChange={(e) => setSessdata(e.target.value)}
                  placeholder="请输入SESSDATA"
                  className="input-field"
                  aria-required="true"
                  disabled={loading}
                />
              </div>
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

          {activeTab === 'sms' && (
            <div
              id="sms-panel"
              role="tabpanel"
              aria-labelledby="sms-tab"
              className={`sms-section ${activeTab === 'sms' ? 'active' : ''}`}
            >
              <div className="input-group">
                <Smartphone className="input-icon" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="请输入手机号码"
                  className="input-field"
                  disabled={loading}
                />
              </div>
              <div className="input-group">
                <Smartphone className="input-icon" />
                <input
                  type="text"
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value)}
                  placeholder="请输入验证码"
                  className="input-field"
                  disabled={loading}
                />
                <button
                  className="send-sms-btn"
                  onClick={handleSendSmsCode}
                  disabled={loading || countdown > 0}
                >
                  {countdown > 0 ? `${countdown}秒后重新获取` : '获取验证码'}
                </button>
              </div>

              <button
                className="login-btn"
                onClick={handleSmsLogin}
                disabled={loading || !smsCaptchaKey}
              >
                {loading ? '登录中...' : '登录'}
              </button>
              <p className="hint-text">
                点击获取验证码后会显示Geetest验证码，验证码有效期为5分钟
              </p>
            </div>
          )}

          {error && (
            <div className="error-message" role="alert" aria-live="polite">
              {error}
            </div>
          )}
        </div>

        {/* Week 3: Geetest验证码模态框 */}
        {showCaptcha && (
          <div className="captcha-overlay" onClick={() => setShowCaptcha(false)}>
            <div className="captcha-modal" onClick={(e) => e.stopPropagation()}>
              <div className="captcha-header">
                <h3>安全验证</h3>
                <button 
                  className="close-btn" 
                  onClick={() => setShowCaptcha(false)}
                  aria-label="关闭验证码"
                >
                  ✕
                </button>
              </div>
              <div className="captcha-body">
                {captchaData && (
                  <GeetestCaptcha 
                    captchaParams={captchaData}
                    onSuccess={handleSmsCaptchaSuccess}
                    onError={(error) => {
                      setError(error)
                      setShowCaptcha(false)
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LoginPage