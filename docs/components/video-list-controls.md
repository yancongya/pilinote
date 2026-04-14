# VideoListControls - 视频列表搜索和排序控件

## 概述

`VideoListControls` 是一个通用的视频列表搜索和排序控件组件，提供关键词搜索、排序方式选择和升序/降序切换功能。

## 特性

- ✅ 关键词搜索：支持按视频标题搜索
- ✅ 多种排序方式：默认、按播放量、按发布时间、按添加/收藏时间
- ✅ 升序/降序切换：一键切换排序方向
- ✅ 灵活配置：通过sortOptions支持不同页面的排序选项
- ✅ 响应式设计：适配移动端和桌面端
- ✅ 现代化UI：包含hover效果和过渡动画

## 组件结构

```
VideoListControls/
├── VideoListControls.tsx    # 主组件
└── VideoListControls.css    # 样式文件
```

## Props 接口

```typescript
export interface VideoListControlsProps {
  keyword: string                              // 当前搜索关键词
  order: string                                // 当前排序方式
  sortDirection: 'desc' | 'asc'               // 当前排序方向
  onKeywordChange: (keyword: string) => void   // 关键词变化回调
  onOrderChange: (order: string) => void       // 排序方式变化回调
  onSortDirectionChange: (direction: 'desc' | 'asc') => void  // 排序方向变化回调
  sortOptions: {                              // 排序选项配置
    value: string;
    label: string;
  }[]
}
```

## 使用示例

### 稍后再看页

```typescript
const [keyword, setKeyword] = useState<string>('')
const [order, setOrder] = useState<string>('default')
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

<VideoListControls
  keyword={keyword}
  order={order}
  sortDirection={sortDirection}
  onKeywordChange={setKeyword}
  onOrderChange={setOrder}
  onSortDirectionChange={setSortDirection}
  sortOptions={[
    { value: 'default', label: '默认' },
    { value: 'view', label: '按播放量' },
    { value: 'pubtime', label: '按发布时间' },
    { value: 'add_time', label: '按添加时间' }
  ]}
/>
```

### 收藏页

```typescript
const [keyword, setKeyword] = useState<string>('')
const [order, setOrder] = useState<string>('default')
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

<VideoListControls
  keyword={keyword}
  order={order}
  sortDirection={sortDirection}
  onKeywordChange={setKeyword}
  onOrderChange={setOrder}
  onSortDirectionChange={setSortDirection}
  sortOptions={[
    { value: 'default', label: '默认' },
    { value: 'view', label: '按播放量' },
    { value: 'pubtime', label: '按发布时间' },
    { value: 'favorite', label: '按收藏时间' }
  ]}
/>
```

## 样式特性

### 搜索框
- 圆角设计
- 焦点时高亮边框
- 平滑过渡动画

### 排序选择器
- 自定义下拉箭头图标
- 悬停效果
- 清晰的选项标签

### 升降序按钮
- 图标切换（上箭头/下箭头）
- 悬停效果
- 当前状态指示

### 响应式设计
- 移动端：垂直布局
- 桌面端：水平布局
- 适配不同屏幕尺寸

## 排序选项说明

### 稍后再看页排序选项

| 值 | 标签 | 说明 |
|------|------|------|
| `default` | 默认 | 按B站默认排序 |
| `view` | 按播放量 | 按视频播放量排序 |
| `pubtime` | 按发布时间 | 按视频发布时间排序 |
| `add_time` | 按添加时间 | 按添加到稍后再看的时间排序 |

### 收藏页排序选项

| 值 | 标签 | 说明 |
|------|------|------|
| `default` | 默认 | 按B站默认排序 |
| `view` | 按播放量 | 按视频播放量排序 |
| `pubtime` | 按发布时间 | 按视频发布时间排序 |
| `favorite` | 按收藏时间 | 按收藏时间排序 |

## 技术实现

### 状态管理
使用React Hooks管理本地状态：
- `keyword`: 搜索关键词
- `order`: 排序方式
- `sortDirection`: 排序方向

### 事件处理
- `handleKeywordChange`: 处理关键词输入
- `handleOrderChange`: 处理排序方式选择
- `handleSortDirectionToggle`: 切换排序方向

### 样式方案
- 使用CSS模块化
- Tailwind CSS作为基础样式
- 自定义CSS增强视觉效果

## 集成页面

当前已集成到以下页面：
- ✅ WatchLaterContent（稍后再看页）
- ✅ FavoritesContent（收藏页）

## 注意事项

1. **排序选项差异**
   - 稍后再看页使用`add_time`（添加时间）
   - 收藏页使用`favorite`（收藏时间）

2. **API调用**
   - 关键词搜索在前端进行（后端已支持）
   - 排序在前端进行（后端已支持）
   - 分页由后端控制

3. **性能考虑**
   - 搜索和排序在前端即时响应
   - 避免频繁API调用
   - 建议添加防抖功能（待实现）

## 未来改进

- [ ] 添加搜索防抖功能
- [ ] 添加排序记忆功能
- [ ] 支持自定义排序选项
- [ ] 添加高级搜索功能
- [ ] 支持多关键词搜索
- [ ] 添加搜索历史记录

## 相关文件

- **组件文件**: `apps/web/src/components/VideoListControls.tsx`
- **样式文件**: `apps/web/src/components/VideoListControls.css`
- **集成页面**: 
  - `apps/web/src/pages/components/WatchLaterContent.tsx`
  - `apps/web/src/pages/components/FavoritesContent.tsx`
- **API文档**: 
  - `docs/api/watchlater-api.md`
  - `docs/api/favorites-api.md`