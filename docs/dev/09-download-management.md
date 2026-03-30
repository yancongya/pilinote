# 下载管理功能

## 功能概述

下载管理模块是PiliNote的核心功能，支持将B站视频和课程添加到下载列表，并管理下载任务。系统采用"添加到列表"的设计理念，用户可以先收集想要下载的视频，然后统一开始下载。

## 核心特性

### 1. 添加到列表（队列管理）
- **批量添加**: 支持批量将多个视频添加到下载列表
- **智能识别**: 自动识别视频类型（普通视频/多P视频/课程）
- **状态分离**: 添加到列表不会立即开始下载，用户可以手动控制
- **元数据保存**: 自动保存视频封面、标题、UP主等信息

### 2. 系列管理
- **自动分组**: 根据bvid自动将同一系列的视频分组显示
- **系列名显示**: 使用B站API获取真实的系列名称
- **批量操作**: 支持对整个系列进行批量操作
- **进度统计**: 显示系列的完成进度和总时长

### 3. 下载控制
- **手动控制**: 用户可以手动开始、取消、重试下载任务
- **批量操作**: 支持批量开始、批量删除
- **状态管理**: 完整的任务状态管理（pending/queued/downloading/processing/completed/failed/cancelled）
- **进度追踪**: 实时显示下载进度、速度、剩余时间

### 4. 恢复功能
- **删除恢复**: 支持删除单个或批量删除任务
- **列表刷新**: 刷新功能可以恢复已删除的分P
- **智能检测**: 自动检测缺失的分P并提示恢复

## API接口

### 下载管理接口

#### 1. 添加到下载列表
```http
POST /api/download/add
Content-Type: application/json

{
  "bvid": "BV1xx411c7mD",
  "title": "视频标题",
  "cid": 123456,
  "aid": 789012,
  "quality": 80,
  "output_format": "mp4",
  "thumbnail_url": "https://...",
  "duration": 300,
  "uploader": "UP主名称",
  "uploader_mid": 123456,
  "sessdata": "用户SESSDATA（可选）"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "已添加到下载列表",
  "data": {
    "id": "uuid-id",
    "status": "pending"
  }
}
```

#### 2. 开始下载
```http
POST /api/download/start
Content-Type: application/json

{
  "bvid": "BV1xx411c7mD",
  "title": "视频标题",
  "cid": 123456,
  "quality": 80,
  "output_format": "mp4"
}
```

#### 3. 批量开始下载
```http
POST /api/download/start/batch
Content-Type: application/json

{
  "download_ids": ["id1", "id2", "id3"]
}
```

#### 4. 获取下载列表
```http
GET /api/download/list?status=pending
```

**参数**:
- `status` (可选): 筛选状态（pending/queued/downloading/processing/completed/failed/cancelled）

**响应示例**:
```json
{
  "success": true,
  "downloads": [
    {
      "id": "uuid-id",
      "bvid": "BV1xx411c7mD",
      "title": "视频标题",
      "status": "pending",
      "progress": 0,
      "downloaded_bytes": 0,
      "total_bytes": 10485760,
      "download_speed": 0,
      "eta": 0,
      "thumbnail_url": "https://...",
      "duration": 300,
      "uploader": "UP主名称",
      "created_at": "2026-03-30T10:00:00Z"
    }
  ]
}
```

#### 5. 根据bvid获取下载任务
```http
GET /api/download/bvid/{bvid}?status=completed
```

#### 6. 取消下载
```http
POST /api/download/{id}/cancel
```

#### 7. 重试下载
```http
POST /api/download/{id}/retry
```

#### 8. 删除下载任务
```http
DELETE /api/download/{id}
```

#### 9. 根据bvid删除下载任务
```http
DELETE /api/download/bvid/{bvid}?status=completed
```

#### 10. 解析下载链接
```http
POST /api/download/parse
Content-Type: application/json

{
  "url": "https://www.bilibili.com/video/BV1xx411c7mD"
}
```

**支持的链接格式**:
- B站视频链接: `https://www.bilibili.com/video/BV1xx411c7mD`
- B站视频ID: `BV1xx411c7mD`
- B站视频AID: `av12345678`
- 课程链接: `https://www.bilibili.com/cheese/play/ss360`
- 课程ID: `ss360`

## 前端功能

### 1. 下载列表页面（DownloadDetailPage）

**功能特性**:
- 显示系列名称（通过B站API获取真实名称）
- 下载进度概览（总进度、已完成、下载中、总大小）
- 分P列表显示
- 批量选择功能（全选/取消全选/反选）
- 批量删除功能
- 单个删除功能
- 刷新恢复功能
- 单个开始下载功能
- 批量开始下载功能

**操作按钮**:
- **全选**: 选择所有分P
- **取消全选**: 取消所有选择
- **反选**: 反向选择
- **删除选中**: 批量删除选中的分P（红色垃圾桶图标）
- **刷新列表**: 恢复已删除的分P（灰色刷新图标）
- **开始全部下载**: 开始所有下载任务（绿色播放图标）

**单个任务操作**:
- **开始下载**: 开始单个下载任务（绿色播放图标，仅等待/失败状态显示）
- **删除**: 删除单个下载任务（红色垃圾桶图标，所有状态显示）

### 2. 下载管理页面（DownloadsContent）

**功能特性**:
- 按系列分组显示下载任务
- 显示系列名称、总数量、已完成数量、完成率
- 实时进度更新（2秒间隔）
- 点击进入系列详情页

**状态颜色**:
- 等待: 灰色 (#9e9e9e)
- 排队: 橙色 (#ffa726)
- 下载中: 粉色 (#fb7299)
- 处理中: 蓝色 (#42a5f5)
- 完成: 绿色 (#66bb6a)
- 失败: 红色 (#ef5350)
- 取消: 浅灰色 (#bdbdbd)

### 3. 系列详情页（DownloadSeriesDetailPage）

**功能特性**:
- 显示系列名称（通过B站API获取真实名称）
- 统计信息（总数、已完成、总时长、完成率）
- 分P列表显示
- 实时进度更新（2秒间隔）
- 任务控制（取消、重试、删除）

## 工作流程

### 添加视频到列表流程

1. **用户操作**: 用户从收藏夹、稍后再看或视频详情页点击"添加到列表"
2. **API调用**: 调用 `/api/download/add` 接口
3. **数据验证**: 验证视频信息是否完整
4. **创建任务**: 在数据库中创建下载任务记录
5. **状态更新**: 设置任务状态为 `pending`
6. **前端更新**: 更新下载列表显示

### 开始下载流程

1. **用户操作**: 用户点击"开始下载"按钮
2. **API调用**: 调用 `/api/download/start` 接口
3. **状态更新**: 将任务状态从 `pending` 改为 `queued`
4. **下载执行**: DownloadService执行下载
5. **进度更新**: 通过进度回调更新下载进度
6. **完成处理**: 下载完成后更新状态为 `completed`

### 删除和恢复流程

1. **删除操作**:
   - 用户点击删除按钮
   - 调用 `/api/download/{id}` 接口删除任务
   - 前端立即从列表中移除该任务
   - 数据库中删除对应记录

2. **恢复操作**:
   - 用户点击刷新按钮
   - 从B站API获取视频的所有分P信息
   - 对比当前列表，检测缺失的分P
   - 提示用户是否恢复缺失的分P
   - 确认后调用 `/api/download/add` 接口添加
   - 刷新列表显示完整的分P

## 技术实现

### 后端技术栈
- **FastAPI**: Web框架
- **SQLAlchemy**: ORM
- **SQLite**: 数据库
- **yt-dlp**: 下载引擎
- **asyncio**: 异步下载

### 前端技术栈
- **React 18**: UI框架
- **TypeScript**: 类型安全
- **Zustand**: 状态管理
- **lucide-react**: 图标库
- **API Service**: API调用封装

### 数据模型

```typescript
interface DownloadTask {
  id: string                    // UUID
  bvid: string                  // 视频ID
  title: string                 // 标题
  status: 'pending' | 'queued' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number              // 进度百分比
  downloaded_bytes: number      // 已下载字节数
  total_bytes: number           // 总字节数
  download_speed: number        // 下载速度
  eta: number                   // 预计剩余时间（秒）
  thumbnail_url?: string        // 封面URL
  duration?: number             // 时长（秒）
  uploader?: string             // UP主名称
  file_path?: string            // 保存路径
  error_message?: string        // 错误信息
  created_at: string            // 创建时间
  started_at?: string           // 开始时间
  completed_at?: string         // 完成时间
  aid?: number                  // 视频AID
  cid?: number                  // 分P CID
}
```

## 注意事项

### 前端注意事项
1. **状态管理**: 使用Zustand管理下载列表状态
2. **实时更新**: 使用定时器（2秒间隔）更新下载进度
3. **错误处理**: 所有API调用都需要错误处理
4. **用户体验**: 删除操作需要确认对话框
5. **数据同步**: 删除后立即更新前端列表，提高响应速度

### 后端注意事项
1. **异步处理**: 使用asyncio实现异步下载
2. **进度追踪**: 通过回调机制更新下载进度
3. **错误处理**: 捕获并记录下载过程中的错误
4. **文件管理**: 确保下载文件的唯一性和完整性
5. **资源清理**: 下载失败时清理临时文件

### 性能优化
1. **批量操作**: 支持批量添加、批量删除，减少API调用
2. **进度优化**: 只在有下载任务时才更新进度
3. **缓存机制**: 使用前端缓存减少API请求
4. **懒加载**: 下载列表采用懒加载，避免一次性加载所有数据

## 常见问题

### Q: 为什么添加到列表后不会立即下载？
A: 系统采用"添加到列表"的设计理念，用户可以先收集想要下载的视频，然后统一开始下载。这样可以更好地管理下载任务，避免一次性下载过多视频。

### Q: 如何批量添加视频到下载列表？
A: 在收藏夹、稍后再看或视频详情页，用户可以批量选择视频，然后点击"添加到列表"按钮。系统会自动识别视频类型，并将所有选中的视频添加到下载列表。

### Q: 删除后如何恢复？
A: 点击刷新按钮，系统会自动检测缺失的分P，并提示用户是否恢复。确认后，系统会从B站API获取视频信息，并重新添加到下载列表。

### Q: 如何查看下载进度？
A: 在下载列表页面，每个下载任务都会显示进度条、下载速度、剩余时间等信息。系统会每2秒自动更新一次进度。

### Q: 下载失败后如何重试？
A: 下载失败的任务会显示红色状态，点击重试按钮即可重新开始下载。

### Q: 支持哪些链接格式？
A: 支持B站视频链接、B站视频ID（bvid/aid）、课程链接（ss360格式）等多种格式。系统会自动识别链接类型。

## 参考实现
- `apps/api/src/routers/download.py` - 下载API路由
- `apps/api/src/services/download_service.py` - 下载服务
- `apps/api/src/models/download.py` - 下载数据模型
- `apps/web/src/pages/DownloadDetailPage.tsx` - 下载详情页
- `apps/web/src/pages/components/DownloadsContent.tsx` - 下载列表组件
- `apps/web/src/stores/download.ts` - 下载状态管理
- `apps/web/src/services/api.ts` - API服务封装

## 更新日志

### 2026-03-30
- ✅ 实现添加到列表功能
- ✅ 实现批量删除功能
- ✅ 实现刷新恢复功能
- ✅ 实现单个删除功能
- ✅ 优化系列名显示（使用B站API获取真实名称）
- ✅ 简化日志输出
- ✅ 优化删除操作（立即更新前端列表）