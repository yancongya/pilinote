# 首页链接解析功能

## 概述

首页链接解析功能允许用户通过输入 Bilibili 链接，直接解析视频信息并添加到下载队列。

## 功能位置

- 前端页面：`apps/web/src/pages/components/HomeContent.tsx`
- 后端API：`apps/api/src/routers/download.py` (`/api/queue/parse`)
- 链接解析工具：`apps/api/src/utils/bilibili_utils.py`

## 支持的链接格式

### ID 格式

| 类型 | 示例 | 解析结果 |
|------|------|---------|
| BV号 | `BV1xx411c7mD` | video |
| AV号 | `av12345678` | video |
| 番剧EP | `ep123456` | bangumi |
| 番剧SS | `ss123456` | bangumi |
| 番剧MD | `md123456` | bangumi |
| 音乐 | `au123456` | music |
| 歌单 | `am123456` | music_list |
| 图文 | `cv123456` | opus |
| 图文合集 | `rl123456` | opus_list |

### URL 格式

| 类型 | 示例 |
|------|------|
| 视频BV | `https://www.bilibili.com/video/BV1xx411c7mD` |
| 视频AV | `https://www.bilibili.com/video/av12345678` |
| 短链接 | `https://b23.tv/xxxxxx` |
| 用户空间 | `https://space.bilibili.com/12345678/video` |
| 收藏夹 | `https://space.bilibili.com/12345678/favlist?fid=9876543` |

## 数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│                        前端                                    │
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐  │
│  │  URL 输入   │────▶│ handleParse │────▶│   显示结果   │  │
│  │            │     │    Url()     │     │              │  │
│  └──────────────┘     └──────┬───────┘     └──────────────┘  │
│                                │                                │
│                         ┌──────▼───────┐                     │
│                         │ apiService   │                     │
│                         │ parseDownload │                     │
│                         │    Url()     │                     │
│                         └──────┬───────┘                     │
└────────────────────────────────┼──────────────────────────────┘
                                 │
                    POST /api/queue/parse
                                 │
┌────────────────────────────────▼──────────────────────────────┐
│                        后端                                    │
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐  │
│  │ /queue/parse│────▶│ LinkParser  │────▶│ BilibiliAPI │  │
│  │   路由      │     │             │     │   获取详情   │  │
│  └──────────────┘     └──────┬───────┘     └──────────────┘  │
│                               │                                │
│                        ┌──────▼───────┐                     │
│                        │ bilibili_    │                     │
│                        │   utils.py   │                     │
│                        └─────────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

## 前端实现

### 组件：HomeContent.tsx

```typescript
interface VideoInfo {
  bvid: string
  aid: number
  title: string
  desc: string
  pic: string
  duration: number
  owner: { mid: number; name: string; face: string }
  stat: { view: number; danmaku: number; reply: number; like: number; coin: number; favorite: number; share: number }
}

interface ParseResponse {
  success: boolean
  data?: {
    video: VideoInfo
    download_options: {
      multi_part: boolean
      pages?: VideoPage[]
    }
  }
  message?: string
}

// 解析链接
const handleParseUrl = async () => {
  const response = await apiService.parseDownloadUrl(urlInput)
  if (response.success) {
    setParseData(response)
    // 默认选中所有分P
    if (response.data.download_options.multi_part) {
      setSelectedPages(new Set(pages.map(p => p.page)))
    }
  }
}

// 添加下载
const handleDownload = async () => {
  // 从设置中获取默认质量
  const defaultQuality = settings?.download?.video?.default_quality || 64
  
  for (const pageNum of selectedPages) {
    await apiService.addToDownloadQueue({
      bvid: video.bvid,
      quality: defaultQuality,
      // ...
    })
  }
}
```

### 状态管理

- **useAuthStore**: 获取用户 sessdata
- **useSettingsStore**: 获取下载设置（默认质量、元数据选项）
- **useDownloadStore**: 下载队列管理

## 后端实现

### 路由：download.py

```python
@router.post("/parse")
async def parse_link(request: ParseLinkRequest):
    # 1. 解析链接
    parsed = link_parser.parse_id(request.url)
    
    # 2. 根据类型获取视频信息
    if parsed["type"] == MediaType.VIDEO:
        # 获取视频详情
        video_info = await bilibili_service.get_video_info(...)
    
    # 3. 返回解析结果
    return ParseLinkResponse(
        success=True,
        data={
            "video": video_info,
            "download_options": {...}
        }
    )
```

### 链接解析器：bilibili_utils.py

```python
class LinkParser:
    """支持12种链接类型"""
    
    def parse_id(self, input_str: str) -> Dict:
        """
        返回: {
            "id": str | int,
            "type": MediaType,
            "target": int | None,
            "original": str
        }
        """
        
        # 1. 处理 ID 格式 (av/BV/ep/ss/md/au/am/cv/rl)
        # 2. 处理 URL 格式
        # 3. 处理短链接 (b23.tv)
```

## API 详情

### 解析链接

```
POST /api/queue/parse
Content-Type: application/json

Request:
{
    "url": "BV1xx411c7mD"
}

Response:
{
    "success": true,
    "data": {
        "video": {
            "bvid": "BV1xx411c7mD",
            "aid": 170001,
            "title": "视频标题",
            "pic": "https://i0.hdslb.com/...",
            "duration": 300,
            "owner": { "mid": 123456, "name": "UP主", "face": "..." },
            "stat": { "view": 10000, "like": 500 }
        },
        "download_options": {
            "multi_part": true,
            "pages": [
                { "page": 1, "cid": 123456, "part": "P1", "duration": 300 }
            ]
        }
    }
}
```

### 添加下载

```
POST /api/queue/add
Content-Type: application/json

Request:
{
    "bvid": "BV1xx411c7mD",
    "title": "视频标题",
    "cid": 123456,
    "aid": 170001,
    "quality": 64,
    "output_format": "mp4"
}
```

## 测试

### 单元测试

```bash
# 后端链接解析测试
python -c "
from apps.api.src.utils.bilibili_utils import LinkParser
parser = LinkParser()

# 测试各种链接
parser.parse_id('BV1xx411c7mD')  # video
parser.parse_id('av12345678')       # video
parser.parse_id('ep123456')         # bangumi
"
```

### Playwright 测试

```bash
# 运行前端测试
npx playwright test tests/home.spec.ts

# 运行链接解析测试
npx playwright test tests/link-parser.spec.ts
```

## 相关设置

### 下载设置 (settings)

| 配置项 | 说明 | 默认值 |
|--------|------|-------|
| video.default_quality | 默认视频质量 | 64 (720P) |
| video.codec | 视频编码 | avc |
| video.output_format | 输出格式 | mp4 |
| metadata.enable_subtitle | 下载字幕 | true |
| metadata.enable_nfo | 生成 NFO | true |
| metadata.enable_cover | 下载封面 | true |

## 常见问题

### 1. 解析失败

**原因**: 链接格式不正确
**解决**: 检查链接格式是否支持

### 2. 短链接解析失败

**原因**: 网络问题或短链接已失效
**解决**: 使用完整链接

### 3. 视频信息获取失败

**原因**: Cookie 失效或账号未登录
**解决**: 重新登录获取有效的 SESSDATA

---

## 关联文档

- [download/queue.md](../download/queue.md) - 下载队列
- [settings/download.md](../settings/download.md) - 下载设置
- [api/implementation.md](../api/implementation.md) - 后端实现

---

[返回上级](./README.md)