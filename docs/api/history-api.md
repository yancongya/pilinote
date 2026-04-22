# 观看历史 API 文档

## 概述

观看历史 API 提供了获取用户在 B 站的观看历史记录的接口，支持分页、搜索、排序等功能，帮助用户回顾和管理观看过的视频。

### 认证方式

所有观看历史 API 都需要用户认证，通过 Cookie 中的 `SESSDATA` 进行身份验证。

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
http://127.0.0.1:8000
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

### 1. 获取观看历史列表

**端点**：`GET /api/history/list`

**描述**：获取用户的观看历史记录，支持分页、搜索和排序。

#### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `pn` | int | 否 | 1 | 页码，从 1 开始 |
| `ps` | int | 否 | 20 | 每页数量，最大 100 |
| `keyword` | string | 否 | - | 搜索关键词，匹配视频标题 |
| `order` | string | 否 | `default` | 排序方式：`default`（默认）、`view`（按播放量）、`pubtime`（按发布时间）、`view_time`（按观看时间） |
| `sort_direction` | string | 否 | `desc` | 排序方向：`desc`（降序）、`asc`（升序） |

#### 请求示例

```bash
curl -X GET "http://localhost:8000/api/history/list?pn=1&ps=20" \
  -H "Cookie: SESSDATA=your_sessdata_here"
```

**搜索示例**：
```bash
# 搜索包含"技术"关键词的视频
curl -X GET "http://localhost:8000/api/history/list?keyword=技术&pn=1&ps=20" \
  -H "Cookie: SESSDATA=your_sessdata_here"
```

**排序示例**：
```bash
# 按播放量降序排列
curl -X GET "http://localhost:8000/api/history/list?order=view&sort_direction=desc&pn=1&ps=20" \
  -H "Cookie: SESSDATA=your_sessdata_here"

# 按发布时间升序排列
curl -X GET "http://localhost:8000/api/history/list?order=pubtime&sort_direction=asc&pn=1&ps=20" \
  -H "Cookie: SESSDATA=your_sessdata_here"

# 按观看时间降序排列
curl -X GET "http://localhost:8000/api/history/list?order=view_time&sort_direction=desc&pn=1&ps=20" \
  -H "Cookie: SESSDATA=your_sessdata_here"
```

**组合示例**：
```bash
# 搜索并按播放量降序排列
curl -X GET "http://localhost:8000/api/history/list?keyword=技术&order=view&sort_direction=desc&pn=1&ps=20" \
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
        "progress": 50,
        "uploader": {
          "name": "UP主名称",
          "mid": 123456789,
          "face": "https://example.com/avatar.jpg"
        },
        "author": "UP主名称",
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
        "view_time": 1640000000,
        "pubtime": 1640000000,
        "cid": 123456789,
        "aid": 987654321,
        "add_time": 1640000000
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
| `progress` | int | 观看进度（百分比，-1 表示未开始或未知） |
| `uploader` | object | UP 主信息 |
| `uploader.name` | string | UP 主名称 |
| `uploader.mid` | int | UP 主 ID |
| `uploader.face` | string | UP 主头像 URL |
| `author` | string | UP 主名称（与 uploader.name 相同） |
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
| `view_time` | int | 观看时间戳（B站原始字段） |
| `pubtime` | int | 视频发布时间戳 |
| `add_time` | int | 观看时间戳（统一字段名，与 view_time 相同） |
| `cid` | int | 视频 CID |
| `aid` | int | 视频 AID |
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

**文件**：`apps/api/src/routers/history.py`

```python
@router.get("/list", response_model=CardListResponse)
async def get_history_list(
    user_sessdata: tuple = Depends(get_current_user_with_sessdata),
    pn: int = Query(1, ge=1, description="页码"),
    ps: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: str = Query("", description="搜索关键词"),
    order: str = Query("default", description="排序方式: default, view, pubtime, view_time"),
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
                elif order == "view_time":
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

### B站 API 说明

**API 端点**：`/x/v2/history`

**请求参数**：
- `view_at`: 观看时间戳（可选）
- `max`: 最大数量（可选）
- `business`: 业务类型（可选）

**注意**：当前实现中，后端调用 B 站 API 时不传递分页参数，获取全部数据后在前端进行分页切片和排序。

**请求示例**：
```bash
GET https://api.bilibili.com/x/v2/history?pn=1&ps=20
```

**响应示例**：
```json
{
  "code": 0,
  "message": "success",
  "data": [
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
      "view_at": 1640000000,
      "pubdate": 1640000000,
      "cid": 123456789,
      "aid": 987654321
    }
  ]
}
```

---

## 数据模型

### HistoryVideo（观看历史视频）

```python
class HistoryVideo(BaseModel):
    id: str
    bvid: str
    title: str
    cover: str
    duration: int
    progress: int
    uploader: UploaderInfo
    stat: VideoStats
    view_at: int
    pubdate: int
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
    duration: int
    uploader: UploaderInfo
    author: str
    stats: CardStats
    progress: int
    add_time: int
    pubtime: int
    cid: int
    aid: int
    # 为了前端兼容，将 stats 字段提升到顶层
    view: int
    danmaku: int
    comment: int
    like: int
    coin: int
    favorite: int
    share: int
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

// 获取观看历史列表
const fetchHistory = async () => {
  const response = await apiService.getHistoryList(1, 20);
  if (response.success) {
    console.log('观看历史列表:', response.data);
  }
};

// 获取观看历史列表（带搜索和排序）
const fetchHistoryWithFilters = async () => {
  const response = await apiService.getHistoryList(
    1,           // 页码
    20,          // 每页数量
    '技术',      // 搜索关键词
    'view',      // 排序方式
    'desc'       // 排序方向
  );
  if (response.success) {
    console.log('观看历史列表:', response.data);
  }
};
```

### 错误处理示例

```typescript
const fetchHistory = async () => {
  try {
    const response = await apiService.getHistoryList(1, 20);
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

观看历史 API 使用 B 站原生 API 直接获取数据，避免 HTML 解析。

### 2. 统一数据转换

使用 `MediaDataTransformer` 进行统一的数据转换，确保数据格式一致性。

### 3. 客户端搜索和排序

搜索和排序在前端完成，减少后端负担。

### 4. 分页加载

支持分页，避免一次性加载大量数据。

---

## 与稍后再看的区别

| 特性 | 观看历史 | 稍后再看 |
|------|----------|----------|
| 数据来源 | `/x/v2/history` | `/x/v2/history/toview` |
| 结构 | 单一列表 | 列表 + 详情 |
| 观看进度 | 支持（百分比） | 支持（秒数） |
| 排序 | 支持 4 种方式 | 支持多种排序 |
| 搜索 | 支持 | 不支持 |
| 数量限制 | 无限制 | 最多 1000 个 |
| 自动记录 | 自动记录所有观看 | 需要手动添加 |

---

## 安全考虑

1. **认证验证**：所有端点都需要有效的 SESSDATA
2. **数据验证**：使用 Pydantic 进行请求和响应数据验证
3. **错误处理**：统一错误处理，避免敏感信息泄露
4. **权限控制**：用户只能访问自己的观看历史数据

---

## 相关文档

- [观看历史页面前端实现](../web/history-page.md)
- [观看历史数据转换](../components/history-data-transformer.md)
- [BilibiliService](../components/bilibili-service.md)
- [API 端点索引](./endpoints.md)
- [历史记录组件](../components/history-list.md)

---

[返回上级](./README.md)
