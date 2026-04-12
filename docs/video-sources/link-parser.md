# 首页链接解析功能

## 概述

首页链接解析功能允许用户通过输入 Bilibili 链接，直接解析视频信息并添加到下载队列。

## 功能位置

- 前端页面：`apps/web/src/pages/components/HomeContent.tsx`
- 前端API：`apps/web/src/services/api.ts` (`parseDownloadUrl`)
- 后端API：`apps/api/src/routers/download.py` (`/api/download/parse`)
- 链接解析工具：`apps/api/src/utils/bilibili_utils.py` (`LinkParser`)

## 智能解析

支持多种输入格式自动识别：

| 输入方式 | 示例 | 说明 |
|----------|------|------|
| 纯ID | `BV1xx411c7mD` | 直接识别类型 |
| 纯ID | `av12345678` | AV号转BV号 |
| 纯ID | `ep123456` | 番剧ID |
| 完整URL | `https://www.bilibili.com/video/BVxxx` | 从URL提取ID |
| 短链接 | `https://b23.tv/xxx` | 解析重定向 |
| 混合输入 | `BVxxx ...` | 自动提取第一个有效ID |
| 短链接 | `b23.tv/xxx` | 自动解析重定向 |
| m站链接 | `m.bilibili.com/opus/xxx` | 自动解析重定向 |

## 支持的链接格式

### 已支持的链接格式

| 类型 | 示例 | 状态 | 说明 |
|------|------|------|------|
| **BV号** | `BV1xx411c7mD` | ✅ | |
| **AV号** | `av12345678` | ✅ | |
| **视频BV-URL** | `https://www.bilibili.com/video/BV1xx411c7mD` | ✅ | |
| **视频AV-URL** | `https://www.bilibili.com/video/av12345678` | ✅ | |
| **番剧EP** | `ep123456` | ✅ | |
| **番剧SS** | `ss123456` | ✅ | |
| **番剧MD** | `md123456` | ✅ | |
| **图文** | `cv123456` | ✅ | 需要登录或Cookie |
| **图文m站** | `m.bilibili.com/opus/xxx` | ✅ | 智能解析重定向 |
| 音乐 | `au123456` | ⚠️ | 需要有效音频ID |
| 歌单 | `am123456` | ⚠️ | 需要有效歌单ID |
| 图文合集 | `rl123456` | ⚠️ | 需要登录 |
| 短链接 | `b23.tv/xxx` | ✅ | 智能解析重定向 |
| 用户空间 | `space.bilibili.com/xxx/video` | ⚠️ | 需要登录，可能返回412 |
| 收藏夹 | `space.bilibili.com/xxx/favlist` | ⚠️ | 需要登录 |

## 解析流程

```
用户输入
    │
    ▼
LinkParser.parse_id()
    │
    ├── 1. 正则匹配纯ID (av/BV/ep/ss/md/au/am/cv/rl)
    │   └── 直接返回类型
    │
    ├── 2. 提取URL (bilibili.com/b23.tv)
    │   └── 从路径解析ID
    │
    └── 3. 短链接重定向
        ├── 获取最终URL后提取ID
        ├── 设置超时 (10秒)
        └── 防止无限递归，直接返回解析的ID
    │
    ▼
返回: {id, type, original}
```

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
// 从 AuthStore 获取用户信息（包括 sessdata）
const { user } = useAuthStore()
const sessdata = user?.sessdata

// 从设置中获取默认质量
const defaultQuality = settings?.download?.video?.default_quality || 64

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
        #    - 超时设置: 10秒
        #    - 防止无限递归，直接返回解析的 ID
        #    - 错误处理: 抛出详细错误信息
        ```

### 短链接解析实现

```python
# b23.tv 短链接处理
if host == 'b23.tv':
    try:
        import httpx
        response = httpx.get(parsed_url, follow_redirects=True, timeout=10)
        final_url = str(response.url)
        
        # 防止无限递归：直接提取 B 站视频 ID
        bvid_match = re.search(r'/(BV[\w]+)', final_url)
        av_match = re.search(r'/av(\d+)', final_url)
        
        if bvid_match:
            return {
                "id": bvid_match.group(1),
                "type": MediaType.VIDEO,
                "target": None,
                "original": url
            }
        elif av_match:
            return {
                "id": f"av{av_match.group(1)}",
                "type": MediaType.VIDEO,
                "target": None,
                "original": url
            }
        
        raise ValueError(f'短链接解析失败: {final_url}')
    except Exception as e:
        raise ValueError(f'短链接解析失败: {e}')
```

### 图文 (Opus) 解析实现

图文解析使用 HTML 解析方法，从页面 `__INITIAL_STATE__` 中提取数据：

```python
async def get_opus_details(self, opus_id: str, sessdata: str = "") -> Dict:
    """获取图文详情（使用HTML解析方法）"""
    
    # 1. 访问图文页面
    response = await client.get(
        f"https://www.bilibili.com/opus/{opus_id}",
        headers=headers
    )
    
    # 2. 从HTML中提取__INITIAL_STATE__数据
    patterns = [
        r'__INITIAL_STATE__\s*=\s*({.*?});',
        r'window\.__INITIAL_STATE__\s*=\s*({.*?});',
    ]
    
    # 3. 解析JSON数据提取模块
    modules = data.get("detail", {}).get("modules", [])
    title_module = next((m for m in modules if m.get("module_type") == "MODULE_TYPE_TITLE"), {})
    author_module = next((m for m in modules if m.get("module_type") == "MODULE_TYPE_AUTHOR"), {})
    stat_module = next((m for m in modules if m.get("module_type") == "MODULE_TYPE_STAT"), {})
    content_module = next((m for m in modules if m.get("module_type") == "MODULE_TYPE_CONTENT"), {})
    
    # 4. 提取返回数据
    return {
        "success": True,
        "data": {
            "id": data.get("id"),
            "title": title_module.get("module_title", {}).get("title", ""),
            "author": author_module.get("module_author", {}),
            "stat": stat_module.get("module_stat", {}),
            "paragraphs": content_module.get("module_content", {}).get("paragraphs", []),
            "image_urls": [pic.get("url") for pic in pics],
            "raw_data": data
        }
    }
```

#### 图文数据结构

| 字段 | 说明 |
|------|------|
| `title` | 图文标题 |
| `author` | 作者信息 {mid, name, avatar} |
| `stat` | 统计数据 {like, reply, forward, favorite, coin} |
| `paragraphs` | 内容段落（文本/图片） |
| `image_urls` | 所有图片URL列表 |

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

### 图文解析响应

```
POST /api/download/parse
Content-Type: application/json

Request:
{
    "url": "cv12345678"
}

Response:
{
    "success": true,
    "data": {
        "media_type": "opus",
        "video": {
            "bvid": "",
            "aid": 12345678,
            "title": "图文标题",
            "pic": "https://i0.hdslb.com/xxx.jpg",
            "pubdate": 1700000000,
            "owner": { "mid": 123456, "name": "作者名", "face": "https://..." },
            "stat": { "like": 100, "reply": 50, "share": 30, "favorite": 20, "coin": 10 }
        },
        "download_options": {
            "multi_part": false,
            "pages": []
        },
        "opus_info": {
            "title": "图文标题",
            "author": "作者名",
            "author_avatar": "https://...",
            "mid": 123456,
            "stat": { "like": {"count": 100}, "comment": {"count": 50}, "forward": {"count": 30} },
            "paragraphs": [
                { "para_type": 1, "text": {"nodes": [{"word": {"words": "文本内容"}}]}},
                { "para_type": 2, "pic": {"pics": [{"url": "https://..."}]}}
            ],
            "image_urls": ["https://...", "https://..."]
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

**原因**: 网络超时（超过10秒）或短链接已失效
**解决**: 
- 检查网络连接
- 使用完整链接
- 错误信息会显示具体失败原因

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