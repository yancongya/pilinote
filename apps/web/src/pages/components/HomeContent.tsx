import { useState } from 'react'

export default function HomeContent() {
  const [urlInput, setUrlInput] = useState('')
  const [urlList, setUrlList] = useState<string[]>([])

  const handleAddUrl = () => {
    if (urlInput.trim()) {
      setUrlList([...urlList, urlInput.trim()])
      setUrlInput('')
    }
  }

  const handleRemoveUrl = (index: number) => {
    setUrlList(urlList.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddUrl()
    }
  }

  return (
    <section
      id="home-panel"
      role="tabpanel"
      aria-labelledby="home-tab"
      className="content-section"
    >
      <div className={`home-input-section ${urlList.length > 0 ? 'has-content' : ''}`}>
        <div className="url-input-container">
          <label htmlFor="url-input" className="visually-hidden">
            视频链接
          </label>
          <input
            id="url-input"
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="粘贴B站视频链接，如：https://www.bilibili.com/video/BV..."
            className="url-input"
            onKeyPress={handleKeyDown}
          />
          <button
            className="add-url-btn"
            onClick={handleAddUrl}
            disabled={!urlInput.trim()}
            aria-label="添加链接"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span className="btn-text">添加</span>
          </button>
        </div>
      </div>
      {urlList.length > 0 && (
        <div className="url-list-section">
          <h3 className="url-list-title">待处理视频 ({urlList.length})</h3>
          <div className="url-list" role="list" aria-label="待处理视频列表">
            {urlList.map((url, index) => (
              <div key={index} className="url-item" role="listitem">
                <div className="url-content">
                  <svg className="url-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  <span className="url-text">{url}</span>
                </div>
                <button
                  className="remove-url-btn"
                  onClick={() => handleRemoveUrl(index)}
                  aria-label={`删除链接 ${index + 1}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}