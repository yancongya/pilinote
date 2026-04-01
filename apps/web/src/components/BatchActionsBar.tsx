import { CheckSquare, X, Download as DownloadIcon } from 'lucide-react'

interface BatchActionsBarProps {
  batchMode: boolean
  selectedCount: number
  onEnterBatchMode: () => void
  onExitBatchMode: () => void
  onBatchDownload: () => void
  loading: boolean
}

export default function BatchActionsBar({
  batchMode,
  selectedCount,
  onEnterBatchMode,
  onExitBatchMode,
  onBatchDownload,
  loading,
}: BatchActionsBarProps) {
  return (
    <div className="batch-actions">
      {!batchMode ? (
        <button
          className="batch-download-btn"
          onClick={(e) => {
            e.stopPropagation()
            onEnterBatchMode()
          }}
          disabled={loading}
          aria-label="进入批量选择模式"
        >
          <CheckSquare size={14} />
          批量下载
        </button>
      ) : (
        <>
          <button
            className="batch-cancel-btn"
            onClick={(e) => {
              e.stopPropagation()
              onExitBatchMode()
            }}
            aria-label="取消批量选择"
          >
            <X size={14} />
            取消
          </button>
          {selectedCount > 0 && (
            <button
              className="batch-start-btn"
              onClick={(e) => {
                e.stopPropagation()
                onBatchDownload()
              }}
              disabled={loading}
              aria-label={`下载选中的 ${selectedCount} 个视频`}
            >
              <DownloadIcon size={14} />
              下载 ({selectedCount})
            </button>
          )}
        </>
      )}
    </div>
  )
}