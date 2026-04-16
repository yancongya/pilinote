// components/NewDownload/index.tsx
import { useEffect, useState } from 'react'
import { useNewQueueStore } from '../../stores/newQueue'
import DownloadsList from './DownloadsList'
import VideoLibrary from './VideoLibrary'
import ScanResultContent from './ScanResultContent'
import { Loader2 } from 'lucide-react'
import './index.css'

export default function NewDownloadContent() {
  const { activeTab, setActiveTab, connectWebSocket, fetchTasks, fetchSchedulers } = useNewQueueStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true)
      try {
        // 并行加载数据
        await Promise.all([
          fetchTasks(),
          fetchSchedulers()
        ])
      } finally {
        setIsLoading(false)
      }
    }

    initData()

    // 连接 WebSocket
    connectWebSocket()
  }, [])

  return (
    <div className="new-download-page" role="main" aria-label="新下载管理">
      {/* 内部Tab */}
      <div className="new-download-tabs" role="tablist" aria-label="下载管理选项卡">
        <button
          role="tab"
          aria-selected={activeTab === 'downloads'}
          aria-controls="downloads-panel"
          className={`tab ${activeTab === 'downloads' ? 'active' : ''}`}
          onClick={() => setActiveTab('downloads')}
          tabIndex={activeTab === 'downloads' ? 0 : -1}
        >
          下载列表
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'library'}
          aria-controls="library-panel"
          className={`tab ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => setActiveTab('library')}
          tabIndex={activeTab === 'library' ? 0 : -1}
        >
          媒体库
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'scan'}
          aria-controls="scan-panel"
          className={`tab ${activeTab === 'scan' ? 'active' : ''}`}
          onClick={() => setActiveTab('scan')}
          tabIndex={activeTab === 'scan' ? 0 : -1}
        >
          自动扫描
        </button>
      </div>

      {/* 内容 */}
      <div className="new-download-content">
        {isLoading ? (
          <div className="loading-state" role="status" aria-label="加载中">
            <Loader2 className="loading-spinner" size={32} aria-hidden="true" />
            <span>加载中...</span>
          </div>
        ) : (
          <>
            {activeTab === 'downloads' && (
              <div id="downloads-panel" role="tabpanel" aria-labelledby="downloads-tab">
                <DownloadsList />
              </div>
            )}
            {activeTab === 'library' && (
              <div id="library-panel" role="tabpanel" aria-labelledby="library-tab">
                <VideoLibrary />
              </div>
            )}
            {activeTab === 'scan' && (
              <div id="scan-panel" role="tabpanel" aria-labelledby="scan-tab">
                <ScanResultContent />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
