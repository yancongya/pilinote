import { useState } from 'react'

interface LoginPageProps {
  onLogin: () => void
}

function LoginPage({ onLogin }: LoginPageProps) {
  const [activeTab, setActiveTab] = useState('qrcode')

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
          <button
            role="tab"
            aria-selected={activeTab === 'password'}
            aria-controls="password-panel"
            className={`tab ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
            tabIndex={activeTab === 'password' ? 0 : -1}
          >
            密码登录
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
              <div className="qrcode-placeholder" aria-label="二维码登录区域">
                <svg className="qrcode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" strokeWidth="2"/>
                  <rect x="14" y="3" width="7" height="7" strokeWidth="2"/>
                  <rect x="3" y="14" width="7" height="7" strokeWidth="2"/>
                  <rect x="14" y="14" width="7" height="7" strokeWidth="2"/>
                </svg>
                <p>请使用B站APP扫码登录</p>
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
                placeholder="请输入SESSDATA"
                className="input-field"
                aria-required="true"
              />
              <button
                className="login-btn"
                onClick={onLogin}
                aria-label="使用SESSDATA登录"
              >
                登录
              </button>
              <p className="hint-text">
                在浏览器开发者工具中找到SESSDATA cookie
              </p>
            </div>
          )}

          {activeTab === 'password' && (
            <div
              id="password-panel"
              role="tabpanel"
              aria-labelledby="password-tab"
              className="password-section"
            >
              <label htmlFor="username-input" className="visually-hidden">
                手机号或邮箱
              </label>
              <input
                id="username-input"
                type="text"
                placeholder="手机号/邮箱"
                className="input-field"
                aria-required="true"
              />
              <label htmlFor="password-input" className="visually-hidden">
                密码
              </label>
              <input
                id="password-input"
                type="password"
                placeholder="密码"
                className="input-field"
                aria-required="true"
              />
              <button
                className="login-btn"
                onClick={onLogin}
                aria-label="使用密码登录"
              >
                登录
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LoginPage
