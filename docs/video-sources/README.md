# 视频源

本目录包含各视频源的数据获取与显示文档。

## 文档索引

### 1. 收藏夹
**文件**: [favorites.md](favorites.md)

内容：
- 收藏夹列表获取
- 收藏夹详情获取
- 分页与排序

### 2. 稍后再看
**文件**: [watchlater.md](watchlater.md)

内容：
- 列表获取
- 观看进度

### 3. 链接解析
**文件**: [link-parser.md](link-parser.md)

内容：
- 支持的链接格式（12种）
- 数据流
- 前端实现
- 后端实现
- API 详情
- 测试

---

## 支持的媒体类型

### 视频类型

| 类型 | 示例 | 支持 |
|------|------|------|
| BV号 | `BV1xx411c7mD` | ✅ |
| AV号 | `av12345678` | ✅ |
| 视频URL | `bilibili.com/video/BVxxx` | ✅ |
| 番剧EP/SS/MD | `ep123456` | ✅ |
| 音乐 | `au123456` | ⚠️ API已失效 |
| 短链接 | `b23.tv/xxxxxx` | ⚠️ 需要有效链接 |

### 专栏类型

| 类型 | 示例 | 说明 |
|------|------|------|
| 图文专栏 | `cv123456789` | B站专栏文章，支持图文下载 |
| 图文链接 | `bilibili.com/opus/xxx` | 专栏文章链接 |

> 详细支持列表见 [link-parser.md](link-parser.md)

---

## 详情页支持

| 类型 | 路由 | 组件 | 说明 |
|------|------|------|------|
| 视频 | `/video/:videoId` | VideoDetailPage | 显示视频详情、分P、统计数据 |
| 图文 | `/opus/:opusId` | VideoDetailPage (type="opus") | 显示图文内容、段落、图片 |

---

[返回上级](../README.md)