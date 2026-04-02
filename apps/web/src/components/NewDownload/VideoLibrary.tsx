// components/NewDownload/VideoLibrary.tsx
import { useNewQueueStore } from '../../stores/newQueue'

export default function VideoLibrary() {
  const { tasks } = useNewQueueStore()

  const completedTasks = Object.values(tasks).filter(t => t.state === 'completed')

  // 按调度器分组
  const groupedByFolder = completedTasks.reduce((acc, task) => {
    const folder = task.schedulerId || '独立任务'
    if (!acc[folder]) acc[folder] = []
    acc[folder].push(task)
    return acc
  }, {} as Record<string, typeof completedTasks>)

  return (
    <div className="video-library">
      <div className="library-header">
        <h3>视频库</h3>
        <span>{completedTasks.length} 个视频</span>
      </div>

      {Object.entries(groupedByFolder).map(([folder, taskList]) => (
        <div key={folder} className="folder-section">
          {folder !== '独立任务' && (
            <h4 className="folder-title">{folder}</h4>
          )}
          <div className="video-grid">
            {taskList.map(task => (
              <div key={task.id} className="video-item">
                {task.cover && (
                  <img src={task.cover} alt={task.title} className="video-thumbnail" />
                )}
                <div className="video-info">
                  <p className="video-title">{task.title}</p>
                  {task.duration > 0 && (
                    <span className="video-duration">
                      {Math.floor(task.duration / 60)}:{(task.duration % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {completedTasks.length === 0 && (
        <div className="empty-state">
          <p>暂无已下载的视频</p>
        </div>
      )}
    </div>
  )
}
