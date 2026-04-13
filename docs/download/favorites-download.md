# 收藏夹下载集成

## 概述

收藏夹下载集成是指在收藏页中添加视频下载功能，允许用户直接从收藏夹下载视频。该功能集成了新的下载队列系统（NewQueueStore），支持单视频和多P视频下载。

## 相关文件

```
apps/web/src/
├── pages/components/FavoritesContent.tsx  # 收藏页主组件
├── hooks/useVideoDownload.ts             # 下载管理 Hook
├── stores/newQueue.ts                    # 下载队列 Store
├── services/api.ts                       # API 服务
└── components/VideoListContainer.tsx     # 视频列表容器
```

## 下载流程

### 完整流程图

```
用户点击下载按钮
    ↓
调用 useVideoDownload.toggleDownload()
    ↓
检查视频是否在下载队列
    ↓
获取视频详情（检查是否多P）
    ↓
判断是否多P视频
    ↓
    ├─ 单P视频 → 创建单个下载任务
    └─ 多P视频 → 创建调度器 → 为每个分P创建任务
    ↓
提交到下载队列
    ↓
更新下载状态
    ↓
显示成功/失败提示
```

### 1. 点击下载按钮

```typescript
// apps/web/src/pages/components/FavoritesContent.tsx
const { toggleDownload } = useVideoDownload();

<VideoListContainer
  videos={videos}
  onDownloadToggle={toggleDownload}
  getDownloadStatus={getDownloadStatus}
  // ...
/>
```

### 2. useVideoDownload Hook

`useVideoDownload` 是一个自定义 Hook，封装了下载逻辑。

```typescript
// apps/web/src/hooks/useVideoDownload.ts
export function useVideoDownload() {
  const newQueueStore = useNewQueueStore();
  const [loading, setLoading] = useState(false);

  const toggleDownload = async (video: any, e?: React.MouseEvent) => {
    e?.stopPropagation();

    // 检查是否已加载视频详情
    if (!video.pages || video.pages.length === 0) {
      // 获取视频详情
      const response = await apiService.getVideoDetail(video.bvid);
      if (response.success && response.data) {
        video.pages = response.data.pages;
        video.cid = response.data.cid;
      }
    }

    // 检查是否多P视频
    if (video.pages && video.pages.length > 1) {
      // 多P视频下载
      await downloadMultiPartVideo(video, newQueueStore);
    } else {
      // 单P视频下载
      await downloadSingleVideo(video, newQueueStore);
    }

    setLoading(false);
  };

  return { toggleDownload, loading };
}
```

### 3. 检查下载状态

```typescript
// apps/web/src/pages/components/FavoritesContent.tsx
const getDownloadStatus = (bvid: string): 'none' | 'in_list' | 'downloaded' => {
  const tasks = newQueueStore.tasks;
  const newSystemTasks = Object.values(tasks);
  
  // 检查是否在队列中（未完成的任务）
  const hasActiveTask = newSystemTasks.some(task =>
    task.media_id === bvid && !['completed', 'cancelled'].includes(task.state)
  );
  
  if (hasActiveTask) {
    return 'in_list';
  }
  
  // 检查是否已下载完成（已完成的任务）
  const hasCompletedTask = newSystemTasks.some(task =>
    task.media_id === bvid && task.state === 'completed'
  );
  
  if (hasCompletedTask) {
    return 'downloaded';
  }
  
  return 'none';
};
```

## 单P视频下载

### 下载流程

```
1. 检查视频是否已下载
2. 获取视频详情（cid、pages）
3. 创建下载任务
4. 提交到下载队列
5. 更新下载状态
```

### 实现代码

```typescript
async function downloadSingleVideo(video: any, newQueueStore: any) {
  try {
    // 检查是否已下载
    const existingTask = Object.values(newQueueStore.tasks).find(
      task => task.media_id === video.bvid && task.state === 'completed'
    );

    if (existingTask) {
      return {
        success: false,
        message: '视频已下载完成'
      };
    }

    // 获取视频详情
    if (!video.cid || !video.pages) {
      const response = await apiService.getVideoDetail(video.bvid);
      if (response.success && response.data) {
        video.cid = response.data.cid;
        video.pages = response.data.pages;
      }
    }

    // 创建下载任务
    await newQueueStore.addTask({
      media_id: video.bvid,
      media_type: 'video',
      meta: {
        title: video.title,
        uploader: video.uploader.name,
        cid: video.cid,
        page: 1,
        part_title: video.title,
        aid: video.aid,
        bvid: video.bvid
      }
    });

    return {
      success: true,
      message: '已添加到下载队列',
      shouldNavigateToLibrary: false
    };
  } catch (error) {
    return {
      success: false,
      message: '添加下载失败'
    };
  }
}
```

### 任务结构

```typescript
{
  media_id: "BV1xx411c7mD",
  media_type: "video",
  meta: {
    title: "视频标题",
    uploader: "UP主名称",
    cid: 123456789,
    page: 1,
    part_title: "视频标题",
    aid: 987654321,
    bvid: "BV1xx411c7mD"
  }
}
```

## 多P视频下载

### 下载流程

```
1. 检查是否已下载（检查调度器）
2. 获取视频详情（pages 数组）
3. 创建调度器
4. 为每个分P创建任务
5. 关联任务到调度器
6. 提交到下载队列
7. 更新下载状态
```

### 实现代码

```typescript
async function downloadMultiPartVideo(video: any, newQueueStore: any) {
  try {
    // 检查是否已下载（检查调度器）
    const existingScheduler = Object.values(newQueueStore.schedulers).find(
      scheduler => scheduler.meta?.bvid === video.bvid
    );

    if (existingScheduler) {
      return {
        success: false,
        message: '系列视频已添加到下载队列'
      };
    }

    // 获取视频详情
    if (!video.pages || video.pages.length === 0) {
      const response = await apiService.getVideoDetail(video.bvid);
      if (response.success && response.data) {
        video.pages = response.data.pages;
        video.cid = response.data.cid;
      }
    }

    // 创建调度器
    const scheduler = await newQueueStore.createScheduler({
      name: `系列-${video.title}`,
      type: 'series',
      meta: {
        aid: video.aid,
        bvid: video.bvid,
        title: video.title,
        uploader: video.uploader.name,
        total_parts: video.pages.length
      }
    });

    // 为每个分P创建任务
    for (const page of video.pages) {
      await newQueueStore.addTask({
        media_id: video.bvid,
        media_type: 'video',
        scheduler_id: scheduler.id,
        meta: {
          title: video.title,
          uploader: video.uploader.name,
          cid: page.cid,
          page: page.page,
          part_title: page.part || `P${page.page}`,
          aid: video.aid,
          bvid: video.bvid,
          scheduler_id: scheduler.id
        }
      });
    }

    return {
      success: true,
      message: `已添加 ${video.pages.length} 个视频到下载队列`,
      shouldNavigateToLibrary: true
    };
  } catch (error) {
    return {
      success: false,
      message: '添加下载失败'
    };
  }
}
```

### 调度器结构

```typescript
{
  id: "scheduler-uuid",
  name: "系列-视频标题",
  type: "series",
  meta: {
    aid: 987654321,
    bvid: "BV1xx411c7mD",
    title: "视频标题",
    uploader: "UP主名称",
    total_parts: 5
  }
}
```

### 任务结构（多P）

```typescript
{
  media_id: "BV1xx411c7mD",
  media_type: "video",
  scheduler_id: "scheduler-uuid",
  meta: {
    title: "视频标题",
    uploader: "UP主名称",
    cid: 123456789,
    page: 1,
    part_title: "第一集",
    aid: 987654321,
    bvid: "BV1xx411c7mD",
    scheduler_id: "scheduler-uuid"
  }
}
```

## 下载状态管理

### 状态类型

```typescript
type DownloadStatus = 'none' | 'in_list' | 'downloaded';
```

### 状态检查逻辑

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
// apps/web/src/components/VideoListContainer.tsx
<VideoListCard
  video={video}
  downloadStatus={getDownloadStatus(video.bvid)}
  onDownloadToggle={(e) => toggleDownload(video, e)}
/>
```

**状态对应的 UI**：
- `none`：显示"下载"按钮
- `in_list`：显示"下载中"按钮（禁用）
- `downloaded`：显示"已下载"按钮（禁用）

## 错误处理

### 1. 网络错误

```typescript
try {
  const response = await apiService.getVideoDetail(video.bvid);
  if (response.success) {
    // 处理成功
  } else {
    return {
      success: false,
      message: response.message || '获取视频详情失败'
    };
  }
} catch (error) {
  return {
    success: false,
    message: '网络请求失败'
  };
}
```

### 2. 重复下载

```typescript
// 单P视频重复下载检查
const existingTask = Object.values(newQueueStore.tasks).find(
  task => task.media_id === video.bvid && task.state === 'completed'
);

if (existingTask) {
  return {
    success: false,
    message: '视频已下载完成'
  };
}

// 多P视频重复下载检查
const existingScheduler = Object.values(newQueueStore.schedulers).find(
  scheduler => scheduler.meta?.bvid === video.bvid
);

if (existingScheduler) {
  return {
    success: false,
    message: '系列视频已添加到下载队列'
  };
}
```

### 3. 用户提示

```typescript
// apps/web/src/pages/components/FavoritesContent.tsx
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

## 使用示例

### 基本使用

```typescript
import { useVideoDownload } from '../hooks/useVideoDownload';

function FavoritesContent() {
  const { toggleDownload } = useVideoDownload();

  return (
    <div>
      <button onClick={(e) => toggleDownload(video, e)}>
        下载
      </button>
    </div>
  );
}
```

### 带状态检查

```typescript
import { useVideoDownload } from '../hooks/useVideoDownload';
import { useNewQueueStore } from '../stores/newQueue';

function FavoritesContent() {
  const { toggleDownload } = useVideoDownload();
  const newQueueStore = useNewQueueStore();

  const getDownloadStatus = (bvid: string): 'none' | 'in_list' | 'downloaded' => {
    const tasks = newQueueStore.tasks;
    const newSystemTasks = Object.values(tasks);
    
    const hasActiveTask = newSystemTasks.some(task =>
      task.media_id === bvid && !['completed', 'cancelled'].includes(task.state)
    );
    
    if (hasActiveTask) return 'in_list';
    
    const hasCompletedTask = newSystemTasks.some(task =>
      task.media_id === bvid && task.state === 'completed'
    );
    
    if (hasCompletedTask) return 'downloaded';
    
    return 'none';
  };

  return (
    <div>
      <button
        onClick={(e) => toggleDownload(video, e)}
        disabled={getDownloadStatus(video.bvid) !== 'none'}
      >
        {getDownloadStatus(video.bvid) === 'downloaded' ? '已下载' : '下载'}
      </button>
    </div>
  );
}
```

## 注意事项

1. **多P视频**：多P视频会创建调度器，所有分P作为一个系列下载
2. **下载状态**：下载状态检查需要新下载队列系统支持
3. **重复下载**：已下载的视频不会重复添加到队列
4. **错误处理**：所有网络请求都应该有错误处理和用户提示
5. **导航逻辑**：多P视频下载后会自动跳转到下载页面
6. **任务关联**：多P视频的所有任务都关联到同一个调度器

## 相关文档

- [收藏页前端实现](../web/favorites-page.md) - 收藏页实现
- [下载队列系统](./download-queue.md) - 下载队列架构
- [useVideoDownload Hook](../hooks/use-video-download.md) - 下载 Hook
- [VideoListContainer](../components/video-list-container.md) - 视频列表容器

---

[返回上级](./README.md)