# 稍后再看 API 文档

## 概述

稍后再看 API 提供了获取和管理 B 站稍后再看列表的接口，用户可以将视频添加到稍后再看，方便后续观看。

### 认证方式

所有稍后再看 API 都需要用户认证，通过 Cookie 中的 `SESSDATA` 进行身份验证。

**注意**：
- 认证方式：仅支持通过 Cookie 传递 SESSDATA
- 不支持通过查询参数传递 SESSDATA
- 未登录时返回 401 Unauthorized

**认证依赖**：`get_current_user_with_sessdata`

```python
# 从 Cookie 获取 SESSDATA
user, sessdata = await get_current_user_with_sessdata(
    db: Session = Depends(get_db)
)
```

### 基础 URL

```
http://localhost:8000
```

### 通用响应格式

所有 API 端点都返回统一的响应格式：

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功",
  "total": 100
}
```

**错误响应**：
```json
{
  "detail": "错误信息"
}
```

---

## 端点列表

#### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `pn` | int | 否 | 1 | 页码，从 1 开始 |
| `ps` | int | 否 | 20 | 每页数量，最大 100 |
| `keyword` | string | 否 | - | 搜索关键词，匹配视频标题 |
| `order` | string | 否 | - | 排序方式：`view`（按播放量）、`pubtime`（按发布时间）、`add_time`（按添加时间） |
| `sort_direction` | string | 否 | `desc` | 排序方向：`desc`（降序）、`asc`（升序） |

#### 请求示例

```bash
curl -X GET "http://localhost:8000/api/watch-later/list?pn=1&ps=20" \
  -H "Cookie: SESSDATA=your_sessdata_here"
```

**搜索示例**：
```bash
# 搜索包含"技术"关键词的视频
curl -X GET "http://localhost:8000/api/watch-later/list?keyword=技术&pn=1&ps=20" \
  -H "Cookie: SESSDATA=your_sessdata_here"
```

**排序示例**：
```bash
# 按播放量降序排列
curl -X GET "http://localhost:8000/api/watch-later/list?order=view&sort_direction=desc&pn=1&ps=20" \
  -H "Cookie: SESSDATA=your_sessdata_here"

# 按发布时间升序排列
curl -X GET "http://localhost:8000/api/watch-later/list?order=pubtime&sort_direction=asc&pn=1&ps=20" \
  -H "Cookie: SESSDATA=your_sessdata_here"

# 按添加时间降序排列
curl -X GET "http://localhost:8000/api/watch-later/list?order=add_time&sort_direction=desc&pn=1&ps=20" \
  -H "Cookie: SESSDATA=your_sessdata_here"
```

**组合示例**：
```bash
# 搜索并按播放量降序排列
curl -X GET "http://localhost:8000/api/watch-later/list?keyword=技术&order=view&sort_direction=desc&pn=1&ps=20" \
  -H "Cookie: SESSDATA=your_sessdata_here"
```

#### 响应示例

**成功响应**（200 OK）：
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 987654321,
        "bvid": "BV1xx411c7mD",
        "title": "视频标题",
        "cover": "https://example.com/cover.jpg",
        "duration": 630,
        "progress": 315,
        "uploader": {
          "name": "UP主名称",
          "mid": 123456789,
          "face": "https://example.com/avatar.jpg"
        },
        "stats": {
          "view": 100000,
          "danmaku": 5000,
          "comment": 2000,
          "like": 5000,
          "coin": 1000,
          "favorite": 2000,
          "share": 500
        },
        "view": 100000,
        "danmaku": 5000,
        "comment": 2000,
        "like": 5000,
        "coin": 1000,
        "favorite": 2000,
        "share": 500,
        "add_time": 1640000000,
        "pubtime": 1640000000,
        "cid": 123456789,
        "aid": 987654321,
        "intro": ""
      }
    ],
    "total": 50,
    "page": 1,
    "page_size": 20
  },
  "total": 50
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 视频 ID（aid） |
| `bvid` | string | B 站视频 ID |
| `title` | string | 视频标题 |
| `cover` | string | 视频封面 URL |
| `duration` | int | 视频时长（秒） |
| `progress` | int | 观看进度（秒） |
| `uploader` | object | UP 主信息 |
| `uploader.name` | string | UP 主名称 |
| `uploader.mid` | int | UP 主 ID |
| `uploader.face` | string | UP 主头像 URL |
| `stats` | object | 统计数据 |
| `stats.view` | int | 播放量 |
| `stats.danmaku` | int | 弹幕数 |
| `stats.comment` | int | 评论数 |
| `stats.like` | int | 点赞数 |
| `stats.coin` | int | 投币数 |
| `stats.favorite` | int | 收藏数 |
| `stats.share` | int | 分享数 |
| `view` | int | 播放量（顶层字段，与 stats.view 重复） |
| `danmaku` | int | 弹幕数（顶层字段，与 stats.danmaku 重复） |
| `comment` | int | 评论数（顶层字段，与 stats.comment 重复） |
| `like` | int | 点赞数（顶层字段，与 stats.like 重复） |
| `coin` | int | 投币数（顶层字段，与 stats.coin 重复） |
| `favorite` | int | 收藏数（顶层字段，与 stats.favorite 重复） |
| `share` | int | 分享数（顶层字段，与 stats.share 重复） |
| `add_time` | int | 添加到稍后再看的时间戳 |
| `pubtime` | int | 视频发布时间戳 |
| `cid` | int | 视频 CID |
| `aid` | int | 视频 AID |
| `intro` | string | 视频简介 |
| `total` | number | 总数 |
| `page` | number | 当前页码 |
| `page_size` | number | 每页数量 |

#### 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 请求参数错误或 B 站 API 返回错误 |
| 401 | 未登录或 SESSDATA 无效 |
| 500 | 服务器内部错误 |

#### 后端实现

**文件**：`apps/api/src/routers/watchlater.py`

```python
@router.get("/list", response_model=dict)
async def get_watch_later_list(
    user_sessdata: tuple = Depends(get_current_user_with_sessdata),
    pn: int = Query(1, ge=1, description="页码"),
    ps: int = Query(20, ge=1, le=100, description="每页数量")
):
    """获取稍后再看列表"""
    user, sessdata = user_sessdata
    
    service = BilibiliService()
    try:
        # 调用 B 站 API: /x/v2/history/toview
        result = await service.get_watch_later(sessdata)  # 只传递 sessdata
        if result["success"]:
            data = result["data"]
            videos = data.get("list", [])
            
            # 转换为前端需要的格式
            video_list = []
            for video in videos:
                video_list.append({
                    "id": video.get("aid", 0),
                    "bvid": video.get("bvid", ""),
                    "title": video.get("title", ""),
                    "cover": video.get("pic", ""),
                    "duration": video.get("duration", 0),
                    "progress": video.get("progress", 0),
                    "uploader": {
                        "name": video.get("owner", {}).get("name", ""),
                        "mid": video.get("owner", {}).get("mid", 0),
                        "face": video.get("owner", {}).get("face", "")
                    },
                    "stats": video.get("stat", {}),
                    "add_time": video.get("add_time", 0),
                    "pubtime": video.get("pubtime", 0),
                    "cid": video.get("cid", 0),
                    "aid": video.get("aid", 0),
                    "intro": video.get("intro", "")
                })
            
            return {
                "success": True,
                "data": {
                    "list": video_list,
                    "total": data.get("count", 0),
                    "page": pn,
                    "page_size": ps
                },
                "total": data.get("count", 0)
            }
        raise HTTPException(status_code=400, detail=result["message"])
    finally:
        service.close()
```

### B站 API 说明

**API 端点**：`/x/v2/history/toview`

**请求参数**：
- `ps`: 每页数量（默认 20，最大 1000）

**注意**：当前实现中，后端调用 B 站 API 时固定使用 `ps: 1000` 获取全部数据，然后在前端进行分页切片。前端传递的 `pn` 和 `ps` 参数仅影响后端返回的数据切片，不影响 B 站 API 的实际调用。

**请求示例**：
```bash
GET https://api.bilibili.com/x/v2/history/toview?ps=20
```

**响应示例**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [
      {
        "bvid": "BV1xx411c7mD",
        "title": "视频标题",
        "pic": "https://example.com/cover.jpg",
        "duration": 630,
        "progress": 315,
        "owner": {
          "name": "UP主名称",
          "mid": 123456789,
          "face": "https://example.com/avatar.jpg"
        },
        "stat": {
          "view": 100000,
          "danmaku": 5000,
          "comment": 2000,
          "like": 5000,
          "coin": 1000,
          "collect": 2000,
          "share": 500
        },
        "add_time": 1640000000,
        "pubtime": 1640000000,
        "cid": 123456789,
        "aid": 987654321
      }
    ],
    "count": 50
  }
}
```

---

### 2. 获取稍后再看媒体信息（统一接口）

> **注意**：此端点当前不可用（返回 404）。请使用 **1. 获取稍后再看列表** 端点。

**端点**：`GET /api/media/watchlater`

**描述**：获取稍后再看列表，返回统一的媒体卡片格式（计划功能）

#### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `pn` | int | 否 | 1 | 页码，从 1 开始 |
| `ps` | int | 否 | 20 | 每页数量，最大 100 |

#### 请求示例

```bash
curl -X GET "http://localhost:8000/api/media/watchlater?pn=1&ps=20" \
  -H "Cookie: SESSDATA=your_sessdata_here"
```

#### 响应示例

**成功响应**（200 OK）：
```json
{
  "success": true,
  "data": {
    "medias": [
      {
        "id": "BV1xx411c7mD",
        "bvid": "BV1xx411c7mD",
        "title": "视频标题",
        "cover": "https://example.com/cover.jpg",
        "duration": "10:30",
        "uploader": {
          "name": "UP主名称",
          "mid": 123456789,
          "face": "https://example.com/avatar.jpg"
        },
        "stats": {
          "view": 100000,
          "danmaku": 5000,
          "comment": 2000,
          "like": 5000,
          "coin": 1000,
          "favorite": 2000,
          "share": 500
        },
        "pubtime": 1640000000,
        "cid": 123456789,
        "aid": 987654321
      }
    ],
    "page_size": 20,
    "info": {
      "total_count": 50
    }
  },
  "total": 50
}
```

#### 响应字段说明

**medias（媒体列表）**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 视频 ID（bvid） |
| `bvid` | string | B 站视频 ID |
| `title` | string | 视频标题 |
| `cover` | string | 视频封面 URL |
| `duration` | string | 视频时长（格式化） |
| `uploader` | object | UP 主信息 |
| `uploader.name` | string | UP 主名称 |
| `uploader.mid` | int | UP 主 ID |
| `uploader.face` | string | UP 主头像 URL |
| `stats` | object | 统计数据 |
| `stats.view` | int | 播放量 |
| `stats.danmaku` | int | 弹幕数 |
| `stats.comment` | int | 评论数 |
| `stats.like` | int | 点赞数 |
| `stats.coin` | int | 投币数 |
| `stats.favorite` | int | 收藏数 |
| `stats.share` | int | 分享数 |
| `pubtime` | int | 发布时间戳 |
| `cid` | int | 视频 CID |
| `aid` | int | 视频 AID |

#### 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 请求参数错误或 B 站 API 返回错误 |
| 401 | 未登录或 SESSDATA 无效 |
| 500 | 服务器内部错误 |

#### 后端实现

**文件**：`apps/api/src/routers/media.py`

```python
@router.get("/watchlater", response_model=CardListResponse)
async def get_watch_later_media(
    user_sessdata: tuple = Depends(get_current_user_with_sessdata),
    pn: int = Query(1, ge=1, description="页码"),
    ps: int = Query(20, ge=1, le=100, description="每页数量")
):
    """获取稍后再看媒体信息 - 使用统一数据格式"""
    user, sessdata = user_sessdata
    
    service = BilibiliService()
    try:
            result = await service.get_watch_later(sessdata)  # 只传递 sessdata
            
            if result["success"]:
                from src.services.media_data_transformer import transformer
                
                data = result["data"]
                videos = data.get("list", [])
                
                # 使用统一转换器转换数据
                video_list = transformer.transform_watchlater_list(videos)            
            # 转换为字典格式（保持向后兼容）
            list_data = [card.model_dump() for card in video_list]
            
            return CardListResponse(
                success=True,
                data={
                    "medias": list_data,
                    "page_size": ps,
                    "info": {
                        "total_count": data.get("count", 0)
                    }
                },
                total=data.get("count", 0)
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=result.get("message", "获取稍后再看列表失败")
            )
    finally:
        service.close()
```

---

## 数据模型

### WatchLaterVideo（稍后再看视频）

```python
class WatchLaterVideo(BaseModel):
    id: str
    bvid: str
    title: str
    cover: str
    duration: int
    progress: int
    uploader: UploaderInfo
    stat: VideoStats
    add_time: int
    pubtime: int
    cid: int
    aid: int
```

### CardData（统一卡片数据）

```python
class CardData(BaseModel):
    id: str
    bvid: str
    title: str
    cover: str
    duration: str
    uploader: UploaderInfo
    stats: CardStats
    pubtime: int
    cid: int
    aid: int
```

### CardStats（视频统计数据）

```python
class CardStats(BaseModel):
    view: int
    danmaku: int
    comment: int
    like: int
    coin: int
    favorite: int
    share: int
```

### UploaderInfo（UP主信息）

```python
class UploaderInfo(BaseModel):
    name: str
    mid: int
    face: str
```

---

## 使用示例

### 前端调用示例

```typescript
import { apiService } from '../services/api';

// 获取稍后再看列表
const fetchWatchLater = async () => {
  const response = await apiService.getWatchLaterList(1, 20);
  if (response.success) {
    console.log('稍后再看列表:', response.data);
  }
};

// 获取稍后再看媒体信息（统一格式）
const fetchWatchLaterMedia = async () => {
  const response = await apiService.getWatchLaterMedia();
  if (response.success) {
    console.log('稍后再看媒体:', response.data);
  }
};
```

### 错误处理示例

```typescript
const fetchWatchLater = async () => {
  try {
    const response = await apiService.getWatchLaterList(1, 20);
    if (response.success) {
      return response.data;
    } else {
      console.error('API 错误:', response.message);
      return [];
    }
  } catch (error) {
    console.error('网络错误:', error);
    return [];
  }
};
```

---

## 性能优化

### 1. 使用 B 站原生 API

稍后再看 API 使用 B 站原生 API 直接获取数据，避免 HTML 解析。

### 2. 统一数据转换

使用 `MediaDataTransformer` 进行统一的数据转换，确保数据格式一致性。

### 3. 分页加载

支持分页，避免一次性加载大量数据。

---

## 与收藏夹的区别

| 特性 | 稍后再看 | 收藏夹 |
|------|----------|--------|
| 数据来源 | `/x/v2/history/toview` | `/fav/v2/fav/folder/list` |
| 结构 | 单一列表 | 列表 + 详情 |
| 观看进度 | 支持 | 不支持 |
| 排序 | 按添加时间 | 支持多种排序 |
| 搜索 | 不支持 | 支持 |
| 数量限制 | 最多 1000 个 | 无限制 |

---

## 安全考虑

1. **认证验证**：所有端点都需要有效的 SESSDATA
2. **数据验证**：使用 Pydantic 进行请求和响应数据验证
3. **错误处理**：统一错误处理，避免敏感信息泄露
4. **权限控制**：用户只能访问自己的稍后再看数据

---

## 相关文档

- [稍后再看功能概述](../video-sources/watchlater.md)
- [稍后再看页前端实现](../web/watchlater-page.md)
- [稍后再看数据转换](../components/toview-data-transformer.md)
- [BilibiliService](../components/bilibili-service.md)
- [API 端点索引](./endpoints.md)

---

[返回上级](./README.md)