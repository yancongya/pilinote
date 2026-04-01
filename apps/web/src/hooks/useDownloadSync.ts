import { useEffect } from 'react'
import { useDownloadStore } from '../stores/download'

/**
 * 下载列表同步 Hook
 * 自动同步下载列表，每30秒同步一次
 */
export function useDownloadSync() {
  const syncFromServer = useDownloadStore((state) => state.syncFromServer)

  useEffect(() => {
    // 初始同步
    syncFromServer()

    // 每30秒同步一次
    const interval = setInterval(() => {
      syncFromServer()
    }, 30000)

    return () => clearInterval(interval)
  }, [syncFromServer])
}