# PiliNote 下载功能重构方案 - 新Tab方案

## 一、方案概述

在主导航栏上添加新的Tab（"新下载"），完全使用BiliTools架构实现下载功能。新旧系统并存，测试通过后删除旧"下载管理"Tab。

### Tab结构变化
```
当前：[首页] [收藏] [稍后再看] [下载管理]
新增：[首页] [收藏] [稍后再看] [下载管理] [新下载]
测试后：[首页] [收藏] [稍后再看] [新下载]
```

### 方案优势
1. **零风险**：新旧系统完全独立
2. **可对比**：同时测试新旧系统功能
3. **可回滚**：随时删除新Tab即可
4. **渐进式**：测试通过后再清理旧代码

## 二、需要修改的文件

### 修改文件（4个）
| 文件 | 修改内容 |
|------|----------|
| `pages/HomePage.tsx` | 添加新Tab按钮 + 路由 + 渲染 |
| `App.tsx` | 添加新路由 `/new-downloads` |
| `stores/` | 新增 `newQueue.ts` |
| `components/` | 新增 `NewDownload/` 目录 |

### 新增文件
```
apps/web/src/
├── stores/newQueue.ts              # 新的状态管理
├── components/NewDownload/
│   ├── index.tsx                   # 主组件
│   ├── DownloadsList.tsx           # 下载列表Tab
│   ├── VideoLibrary.tsx            # 视频库Tab
│   ├── TaskCard.tsx                # 任务卡片
│   ├── SchedulerCard.tsx           # 调度器卡片
│   └── index.css                   # 样式
└── hooks/useNewQueue.ts            # (可选) 队列hook
```

## 三、具体实现

### 3.1 修改 HomePage.tsx

#### 3.1.1 导入新组件
```tsx
// 在 imports 中添加
import NewDownloadContent from './components/NewDownload'
```

#### 3.1.2 修改类型定义
```tsx
// 当前代码 (第68-74行)
const getActiveTabFromPath = () => {
  const path = location.pathname
  if (path === '/favorites' || path.startsWith('/favorites/')) return 'favorites'
  if (path === '/watch-later') return 'watch-later'
  if (path === '/downloads') return 'downloads'
  return 'home'
}

// 修改为
const getActiveTabFromPath = () => {
  const path = location.pathname
  if (path === '/favorites' || path.startsWith('/favorites/')) return 'favorites'
  if (path === '/watch-later') return 'watch-later'
  if (path === '/downloads') return 'downloads'
  if (path === '/new-downloads') return 'new-downloads'  // 新增
  return 'home'
}
```

#### 3.1.3 修改路由映射
```tsx
// 当前代码 (第78-86行)
const handleTabChange = (tab: string) => {
  const routes: Record<string, string> = {
    home: '/home',
    favorites: '/favorites',
    'watch-later': '/watch-later',
    downloads: '/downloads'
  }
  navigate(routes[tab] || '/home')
}

// 修改为
const handleTabChange = (tab: string) => {
  const routes: Record<string, string> = {
    home: '/home',
    favorites: '/favorites',
    'watch-later': '/watch-later',
    downloads: '/downloads',
    'new-downloads': '/new-downloads'  // 新增
  }
  navigate(routes[tab] || '/home')
}
```

#### 3.1.4 添加新Tab按钮
```tsx
// 在下载管理Tab后面添加 (第203行后)
<button
  role="tab"
  aria-selected={activeTab === 'new-downloads'}
  aria-controls="new-downloads-panel"
  className={`home-tab ${activeTab === 'new-downloads' ? 'active' : ''}`}
  onClick={() => handleTabChange('new-downloads')}
  tabIndex={activeTab === 'new-downloads' ? 0 : -1}
>
  <Download className="tab-icon" />
  <span className="tab-label">新下载</span>
</button>
```

#### 3.1.5 添加新Tab内容渲染
```tsx
// 在 downloads 内容后面添加
{activeTab === 'new-downloads' && (
  <div id="new-downloads-panel">
    <NewDownloadContent />
  </div>
)}
```

#### 3.1.6 添加底部导航按钮
```tsx
// 在底部导航的下载按钮后面添加
<button
  className={`nav-item ${activeTab === 'new-downloads' ? 'active' : ''}`}
  onClick={() => handleTabChange('new-downloads')}
  aria-label="新下载"
  aria-current={activeTab === 'new-downloads' ? 'page' : undefined}
>
  <Download className="nav-icon" />
  <span className="nav-label">新下载</span>
</button>
```

### 3.2 新增状态管理 (newQueue.ts)

```typescript
// stores/newQueue.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 类型定义
export type TaskState = 'backlog' | 'pending' | 'active' | 'completed' | 'paused' | 'failed' | 'cancelled';
export type SchedulerState = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  ts: number;
  seq: number;
  title: string;
  cover: string;
  desc: string;
  duration: number;
  pubtime: number;
  mediaType: string;
  url: string;
  aid?: number;
  cid?: number;
  bvid?: string;
  schedulerId?: string;
  state: TaskState;
  select: PopupSelect;
  subtasks: SubTask[];
  subtaskStatus: Record<string, SubTaskStatus>;
}

export interface Scheduler {
  sid: string;
  ts: number;
  list: string[];
  state: SchedulerState;
  folder: string;
}

export interface SubTask {
  id: string;
  type: string;
}

export interface SubTaskStatus {
  content: number;
  chunk: number;
}

export interface PopupSelect {
  res?: number;
  abr?: number;
  enc?: number;
  fmt: string;
  misc: { aiSummary: boolean; subtitles: false | string };
  nfo: { album: boolean; single: boolean };
  danmaku: { live: boolean; history: false | string };
  thumb: string[];
  media: { video: boolean; audio: boolean; audioVideo: boolean };
}

interface NewQueueState {
  // 数据
  tasks: Record<string, Task>;
  schedulers: Record<string, Scheduler>;
  
  // UI状态
  activeTab: 'downloads' | 'library';
  filterStatus: TaskState | 'all';
  
  // WebSocket
  ws: WebSocket | null;
  connected: boolean;
  
  // Actions
  connectWebSocket: () => void;
  handleEvent: (event: any) => void;
  submitTask: (task: Task) => Promise<void>;
  controlTask: (taskId: string, action: string) => Promise<void>;
  controlScheduler: (sid: string, action: string) => Promise<void>;
  setActiveTab: (tab: 'downloads' | 'library') => void;
  setFilterStatus: (status: TaskState | 'all') => void;
  
  // 计算属性
  getTaskProgress: (taskId: string) => number;
  getFilteredTasks: () => Task[];
}

export const useNewQueueStore = create<NewQueueState>()(
  persist(
    (set, get) => ({
      tasks: {},
      schedulers: {},
      activeTab: 'downloads',
      filterStatus: 'all',
      ws: null,
      connected: false,
      
      connectWebSocket: () => {
        const ws = new WebSocket('ws://localhost:8000/ws/queue');
        
        ws.onopen = () => {
          set({ connected: true });
          console.log('[NewDownload] WebSocket connected');
        };
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          get().handleEvent(data);
        };
        
        ws.onclose = () => {
          set({ connected: false });
          console.log('[NewDownload] WebSocket disconnected');
          setTimeout(() => get().connectWebSocket(), 3000);
        };
        
        set({ ws });
      },
      
      handleEvent: (event) => {
        switch (event.type) {
          case 'taskUpdated':
            set((state) => {
              const tasks = { ...state.tasks };
              if (event.cancelled) {
                delete tasks[event.id];
              } else if (event.state) {
                tasks[event.id] = { ...tasks[event.id], state: event.state };
              }
              return { tasks };
            });
            break;
            
          case 'progress':
            set((state) => {
              const task = state.tasks[event.task];
              if (task) {
                task.subtaskStatus[event.subtask] = {
                  content: event.content,
                  chunk: event.chunk,
                };
              }
              return { tasks: { ...state.tasks } };
            });
            break;
        }
      },
      
      submitTask: async (task) => {
        const response = await fetch('/api/tasks/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: task.id, view: task }),
        });
        if (!response.ok) throw new Error('Submit failed');
      },
      
      controlTask: async (taskId, action) => {
        const response = await fetch(`/api/tasks/${taskId}/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        if (!response.ok) throw new Error('Control failed');
      },
      
      controlScheduler: async (sid, action) => {
        const response = await fetch(`/api/tasks/schedulers/${sid}/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        if (!response.ok) throw new Error('Control failed');
      },
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      setFilterStatus: (status) => set({ filterStatus: status }),
      
      getTaskProgress: (taskId) => {
        const task = get().tasks[taskId];
        if (!task) return 0;
        
        let total = 0;
        let completed = 0;
        for (const status of Object.values(task.subtaskStatus || {})) {
          total += status.content;
          completed += status.chunk;
        }
        return total > 0 ? (completed / total) * 100 : 0;
      },
      
      getFilteredTasks: () => {
        const { tasks, filterStatus } = get();
        const taskList = Object.values(tasks);
        
        if (filterStatus === 'all') return taskList;
        return taskList.filter(t => t.state === filterStatus);
      },
    }),
    {
      name: 'new-queue-storage',
      partialize: (state) => ({
        tasks: state.tasks,
        schedulers: state.schedulers,
      }),
    }
  )
);
```

### 3.3 新增主组件 (NewDownload/index.tsx)

```tsx
// components/NewDownload/index.tsx
import { useEffect } from 'react';
import { useNewQueueStore } from '../../stores/newQueue';
import DownloadsList from './DownloadsList';
import VideoLibrary from './VideoLibrary';
import './index.css';

export default function NewDownloadContent() {
  const { activeTab, setActiveTab, connectWebSocket, connected } = useNewQueueStore();
  
  useEffect(() => {
    connectWebSocket();
  }, []);
  
  return (
    <div className="new-download-page">
      {/* 连接状态 */}
      {!connected && (
        <div className="connection-warning">
          ⚠️ 连接断开，正在重连...
        </div>
      )}
      
      {/* 内部Tab */}
      <div className="new-download-tabs">
        <button 
          className={`tab ${activeTab === 'downloads' ? 'active' : ''}`}
          onClick={() => setActiveTab('downloads')}
        >
          下载列表
        </button>
        <button 
          className={`tab ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => setActiveTab('library')}
        >
          视频库
        </button>
      </div>
      
      {/* 内容 */}
      <div className="new-download-content">
        {activeTab === 'downloads' ? <DownloadsList /> : <VideoLibrary />}
      </div>
    </div>
  );
}
```

### 3.4 新增下载列表组件 (DownloadsList.tsx)

```tsx
// components/NewDownload/DownloadsList.tsx
import { useNewQueueStore } from '../../stores/newQueue';
import TaskCard from './TaskCard';
import SchedulerCard from './SchedulerCard';

export default function DownloadsList() {
  const { tasks, filterStatus, setFilterStatus, getFilteredTasks } = useNewQueueStore();
  
  const filteredTasks = getFilteredTasks();
  
  // 按调度器分组
  const schedulerTasks = filteredTasks.filter(t => t.schedulerId);
  const independentTasks = filteredTasks.filter(t => !t.schedulerId);
  
  const groupedByScheduler = schedulerTasks.reduce((acc, task) => {
    const sid = task.schedulerId!;
    if (!acc[sid]) acc[sid] = [];
    acc[sid].push(task);
    return acc;
  }, {} as Record<string, typeof schedulerTasks>);
  
  return (
    <div className="downloads-list">
      {/* 过滤器 */}
      <div className="filter-bar">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
          <option value="all">全部</option>
          <option value="backlog">待处理</option>
          <option value="active">下载中</option>
          <option value="paused">已暂停</option>
          <option value="failed">失败</option>
          <option value="completed">已完成</option>
        </select>
      </div>
      
      {/* 调度器任务 */}
      {Object.entries(groupedByScheduler).map(([sid, taskList]) => (
        <SchedulerCard key={sid} schedulerId={sid} tasks={taskList} />
      ))}
      
      {/* 独立任务 */}
      {independentTasks.map(task => (
        <TaskCard key={task.id} task={task} />
      ))}
      
      {filteredTasks.length === 0 && (
        <div className="empty-state">
          <p>暂无下载任务</p>
        </div>
      )}
    </div>
  );
}
```

### 3.5 新增任务卡片组件 (TaskCard.tsx)

```tsx
// components/NewDownload/TaskCard.tsx
import { useNewQueueStore } from '../../stores/newQueue';
import { Play, Pause, Trash2, RefreshCw } from 'lucide-react';

interface Props {
  task: any;
}

export default function TaskCard({ task }: Props) {
  const { controlTask, getTaskProgress } = useNewQueueStore();
  const progress = getTaskProgress(task.id);
  
  const statusConfig: Record<string, { label: string; color: string }> = {
    'backlog': { label: '待处理', color: '#f59e0b' },
    'pending': { label: '已规划', color: '#3b82f6' },
    'active': { label: '下载中', color: '#10b981' },
    'paused': { label: '已暂停', color: '#f97316' },
    'failed': { label: '失败', color: '#ef4444' },
    'cancelled': { label: '已取消', color: '#6b7280' },
    'completed': { label: '已完成', color: '#22c55e' },
  };
  
  const status = statusConfig[task.state] || { label: task.state, color: '#6b7280' };
  
  return (
    <div className="task-card" style={{ borderLeft: `4px solid ${status.color}` }}>
      <div className="task-header">
        <img src={task.cover} alt={task.title} className="thumbnail" />
        <div className="info">
          <h4 className="title">{task.title}</h4>
          <div className="meta">
            <span className="status" style={{ color: status.color }}>{status.label}</span>
          </div>
        </div>
      </div>
      
      <div className="task-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%`, backgroundColor: status.color }} />
        </div>
        <span>{progress.toFixed(1)}%</span>
      </div>
      
      <div className="task-actions">
        {task.state === 'active' && (
          <button onClick={() => controlTask(task.id, 'pause')}><Pause size={16} /></button>
        )}
        {task.state === 'paused' && (
          <button onClick={() => controlTask(task.id, 'resume')}><Play size={16} /></button>
        )}
        {(task.state === 'failed' || task.state === 'cancelled') && (
          <button onClick={() => controlTask(task.id, 'retry')}><RefreshCw size={16} /></button>
        )}
        {!['completed', 'cancelled'].includes(task.state) && (
          <button onClick={() => controlTask(task.id, 'cancel')}><Trash2 size={16} /></button>
        )}
      </div>
    </div>
  );
}
```

### 3.6 新增视频库组件 (VideoLibrary.tsx)

```tsx
// components/NewDownload/VideoLibrary.tsx
import { useNewQueueStore } from '../../stores/newQueue';

export default function VideoLibrary() {
  const { tasks } = useNewQueueStore();
  
  const completedTasks = Object.values(tasks).filter(t => t.state === 'completed');
  
  return (
    <div className="video-library">
      <div className="library-header">
        <h3>视频库</h3>
        <span>{completedTasks.length} 个视频</span>
      </div>
      
      <div className="video-grid">
        {completedTasks.map(task => (
          <div key={task.id} className="video-item">
            <img src={task.cover} alt={task.title} />
            <p>{task.title}</p>
          </div>
        ))}
      </div>
      
      {completedTasks.length === 0 && (
        <div className="empty-state">
          <p>暂无已下载的视频</p>
        </div>
      )}
    </div>
  );
}
```

## 四、实施步骤

| 步骤 | 内容 | 预计时间 | 文件 |
|------|------|----------|------|
| 1 | 创建状态管理 | 1小时 | `stores/newQueue.ts` |
| 2 | 创建主组件 | 30分钟 | `components/NewDownload/index.tsx` |
| 3 | 创建下载列表组件 | 1小时 | `components/NewDownload/DownloadsList.tsx` |
| 4 | 创建任务卡片 | 1小时 | `components/NewDownload/TaskCard.tsx` |
| 5 | 创建视频库组件 | 30分钟 | `components/NewDownload/VideoLibrary.tsx` |
| 6 | 创建样式文件 | 30分钟 | `components/NewDownload/index.css` |
| 7 | 修改HomePage添加Tab | 30分钟 | `pages/HomePage.tsx` |
| 8 | 测试验证 | 1小时 | - |

**总计：约5小时**

## 五、测试计划

### 5.1 功能测试清单
- [ ] 新Tab可以正常显示
- [ ] WebSocket连接正常
- [ ] 提交下载任务
- [ ] 查看下载进度
- [ ] 暂停/恢复/取消任务
- [ ] 调度器功能（系列任务）
- [ ] 视频库显示已完成任务

### 5.2 对比测试
- [ ] 旧Tab功能正常
- [ ] 新旧系统可以同时使用
- [ ] 状态独立，互不影响

## 六、清理计划（测试通过后）

### 6.1 删除文件
- `components/DownloadsContent.tsx`
- `stores/download.ts` (替换为 newQueue.ts)

### 6.2 修改文件
- `pages/HomePage.tsx` - 删除旧Tab
- 删除 `hooks/useVideoDownload.ts` 等旧hook

## 七、风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 新Tab显示异常 | 低 | 低 | 独立组件，不影响其他功能 |
| WebSocket连接失败 | 中 | 中 | 添加重连机制 |
| 状态同步问题 | 低 | 低 | 定期全量同步 |
| 其他功能受影响 | 极低 | 低 | 完全独立的新代码 |

## 八、后端API需求

### 需要的新API端点
```
POST   /api/tasks/submit              # 提交任务
POST   /api/tasks/{id}/control        # 控制任务
GET    /api/tasks/list                # 获取任务列表
POST   /api/schedulers/{sid}/process  # 处理调度器
WS     /ws/queue                      # WebSocket事件
```

### 需要确认
1. 后端是否已实现这些API？
2. WebSocket服务器是否已配置？

---

**文档版本**: 1.0  
**最后更新**: 2026-04-02
