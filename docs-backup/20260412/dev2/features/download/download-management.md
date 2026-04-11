# 下载管理功能

## 核心原则

**⚠️ 重要：严格复刻BiliTools实现方法**

本模块的设计和实现必须**严格遵循BiliTools的实现方法**，不得创造新的方法或流程。所有功能都应参考BiliTools的源代码实现。

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
- **纯前端判断**: 使用title匹配来判断缺失的分P，避免依赖数据库查询

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

#### 5. 取消下载
```http
POST /api/download/{id}/cancel
```

#### 6. 重试下载
```http
POST /api/download/{id}/retry
```

#### 7. 删除下载任务
```http
DELETE /api/download/{id}
```

#### 8. 解析下载链接
```http
POST /api/download/parse
Content-Type: application/json

{
  "url": "https://www.bilibili.com/video/BV1xx411c7mD"
}
```

## 前端功能

### 1. 下载列表页面（DownloadDetailPage）

**功能特性**:
- 显示系列名称（通过B站API获取真实名称）
- 下载进度概览（总进度、已完成、下载中、总大小）
- 分P列表显示
- 批量选择功能（全选/取消全选/反选）
- 批量删除功能
- 刷新恢复功能

### 2. 下载管理页面（DownloadsContent）

**功能特性**:
- 按系列分组显示下载任务
- 显示系列名称、总数量、已完成数量、完成率
- 实时进度更新（2秒间隔）
- 点击进入系列详情页

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

2. **恢复操作**:
   - 用户点击刷新按钮
   - 从B站API获取视频的所有分P信息
   - **纯前端判断**: 使用当前显示列表的title来判断缺失的分P
   - 提示用户是否恢复缺失的分P

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

## 常见问题

### Q: 为什么添加到列表后不会立即下载？
A: 系统采用"添加到列表"的设计理念，用户可以先收集想要下载的视频，然后统一开始下载。这样可以更好地管理下载任务，避免一次性下载过多视频。

### Q: 如何批量添加视频到下载列表？
A: 在收藏夹、稍后再看或视频详情页，用户可以批量选择视频，然后点击"添加到列表"按钮。

### Q: 删除后如何恢复？
A: 点击刷新按钮，系统会自动检测缺失的分P，并提示用户是否恢复。

### Q: 支持哪些链接格式？
A: 系统支持12种媒体类型，包括视频、番剧、音乐、歌单、课程、稍后再看、收藏夹、图文、图文合集、用户视频、用户图文、用户音频。

## 参考实现
- `apps/api/src/routers/download.py` - 下载API路由
- `apps/api/src/services/download_service.py` - 下载服务
- `apps/api/src/models/download.py` - 下载数据模型
- `apps/web/src/pages/DownloadDetailPage.tsx` - 下载详情页
- `apps/web/src/stores/download.ts` - 下载状态管理

## 更新日志

### 2026-03-31
- ✅ 实现视频分辨率选择
- ✅ 实现音频码率选择
- ✅ 实现视频编码格式选择
- ✅ 完全复刻BiliTools下载设置UI
- ✅ 支持yt-dlp格式字符串构建
- ✅ 支持音频流ID选择

### 2026-03-30
- ✅ 实现添加到列表功能
- ✅ 实现批量删除功能
- ✅ 实现刷新恢复功能
- ✅ 实现单个删除功能
- ✅ 优化系列名显示（使用B站API获取真实名称）
- ✅ 扩展链接识别：从4种类型扩展到12种媒体类型
- ✅ 完全复刻BiliTools链接识别功能