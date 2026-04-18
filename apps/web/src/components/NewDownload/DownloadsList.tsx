// components/NewDownload/DownloadsList.tsx
import { useState } from 'react'
import { Trash2, Square, Play } from 'lucide-react'
import { useNewQueueStore } from '../../stores/newQueue'
import { useToast } from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import TaskCard from './TaskCard'
import SchedulerCard from './SchedulerCard'
import './DownloadsList.css'

export default function DownloadsList() {
  const { filterStatus, setFilterStatus, getFilteredTasks, schedulers, batchDeleteTasks, deleteAllTasks, batchStartTasks } = useNewQueueStore()
  const { showToast } = useToast()
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  
  // 确认对话框状态
  const [showClearCacheConfirm, setShowClearCacheConfirm] = useState(false)
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)

  const filteredTasks = getFilteredTasks()

  // 按调度器分组
  const schedulerTasks = filteredTasks.filter(t => t.schedulerId)
  const independentTasks = filteredTasks.filter(t => !t.schedulerId)

  const groupedByScheduler = schedulerTasks.reduce((acc, task) => {
    const sid = task.schedulerId!
    if (!acc[sid]) acc[sid] = []
    acc[sid].push(task)
    return acc
  }, {} as Record<string, typeof schedulerTasks>)

  // 清除缓存
  const handleClearCache = () => {
    localStorage.removeItem('new-queue-storage')
    window.location.reload()
  }

  // 批量选择
  const handleTaskSelect = (taskId: string) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
  }

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set())
    } else {
      setSelectedTasks(new Set(filteredTasks.map(t => t.id)))
    }
  }

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedTasks.size === 0) return
    try {
      await batchDeleteTasks(Array.from(selectedTasks))
      setSelectedTasks(new Set())
      setIsBatchMode(false)
    } catch (error) {
      console.error('批量删除失败:', error)
      showToast('批量删除失败，请重试', 'error')
    }
  }

  // 批量开始下载
  const handleBatchStart = async () => {
    if (selectedTasks.size === 0) return
    try {
      await batchStartTasks(Array.from(selectedTasks))
      setSelectedTasks(new Set())
      setIsBatchMode(false)
    } catch (error) {
      console.error('批量开始下载失败:', error)
      showToast('批量开始下载失败，请重试', 'error')
    }
  }

  // 清空所有任务记录
  const handleDeleteAll = async () => {
    if (filteredTasks.length === 0) return
    try {
      await deleteAllTasks()
      setSelectedTasks(new Set())
      setIsBatchMode(false)
    } catch (error) {
      console.error('清空任务记录失败:', error)
      showToast('清空任务记录失败，请重试', 'error')
    }
  }

  return (
    <div className="downloads-list">
      {/* 过滤器 */}
      <div className="filter-bar">
        <label htmlFor="status-filter" className="sr-only">筛选状态</label>
        <select
          id="status-filter"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
        >
          <option value="all">全部</option>
          <option value="backlog">待处理</option>
          <option value="active">下载中</option>
          <option value="paused">已暂停</option>
          <option value="failed">失败</option>
        </select>

        {/* 清除缓存按钮 */}
        <button
          className="refresh-button"
          onClick={() => setShowClearCacheConfirm(true)}
          aria-label="清除本地缓存"
          title="清除本地缓存数据"
          style={{ marginLeft: '8px' }}
        >
          <span>清除缓存</span>
        </button>

        {/* 批量管理按钮 */}
        {filteredTasks.length > 0 && (
          <button
            className="refresh-button"
            onClick={() => setIsBatchMode(!isBatchMode)}
            aria-label="批量管理"
            title="批量管理任务"
            style={{ marginLeft: '8px' }}
          >
            <span>{isBatchMode ? '取消批量管理' : '批量管理'}</span>
          </button>
        )}

        {/* 批量删除按钮 */}
        {isBatchMode && selectedTasks.size > 0 && (
          <button
            className="refresh-button"
            onClick={() => setShowBatchDeleteConfirm(true)}
            aria-label="批量删除"
            title={`删除选中的 ${selectedTasks.size} 个任务`}
            style={{ marginLeft: '8px', color: 'var(--color-error-500)' }}
          >
            <Trash2 size={16} />
            <span>删除 ({selectedTasks.size})</span>
          </button>
        )}

        {/* 批量开始下载按钮 */}
        {isBatchMode && selectedTasks.size > 0 && (
          <button
            className="refresh-button"
            onClick={handleBatchStart}
            aria-label="批量开始下载"
            title={`开始下载选中的 ${selectedTasks.size} 个任务`}
            style={{ marginLeft: '8px', color: 'var(--color-success-500)' }}
          >
            <Play size={16} />
            <span>开始 ({selectedTasks.size})</span>
          </button>
        )}

        {/* 清空任务记录按钮 */}
        {isBatchMode && (
          <button
            className="refresh-button"
            onClick={() => setShowDeleteAllConfirm(true)}
            aria-label="清空任务记录"
            title={`清空 ${filteredTasks.length} 个任务记录（不删除本地下载文件）`}
            style={{ marginLeft: '8px', color: 'var(--color-error-500)' }}
          >
            <Trash2 size={16} />
            <span>清空任务</span>
          </button>
        )}

        {/* 全选按钮 */}
        {isBatchMode && (
          <button
            className="refresh-button"
            onClick={handleSelectAll}
            aria-label="全选"
            title={selectedTasks.size === filteredTasks.length ? '取消全选' : '全选'}
            style={{ marginLeft: '8px' }}
          >
            {selectedTasks.size === filteredTasks.length ? (
              <div style={{
                width: '16px',
                height: '16px',
                backgroundColor: 'var(--color-primary-500)',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            ) : (
              <Square size={16} />
            )}
            <span>{selectedTasks.size === filteredTasks.length ? '取消全选' : '全选'}</span>
          </button>
        )}
      </div>

      {/* 调度器任务 */}
      {Object.entries(groupedByScheduler).map(([sid]) => {
        const scheduler = schedulers[sid]
        if (!scheduler) return null
        return (
          <SchedulerCard 
            key={sid} 
            scheduler={scheduler} 
            isBatchMode={isBatchMode}
            selectedTasks={selectedTasks}
            onTaskSelect={handleTaskSelect}
          />
        )
      })}

      {/* 独立任务 */}
      {independentTasks.map(task => (
        <TaskCard 
          key={task.id} 
          task={task} 
          isBatchMode={isBatchMode}
          isSelected={selectedTasks.has(task.id)}
          onSelect={() => handleTaskSelect(task.id)}
        />
      ))}

      {filteredTasks.length === 0 && (
        <div className="empty-state" role="status">
          <p>暂无下载任务</p>
        </div>
      )}

      {/* 确认对话框 */}
      <ConfirmModal
        isOpen={showClearCacheConfirm}
        onClose={() => setShowClearCacheConfirm(false)}
        onConfirm={handleClearCache}
        title="确认清除缓存"
        message="确定要清除本地缓存吗？这将重新从服务器加载所有数据。"
        confirmText="清除"
        confirmVariant="danger"
      />

      <ConfirmModal
        isOpen={showBatchDeleteConfirm}
        onClose={() => setShowBatchDeleteConfirm(false)}
        onConfirm={handleBatchDelete}
        title="确认批量删除"
        message={`确定要删除选中的 ${selectedTasks.size} 个任务吗？`}
        confirmText="删除"
        confirmVariant="danger"
      />

      <ConfirmModal
        isOpen={showDeleteAllConfirm}
        onClose={() => setShowDeleteAllConfirm(false)}
        onConfirm={handleDeleteAll}
        title="确认清空任务记录"
        message={`确定要清空所有 ${filteredTasks.length} 个任务记录吗？这不会删除本地已下载文件。`}
        confirmText="清空"
        confirmVariant="danger"
      />
    </div>
  )
}
