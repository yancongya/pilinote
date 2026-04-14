// components/NewDownload/DownloadsList.tsx
import { useState, useRef, useEffect } from 'react'
import { RefreshCw, Trash2, Square, Play, Database, FolderOpen, ChevronDown } from 'lucide-react'
import { useNewQueueStore } from '../../stores/newQueue'
import { useToast } from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import TaskCard from './TaskCard'
import SchedulerCard from './SchedulerCard'
import './DownloadsList.css'

export default function DownloadsList() {
  const { filterStatus, setFilterStatus, getFilteredTasks, fetchTasks, fetchSchedulers, schedulers, batchDeleteTasks, deleteAllTasks, batchStartTasks } = useNewQueueStore()
  const { showToast } = useToast()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [showRefreshMenu, setShowRefreshMenu] = useState(false)
  const [libraryStats, setLibraryStats] = useState<any>(null)
  const refreshMenuRef = useRef<HTMLDivElement>(null)
  
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

  // 刷新任务列表
  const handleRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await Promise.all([
        fetchTasks(),
        fetchSchedulers()
      ])
    } finally {
      setIsRefreshing(false)
    }
  }

  // 处理点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (refreshMenuRef.current && !refreshMenuRef.current.contains(event.target as Node)) {
        setShowRefreshMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 获取视频库统计信息
  const fetchLibraryStats = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/library/statistics')
      if (response.ok) {
        const result = await response.json()
        setLibraryStats(result.data)
      }
    } catch (error) {
      console.error('获取视频库统计信息失败:', error)
    }
  }

  // 刷新本地视频库
  const handleRefreshLibrary = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    setShowRefreshMenu(false)
    try {
      const response = await fetch('http://localhost:8000/api/library/sync?auto_import=true&auto_cleanup=false', {
        method: 'POST'
      })
      if (response.ok) {
        const result = await response.json()
        showToast(`视频库刷新完成！${result.data.scan_result.total_files} 个文件，${result.data.imported_count} 个新文件`, 'success')
        // 刷新任务列表
        await fetchTasks()
        // 更新统计信息
        await fetchLibraryStats()
      } else {
        const errorResult = await response.json()
        throw new Error(errorResult.detail || '刷新失败')
      }
    } catch (error) {
      console.error('刷新视频库失败:', error)
      showToast(`刷新视频库失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setIsRefreshing(false)
    }
  }

  // 显示刷新菜单
  const toggleRefreshMenu = () => {
    setShowRefreshMenu(!showRefreshMenu)
    if (!showRefreshMenu) {
      fetchLibraryStats()
    }
  }

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

  // 删除所有任务
  const handleDeleteAll = async () => {
    if (filteredTasks.length === 0) return
    try {
      await deleteAllTasks()
      setSelectedTasks(new Set())
      setIsBatchMode(false)
    } catch (error) {
      console.error('删除所有任务失败:', error)
      showToast('删除所有任务失败，请重试', 'error')
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

        {/* 刷新按钮 */}
        <div className="refresh-dropdown" ref={refreshMenuRef}>
          <button
            className="refresh-button"
            onClick={toggleRefreshMenu}
            disabled={isRefreshing}
            aria-label="刷新选项"
            title="刷新选项"
          >
            <RefreshCw size={16} className={isRefreshing ? 'rotating' : ''} />
            <span>刷新</span>
            <ChevronDown size={14} style={{ marginLeft: '4px' }} />
          </button>

          {/* 刷新菜单 */}
          {showRefreshMenu && (
            <div className="refresh-menu">
              <div className="refresh-menu-header">
                <Database size={14} />
                <span>刷新选项</span>
              </div>
              
              <button
                className="refresh-menu-item"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw size={16} />
                <div className="refresh-menu-item-content">
                  <span>刷新任务列表</span>
                  <span className="refresh-menu-item-desc">更新下载任务状态和进度</span>
                </div>
              </button>

              <button
                className="refresh-menu-item"
                onClick={handleRefreshLibrary}
                disabled={isRefreshing}
              >
                <FolderOpen size={16} />
                <div className="refresh-menu-item-content">
                  <span>刷新本地视频库</span>
                  <span className="refresh-menu-item-desc">
                    {libraryStats ? `扫描 ${libraryStats.file_count} 个文件，${(libraryStats.total_size_gb).toFixed(2)} GB` : '扫描下载目录并同步'}
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>

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
            style={{ marginLeft: '8px', color: '#ef4444' }}
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
            style={{ marginLeft: '8px', color: '#10b981' }}
          >
            <Play size={16} />
            <span>开始 ({selectedTasks.size})</span>
          </button>
        )}

        {/* 删除所有按钮 */}
        {isBatchMode && (
          <button
            className="refresh-button"
            onClick={() => setShowDeleteAllConfirm(true)}
            aria-label="删除所有"
            title={`删除所有 ${filteredTasks.length} 个任务`}
            style={{ marginLeft: '8px', color: '#ef4444' }}
          >
            <Trash2 size={16} />
            <span>全部删除</span>
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
                backgroundColor: '#3b82f6',
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
        title="确认删除所有"
        message={`确定要删除所有 ${filteredTasks.length} 个任务吗？此操作不可恢复！`}
        confirmText="删除"
        confirmVariant="danger"
      />
    </div>
  )
}