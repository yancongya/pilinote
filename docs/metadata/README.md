# 元数据文档

## 概述

PiliNote使用多种元数据格式来存储和管理视频信息，确保数据的完整性和可移植性。

## 文档列表

- [NFO文件格式](./nfo-format.md) - NFO文件结构和字段说明
- [评分算法](./rating-algorithm.md) - 视频评分计算方法
- [标签系统](./tag-system.md) - 视频标签分类和管理

## 元数据类型

### NFO文件

NFO（Information）文件是PiliNote的主要元数据格式，采用XML结构，包含：

- **基本信息**：标题、简介、发布日期等
- **UP主信息**：UP主名称、头像等
- **统计数据**：播放量、点赞数、投币数等
- **评论数据**：置顶评论和热门评论
- **自定义字段**：BVID、AID等扩展信息

### JSON格式

JSON格式用于API响应和内部数据交换：

- **API响应**：统一的API响应格式
- **配置文件**：应用配置和设置
- **缓存数据**：临时数据缓存

## 数据流

```
B站API → 数据提取 → NFO生成 → 本地存储 → 前端显示
    ↓
统计更新 → 评论同步 → 数据刷新 → 实时更新
```

## 前端消费方式

### 评论显示

- 视频详情页通过 `/api/video/{bvid}` 获取评论数据
- 后端优先从本地 NFO 读取 `<comments>` 节点
- 前端将 `data.comments` 渲染为“热门评论”区域

### 本地视频播放

- 视频详情页通过 `/api/video-library/playback/{bvid}` 获取本地可播放文件映射
- 点击封面后，前端使用 `/api/library/video?file_path=...` 作为 `<video>` 播放地址
- 多 P 视频优先按 `cid` 匹配本地文件，避免播错分P

## 相关文档

- [评论数据提取](../download/comment-extraction.md)
- [本地视频库API](../api/library-api.md)
- [视频详情页组件](../components/video-detail-page.md)
- [后端架构](../architecture/backend-architecture.md)

---

**文档版本**: 1.0
**最后更新**: 2026-04-17
**维护者**: PiliNote Team
