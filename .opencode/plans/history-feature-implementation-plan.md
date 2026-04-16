# 观看历史功能实施计划

**创建日期**: 2026-04-16  
**基于设计文档**: `/docs/superpowers/specs/2026-04-16-history-feature-design.md`  
**核心策略**: 完全复用稍后再看架构

---

## 实施概览

### Phase 1: 后端API开发 (预计 2-3 小时)
- 在 `BilibiliService` 中添加 `get_history()` 方法
- 创建 `history.py` router 文件
- 在 `media_data_transformer` 中添加 `transform_history_list()` 方法
- 在 `main.py` 中注册 history 路由

### Phase 2: 前端页面开发 (预计 1-2 小时)
- 创建 `HistoryContent.tsx` 组件（复用 WatchLaterContent）
- 在 `apiService` 中添加 `getHistoryList()` 方法
- 添加路由配置
- 在导航菜单中添加入口

### Phase 3: 集成和优化 (预计 1 小时)
- 集成下载队列功能
- 集成视频库状态检查
- 优化加载性能
- 添加错误提示

### Phase 4: 测试 (预计 1 小时)
- 后端API测试
- 前端页面测试
- 集成测试
- 性能测试

---

## Phase 1: 后端API开发

### 任务 1.1: 在 BilibiliService 中添加 get_history() 方法

**文件**: `/Users/tanyancong/工作/开发/pilinote/apps/api/src/services/bilibili.py`

**位置**: 在 `get_watch_later()` 方法之后添加

**实现代码**:
```python
async def get_history(self, sessdata: str) -> Dict:
    """获取观看历史列表（全部，使用HeadersManager获取headers）
    
    Args:
        sessdata: B站SESSDATA
        
    Returns:
        Dict: {
            "success": True/False,
            "data": B站历史记录原始数据,
            "message": 错误信息（如果失败）
        }
    """
    # 尝试从缓存获取
    from src.services.cache.video_cache import video_cache
    
    # 使用用户MID作为缓存键
    cached_data = video_cache.get('history', user_id=sessdata[:20])  # 使用sessdata前20位作为用户标识
    if cached_data:
        print(f"[Cache] 观看历史列表命中缓存")
        return cached_data

    # 确保SESSDATA在headers中
    await self.headers_manager.update_cookie("SESSDATA", sessdata)
    
    url = f"{self.api_base}/x/v2/history"
    headers = await self.headers_manager.get_headers()
    
    # 传递大参数获取全部数据，B站API默认只返回20个
    params = {
        "ps": 1000  # 获取1000个视频，确保覆盖全部
    }
    
    try:
        # 使用异步请求
        response = await self._request("GET", url, params=params)
        data = response.json()
        print(f"观看历史列表响应: {data}")
        
        if data.get("code") == 0:
            result = {
                "success": True,
                "data": data.get("data", {})
            }
            # 缓存结果（5分钟）
            video_cache.set('history', result, user_id=sessdata[:20])
            return result
        return {
            "success": False,
            "message": data.get("message", "获取观看历史列表失败"),
            "code": data.get("code")
        }
    except Exception as e:
        print(f"获取观看历史列表异常: {str(e)}")
        return {
            "success": False,
            "message": f"获取观看历史列表异常: {str(e)}"
        }
```

**注意事项**:
- 复用 `get_watch_later()` 的实现逻辑
- 使用 B站 API `/x/v2/history`
- 缓存键使用 `'history'`
- 缓存时长 5 分钟

---

### 任务 1.2: 创建 history.py router 文件

**文件**: `/Users/tanyancong/工作/开发/pilinote/apps/api/src/routers/history.py` (新建)

**完整代码**:
```python
from fastapi import APIRouter, HTTPException, Query, Depends
from src.services.bilibili import BilibiliService
from src.schemas.card import CardData, CardListResponse
from src.dependencies.auth import get_current_user_with_sessdata

router = APIRouter(prefix="/api/history", tags=["观看历史"])


@router.get("/list", response_model=CardListResponse)
async def get_history_list(
    user_sessdata: tuple = Depends(get_current_user_with_sessdata),
    pn: int = Query(1, ge=1, description="页码"),
    ps: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: str = Query("", description="搜索关键词"),
    order: str = Query("default", description="排序方式: default, view, pubtime, view_at"),
    sort_direction: str = Query("desc", description="排序方向: desc, asc")
):
    """获取观看历史列表（支持分页、搜索、排序）
    
    功能：
    - 支持分页
    - 支持关键词搜索
    - 支持排序（按播放量、发布时间、观看时间）
    - 支持升序/降序切换
    - 使用B站原生API快速加载
    """
    user, sessdata = user_sessdata
    
    try:
        service = BilibiliService()
        try:
            result = await service.get_history(sessdata)
            if result["success"]:
                from src.services.media_data_transformer import transformer
                
                data = result["data"]
                
                # 使用统一转换器转换数据
                video_list = transformer.transform_history_list(data)
                
                # 搜索过滤
                if keyword:
                    video_list = [
                        video for video in video_list
                        if keyword.lower() in video.title.lower()
                    ]
                
                # 排序
                reverse = sort_direction == "desc"
                
                if order == "view":
                    video_list = sorted(video_list, key=lambda x: x.view or 0, reverse=reverse)
                elif order == "pubtime":
                    video_list = sorted(video_list, key=lambda x: x.pubtime or 0, reverse=reverse)
                elif order == "view_at":
                    video_list = sorted(video_list, key=lambda x: x.add_time or 0, reverse=reverse)
                
                # 分页处理
                start_idx = (pn - 1) * ps
                end_idx = start_idx + ps
                paginated_list = video_list[start_idx:end_idx]
                
                # 转换为字典格式（保持向后兼容）
                list_data = [card.model_dump() for card in paginated_list]
                
                return CardListResponse(
                    success=True,
                    data={
                        "list": list_data,
                        "total": len(video_list),
                        "page": pn,
                        "page_size": ps
                    },
                    total=len(video_list)
                )
            else:
                raise HTTPException(status_code=400, detail=result.get("message", "获取观看历史列表失败"))
        finally:
            service.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取观看历史列表失败: {str(e)}")
```

**注意事项**:
- 完全复用 `watchlater.py` 的结构
- 排序选项包括 `view_at`（观看时间）
- 使用 `transform_history_list()` 转换数据

---

### 任务 1.3: 在 media_data_transformer 中添加 transform_history_list() 方法

**文件**: `/Users/tanyancong/工作/开发/pilinote/apps/api/src/services/media_data_transformer.py`

**位置**: 在 `transform_watchlater_list()` 方法之后添加

**实现代码**:
```python
@staticmethod
def transform_history_video(raw_video: Dict[str, Any]) -> CardData:
    """转换 History 视频数据
    
    Args:
        raw_video: B站 API 返回的视频数据
        
    Returns:
        CardData: 统一格式的卡片数据
    """
    # B站历史记录数据结构：
    # {
    #   "history": {
    #     "bvid": "BV1xx",
    #     "cid": 123456,
    #     "view_at": 1649999999,  # 观看时间戳
    #     "progress": 50,  # 观看进度百分比
    #     ...
    #   },
    #   "stat": {
    #     "view": 1000,  # 播放量
    #     ...
    #   },
    #   "title": "视频标题",
    #   "author": "UP主",
    #   ...
    # }
    
    # 提取历史记录信息
    history_info = raw_video.get("history", {})
    
    # 提取统计数据
    stat_data = raw_video.get("stat", {})
    
    # 提取UP主信息
    author = raw_video.get("author", {})
    
    # 归一化统计数据
    stats = MediaDataTransformer.normalize_stats(stat_data, {})
    
    # 归一化UP主信息
    uploader_info = MediaDataTransformer.normalize_uploader(author, {})
    
    # 获取发布时间
    pubtime = raw_video.get("pubdate", raw_video.get("pubtime", 0))
    
    # 观看时间（使用 history.view_at）
    view_at = history_info.get("view_at", 0)
    
    # 观看进度（使用 history.progress）
    progress = history_info.get("progress", -1)
    
    return CardData(
        id=raw_video.get("aid", 0),
        bvid=history_info.get("bvid", ""),
        title=raw_video.get("title", ""),
        cover=raw_video.get("pic", ""),
        duration=raw_video.get("duration", 0),
        pubtime=pubtime,
        add_time=view_at,  # 观看时间
        uploader=uploader_info,
        stats=stats,
        progress=progress,  # 观看进度
        # 为了前端兼容，将 stats 字段提升到顶层
        view=stats.view,
        danmaku=stats.danmaku,
        comment=stats.comment,
        like=stats.like,
        coin=stats.coin,
        favorite=stats.favorite,
        share=stats.share
    )

@staticmethod
def transform_history_list(raw_data: Dict[str, Any]) -> List[CardData]:
    """转换 History 视频列表
    
    Args:
        raw_data: B站 API 返回的完整数据
        
    Returns:
        List[CardData]: 统一格式的卡片数据列表
    """
    videos = raw_data.get("list", [])
    return [MediaDataTransformer.transform_history_video(video) for video in videos]
```

**注意事项**:
- B站历史记录数据结构与稍后再看不同
- `history` 字段包含核心信息（bvid, view_at, progress）
- `add_time` 使用 `history.view_at`
- `progress` 使用 `history.progress`

---

### 任务 1.4: 在 video_cache 中添加 history 缓存配置

**文件**: `/Users/tanyancong/工作/开发/pilinote/apps/api/src/services/cache/video_cache.py`

**位置**: 在 `__init__()` 方法的 `ttls` 字典中添加

**修改代码**:
```python
# 在 ttls 字典中添加
self.ttls = {
    'video_info': 3600,        # 视频信息：1小时
    'favorites': 600,          # 收藏夹列表：10分钟
    'watch_later': 300,        # 稍后再看：5分钟
    'history': 300,            # 观看历史：5分钟  # 新增
    'user_info': 3600,         # 用户信息：1小时
    'uploader_info': 7200,     # UP主信息：2小时
}
```

---

### 任务 1.5: 在 main.py 中注册 history 路由

**文件**: `/Users/tanyancong/工作/开发/pilinote/apps/api/main.py`

**位置**: 在导入部分添加，在路由注册部分添加

**修改代码**:
```python
# 1. 在导入部分添加（在其他 router 导入之后）
from src.routers.history import router as history_router

# 2. 在 app.include_router 部分添加（在其他路由之后）
app.include_router(history_router)
```

---

## Phase 2: 前端页面开发

### 任务 2.1: 创建 HistoryContent.tsx 组件

**文件**: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/pages/components/HistoryContent.tsx` (新建)

**完整代码**:
```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useNewQueueStore } from '../../stores/newQueue'
import { videoLibraryService } from '../../services/videoLibraryService'
import { formatDuration, formatNumber, formatProgress, formatTime } from '../../utils/videoFormatters'
import { useVideoList } from '../../hooks/useVideoList'
import { useVideoDownload } from '../../hooks/useVideoDownload'
import VideoListContainer from '../../components/VideoListContainer'
import VideoListControls from '../../components/VideoListControls'
import AlertModal from '../../components/AlertModal'
import ConfirmModal from '../../components/ConfirmModal'

export default function HistoryContent() {
  const [totalCount, setTotalCount] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [order, setOrder] = useState<string>('default')
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc')
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'error' | 'info'; showConfirm?: boolean; onConfirm?: () => void }>({
    show: false,
    title: '',
    message: '',
    type: 'success'
  })
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; title: string; message: string; onConfirm: () => void }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })

  const { user } = useAuthStore()
  const newQueueStore = useNewQueueStore()
  const navigate = useNavigate()

  // Refs to track if data has been loaded
  const tasksSyncedRef = useRef(false)

  // 下载状态检查函数（只检查新系统）
  const getDownloadStatus = (bvid: string): 'none' | 'in_list' | 'downloaded' => {
    const tasks = newQueueStore.tasks
    const newSystemTasks = Object.values(tasks)
    
    // 检查是否在队列中（未完成的任务）
    const hasActiveTask = newSystemTasks.some(task =>
      task.media_id === bvid && !['completed', 'cancelled'].includes(task.state)
    )
    
    if (hasActiveTask) {
      return 'in_list'
    }
    
    // 检查是否已下载完成（已完成的任务）
    const hasCompletedTask = newSystemTasks.some(task =>
      task.media_id === bvid && task.state === 'completed'
    )
    
    if (hasCompletedTask) {
      return 'downloaded'
    }
    
    return 'none'
  }

  // 组件挂载时同步数据（只执行一次）
  useEffect(() => {
    const syncData = async () => {
      if (tasksSyncedRef.current) return
      tasksSyncedRef.current = true

      try {
        // 先清理本地缓存，确保数据一致
        newQueueStore.forceClearCache()
        
        // 同步最新数据
        await newQueueStore.fetchTasks()
        await newQueueStore.fetchSchedulers()
        
        // 清理重复的已完成任务
        await newQueueStore.cleanupDuplicateCompletedTasks()
      } catch (error) {
        console.error('[History] 同步数据失败:', error)
      }
    }
    syncData()
  }, [])

  // 使用 useCallback 缓存 fetchFn，避免每次渲染创建新函数引用
  const fetchHistoryVideos = useCallback(async (page: number, pageSize: number) => {
    if (!user?.mid) {
      return { success: false, message: '缺少必要参数' }
    }
    // 调用getHistoryList时不需要传递sessdata，后端会从cookie中获取
    const response = await apiService.getHistoryList(page, pageSize, keyword, order, sortDirection)
    return response
  }, [user?.mid, keyword, order, sortDirection])

  // 使用 useVideoList Hook 管理视频列表
  const { videos, loading: videosLoading, loadingMore, error: videosError, hasMore, loadMoreRef } = useVideoList({
    fetchFn: fetchHistoryVideos,
    pageSize: 20,
    deps: [],  // ✅ 不需要deps，因为fetchFn已经用useCallback处理了依赖
    formatItem: (video: any) => ({
      id: video.id,
      bvid: video.bvid,
      title: video.title,
      cover: video.cover,
      duration: formatDuration(video.duration),
      durationSeconds: video.duration,
      progress: video.progress,
      watched: formatProgress(video.progress, video.duration),
      uploader: video.uploader?.name || '未知',
      views: formatNumber(video.view),
      danmaku: video.danmaku ? formatNumber(video.danmaku) : '0',
      comments: video.comment ? formatNumber(video.comment) : '0',
      likes: video.like ? formatNumber(video.like) : '0',
      coins: video.coin ? formatNumber(video.coin) : '0',
      favorites: video.favorite ? formatNumber(video.favorite) : '0',
      shares: video.share ? formatNumber(video.share) : '0',
      time: formatTime(video.add_time),
      // 保留原始数据用于下载
      cid: video.cid,
      aid: video.aid,
      pic: video.cover,
      originalDuration: video.duration,
      owner: video.uploader,
      pubtime: video.add_time
    })
  })

  // 使用 useVideoDownload Hook 处理单个视频下载（使用新的下载系统）
  const { toggleDownload: baseToggleDownload } = useVideoDownload()

  // 包装toggleDownload，确保状态更新
  const toggleDownload = useCallback(async (video: any, e: React.MouseEvent) => {
    try {
      // 检查视频是否已下载
      const decision = await videoLibraryService.checkBeforeAdd(video)
      
      switch (decision.action) {
        case 'add':
          // 直接添加
          await baseToggleDownload(video, e)
          break
          
        case 'show_confirm':
          // 显示确认对话框
          setAlertModal({
            show: true,
            title: '重新下载视频',
            message: `视频 ${video.title} 已在视频库中，是否重新下载？`,
            type: 'info',
            showConfirm: true,
            onConfirm: async () => {
              await baseToggleDownload(video, e)
              setAlertModal(prev => ({ ...prev, show: false }))
            }
          })
          break
          
        case 'skip':
          // 静默跳过
          setAlertModal({
            show: true,
            title: '提示',
            message: `视频 ${video.title} 已下载，已在视频库中`,
            type: 'success'
          })
          break
      }
    } catch (error) {
      console.error('检查下载状态失败:', error)
      // 降级到原有逻辑
      const result = await baseToggleDownload(video, e)
      if (result.success) {
        // 如果需要跳转到视频库
        if (result.shouldNavigateToLibrary) {
          navigate('/downloads', { replace: true })
          // 延迟显示弹窗，让页面先跳转
          setTimeout(() => {
            setAlertModal({
              show: true,
              title: '操作成功',
              message: result.message,
              type: 'success'
            })
          }, 100)
        } else {
          setAlertModal({
            show: true,
            title: '操作成功',
            message: result.message,
            type: 'success'
          })
        }
      } else {
        setAlertModal({
          show: true,
          title: '操作失败',
          message: result.message,
          type: 'error'
        })
      }
    }
  }, [baseToggleDownload, navigate])

  // 更新总数（从响应中获取）
  useEffect(() => {
    if (videos.length > 0 && videos.length >= totalCount) {
      setTotalCount(videos.length)
    }
  }, [videos.length, totalCount])

  if (!user?.mid) {
    return (
      <section className="content-section text-center py-15 px-5">
        <p className="text-secondary-400 dark:text-secondary-500 text-base">请先登录以查看观看历史</p>
      </section>
    )
  }

  return (
    <section
      id="history-panel"
      role="tabpanel"
      aria-labelledby="history-tab"
      className="content-section"
    >
      <div className="section-header">
        <div className="section-title">
          <h2>观看历史</h2>
          <span className="video-count">共{totalCount || videos.length}个视频</span>
        </div>
      </div>

      <VideoListControls
        keyword={keyword}
        order={order}
        sortDirection={sortDirection}
        onKeywordChange={setKeyword}
        onOrderChange={setOrder}
        onSortDirectionChange={setSortDirection}
        sortOptions={[
          { value: 'default', label: '默认' },
          { value: 'view', label: '按播放量' },
          { value: 'pubtime', label: '按发布时间' },
          { value: 'view_at', label: '按观看时间' }
        ]}
      />

      <VideoListContainer
        videos={videos}
        loading={videosLoading}
        loadingMore={loadingMore}
        error={videosError}
        onDownloadToggle={toggleDownload}
        getDownloadStatus={getDownloadStatus}
        loadMoreRef={loadMoreRef}
        hasMore={hasMore}
        emptyText="暂无观看历史"
        cardClickable={true}
      />

      {/* AlertModal */}
      <AlertModal
        isOpen={alertModal.show}
        onClose={() => setAlertModal({ show: false, title: '', message: '', type: 'success', showConfirm: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        showConfirm={alertModal.showConfirm}
        onConfirm={alertModal.onConfirm}
      />

      {/* ConfirmModal */}
      <ConfirmModal
        isOpen={confirmModal.show}
        onClose={() => setConfirmModal({ show: false, title: '', message: '', onConfirm: () => {} })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmVariant="primary"
      />
    </section>
  )
}
```

**注意事项**:
- 完全复用 `WatchLaterContent.tsx` 的结构
- 修改 `fetchFn` 为 `fetchHistoryVideos`
- 修改标题为 "观看历史"
- 排序选项添加 "按观看时间"
- 空状态提示改为 "暂无观看历史"
- 调用 `apiService.getHistoryList()`

---

### 任务 2.2: 在 apiService 中添加 getHistoryList() 方法

**文件**: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/services/api.ts`

**位置**: 在 `getWatchLaterList()` 方法之后添加

**实现代码**:
```typescript
// 观看历史相关API
async getHistoryList(
  pn: number = 1,
  ps: number = 20,
  keyword: string = '',
  order: string = 'default',
  sortDirection: 'desc' | 'asc' = 'desc'
): Promise<ApiResponse<any>> {
  const params = new URLSearchParams({
    pn: pn.toString(),
    ps: ps.toString()
  })
  
  if (keyword) {
    params.append('keyword', keyword)
  }
  
  if (order && order !== 'default') {
    params.append('order', order)
    params.append('sort_direction', sortDirection)
  }
  
  return this.request<any>(
    `/api/history/list?${params.toString()}`,
    { method: 'GET' }
  );
}
```

**注意事项**:
- 复用 `getWatchLaterList()` 的实现逻辑
- API 端点为 `/api/history/list`

---

### 任务 2.3: 在 App.tsx 中添加路由配置

**文件**: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/App.tsx`

**位置**: 在路由部分添加

**修改代码**:
```typescript
// 在 Routes 中添加（在其他路由之后）
<Route path="/history" element={<MainLayout />} />
```

---

### 任务 2.4: 在 MainLayout.refactored.tsx 中添加导航菜单项

**文件**: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/components/MainLayout.refactored.tsx`

**位置**: 在 `navItems` 数组中添加

**修改代码**:
```typescript
// 1. 在导入部分添加（如果需要特殊图标）
import { History } from 'lucide-react'

// 2. 在 navItems 数组中添加
const navItems = [
  { id: 'home', label: '首页', path: '/home', icon: Home },
  { id: 'favorites', label: '收藏', path: '/favorites', icon: Heart },
  { id: 'watch-later', label: '稍后再看', path: '/watch-later', icon: Clock },
  { id: 'history', label: '观看历史', path: '/history', icon: History },  // 新增
  { id: 'downloads', label: '新下载', path: '/downloads', icon: Download },
]

// 3. 在 getActiveTabFromPath() 函数中添加
const getActiveTabFromPath = () => {
  const path = location.pathname
  if (path === '/favorites' || path.startsWith('/favorites/')) return 'favorites'
  if (path === '/watch-later') return 'watch-later'
  if (path === '/history') return 'history'  // 新增
  if (path === '/downloads') return 'downloads'
  return 'home'
}

// 4. 在内容区域添加历史记录面板
<div className={activeTab === 'history' ? 'block' : 'hidden'}>
  {isAuthenticated ? (
    <HistoryContent />
  ) : (
    <LoginPrompt message="登录后可以查看您的观看历史" />
  )}
</div>

// 5. 在文件顶部导入 HistoryContent
import HistoryContent from '../pages/components/HistoryContent'
```

---

## Phase 3: 集成和优化

### 任务 3.1: 验证下载功能集成

**验证步骤**:
1. 确保 `HistoryContent` 中正确使用 `useVideoDownload` Hook
2. 确保 `getDownloadStatus` 函数正确实现
3. 测试单个视频下载功能
4. 测试批量下载功能

**预期结果**:
- 点击下载按钮可以添加到下载队列
- 显示正确的下载状态（未下载、下载中、已下载）
- 批量下载功能正常工作

---

### 任务 3.2: 验证视频库状态检查

**验证步骤**:
1. 确保 `videoLibraryService.checkBeforeAdd()` 正确调用
2. 测试已下载视频的处理逻辑
3. 测试重复下载的确认对话框

**预期结果**:
- 已下载的视频显示"已下载"状态
- 重复下载时显示确认对话框
- 可以正确跳过或重新下载

---

### 任务 3.3: 优化加载性能

**优化措施**:
1. 确保缓存机制正常工作（5分钟TTL）
2. 测试大量历史记录的加载性能（1000+）
3. 验证分页功能正常工作
4. 检查内存使用情况

**性能指标**:
- 首次加载时间 < 2秒
- 缓存命中时间 < 100ms
- 分页切换时间 < 500ms

---

### 任务 3.4: 添加错误提示

**错误类型**:
1. 用户未登录（401）
2. B站API限流（503）
3. 网络超时（504）
4. 服务器错误（500）

**实现位置**:
- `HistoryContent` 中的 `alertModal`
- 使用现有的 `AlertModal` 组件

**错误提示文案**:
```typescript
{
  401: "请先登录B站账号",
  503: "B站API限流，请稍后重试",
  504: "请求超时，请检查网络连接",
  500: "服务器错误，请稍后重试"
}
```

---

## Phase 4: 测试

### 任务 4.1: 后端API测试

**测试文件**: `/Users/tanyancong/工作/开发/pilinote/apps/api/test_history_api.py` (新建)

**测试用例**:
```python
import pytest
import asyncio
from src.services.bilibili import BilibiliService
from src.services.media_data_transformer import transformer

@pytest.mark.asyncio
async def test_get_history():
    """测试获取观看历史"""
    service = BilibiliService()
    try:
        # 使用测试账号的SESSDATA
        sessdata = "your_test_sessdata"
        result = await service.get_history(sessdata)
        
        assert result["success"] is True
        assert "data" in result
        assert "list" in result["data"]
    finally:
        service.close()

@pytest.mark.asyncio
async def test_transform_history_list():
    """测试历史记录数据转换"""
    # 模拟B站历史记录数据
    raw_data = {
        "list": [
            {
                "history": {
                    "bvid": "BV1xx411c7mD",
                    "view_at": 1649999999,
                    "progress": 50
                },
                "stat": {
                    "view": 1000
                },
                "title": "测试视频",
                "author": {
                    "mid": 123456,
                    "name": "测试UP主"
                },
                "pic": "http://example.com/cover.jpg",
                "duration": 300,
                "pubdate": 1640000000
            }
        ]
    }
    
    result = transformer.transform_history_list(raw_data)
    
    assert len(result) == 1
    assert result[0].bvid == "BV1xx411c7mD"
    assert result[0].title == "测试视频"
    assert result[0].add_time == 1649999999
    assert result[0].progress == 50

def test_history_cache():
    """测试历史记录缓存"""
    from src.services.cache.video_cache import video_cache
    
    # 测试缓存设置
    test_data = {"success": True, "data": {"list": []}}
    video_cache.set('history', test_data, user_id='test_user')
    
    # 测试缓存获取
    cached = video_cache.get('history', user_id='test_user')
    assert cached is not None
    assert cached["success"] is True
```

**测试命令**:
```bash
cd /Users/tanyancong/工作/开发/pilinote/apps/api
python -m pytest test_history_api.py -v
```

---

### 任务 4.2: 前端页面测试

**测试文件**: `/Users/tanyancong/工作/开发/pilinote/tests/history-page.spec.ts` (新建)

**测试用例**:
```typescript
import { test, expect } from '@playwright/test'

test.describe('观看历史页面', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('http://localhost:5173/login')
    // 填写登录信息
    // ...
  })

  test('应该显示观看历史页面', async ({ page }) => {
    await page.goto('http://localhost:5173/history')
    await expect(page.locator('h2')).toContainText('观看历史')
  })

  test('应该显示视频列表', async ({ page }) => {
    await page.goto('http://localhost:5173/history')
    await page.waitForSelector('.video-card')
    const cards = await page.locator('.video-card').count()
    expect(cards).toBeGreaterThan(0)
  })

  test('应该支持搜索功能', async ({ page }) => {
    await page.goto('http://localhost:5173/history')
    
    // 输入搜索关键词
    await page.fill('input[placeholder="搜索"]', '测试')
    await page.press('input[placeholder="搜索"]', 'Enter')
    
    // 等待搜索结果
    await page.waitForTimeout(1000)
    
    // 验证搜索结果
    const cards = await page.locator('.video-card').count()
    expect(cards).toBeGreaterThanOrEqual(0)
  })

  test('应该支持排序功能', async ({ page }) => {
    await page.goto('http://localhost:5173/history')
    
    // 选择排序方式
    await page.click('button:has-text("按观看时间")')
    
    // 等待排序完成
    await page.waitForTimeout(1000)
    
    // 验证排序结果
    const cards = await page.locator('.video-card').count()
    expect(cards).toBeGreaterThan(0)
  })

  test('应该支持分页功能', async ({ page }) => {
    await page.goto('http://localhost:5173/history')
    
    # 滚动到底部触发加载更多
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    
    # 等待加载更多
    await page.waitForTimeout(2000)
    
    # 验证是否加载了更多内容
    const cards = await page.locator('.video-card').count()
    expect(cards).toBeGreaterThan(20)
  })

  test('应该支持下载功能', async ({ page }) => {
    await page.goto('http://localhost:5173/history')
    
    # 点击第一个视频的下载按钮
    await page.click('.video-card:first-child .download-button')
    
    # 等待下载添加完成
    await page.waitForTimeout(1000)
    
    # 验证成功提示
    await expect(page.locator('.alert-modal')).toBeVisible()
    await expect(page.locator('.alert-modal')).toContainText('操作成功')
  })
})
```

**测试命令**:
```bash
cd /Users/tanyancong/工作/开发/pilinote
npx playwright test tests/history-page.spec.ts
```

---

### 任务 4.3: 集成测试

**测试场景**:
1. 从登录到查看观看历史
2. 从观看历史到下载视频
3. 从观看历史到跳转视频详情
4. 缓存机制的端到端测试

**测试步骤**:
```bash
# 1. 启动后端服务
cd /Users/tanyancong/工作/开发/pilinote/apps/api
source venv/bin/activate
python main.py

# 2. 启动前端服务
cd /Users/tanyancong/工作/开发/pilinote/apps/web
pnpm dev

# 3. 手动测试
# - 访问 http://localhost:5173/history
# - 测试所有功能
# - 检查控制台错误
# - 验证网络请求
```

---

### 任务 4.4: 性能测试

**测试工具**: Chrome DevTools Performance

**测试指标**:
1. 首次加载时间
2. 缓存命中时间
3. 分页切换时间
4. 内存使用情况

**测试步骤**:
```bash
# 1. 打开 Chrome DevTools
# 2. 切换到 Performance 标签
# 3. 点击录制
# 4. 访问观看历史页面
# 5. 停止录制
# 6. 分析性能数据
```

**性能目标**:
- 首次加载时间 < 2秒
- 缓存命中时间 < 100ms
- 分页切换时间 < 500ms
- 内存增长 < 50MB

---

## 验收标准

### 功能验收
- [ ] 用户可以查看观看历史列表
- [ ] 支持分页功能
- [ ] 支持关键词搜索
- [ ] 支持排序（默认、播放量、发布时间、观看时间）
- [ ] 支持升序/降序切换
- [ ] 支持单个视频下载
- [ ] 支持批量下载
- [ ] 显示正确的下载状态
- [ ] 已下载视频的重复处理
- [ ] 缓存机制正常工作

### 性能验收
- [ ] 首次加载时间 < 2秒
- [ ] 缓存命中时间 < 100ms
- [ ] 分页切换时间 < 500ms
- [ ] 支持 1000+ 历史记录

### 错误处理验收
- [ ] 用户未登录时显示登录提示
- [ ] B站API限流时显示友好提示
- [ ] 网络超时时显示友好提示
- [ ] 服务器错误时显示友好提示

### 用户体验验收
- [ ] 页面样式与稍后再看页面一致
- [ ] 交互流程与稍后再看页面一致
- [ ] 响应式设计正常工作
- [ ] 加载状态提示清晰
- [ ] 空状态提示友好

---

## 风险和注意事项

### 已知风险
1. **B站API限流**: 频繁请求可能导致限流，需要适当增加重试机制
2. **缓存一致性**: 多账号切换时需要注意缓存隔离
3. **数据量过大**: 历史记录可能超过1000条，需要考虑分页优化

### 注意事项
1. **测试账号**: 使用真实B站账号进行测试
2. **SESSDATA管理**: 确保SESSDATA正确传递和刷新
3. **错误日志**: 添加详细的错误日志便于调试
4. **性能监控**: 添加性能监控代码

---

## 实施时间表

| Phase | 任务 | 预计时间 | 负责人 |
|-------|------|----------|--------|
| Phase 1 | 后端API开发 | 2-3小时 | 开发者 |
| Phase 2 | 前端页面开发 | 1-2小时 | 开发者 |
| Phase 3 | 集成和优化 | 1小时 | 开发者 |
| Phase 4 | 测试 | 1小时 | 开发者 |
| **总计** | | **5-7小时** | |

---

## 相关文件清单

### 后端文件
- `/Users/tanyancong/工作/开发/pilinote/apps/api/src/services/bilibili.py` (修改)
- `/Users/tanyancong/工作/开发/pilinote/apps/api/src/routers/history.py` (新建)
- `/Users/tanyancong/工作/开发/pilinote/apps/api/src/services/media_data_transformer.py` (修改)
- `/Users/tanyancong/工作/开发/pilinote/apps/api/src/services/cache/video_cache.py` (修改)
- `/Users/tanyancong/工作/开发/pilinote/apps/api/main.py` (修改)

### 前端文件
- `/Users/tanyancong/工作/开发/pilinote/apps/web/src/pages/components/HistoryContent.tsx` (新建)
- `/Users/tanyancong/工作/开发/pilinote/apps/web/src/services/api.ts` (修改)
- `/Users/tanyancong/工作/开发/pilinote/apps/web/src/App.tsx` (修改)
- `/Users/tanyancong/工作/开发/pilinote/apps/web/src/components/MainLayout.refactored.tsx` (修改)

### 测试文件
- `/Users/tanyancong/工作/开发/pilinote/apps/api/test_history_api.py` (新建)
- `/Users/tanyancong/工作/开发/pilinote/tests/history-page.spec.ts` (新建)

---

## 总结

本实施计划基于"完全复用稍后再看架构"的核心策略，通过最小化开发成本快速实现观看历史功能。所有代码实现都遵循现有项目的代码规范和最佳实践，确保与现有系统的无缝集成。

**关键成功因素**:
1. 严格复用现有组件和逻辑
2. 保持代码风格一致
3. 充分的测试覆盖
4. 性能优化到位
5. 用户体验良好

**下一步行动**:
1. 按照Phase顺序实施
2. 每个Phase完成后进行测试
3. 及时记录问题和解决方案
4. 完成后进行整体验收测试