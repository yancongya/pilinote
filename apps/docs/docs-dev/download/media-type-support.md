# 多类型媒体支持文档

## 目录

1. [媒体类型概述](#媒体类型概述)
2. [单个视频处理](#单个视频处理)
3. [系列视频处理](#系列视频处理)
4. [图文内容处理](#图文内容处理)
5. [媒体类型对比](#媒体类型对比)
6. [技术架构](#技术架构)
7. [用户界面适配](#用户界面适配)
8. [性能优化](#性能优化)
9. [错误处理](#错误处理)
10. [未来扩展](#未来扩展)

---

## 媒体类型概述

PiliNote 支持多种媒体类型的下载，每种类型都有其独特的特征和处理逻辑。

### 已支持的媒体类型

| 类型 | 标识符 | 说明 | 状态 |
|------|--------|------|------|
| 视频 | `video` | 单个视频（单P或多P） | ✅ 已实现 |
| 收藏夹 | `favorite` | 收藏夹中的视频 | ✅ 已实现（复用video逻辑） |
| 稍后再看 | `watch_later` | 稍后再看列表中的视频 | ✅ 已实现（复用video逻辑） |
| 图文 | `opus` | 单个图文内容 | 🚧 部分实现 |
| 图文合集 | `opus_list` | 多个图文的合集 | 🚧 部分实现 |

### 计划支持的媒体类型

| 类型 | 标识符 | 说明 | 状态 |
|------|--------|------|------|
| 番剧 | `bangumi` | 动画番剧 | ❌ 未实现 |
| 音乐 | `music` | 单个音乐 | ❌ 未实现 |
| 音乐列表 | `music_list` | 音乐合集 | ❌ 未实现 |
| 课程 | `lesson` | 课程内容 | ❌ 未实现 |
| 用户视频 | `user_video` | 用户发布的视频 | ❌ 未实现 |
| 用户图文 | `user_opus` | 用户发布的图文 | ❌ 未实现 |
| 用户音频 | `user_audio` | 用户发布的音频 | ❌ 未实现 |

### 媒体类型枚举定义

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/models/task.py

class MediaType(str, enum.Enum):
    """媒体类型枚举"""
    VIDEO = "video"
    BANGUMI = "bangumi"
    MUSIC = "music"
    MUSIC_LIST = "music_list"
    LESSON = "lesson"
    WATCH_LATER = "watch_later"
    FAVORITE = "favorite"
    OPUS = "opus"
    OPUS_LIST = "opus_list"
    USER_VIDEO = "user_video"
    USER_OPUS = "user_opus"
    USER_AUDIO = "user_audio"
```

---

## 单个视频处理

### 处理流程

单个视频的处理流程包括以下几个阶段：

```
用户点击添加
    ↓
获取视频详情（调用 Bilibili API）
    ↓
检测视频类型（单P/多P）
    ↓
创建任务对象
    ↓
提交到待办队列
    ↓
调度器启动（如需要）
    ↓
任务执行
    ├── 准备阶段（获取元数据）
    ├── 下载阶段（下载视频）
    ├── 移动阶段（移动到最终目录）
    └── 后处理阶段（封面、字幕、NFO等）
    ↓
任务完成
```

### 数据获取流程

#### 1. 前端获取视频详情

```typescript
// /Users/tanyancong/工作/开发/pilinote/apps/web/src/hooks/useVideoDownload.ts

const videoDetailResponse = await apiService.getVideoDetail(video.bvid, sessdata || undefined)

if (videoDetailResponse.success && videoDetailResponse.data?.pages) {
  const pages = videoDetailResponse.data.pages
  const videoDetailData = videoDetailResponse.data as VideoDetail
  
  if (pages.length > 1) {
    // 多P视频处理
    // ...
  } else {
    // 单P视频处理
    const taskData = {
      title: video.title,
      media_type: 'video',
      media_id: video.bvid,
      cover: video.pic || video.cover || '',
      desc: `CID: ${videoDetailData.cid || pages[0]?.cid}`,
      meta: {
        cid: videoDetailData.cid || pages[0]?.cid
      }
    }
  }
}
```

#### 2. 后端获取视频信息

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/services/queue/task.py

async def _prepare_video(self, bilibili_service: BilibiliService):
    """准备视频任务"""
    # 获取视频信息
    result = await bilibili_service.get_video_info(self.task.media_id)

    if not result.get('success'):
        raise Exception(result.get('message', '获取视频信息失败'))

    video_info = result['data']

    # 保存元数据
    if self.task.meta and isinstance(self.task.meta, dict):
        # 保存原有的分P信息
        cid = self.task.meta.get('cid')
        page = self.task.meta.get('page')
        part_title = self.task.meta.get('part_title')
        
        # 用 video_info 更新 meta，但保留分P信息
        self.task.meta = {**video_info}
        
        # 恢复分P信息
        if cid:
            self.task.meta['cid'] = cid
        if page:
            self.task.meta['page'] = page
        if part_title:
            self.task.meta['part_title'] = part_title
    else:
        self.task.meta = video_info

    # 构建准备数据
    self.task.prepare = {
        'subtasks': self._create_subtasks(video_info)
    }
```

### 任务创建逻辑

#### 单P视频任务结构

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "media_type": "video",
  "media_id": "BV1xx411c7mD",
  "title": "视频标题",
  "cover": "https://cover_url.jpg",
  "desc": "CID: 12345678",
  "meta": {
    "aid": 12345678,
    "bvid": "BV1xx411c7mD",
    "cid": 12345678,
    "title": "视频标题",
    "pic": "https://cover_url.jpg",
    "desc": "视频描述",
    "duration": 120,
    "owner": {
      "mid": 123456,
      "name": "UP主名称",
      "face": "https://avatar_url.jpg"
    },
    "stat": {
      "view": 1000,
      "danmaku": 100,
      "reply": 50,
      "favorite": 20,
      "coin": 30,
      "share": 10,
      "like": 80
    },
    "pubdate": 1234567890
  },
  "prepare": {
    "subtasks": [
      {
        "type": "video",
        "bvid": "BV1xx411c7mD",
        "filename": "视频标题.mp4"
      },
      {
        "type": "subtitles",
        "bvid": "BV1xx411c7mD",
        "filename": "视频标题.zh.srt"
      },
      {
        "type": "thumb",
        "url": "https://cover_url.jpg",
        "filename": "视频标题.jpg"
      },
      {
        "type": "AVATAR",
        "uploader_mid": 123456,
        "uploader": "UP主名称",
        "avatar_url": "https://avatar_url.jpg",
        "filename": "avatar.jpg"
      },
      {
        "type": "single_nfo",
        "meta": {...},
        "filename": "视频标题.nfo"
      }
    ]
  },
  "status": {
    "progress": 0,
    "speed": 0,
    "eta": 0,
    "stage": "pending",
    "downloaded": 0,
    "total": 0
  },
  "state": 0,
  "scheduler_id": null,
  "created_at": 1234567890,
  "updated_at": 1234567890
}
```

### 文件结构设计

#### 单P视频文件结构

```
downloads/
└── 视频标题/
    ├── 视频标题.mp4          # 视频文件
    ├── 视频标题.jpg          # 封面图片
    ├── 视频标题.zh.srt       # 中文字幕
    ├── avatar.jpg            # UP主头像
    └── 视频标题.nfo          # 元数据文件（NFO格式）
```

### 元数据处理

#### 视频元数据包含以下信息：

1. **基本信息**
   - aid: 视频ID
   - bvid: BV号
   - cid: 分集ID
   - title: 标题
   - pic: 封面URL
   - desc: 描述

2. **UP主信息**
   - mid: UP主ID
   - name: UP主名称
   - face: 头像URL

3. **统计数据**
   - view: 播放量
   - danmaku: 弹幕数
   - reply: 评论数
   - favorite: 收藏数
   - coin: 投币数
   - share: 分享数
   - like: 点赞数

4. **时间信息**
   - pubdate: 发布时间戳
   - duration: 时长（秒）

5. **分P信息**（仅多P视频）
   - page: 分P序号
   - part: 分P标题
   - cid: 分P的CID

---

## 系列视频处理

### 多P视频识别机制

多P视频通过检查视频详情API返回的 `pages` 数组长度来识别：

```typescript
// /Users/tanyancong/工作/开发/pilinote/apps/web/src/hooks/useVideoDownload.ts

const videoDetailResponse = await apiService.getVideoDetail(video.bvid, sessdata || undefined)

if (videoDetailResponse.success && videoDetailResponse.data?.pages) {
  const pages = videoDetailResponse.data.pages
  
  if (pages.length > 1) {
    // 多P视频：按照BiliTools方案，创建调度器统一管理
    // ...
  } else {
    // 单P视频
    // ...
  }
}
```

### 分P任务创建逻辑

#### 多P视频处理流程

```
检测到多P视频（pages.length > 1）
    ↓
为每个分P创建独立任务
    ↓
收集所有任务ID
    ↓
创建调度器
    ↓
将任务ID列表关联到调度器
    ↓
设置统一的输出文件夹
    ↓
提交调度器到待处理队列
```

#### 创建分P任务的代码实现

```typescript
// /Users/tanyancong/工作/开发/pilinote/apps/web/src/hooks/useVideoDownload.ts

if (pages.length > 1) {
  // 多P视频：按照BiliTools方案，创建调度器统一管理
  
  // 步骤1：为每个分P创建任务并提交到backlog
  const taskIds: string[] = []
  let addedCount = 0

  for (const page of pages) {
    try {
      const taskData = {
        title: page.part || `${video.title} - P${page.page}`,
        media_type: 'video',
        media_id: video.bvid,
        cover: video.pic || video.cover || '',
        desc: `CID: ${page.cid}`,
        meta: {
          cid: page.cid,
          page: page.page,
          part_title: page.part
        }
      }

      const response = await apiService.submitTask(taskData)
      if (response.success && response.data) {
        taskIds.push(response.data.id)
        addedCount++
      }
    } catch (error) {
      console.error(`添加分集任务失败: ${page.part}`, error)
    }
  }

  if (addedCount === 0) {
    throw new Error('所有分集添加失败')
  }

  // 步骤2：创建调度器，使用收集到的任务ID
  const folderName = `系列-${video.title.replace(/[\/\\:*?"<>|]/g, '_')}`
  
  // Get user settings to use configured download path
  const { useSettingsStore } = await import('../stores/settings')
  const settingsStore = useSettingsStore.getState()
  
  // Fetch settings if not already loaded
  if (!settingsStore.settings) {
    await settingsStore.fetchSettings()
  }
  
  // Use download path from settings or fallback to default
  const downloadPath = settingsStore.settings?.storage?.download_path || '/Users/tanyancong/工作/开发/pilinote/downloads'
  const folderPath = `${downloadPath}/${folderName}`

  const schedulerResponse = await apiService.createScheduler({
    title: video.title,
    task_ids: taskIds,
    folder: folderPath
  })

  if (!schedulerResponse.success || !schedulerResponse.data) {
    throw new Error(schedulerResponse.message || '创建调度器失败')
  }

  const _schedulerId = schedulerResponse.data.id

  // 立即刷新任务列表，确保状态更新
  await newQueueStore.fetchTasks()
  return {success: true, message: `已添加 ${addedCount} 个视频到下载列表`}
}
```

### 调度器统一管理

#### 调度器数据结构

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "title": "系列视频标题",
  "list": [
    "550e8400-e29b-41d4-a716-446655440002",
    "550e8400-e29b-41d4-a716-446655440003",
    "550e8400-e29b-41d4-a716-446655440004"
  ],
  "count": 3,
  "queue_type": 1,
  "state": 0,
  "folder": "/Users/tanyancong/工作/开发/pilinote/downloads/系列-视频标题",
  "created_at": 1234567890,
  "updated_at": 1234567890
}
```

#### 调度器功能

1. **任务分组管理**
   - 将相关任务组织在一起
   - 统一的取消/暂停/重试操作
   - 批量进度追踪

2. **统一输出目录**
   - 为系列视频创建统一的文件夹
   - 避免文件散乱
   - 便于整理和管理

3. **队列调度**
   - 调度器本身也是一个队列元素
   - 支持优先级调度
   - 可以暂停/恢复整个系列

### 文件夹结构设计

#### 多P视频文件结构

```
downloads/
└── 系列-视频标题/
    ├── 分P1标题/
    │   ├── 分P1标题.mp4
    │   ├── 分P1标题.jpg
    │   ├── 分P1标题.zh.srt
    │   ├── avatar.jpg
    │   └── 分P1标题.nfo
    ├── 分P2标题/
    │   ├── 分P2标题.mp4
    │   ├── 分P2标题.jpg
    │   ├── 分P2标题.zh.srt
    │   ├── avatar.jpg
    │   └── 分P2标题.nfo
    └── 分P3标题/
        ├── 分P3标题.mp4
        ├── 分P3标题.jpg
        ├── 分P3标题.zh.srt
        ├── avatar.jpg
        └── 分P3标题.nfo
```

### 批量操作支持

#### 取消整个系列

```typescript
// 取消调度器
await apiService.cancelScheduler(schedulerId)
```

#### 删除整个系列

```typescript
// 删除调度器（包括所有任务和文件）
await apiService.deleteScheduler(schedulerId)
```

#### 暂停/恢复系列

```typescript
// 暂停系列
await apiService.pauseScheduler(schedulerId)

// 恢复系列
await apiService.resumeScheduler(schedulerId)
```

---

## 图文内容处理

### 图文类型识别

图文内容通过URL格式识别：

```
- 单个图文: cv\d+ (例如: cv12345678)
- 图文合集: rl\d+ (例如: rl12345678)
- 用户图文: space.bilibili.com/{mid}/opus
```

### 图文下载逻辑

#### 获取图文详情

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/services/bilibili.py

async def get_opus_details(self, opus_id: str, sessdata: str = "") -> Dict:
    """获取图文详情（使用HTML解析方法）
    
    Args:
        opus_id: 图文ID（纯数字）
        sessdata: SESSDATA cookie
        
    Returns:
        Dict: 图文详情信息
    """
    async_client = await self._get_client()
    
    try:
        response = await async_client.get(
            f"https://www.bilibili.com/opus/{opus_id}",
            follow_redirects=True
        )
        
        html_text = response.text
        
        # 提取图文模块数据
        # ... HTML 解析逻辑
        
        return {
            "success": True,
            "data": {
                "id": opus_id,
                "title": "图文标题",
                "raw_data": {...},
                "author": {...},
                "stat": {...},
                "image_urls": [...],
                "paragraphs": [...]
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"获取图文详情异常: {str(e)}"
        }
```

### 文本内容保存

#### 图文元数据结构

```json
{
  "id": "cv12345678",
  "title": "图文标题",
  "raw_data": {
    "modules": {...}
  },
  "author": {
    "mid": 123456,
    "name": "作者名称",
    "face": "https://avatar_url.jpg"
  },
  "stat": {
    "view": 1000,
    "like": 100,
    "reply": 50
  },
  "image_urls": [
    "https://image1.jpg",
    "https://image2.jpg",
    "https://image3.jpg"
  ],
  "paragraphs": [
    {
      "type": "text",
      "content": "段落文本内容"
    },
    {
      "type": "image",
      "url": "https://image1.jpg"
    }
  ]
}
```

### 元数据提取

#### 图文任务创建

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/routers/download.py

elif media_type in [MediaType.OPUS, MediaType.OPUS_LIST]:
    # 特殊处理：图文
    opus_id = parsed["id"].replace("cv", "").replace("CV", "")
    opus_result = await bilibili_service.get_opus_details(opus_id, request.sessdata)
    
    if not opus_result["success"]:
        raise HTTPException(
            status_code=400,
            message=opus_result.get("message", "获取图文信息失败")
        )
    
    opus_data = opus_result.get("data", {})
    raw_data = opus_data.get("raw_data", {})
    
    author = opus_data.get("author", {})
    raw_stat = opus_data.get("stat", {})
    
    # 创建下载任务
    download = Download(
        id=str(uuid.uuid4()),
        aid=opus_data.get("id", 0),
        title=opus_data.get("title", ""),
        # ...
    )
    
    # 保存图文信息
    download.opus_info = {
        "title": opus_data.get("title", ""),
        "paragraphs": opus_data.get("paragraphs", []),
        "image_urls": opus_data.get("image_urls", [])
    }
```

### 文件结构设计

#### 图文文件结构

```
downloads/
└── 图文标题/
    ├── cover.jpg              # 封面（使用第一张图片作为本地封面）
    ├── images/
    │   ├── article-image.png
    │   ├── article-image-2.png
    │   └── banner.webp
    ├── avatar.jpg             # 作者头像
    ├── 图文标题.md            # 文本内容（Markdown格式，引用本地 images/）
    └── 图文标题.nfo           # 元数据文件
```

#### 当前实现说明

- 任务创建入口统一提交 `media_type: opus`
- `media_id` 会规范化为 `cv...`
- 准备阶段调用 `BilibiliService.get_opus_details()` 获取标题、段落、图片、作者与统计信息
- 执行阶段不再尝试走视频媒体下载，而是直接进入后处理归档
- 后处理会生成：
  - `cover.*`
  - `avatar.*`
  - `images/` 本地图片目录
  - `图文标题.md`
  - `图文标题.nfo`

#### Markdown 归档规则

- 正文段落写入 Markdown 普通段落
- 图片段落转换为 `![图文图片 N](images/文件名.ext)`
- 图片文件名优先复用源 URL basename，冲突时自动追加 `-2`、`-3`
- Markdown 内不再保留远程 B 站图片 URL，详情页读取本地 Markdown 时会走本地图片代理接口

---

## 媒体类型对比

### 数据结构差异

| 特性 | 单个视频 | 系列视频 | 图文内容 |
|------|----------|----------|----------|
| **media_type** | `video` | `video` | `opus` |
| **media_id** | BV号 | BV号 | cv号 |
| **scheduler_id** | `null` | 调度器ID | `null` |
| **meta.cid** | 分集CID | 各分P的CID | N/A |
| **meta.page** | N/A | 分P序号 | N/A |
| **meta.part_title** | N/A | 分P标题 | N/A |
| **meta.opus_info** | N/A | N/A | 图文信息 |

### 处理流程差异

#### 单个视频流程

```
获取详情 → 检测单P → 创建任务 → 执行任务 → 完成
```

#### 系列视频流程

```
获取详情 → 检测多P → 创建多个任务 → 创建调度器 → 调度器执行 → 完成
```

#### 图文内容流程

```
获取详情 → 规范化 cv 任务 → 下载头像/封面/图片 → 生成 Markdown/NFO → 完成
```

### 文件组织差异

| 类型 | 文件夹结构 | 子文件夹 | 特殊文件 |
|------|------------|----------|----------|
| 单个视频 | `视频标题/` | 无 | mp4, srt, jpg, nfo |
| 系列视频 | `系列-标题/` | 每个分P一个子文件夹 | mp4, srt, jpg, nfo（每P独立） |
| 图文内容 | `图文标题/` | `images/` | jpg, md, nfo |

### 用户界面差异

#### 下载按钮状态

| 状态 | 单个视频 | 系列视频 | 图文内容 |
|------|----------|----------|----------|
| 未下载 | 显示"添加"图标 | 显示"添加"图标 | 显示"添加"图标 |
| 下载中 | 显示进度条 | 显示整体进度 | 显示进度条 |
| 已完成 | 显示"完成"图标 | 显示"完成"图标 | 显示"完成"图标 |

#### 批量操作

| 操作 | 单个视频 | 系列视频 | 图文内容 |
|------|----------|----------|----------|
| 取消 | 取消当前任务 | 取消整个系列 | 取消当前任务 |
| 暂停 | 暂停当前任务 | 暂停整个系列 | 暂停当前任务 |
| 重试 | 重试当前任务 | 重试整个系列 | 重试当前任务 |
| 删除 | 删除当前任务 | 删除整个系列 | 删除当前任务 |

---

## 技术架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                       前端层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ 收藏夹页面    │  │ 稍后再看页面  │  │ 下载队列页面  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │          │
│         └─────────────────┼─────────────────┘          │
│                           │                             │
│                    ┌──────▼──────┐                      │
│                    │ useVideoDownload                    │
│                    │    Hook     │                      │
│                    └──────┬──────┘                      │
└───────────────────────────┼─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                       API层                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ /api/queue   │  │ /api/media   │  │ /api/auth    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼─────────┐
│                     服务层                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │QueueManager  │  │TaskService   │  │BilibiliService│ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐   │
│  │SchedulerSvc │  │DownloadEngine│  │HeadersManager│  │
│  └─────────────┘  └─────────────┘  └─────────────┘   │
└───────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                    数据层                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Task 模型   │  │Scheduler 模型│  │  Cookie 模型 │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└───────────────────────────────────────────────────────┘
```

### 核心组件

#### 1. QueueManager（队列管理器）

**职责：**
- 管理四级队列（backlog, pending, doing, complete）
- 管理所有任务和调度器
- 提供任务提交、查询、删除等API
- 持久化队列状态到数据库

**关键方法：**

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/services/queue/manager.py

class QueueManager:
    """统一队列管理器"""
    
    async def submit_backlog(self, task_create: TaskCreate) -> TaskResponse:
        """提交任务到待办队列"""
        pass
    
    async def plan_scheduler(self, scheduler_create: SchedulerCreate) -> SchedulerResponse:
        """从待办队列创建调度器"""
        pass
    
    async def get_task(self, task_id: str) -> Optional[Task]:
        """获取任务"""
        pass
    
    async def get_scheduler(self, scheduler_id: str) -> Optional[Scheduler]:
        """获取调度器"""
        pass
```

#### 2. TaskService（任务服务）

**职责：**
- 准备任务（获取元数据）
- 执行任务（下载视频、下载封面等）
- 管理子任务
- 报告进度

**关键方法：**

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/services/queue/task.py

class TaskService:
    """任务服务 - 管理单个任务的执行"""
    
    async def prepare(self):
        """准备任务（获取元数据）"""
        pass
    
    async def execute(self, temp_dir: Path, output_dir: Path):
        """执行任务"""
        pass
    
    def _create_subtasks(self, info: dict) -> List[dict]:
        """创建子任务列表"""
        pass
```

#### 3. DownloadEngine（下载引擎）

**职责：**
- 使用 yt-dlp 下载视频
- 支持 aria2c 加速下载
- 提供进度回调
- 支持暂停/恢复

**关键方法：**

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/services/download_engine.py

class DownloadEngine:
    """下载引擎 - 使用yt-dlp下载视频"""
    
    async def download_video(
        self,
        bvid: str,
        quality: int,
        output_format: str,
        output_path: str,
        sessdata: str,
        progress_callback: Callable,
        cid: Optional[int] = None,
        page_num: Optional[int] = None
    ):
        """下载视频"""
        pass
```

### 数据模型设计

#### Task 模型

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/models/task.py

class Task(Base):
    """任务模型"""
    __tablename__ = 'tasks'

    id = Column(String(50), primary_key=True)
    media_type = Column(String(20), nullable=False, index=True)
    media_id = Column(String(50), nullable=False, index=True)
    title = Column(String(500))
    cover = Column(String(500))
    desc = Column(String(2000))
    
    # 元数据
    meta = Column(JSON, nullable=False, default=lambda: {})
    prepare = Column(JSON, nullable=False, default=lambda: {})
    status = Column(JSON, nullable=False, default=lambda: {})
    
    # 状态
    state = Column(Integer, nullable=False, default=TaskState.BACKLOG, index=True)
    
    # 调度器关联
    scheduler_id = Column(String(50), nullable=True, index=True)
    
    # 时间戳
    created_at = Column(Integer, nullable=False)
    updated_at = Column(Integer, nullable=False)
```

#### Scheduler 模型

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/models/scheduler.py

class Scheduler(Base):
    """调度器模型"""
    __tablename__ = 'schedulers'

    id = Column(String(50), primary_key=True)
    title = Column(String(500), nullable=False)
    
    # 任务列表
    list = Column(JSON, nullable=False, default=lambda: [])
    count = Column(Integer, nullable=False, default=0)
    
    # 队列和状态
    queue_type = Column(Integer, nullable=False, default=QueueType.PENDING)
    state = Column(Integer, nullable=False, default=SchedulerState.PENDING, index=True)
    
    # 输出目录
    folder = Column(String(500), nullable=False)
    
    # 时间戳
    created_at = Column(Integer, nullable=False)
    updated_at = Column(Integer, nullable=False)
```

---

## 用户界面适配

### 下载状态展示

#### 状态枚举

```typescript
// 下载状态
type DownloadStatus = 'none' | 'in_list' | 'downloaded'

// 状态检查函数
const getDownloadStatus = (bvid: string): DownloadStatus => {
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
```

#### UI 组件

```typescript
// /Users/tanyancong/工作/开发/pilinote/apps/web/src/pages/components/FavoritesContent.tsx

// 视频卡片下载按钮
<button
  onClick={(e) => toggleDownload(video, e)}
  disabled={getDownloadStatus(video.bvid) === 'downloaded'}
  className={`
    ${getDownloadStatus(video.bvid) === 'none' 
      ? 'text-gray-400 hover:text-blue-500' 
      : getDownloadStatus(video.bvid) === 'in_list' 
        ? 'text-blue-500' 
        : 'text-green-500'
    }
  `}
>
  {getDownloadStatus(video.bvid) === 'none' && <PlusIcon />}
  {getDownloadStatus(video.bvid) === 'in_list' && <Loader2Icon className="animate-spin" />}
  {getDownloadStatus(video.bvid) === 'downloaded' && <CheckIcon />}
</button>
```

### 多P视频标识

#### 标识逻辑

```typescript
// 检测是否为多P视频
const isMultiPart = (video: VideoInfo): boolean => {
  // 视频详情API返回的 pages 数组长度 > 1
  return video.pages && video.pages.length > 1
}
```

#### UI 展示

```typescript
// 视频卡片多P标识
{isMultiPart(video) && (
  <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
    {video.pages.length}P
  </div>
)}
```

### 批量操作UI

#### 批量操作栏

```typescript
// /Users/tanyancong/工作/开发/pilinote/apps/web/src/components/VideoListControls.tsx

function VideoListControls() {
  const { selectedVideos, clearSelection } = useVideoList()
  const { toggleDownload } = useVideoDownload()
  
  const handleBatchAdd = async () => {
    for (const video of selectedVideos) {
      await toggleDownload(video, new MouseEvent('click') as any)
    }
    clearSelection()
  }
  
  const handleBatchCancel = async () => {
    // 批量取消逻辑
  }
  
  return (
    <div className="flex gap-2">
      <button onClick={handleBatchAdd}>
        批量添加 ({selectedVideos.length})
      </button>
      <button onClick={handleBatchCancel}>
        批量取消
      </button>
    </div>
  )
}
```

---

## 性能优化

### 并发下载控制

#### 信号量控制

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/services/queue/manager.py

class QueueManager:
    """统一队列管理器"""
    
    def __init__(self):
        # 信号量用于并发控制
        self.semaphore = asyncio.Semaphore(3)  # 最多3个并发下载
```

#### 并发执行

```python
async def dispatch(self):
    """分发任务（并发执行）"""
    async with self.semaphore:
        # 获取下一个任务
        task_id = await self._get_next_task()
        
        if task_id:
            # 执行任务
            await self._execute_task(task_id)
```

### 缓存机制

#### 视频详情缓存

```typescript
// /Users/tanyancong/工作/开发/pilinote/apps/web/src/stores/cache.ts

interface CacheStore {
  videoDetailsCache: Map<string, VideoDetail>
  getVideoDetail: (bvid: string) => Promise<VideoDetail>
}

// 缓存视频详情
const getVideoDetail = async (bvid: string): Promise<VideoDetail> => {
  // 检查缓存
  if (videoDetailsCache.has(bvid)) {
    return videoDetailsCache.get(bvid)!
  }
  
  // 从API获取
  const response = await apiService.getVideoDetail(bvid)
  
  // 缓存结果
  if (response.success) {
    videoDetailsCache.set(bvid, response.data)
  }
  
  return response.data
}
```

#### 收藏夹缓存

```typescript
// 缓存收藏夹列表
const getFoldersCache = (): any[] => {
  const cached = localStorage.getItem('folders_cache')
  return cached ? JSON.parse(cached) : []
}

const setFoldersCache = (folders: any[]): void => {
  localStorage.setItem('folders_cache', JSON.stringify(folders))
}
```

### 文件大小优化

#### 图片压缩

```python
# 下载封面时压缩图片
async def _download_image(self, url: str, output_file: Path) -> bool:
    """下载图片（带压缩）"""
    from PIL import Image
    
    # 下载图片
    response = await httpx.get(url)
    img = Image.open(BytesIO(response.content))
    
    # 压缩图片（最大宽度800px）
    if img.width > 800:
        ratio = 800 / img.width
        new_size = (800, int(img.height * ratio))
        img = img.resize(new_size, Image.LANCZOS)
    
    # 保存为JPEG，质量85%
    img.save(output_file, 'JPEG', quality=85, optimize=True)
    
    return True
```

#### 元数据精简

```python
# 只保存必要的元数据
essential_meta = {
    'aid': video_info.get('aid'),
    'bvid': video_info.get('bvid'),
    'cid': video_info.get('cid'),
    'title': video_info.get('title'),
    'pic': video_info.get('pic'),
    'owner': {
        'mid': video_info.get('owner', {}).get('mid'),
        'name': video_info.get('owner', {}).get('name'),
        'face': video_info.get('owner', {}).get('face')
    },
    'stat': {
        'view': video_info.get('stat', {}).get('view'),
        'like': video_info.get('stat', {}).get('like')
    },
    'pubdate': video_info.get('pubdate')
}
```

---

## 错误处理

### 通用错误处理

#### 前端错误处理

```typescript
// /Users/tanyancong/工作/开发/pilinote/apps/web/src/hooks/useVideoDownload.ts

const toggleDownload = async (video: VideoInfo, e: React.MouseEvent) => {
  try {
    const response = await apiService.submitTask(taskData)
    
    if (response.success) {
      return {success: true, message: '已添加到下载队列'}
    } else {
      return {success: false, message: '添加到下载队列失败: ' + (response.message || '未知错误')}
    }
  } catch (error) {
    console.error('添加任务失败:', error)
    return {success: false, message: '添加到下载队列失败'}
  }
}
```

#### 后端错误处理

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/routers/queue.py

@router.post("/tasks", response_model=ApiResponse)
async def submit_task(task_create: TaskCreate):
    """提交任务到待办队列"""
    try:
        task = await queue_manager.submit_backlog(task_create)
        return ApiResponse(
            success=True,
            message="任务提交成功",
            data=task
        )
    except Exception as e:
        logger.error(f"Failed to submit task: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### 视频特定错误

#### 获取视频详情失败

```typescript
// 降级处理：使用现有数据
if (!videoDetailResponse.success || !videoDetailResponse.data?.pages) {
  console.error('获取视频详情失败，降级为直接添加')
  
  const taskData = {
    title: video.title,
    media_type: 'video',
    media_id: video.bvid,
    cover: video.pic || video.cover || '',
    desc: video.cid || video.aid ? `CID: ${video.cid || video.aid}` : '',
    meta: video.cid ? { cid: video.cid } : undefined
  }
  
  const response = await apiService.submitTask(taskData)
  return response
}
```

#### 视频不可下载

```python
# 检查视频是否可下载
if video_info.get('state') != 0:
    raise Exception("视频不可下载（可能已删除或审核中）")
```

### 多P视频特定错误

#### 分P创建失败

```typescript
// 创建分P任务时处理失败
for (const page of pages) {
  try {
    const response = await apiService.submitTask(taskData)
    if (response.success && response.data) {
      taskIds.push(response.data.id)
      addedCount++
    }
  } catch (error) {
    console.error(`添加分集任务失败: ${page.part}`, error)
    // 继续处理下一个分P
  }
}

// 检查是否至少成功创建了一个任务
if (addedCount === 0) {
  throw new Error('所有分集添加失败')
}
```

#### 调度器创建失败

```typescript
const schedulerResponse = await apiService.createScheduler({
  title: video.title,
  task_ids: taskIds,
  folder: folderPath
})

if (!schedulerResponse.success || !schedulerResponse.data) {
  throw new Error(schedulerResponse.message || '创建调度器失败')
}
```

### 图文特定错误

#### 图文获取失败

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/services/bilibili.py

async def get_opus_details(self, opus_id: str, sessdata: str = "") -> Dict:
    """获取图文详情"""
    try:
        response = await async_client.get(
            f"https://www.bilibili.com/opus/{opus_id}",
            follow_redirects=True
        )
        
        html_text = response.text
        
        # 解析HTML
        # ...
        
        return {
            "success": True,
            "data": opus_data
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"获取图文详情异常: {str(e)}"
        }
```

#### 图片下载失败

```python
# 下载图片时处理失败
for idx, image_url in enumerate(opus_data.get('image_urls', [])):
    try:
        filename = f"image_{idx+1:03d}.jpg"
        output_file = images_dir / filename
        
        success = await self._download_image(image_url, output_file)
        
        if not success:
            logger.warning(f"图片下载失败: {image_url}")
    except Exception as e:
        logger.error(f"图片下载异常: {e}")
        # 继续下载下一张图片
```

---

## 未来扩展

### 新媒体类型支持

#### 扩展步骤

1. **定义媒体类型**
   ```python
   # 在 MediaType 枚举中添加新类型
   class MediaType(str, enum.Enum):
       # ... 现有类型
       NEW_TYPE = "new_type"
   ```

2. **实现数据获取**
   ```python
   # 在 BilibiliService 中添加获取方法
   async def get_new_type_details(self, media_id: str, sessdata: str = "") -> Dict:
       """获取新类型详情"""
       pass
   ```

3. **实现任务准备**
   ```python
   # 在 TaskService 中添加准备方法
   async def _prepare_new_type(self):
       """准备新类型任务"""
       pass
   ```

4. **实现任务执行**
   ```python
   # 在 TaskService 中添加执行方法
   async def _execute_new_type(self, temp_dir: Path, output_dir: Path):
       """执行新类型任务"""
       pass
   ```

5. **更新链接解析**
   ```python
   # 在链接解析器中添加识别规则
   MEDIA_TYPE_PATTERNS = {
       # ... 现有规则
       r'^nt\d+$': MediaType.NEW_TYPE,  # 新类型识别规则
   }
   ```

### 插件化架构

#### 任务处理器接口

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/services/queue/handlers/base.py

class TaskHandler(ABC):
    """任务处理器基类"""
    
    @abstractmethod
    async def prepare(self, task: Task) -> Dict:
        """准备任务"""
        pass
    
    @abstractmethod
    async def execute(self, task: Task, temp_dir: Path, output_dir: Path):
        """执行任务"""
        pass
    
    @abstractmethod
    async def cleanup(self, task: Task, temp_dir: Path):
        """清理任务"""
        pass
```

#### 视频任务处理器

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/services/queue/handlers/video.py

class VideoTaskHandler(TaskHandler):
    """视频任务处理器"""
    
    async def prepare(self, task: Task) -> Dict:
        """准备视频任务"""
        bilibili_service = BilibiliService()
        await bilibili_service.init()
        
        result = await bilibili_service.get_video_info(task.media_id)
        
        if not result.get('success'):
            raise Exception(result.get('message', '获取视频信息失败'))
        
        video_info = result['data']
        
        return {
            'subtasks': self._create_subtasks(video_info),
            'meta': video_info
        }
    
    async def execute(self, task: Task, temp_dir: Path, output_dir: Path):
        """执行视频任务"""
        # 视频下载逻辑
        pass
```

#### 任务处理器注册

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/services/queue/registry.py

class TaskHandlerRegistry:
    """任务处理器注册表"""
    
    _handlers: Dict[str, TaskHandler] = {}
    
    @classmethod
    def register(cls, media_type: str, handler: TaskHandler):
        """注册任务处理器"""
        cls._handlers[media_type] = handler
    
    @classmethod
    def get(cls, media_type: str) -> TaskHandler:
        """获取任务处理器"""
        handler = cls._handlers.get(media_type)
        
        if not handler:
            raise Exception(f"未找到媒体类型 {media_type} 的处理器")
        
        return handler

# 注册处理器
TaskHandlerRegistry.register('video', VideoTaskHandler())
TaskHandlerRegistry.register('opus', OpusTaskHandler())
```

### 配置化处理

#### 媒体类型配置

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/config/media_types.py

MEDIA_TYPE_CONFIGS = {
    'video': {
        'name': '视频',
        'icon': 'video',
        'supports_multi_part': True,
        'download_subtitles': True,
        'download_cover': True,
        'download_avatar': True,
        'generate_nfo': True,
        'file_extensions': ['.mp4', '.mkv', '.flv']
    },
    'opus': {
        'name': '图文',
        'icon': 'image',
        'supports_multi_part': False,
        'download_subtitles': False,
        'download_cover': True,
        'download_avatar': True,
        'generate_nfo': True,
        'file_extensions': ['.jpg', '.png', '.md']
    },
    'bangumi': {
        'name': '番剧',
        'icon': 'film',
        'supports_multi_part': True,
        'download_subtitles': True,
        'download_cover': True,
        'download_avatar': True,
        'generate_nfo': True,
        'file_extensions': ['.mp4', '.mkv']
    }
}
```

#### 动态加载配置

```python
# 加载媒体类型配置
def get_media_type_config(media_type: str) -> Dict:
    """获取媒体类型配置"""
    return MEDIA_TYPE_CONFIGS.get(media_type, {})

# 检查是否支持某功能
def supports_feature(media_type: str, feature: str) -> bool:
    """检查媒体类型是否支持某功能"""
    config = get_media_type_config(media_type)
    return config.get(feature, False)
```

---

## 总结

PiliNote 的多类型媒体支持系统具有以下特点：

1. **灵活性**
   - 支持多种媒体类型
   - 可扩展的架构设计
   - 统一的任务处理流程

2. **健壮性**
   - 完善的错误处理机制
   - 降级处理策略
   - 任务状态追踪

3. **性能**
   - 并发下载控制
   - 缓存机制
   - 文件大小优化

4. **用户体验**
   - 直观的下载状态展示
   - 批量操作支持
   - 统一的文件组织结构

5. **可维护性**
   - 清晰的代码结构
   - 完善的日志记录
   - 配置化处理

通过本文档，开发人员可以深入了解 PiliNote 的多类型媒体支持机制，并根据需要进行扩展和维护。
