# 观看历史功能设计文档

**文档版本**: 1.0.0  
**创建日期**: 2026-04-16  
**设计目标**: 添加观看历史功能，显示用户的B站观看记录

---

## 目录

1. [设计目标](#设计目标)
2. [技术方案](#技术方案)
3. [后端API设计](#后端api设计)
4. [前端页面设计](#前端页面设计)
5. [数据转换设计](#数据转换设计)
6. [缓存策略设计](#缓存策略设计)
7. [错误处理和边界情况](#错误处理和边界情况)
8. [测试策略](#测试策略)
9. [实施步骤](#实施步骤)

---

## 设计目标

### 核心目标

1. **显示观看历史** - 展示用户的B站观看记录
2. **完全复用现有架构** - 基于稍后再看的实现，最小化开发成本
3. **支持标准功能** - 分页、搜索、排序、批量下载
4. **性能优化** - 使用缓存机制提升响应速度

### 用户体验目标

- 页面加载时间 < 2秒
- 支持大量历史记录（1000+）
- 与稍后再看页面完全一致的交互体验
- 准确的下载状态显示

---

## 技术方案

### 方案选择

**采用方案A：完全复用稍后再看架构**

理由：
1. 用户明确要求"前端部分和稍后再看收藏页一模一样，完全套用组件"
2. 侧重于后端开发，前端尽量复用
3. 观看历史和稍后再看的数据结构类似（都是视频列表）
4. 快速实现，降低风险

### 架构概述

```
前端: HistoryContent → useVideoList → VideoListContainer
后端: history router → BilibiliService.get_history() → media_data_transformer
数据: B站API /x/v2/history → 标准CardData格式
```

---

## 后端API设计

### API端点

- `GET /api/history/list` - 获取观看历史列表

### 功能特性

- 支持分页（pn, ps参数）
- 支持关键词搜索
- 支持排序（按观看时间、播放量、发布时间）
- 支持升序/降序切换
- 使用B站原生API `/x/v2/history`
- 实现缓存机制（5分钟TTL）

### 请求参数

```python
pn: int = Query(1, ge=1, description="页码")
ps: int = Query(20, ge=1, le=100, description="每页数量")
keyword: str = Query("", description="搜索关键词")
order: str = Query("default", description="排序方式: default, view, pubtime, view_at")
sort_direction: str = Query("desc", description="排序方向: desc, asc")
```

### 响应格式

```python
{
  "success": True,
  "data": {
    "list": [CardData, ...],
    "total": 100,
    "page": 1,
    "page_size": 20
  },
  "total": 100
}
```

### 数据流程

```
前端请求 → history router → BilibiliService.get_history() 
→ media_data_transformer.transform_history_list() 
→ 返回标准化CardData列表
```

### 错误处理

- 用户未登录：返回401错误
- API调用失败：返回500错误并记录日志
- 数据格式错误：返回400错误

---

## 前端页面设计

### 新建文件

- `HistoryContent.tsx` - 观看历史内容组件（与`WatchLaterContent.tsx`结构相同）

### 页面功能

- 调用`apiService.getHistoryList()`获取观看历史
- 完全复用稍后再看的UI和交互逻辑
- 支持分页、搜索、排序
- 支持批量添加到下载队列
- 显示下载状态（使用videoLibraryService）

### 路由集成

- 添加路由：`/history` → `HistoryContent`
- 在导航菜单中添加"观看历史"入口

### 数据流

```
HistoryContent → useVideoList Hook 
→ apiService.getHistoryList()
→ VideoListContainer 展示
```

### 组件复用

完全复用以下组件：
- `VideoListContainer` - 视频列表容器
- `VideoListControls` - 搜索和排序控件
- `VideoListCard` - 单个视频卡片
- `AlertModal` - 提示对话框
- `ConfirmModal` - 确认对话框

---

## 数据转换设计

### 转换器方法

- `media_data_transformer.transform_history_list()` - 转换B站历史记录数据为标准CardData格式

### 转换逻辑

```python
# B站历史记录数据结构：
{
  "list": [
    {
      "history": {
        "bvid": "BV1xx",
        "cid": 123456,
        "view_at": 1649999999,  # 观看时间戳
        "progress": 50,  # 观看进度百分比
        ...
      },
      "stat": {
        "view": 1000,  # 播放量
        ...
      },
      "title": "视频标题",
      "author": "UP主",
      ...
    }
  ]
}

# 转换为CardData格式：
{
  "bvid": "BV1xx",
  "title": "视频标题",
  "author": "UP主",
  "view": 1000,
  "pubtime": 1649999999,
  "pic": "封面URL",
  "add_time": 1649999999,  # 观看时间
  "progress": 50,  # 观看进度
  ...
}
```

### 特殊字段处理

- `add_time`: 使用B站的`view_at`字段（观看时间）
- `progress`: 使用B站的`progress`字段（观看进度百分比）
- 其他字段与稍后再看转换逻辑相同

---

## 缓存策略设计

### 缓存机制

- 使用现有的`video_cache`系统
- 缓存键：`'history'` + 用户标识（sessdata前20位）
- 缓存时长：5分钟
- 缓存失效：用户主动刷新或时间过期

### 缓存优势

- 减少B站API调用频率
- 提升页面加载速度
- 降低服务器压力

### 缓存更新策略

- 首次请求从B站API获取并缓存
- 后续请求优先使用缓存
- 缓存过期后重新获取

### 缓存实现

```python
from src.services.cache.video_cache import video_cache

# 获取缓存
cached_data = video_cache.get('history', user_id=sessdata[:20])
if cached_data:
    return cached_data

# 设置缓存
video_cache.set('history', result, user_id=sessdata[:20])
```

---

## 错误处理和边界情况

### 后端错误处理

- 用户未登录（SESSDATA无效）：返回401错误
- B站API限流：返回503错误，建议用户稍后重试
- 网络超时：返回504错误
- 数据解析失败：返回500错误并记录详细日志
- 空历史记录：返回空列表而不是错误

### 边界情况处理

- 历史记录数量为0：正常显示空状态
- 分页超出范围：返回空列表
- 无效排序参数：使用默认排序
- 关键词过长：限制为100字符

### 前端错误处理

- API请求失败：显示错误提示
- 加载超时：显示加载超时提示
- 网络错误：显示网络错误提示

### 错误提示

使用现有的`AlertModal`组件显示友好的错误信息：
- 401错误："请先登录B站账号"
- 503错误："B站API限流，请稍后重试"
- 504错误："请求超时，请检查网络连接"
- 500错误："服务器错误，请稍后重试"

---

## 测试策略

### 后端测试

- API端点存在性测试：`GET /api/history/list`
- 数据转换测试：B站历史记录格式 → CardData格式
- 缓存机制测试：验证缓存命中和失效
- 错误处理测试：各种异常情况
- 分页和排序测试：验证参数处理

### 前端测试

- 页面渲染测试：HistoryContent正常显示
- 交互功能测试：搜索、排序、分页
- API集成测试：与后端接口正确交互
- 错误处理测试：各种错误情况显示
- 性能测试：大量历史记录加载性能

### 集成测试

- 端到端测试：从用户登录到历史记录显示
- 与下载队列集成：批量添加下载功能
- 与视频库集成：下载状态检查

### Playwright测试

创建测试文件：`tests/history.spec.ts`
- 测试API端点
- 测试页面渲染
- 测试交互功能
- 测试错误处理

---

## 实施步骤

### Phase 1: 后端API开发

1. 在`BilibiliService`中添加`get_history()`方法
2. 创建`history.py` router文件
3. 在`media_data_transformer`中添加`transform_history_list()`方法
4. 实现缓存机制
5. 在`main.py`中注册history路由

### Phase 2: 前端页面开发

1. 创建`HistoryContent.tsx`组件
2. 在`apiService`中添加`getHistoryList()`方法
3. 添加路由配置
4. 在导航菜单中添加入口
5. 添加i18n翻译

### Phase 3: 集成和优化

1. 集成下载队列功能
2. 集成视频库状态检查
3. 优化加载性能
4. 添加错误提示

### Phase 4: 测试

1. 后端API测试
2. 前端页面测试
3. 集成测试
4. 性能测试

---

## 附录

### 相关文件

**后端文件：**
- `apps/api/src/services/bilibili.py` - BilibiliService（添加get_history方法）
- `apps/api/src/routers/history.py` - 历史记录路由（新建）
- `apps/api/src/services/media_data_transformer.py` - 数据转换器（添加transform_history_list方法）
- `apps/api/src/main.py` - 主应用（注册history路由）

**前端文件：**
- `apps/web/src/services/api.ts` - API服务（添加getHistoryList方法）
- `apps/web/src/pages/components/HistoryContent.tsx` - 观看历史内容组件（新建）
- `apps/web/src/App.tsx` - 应用路由（添加/history路由）
- `apps/web/src/components/Navigation.tsx` - 导航菜单（添加观看历史入口）

### API参数说明

**B站API参数：**
- `ps`: 页面大小，设置为1000以获取全部历史记录
- `view_at`: 观看时间戳，用于排序
- `progress`: 观看进度百分比（0-100）

**自定义参数：**
- `keyword`: 搜索关键词，匹配视频标题
- `order`: 排序方式（default, view, pubtime, view_at）
- `sort_direction`: 排序方向（desc, asc）

### 数据映射表

| B站字段 | CardData字段 | 说明 |
|---------|-------------|------|
| history.bvid | bvid | 视频BVID |
| title | title | 视频标题 |
| author.name | author | UP主名称 |
| stat.view | view | 播放量 |
| history.view_at | add_time | 观看时间 |
| pubdate | pubtime | 发布时间 |
| pic | pic | 封面图片URL |
| history.progress | progress | 观看进度百分比 |

---

## 实施状态

### 待完成任务

- [ ] Phase 1: 后端API开发
- [ ] Phase 2: 前端页面开发
- [ ] Phase 3: 集成和优化
- [ ] Phase 4: 测试

### 已知问题

无

### 下一步优化

1. 考虑添加历史记录清理功能
2. 考虑添加观看时间筛选功能
3. 考虑添加观看进度显示优化
4. 考虑添加历史记录统计功能

---

**文档结束**