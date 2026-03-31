# 视频相关API文档

## 收藏夹相关API

### 获取收藏夹列表
```
GET /x/v3/fav/folder/created/list
```

**参数**:
- `pn`: 页码
- `ps`: 页面大小
- `up_mid`: UP主ID（可选）

**返回**: 收藏夹列表（id, title, cover, media_count等）

### 获取收藏夹详情
```
GET /x/v3/fav/resource/list
```

**参数**:
- `media_id`: 收藏夹ID
- `pn`: 页码
- `ps`: 页面大小
- `keyword`: 关键词筛选
- `order`: 排序方式（view/mtime/pubtime）
- `type`: 类型筛选
- `tid`: 分类筛选
- `platform`: 平台

**返回**: 视频列表（bvid, title, cover, duration, view, danmaku等）

## 稍后再看API

### 获取稍后再看列表
```
GET /x/v2/history/toview
```

**返回**: 稍后再看视频列表

### 添加到稍后再看
```
POST /x/v2/history/toview/add
```

**参数**:
- `bvid`: 视频BV号

### 从稍后再看删除
```
POST /x/v2/history/toview/del
```

**参数**:
- `bvid`: 视频BV号

### 清空稍后再看
```
POST /x/v2/history/toview/clear
```

## 视频信息API

### 视频详情
```
GET /x/web-interface/view
```

**参数**:
- `bvid`: 视频BV号
- `aid`: 视频AID

**返回**: 完整视频信息（标题、封面、UP主、统计数据、分P信息等）

**注意**: 由于B站加强反爬虫机制，此接口可能返回412错误

### 视频播放地址
```
GET /x/player/wbi/playurl
```

**参数**:
- `bvid`: 视频BV号
- `cid`: 视频CID
- `qn`: 画质
- `fnval`: 格式值
- `fnver`: 格式版本
- `fourk`: 是否4K

**返回**: 视频播放地址（多个清晰度）

### 字幕列表
```
GET /x/player/wbi/v2
```

**参数**:
- `aid`: 视频AID
- `cid`: 视频CID

**返回**: 播放器信息，包含字幕列表

**字幕数据结构**:
```typescript
{
  "subtitle": {
    "subtitles": [
      {
        "id": 123456,
        "lan": "zh-CN",
        "lan_doc": "中文（中国）",
        "subtitle_url": "//i0.hdslb.com/bfs/subtitle/...",
        "author": {
          "mid": 123456,
          "name": "UP主名称"
        }
      }
    ]
  }
}
```

**AI字幕**: 语言代码为 `ai-zh`（中文AI）或 `ai-en`（英文AI）

**需要WBI签名**: 此接口需要WBI签名才能正常访问

### 弹幕API
```
GET /x/v1/dm/list.so
```

**参数**:
- `oid`: 视频OID

**返回**: 弹幕数据（XML格式）

## 统计信息获取（薯片数据）

### 统一统计信息结构
所有视频资源的统计信息都包含以下7项数据：
```typescript
interface MediaStats {
  play: number;      // 播放量
  danmaku: number;   // 弹幕数
  reply: number;     // 评论数
  like: number;      // 点赞数
  coin: number;      // 投币数
  favorite: number;  // 收藏数
  share: number;     // 转发数
}
```

### 统计信息获取方式

#### 1. HTML解析方法（推荐）
**适用场景**: 视频详情获取
**优势**: 绕过API限制，获取完整7项统计信息

#### 2. API方法（备用）
**适用场景**: 番剧、课程等特殊类型
**注意**: 可能受到B站API限制

#### 3. 收藏夹API方法
**适用场景**: 收藏夹列表
**数据来源**: 收藏夹详情API的`cnt_info`字段

## 媒体类型支持

系统支持以下12种媒体类型：
- `VIDEO` - 普通视频
- `BANGUMI` - 番剧
- `MUSIC` - 音乐
- `MUSIC_LIST` - 歌单
- `LESSON` - 课程
- `WATCH_LATER` - 稍后再看
- `FAVORITE` - 收藏夹
- `OPUS` - 图文
- `OPUS_LIST` - 图文合集
- `USER_VIDEO` - 用户视频
- `USER_OPUS` - 用户图文
- `USER_AUDIO` - 用户音频

## 链接识别功能

### ID格式识别
直接支持以下ID格式：
- `av12345678` - 视频AV号
- `BV1xx411c7mh` - 视频BV号
- `ep12345` - 番剧分集
- `ss12345` - 番剧季/课程
- `md12345` - 番剧
- `au12345` - 音乐
- `am12345` - 歌单
- `cv12345` - 图文
- `rl12345` - 图文合集

### URL格式识别
支持完整的B站URL格式：
- 视频URL: `https://www.bilibili.com/video/BV1xx411c7mh`
- 番剧URL: `https://www.bilibili.com/bangumi/play/ep12345`
- 稍后再看: `https://www.bilibili.com/watchlater`
- 收藏夹: `https://space.bilibili.com/123456/favlist?fid=789`
- 用户空间: `https://space.bilibili.com/123456/video`
- 短链接: `https://b23.tv/BV1xx411c7mh`

### 特殊处理
- **短链接**: 自动重定向获取真实URL
- **BV/AV转换**: 自动支持BV号和AV号的相互识别
- **路径简化**: 支持无协议前缀的链接

## 后端API端点

### 收藏夹模块 (`/api/favorites`)
- `GET /api/favorites/folders` - 获取收藏夹列表
- `GET /api/favorites/folders/{folder_id}` - 获取收藏夹详情

### 稍后再看模块 (`/api/watchlater`)
- `GET /api/watchlater/list` - 获取稍后再看列表

### 视频模块 (`/api/video`)
- `GET /api/video/{video_id}` - 获取视频详情

## 数据处理

### MediaDataProcessor类
**功能**: 统一处理所有媒体类型的数据获取
**位置**: `apps/api/src/services/media_processor.py`

**核心方法**:
```python
class MediaDataProcessor:
    async def get_media_info(
        self, 
        media_id: str, 
        media_type: MediaType,
        sessdata: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """统一的媒体数据获取接口"""
        if media_type == MediaType.VIDEO:
            return await self._process_video(media_id, sessdata)
        elif media_type == MediaType.BANGUMI:
            return await self._process_bangumi(media_id, sessdata)
        # ... 其他媒体类型
```

### 数据结构
```python
class MediaStats(BaseModel):
    """媒体统计信息 - 统一的7项统计数据"""
    play: Optional[int] = Field(None, description="播放量")
    danmaku: Optional[int] = Field(None, description="弹幕数")
    reply: Optional[int] = Field(None, description="评论数")
    like: Optional[int] = Field(None, description="点赞数")
    coin: Optional[int] = Field(None, description="投币数")
    favorite: Optional[int] = Field(None, description="收藏数")
    share: Optional[int] = Field(None, description="转发数")

class MediaInfo(BaseModel):
    """媒体信息容器 - 统一的媒体数据结构"""
    type: MediaType = Field(..., description="媒体类型")
    id: str = Field(..., description="媒体ID")
    pn: bool = Field(False, description="是否支持分页")
    nfo: MediaNfo = Field(..., description="媒体元数据")
    list: List[MediaItem] = Field(default_factory=list, description="媒体项目列表")
```

## 反爬虫绕过技术

### HTML解析优势
- ✅ 绕过API反爬虫机制
- ✅ 获取完整的7项统计信息
- ✅ 包含视频元数据和UP主信息
- ✅ 支持分P视频信息
- ✅ 稳定性高，不容易被限制

### 请求头优化
```python
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": f"https://www.bilibili.com/video/{bvid}",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "Origin": "https://www.bilibili.com"
}
```

## 前端统计信息显示

### 显示逻辑
```typescript
// 所有统计信息都显示，即使数值为0
<div className="video-card-stats">
  <span className="stat-item" title="播放量">
    <Eye />
    {views}
  </span>
  <span className="stat-item" title="弹幕数">
    <MessageSquare />
    {danmaku}
  </span>
  <!-- 其他统计项 -->
</div>
```

### 数据格式化
```typescript
// 数字格式化（万级显示）
const formatNumber = (num: number): string => {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`
  }
  return num.toString()
}
```

## 测试工具

### 收藏夹列表测试
```bash
curl "http://localhost:8000/api/favorites/folders?sessdata=YOUR_SESSDATA&up_mid=YOUR_MID"
```

### 视频详情测试
```bash
curl "http://localhost:8000/api/video/BV1xx411c7mD"
```

### 链接解析测试
```bash
curl -X POST http://localhost:8000/api/download/parse \
  -H "Content-Type: application/json" \
  -d '{"url":"BV1xx411c7mh"}'
```

## 更新日志

### 2026-03-30
- ✅ 扩展链接识别功能：从4种类型扩展到12种媒体类型
- ✅ 完整复刻BiliTools链接识别功能
- ✅ 实现BV/AV双向转换算法
- ✅ 支持短链接自动重定向
- ✅ 支持番剧/课程的完整信息解析
- ✅ 支持用户视频/图文/音频列表
- ✅ 实现HTML页面数据提取绕过API限制
- ✅ 统一7项统计数据获取
- ✅ 解决B站API 412 Precondition Failed错误