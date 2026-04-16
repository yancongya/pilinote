import { useState } from 'react'

interface ReDownloadDialogProps {
  isOpen: boolean
  video: any
  onConfirm: () => void
  onCancel: () => void
}

export default function ReDownloadDialog({
  isOpen,
  video,
  onConfirm,
  onCancel
}: ReDownloadDialogProps) {
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          重新下载视频
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          视频 <span className="font-medium">{video?.title || '未知视频'}</span> 已在视频库中，是否重新下载？
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '处理中...' : '重新下载'}
          </button>
        </div>
      </div>
    </div>
  )
}