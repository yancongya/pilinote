# 稍后再看下载集成

## 概述

稍后再看页集成了完整的下载功能，支持单视频下载、多P视频下载，并能实时显示下载状态。

## 文件位置

```
apps/web/src/pages/components/WatchLaterContent.tsx
apps/web/src/hooks/useVideoDownload.ts
apps/web/src/stores/newQueue.ts
```

## 下载流程

### 整体流程图

```
用户点击下载按钮
    ↓
检查下载状态（getDownloadStatus）
    ↓
判断视频类型（单P/多P）
    ↓
获取视频详情
    ↓
创建下载任务
    ↓
提交到下载队列
    ↓
更新下载状态
    ↓
显示用户提示
```

## 下载状态检查

### 状态类型

```typescript
type DownloadStatus = 'none' | 'in_list' | 'downloaded';
```

- `none`: 未下载
- `in_list`: 在下载队列中（未完成）
- `downloaded`: 已下载完成

### 状态检查函数

```typescript
const getDownloadStatus = (bvid: string): DownloadStatus => {
  const tasks = newQueueStore.tasks;
  const newSystemTasks = Object.values(tasks);
  
  // 检查是否在队列中（未完成的任务）
  const hasActiveTask = newSystemTasks.some(task =>
    task.media_id === bvid && 
    !['completed', 'cancelled'].includes(task.state)
  );
  
  if (hasActiveTask) {
    return 'in_list';
  }
  
  // 检查是否已下载完成（已完成的任务）
  const hasCompletedTask = newSystemTasks.some(task =>
    task.media_id === bvid && 
    task.state === 'completed'
  );
  
  if (hasCompletedTask) {
    return 'downloaded';
  }
  
  return 'none';
};
```

### 状态显示

```typescript
// VideoListCard 组件中
const status = getDownloadStatus(video.bvid);

switch (status) {
  case 'in_list':
    return <DownloadButton variant="in-queue" />;
  case 'downloaded':
    return <DownloadButton variant="completed" />;
  default:
    return <DownloadButton variant="default" />;
}
```

## 单P视频下载

### 下载流程

```typescript
const toggleDownload = useCallback(async (video: any, e: React.MouseEvent) => {
  const result = await baseToggleDownload(video, e);
  
  if (result.success) {
    if (result.shouldNavigateToLibrary) {
      navigate('/downloads', { replace: true });
      setTimeout(() => {
        setAlertModal({
          show: true,
          title: '操作成功',
          message: result.message,
          type: 'success'
        });
      }, 100);
    } else {
      setAlertModal({
        show: true,
        title: '操作成功',
        message: result.message,
        type: 'success'
      });
    }
  } else {
    setAlertModal({
      show: true,
      title: '操作失败',
      message: result.message,
      type: 'error'
    });
  }
}, [baseToggleDownload, navigate]);
```

### 任务创建

```typescript
// useVideoDownload Hook
const createTask = async (video: any) => {
  const task = {
    media_id: video.bvid,
    media_type: 'video',
    title: video.title,
    cover: video.pic,
    quality: settings.quality || 80,
    cid: video.cid,
    aid: video.aid,
    duration: video.durationSeconds,
    uploader: video.owner,
    pubtime: video.pubtime,
    meta: {
      cid: video.cid,
      page: 1,
      part_title: video.title
    }
  };
  
  await apiService.createDownloadTask(task);
};
```

## 多P视频下载

### 分P检测

```typescript
// 获取视频详情时检测分P
const response = await apiService.getVideoDetail(video.bvid);

if (response.success && response.data) {
  const pages = response.data.pages || [];
  
  if (pages.length > 1) {
    // 多P视频
    return handleMultiPartDownload(video, pages);
  } else {
    // 单P视频
    return handleSinglePartDownload(video);
  }
}
```

### 调度器创建

```typescript
const handleMultiPartDownload = async (video: any, pages: any[]) => {
  // 1. 创建调度器
  const scheduler = {
    name: `系列-${video.title}`,
    media_type: 'video',
    total_tasks: pages.length,
    description: `共 ${pages.length} 个分P`
  };
  
  const schedulerResult = await apiService.createScheduler(scheduler);
  
  if (!schedulerResult.success) {
    return { success: false, message: '创建调度器失败' };
  }
  
  const schedulerId = schedulerResult.data.id;
  
  // 2. 为每个分P创建任务
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const task = {
      media_id: video.bvid,
      media_type: 'video',
      title: page.part || `P${i + 1}`,
      cover: video.pic,
      quality: settings.quality || 80,
      cid: page.cid,
      aid: video.aid,
      duration: page.duration,
      uploader: video.owner,
      pubtime: video.pubtime,
      scheduler_id: schedulerId,
      meta: {
        cid: page.cid,
        page: page.page,
        part_title: page.part || `P${i + 1}`,
        page_count: pages.length
      }
    };
    
    await apiService.createDownloadTask(task);
  }
  
  return { 
    success: true, 
    message: `已添加 ${pages.length} 个分P到下载队列`,
    shouldNavigateToLibrary: true
  };
};
```

### 文件夹命名

```typescript
// 调度器名称格式
const schedulerName = `系列-${video.title}`;

// 文件夹路径
const folderPath = `${settings.download_path}/${schedulerName}`;

// 最终文件路径
const filePath = `${folderPath}/P${page.page} ${page.part}.mp4`;
```

## 下载状态管理

### 状态更新

```typescript
// 组件挂载时同步数据
useEffect(() => {
  const syncData = async () => {
    if (tasksSyncedRef.current) return;
    tasksSyncedRef.current = true;

    try {
      // 清理本地缓存
      newQueueStore.forceClearCache();
      
      // 同步最新数据
      await newQueueStore.fetchTasks();
      await newQueueStore.fetchSchedulers();
      
      // 清理重复的已完成任务
      await newQueueStore.cleanupDuplicateCompletedTasks();
    } catch (error) {
      console.error('[WatchLater] 同步数据失败:', error);
    }
  };
  
  syncData();
}, []);
```

### 实时更新

```typescript
// WebSocket 连接用于实时更新
useEffect(() => {
  const ws = new WebSocket('ws://localhost:8000/ws');
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'task_update') {
      // 更新任务状态
      newQueueStore.updateTask(data.task);
    }
  };
  
  return () => {
    ws.close();
  };
}, []);
```

## 错误处理

### 网络错误

```typescript
try {
  const result = await baseToggleDownload(video, e);
  if (result.success) {
    // 成功处理
  } else {
    setAlertModal({
      show: true,
      title: '操作失败',
      message: result.message,
      type: 'error'
    });
  }
} catch (error) {
  setAlertModal({
    show: true,
    title: '网络错误',
    message: '网络请求失败，请稍后重试',
    type: 'error'
  });
}
```

### API 错误

```typescript
const response = await apiService.createDownloadTask(task);

if (!response.success) {
  return {
    success: false,
    message: response.message || '创建下载任务失败'
  };
}
```

### 用户操作错误

```typescript
// 检查视频是否已在队列中
const status = getDownloadStatus(video.bvid);

if (status === 'in_list') {
  return {
    success: false,
    message: '视频已在下载队列中'
  };
}

if (status === 'downloaded') {
  return {
    success: false,
    message: '视频已下载完成'
  };
}
```

## 用户提示

### 成功提示

```typescript
<AlertModal
  isOpen={alertModal.show}
  onClose={() => setAlertModal({ show: false, title: '', message: '', type: 'success' })}
  title={alertModal.title}
  message={alertModal.message}
  type={alertModal.type}
/>
```

### 提示场景

| 场景 | 标题 | 消息 |
|------|------|------|
| 单P下载成功 | 操作成功 | 已添加到下载队列 |
| 多P下载成功 | 操作成功 | 已添加 N 个分P到下载队列 |
| 下载失败 | 操作失败 | 具体错误信息 |
| 网络错误 | 网络错误 | 网络请求失败，请稍后重试 |

## 下载队列集成

### NewQueueStore

```typescript
// apps/web/src/stores/newQueue.ts
interface NewQueueState {
  tasks: Record<string, DownloadTask>;
  schedulers: Record<string, Scheduler>;
  
  // Actions
  fetchTasks: () => Promise<void>;
  fetchSchedulers: () => Promise<void>;
  updateTask: (task: DownloadTask) => void;
  forceClearCache: () => void;
  cleanupDuplicateCompletedTasks: () => Promise<void>;
}
```

### 任务状态

```typescript
type TaskState = 
  | 'pending'     // 等待中
  | 'running'     // 下载中
  | 'paused'      // 已暂停
  | 'completed'   // 已完成
  | 'failed'      // 失败
  | 'cancelled';  // 已取消
```

## 代码示例

### 完整的下载流程

```typescript
// apps/web/src/pages/components/WatchLaterContent.tsx
export default function WatchLaterContent() {
  const newQueueStore = useNewQueueStore();
  const { toggleDownload: baseToggleDownload } = useVideoDownload();
  
  // 下载状态检查
  const getDownloadStatus = (bvid: string): 'none' | 'in_list' | 'downloaded' => {
    const tasks = newQueueStore.tasks;
    const newSystemTasks = Object.values(tasks);
    
    const hasActiveTask = newSystemTasks.some(task =>
      task.media_id === bvid && 
      !['completed', 'cancelled'].includes(task.state)
    );
    
    if (hasActiveTask) {
      return 'in_list';
    }
    
    const hasCompletedTask = newSystemTasks.some(task =>
      task.media_id === bvid && 
      task.state === 'completed'
    );
    
    if (hasCompletedTask) {
      return 'downloaded';
    }
    
    return 'none';
  };
  
  // 包装下载函数
  const toggleDownload = useCallback(async (video: any, e: React.MouseEvent) => {
    const result = await baseToggleDownload(video, e);
    
    if (result.success) {
      if (result.shouldNavigateToLibrary) {
        navigate('/downloads', { replace: true });
        setTimeout(() => {
          setAlertModal({
            show: true,
            title: '操作成功',
            message: result.message,
            type: 'success'
          });
        }, 100);
      } else {
        setAlertModal({
          show: true,
          title: '操作成功',
          message: result.message,
          type: 'success'
        });
      }
    } else {
      setAlertModal({
        show: true,
        title: '操作失败',
        message: result.message,
        type: 'error'
      });
    }
  }, [baseToggleDownload, navigate]);
  
  return (
    <VideoListContainer
      videos={videos}
      onDownloadToggle={toggleDownload}
      getDownloadStatus={getDownloadStatus}
      // ...
    />
  );
}
```

## 注意事项

1. **下载状态检查**：每次渲染时都需要检查最新的下载状态
2. **多P视频处理**：需要为每个分P创建独立的任务
3. **调度器关联**：多P视频的所有任务都需要关联到同一个调度器
4. **错误处理**：所有网络请求都需要错误处理和用户提示
5. **状态同步**：组件挂载时需要同步下载队列数据

## 性能优化

### 1. useCallback 缓存函数

```typescript
const toggleDownload = useCallback(async (video: any, e: React.MouseEvent) => {
  // ...
}, [baseToggleDownload, navigate]);
```

### 2. useRef 避免重复请求

```typescript
const tasksSyncedRef = useRef(false);

useEffect(() => {
  if (tasksSyncedRef.current) return;
  tasksSyncedRef.current = true;
  // ... 同步逻辑
}, []);
```

## 与收藏夹的区别

稍后再看的下载集成与收藏夹完全相同，使用相同的 Hooks 和 Store。

| 特性 | 稍后再看 | 收藏夹 |
|------|----------|--------|
| 下载状态检查 | 相同 | 相同 |
| 单P下载 | 相同 | 相同 |
| 多P下载 | 相同 | 相同 |
| 下载队列 | 相同 | 相同 |
| 错误处理 | 相同 | 相同 |

## 相关组件

- [VideoListContainer](../components/video-list-container.md) - 视频列表容器
- [AlertModal](../components/alert-modal.md) - 提示弹窗
- [DownloadManager](../download/download-manager.md) - 下载管理器

## 相关 Hooks

- [useVideoDownload](../hooks/use-video-download.md) - 下载管理 Hook

## 相关文档

- [稍后再看 API](../api/watchlater-api.md) - API 文档
- [稍后再看页前端实现](../web/watchlater-page.md) - 前端实现
- [收藏夹下载集成](./favorites-download.md) - 收藏夹下载集成

---

[返回上级](./README.md)