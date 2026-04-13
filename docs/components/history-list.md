# HistoryList 历史记录

## 概述

历史记录功能模块，自动记录用户解析过的 B 站链接，支持快速访问和管理浏览历史。

## 文件位置

```
apps/web/src/
├── stores/history.ts           # 状态管理 (HistoryStore)
└── pages/components/
    ├── HistoryList.tsx          # 历史记录列表组件
    └── HistoryCard.tsx          # 单条历史记录卡片组件
```

## 数据结构

### HistoryItem
历史记录项接口，定义单条历史记录的数据结构。

```typescript
interface HistoryItem {
  id: string;                    // bvid 或 opusId
  type: 'video' | 'opus';        // 媒体类型
  title: string;                 // 标题
  cover: string;                 // 封面URL
  duration: number;              // 时长（秒）
  uploader: string;              // UP主名称
  uploader_mid: number;          // UP主 ID
  timestamp: number;             // 添加时间戳
  view_count?: number;           // 播放量（可选）
  danmaku_count?: number;        // 弹幕数（可选）
}
```

### HistoryState
历史记录状态接口，定义状态管理的数据结构。

```typescript
interface HistoryState {
  history: HistoryItem[];        // 历史记录列表
  maxHistorySize: number;        // 最大历史记录数量
  
  // Actions
  addToHistory: (item: HistoryItem) => void;      // 添加到历史记录
  removeFromHistory: (id: string) => void;        // 删除单条记录
  clearHistory: () => void;                        // 清空所有记录
  getHistory: () => HistoryItem[];                // 获取历史记录
}
```

## 核心组件

### 1. HistoryStore (history.ts)

使用 Zustand + persist 中间件的状态管理器，负责历史记录的存储和管理。

#### 功能特性
- **持久化存储**：数据自动保存到 localStorage
- **自动去重**：相同 ID 的记录会更新时间戳并移到最前
- **数量限制**：最多保存 20 条记录，超出后删除最旧的
- **存储键名**：`pilinote-history`

#### 使用示例
```typescript
import { useHistoryStore } from '../../stores/history';

function MyComponent() {
  const addToHistory = useHistoryStore((state) => state.addToHistory);
  const history = useHistoryStore((state) => state.history);
  
  // 添加到历史记录
  addToHistory({
    id: 'BV1xx411c7mD',
    type: 'video',
    title: '视频标题',
    cover: 'https://example.com/cover.jpg',
    duration: 180,
    uploader: 'UP主名称',
    uploader_mid: 123456789,
    timestamp: Date.now(),
  });
  
  // 获取历史记录
  const allHistory = useHistoryStore.getState().getHistory();
}
```

### 2. HistoryCard (HistoryCard.tsx)

单条历史记录卡片组件，显示历史记录的简要信息。

#### Props
```typescript
interface HistoryCardProps {
  item: HistoryItem;             // 历史记录项
  onDelete: (id: string) => void; // 删除回调
}
```

#### 功能特性
- **类型标识**：显示"视频"或"图文"标签，使用不同颜色区分
- **时间显示**：显示相对时间（如"5分钟前"、"2小时前"）
- **点击导航**：点击卡片跳转到对应详情页
- **删除功能**：独立的删除按钮，支持删除单条记录
- **无障碍支持**：使用语义化标签和 ARIA 属性

#### 时间显示规则
| 时间差 | 显示格式 |
|--------|----------|
| < 1 分钟 | "刚刚" |
| < 1 小时 | "N分钟前" |
| < 1 天 | "N小时前" |
| < 1 周 | "N天前" |
| < 1 个月 | "N周前" |
| < 1 年 | "N个月前" |
| ≥ 1 年 | "N年前" |

### 3. HistoryList (HistoryList.tsx)

历史记录列表组件，显示所有历史记录并提供管理功能。

#### 功能特性
- **空状态显示**：无历史记录时显示友好的空状态提示
- **记录统计**：显示历史记录总数量
- **批量操作**：支持清空所有历史记录
- **确认对话框**：清空前显示确认提示，防止误操作

#### 布局结构
```
┌─────────────────────────────────────────────┐
│ 浏览历史                      10 条记录 🗑️  │
├─────────────────────────────────────────────┤
│ ┌───────────────┐ ┌───────────────┐        │
│ │ [视频] 标题    │ │ [图文] 标题    │        │
│ │ 🕐 5分钟前 ✕  │ │ 🕐 2小时前 ✕  │        │
│ └───────────────┘ └───────────────┘        │
│ ┌───────────────┐                          │
│ │ [视频] 标题    │                          │
│ │ 🕐 1天前 ✕    │                          │
│ └───────────────┘                          │
└─────────────────────────────────────────────┘
```

## 功能特性

### 自动记录
- 解析 B 站链接成功后自动添加到历史记录
- 解析成功时记录视频/图文的元信息（标题、封面、UP主等）
- 已存在的记录会更新时间戳并移到最前

### 持久化存储
- 使用 Zustand persist 中间件
- 数据自动保存到浏览器 localStorage
- 刷新页面后数据保留

### 数量限制
- 默认最多保存 20 条历史记录
- 超出限制时自动删除最旧的记录
- 通过 `maxHistorySize` 配置

### 管理功能
- **删除单条**：点击卡片右上角的删除图标（✕）
- **清空全部**：点击头部右侧的清空图标（🗑️）（需确认）
- **快速访问**：点击卡片跳转到详情页

### 响应式设计
- **移动端**（< 375px）：单列布局
- **平板**（768px - 1024px）：双列布局
- **桌面**（≥ 1024px）：多列网格布局

### 类型区分
- **视频**：蓝色标签 (#2563EB)
- **图文**：粉色标签 (#FB7299)

## 使用示例

### 在首页集成历史记录

```typescript
import HistoryList from './components/HistoryList';
import { useHistoryStore } from '../../stores/history';

function HomeContent() {
  const addToHistory = useHistoryStore((state) => state.addToHistory);
  
  const handleParseUrl = async () => {
    const response = await apiService.parseDownloadUrl(url);
    
    if (response.success && response.data?.video) {
      const video = response.data.video;
      const parsedId = response.data.parsed_id;
      
      // 添加到历史记录
      if (parsedId) {
        addToHistory({
          id: parsedId.id,
          type: parsedId.type === 'opus' ? 'opus' : 'video',
          title: video.title,
          cover: video.pic,
          duration: video.duration || 0,
          uploader: video.owner.name,
          uploader_mid: video.owner.mid,
          timestamp: Date.now(),
        });
      }
    }
  };
  
  return (
    <div>
      {/* 解析输入框 */}
      {/* 解析结果卡片 */}
      
      {/* 历史记录列表 */}
      <HistoryList />
    </div>
  );
}
```

### 自定义历史记录显示

```typescript
import { useHistoryStore } from '../../stores/history';

function CustomHistoryView() {
  const history = useHistoryStore((state) => state.history);
  const removeFromHistory = useHistoryStore((state) => state.removeFromHistory);
  
  return (
    <div>
      <h2>最近浏览</h2>
      <ul>
        {history.map((item) => (
          <li key={item.id}>
            <span>{item.type}: {item.title}</span>
            <button onClick={() => removeFromHistory(item.id)}>
              删除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## 样式说明

### 主要 CSS 类

| 类名 | 说明 |
|------|------|
| `.history-list` | 历史记录列表容器 |
| `.history-list-header` | 列表头部 |
| `.history-list-header-actions` | 头部操作区域（数量 + 清空按钮） |
| `.history-list-title` | 标题文本 |
| `.history-list-count` | 记录数量 |
| `.history-list-grid` | 网格布局容器 |
| `.history-card` | 历史记录卡片 |
| `.history-card-type` | 类型标签 |
| `.history-card-type.video` | 视频类型样式 |
| `.history-card-type.opus` | 图文类型样式 |
| `.history-card-title` | 标题文本 |
| `.history-card-meta` | 元数据（时间等） |
| `.history-card-delete-icon` | 删除图标 |
| `.history-list-clear-btn` | 清空按钮（小图标样式） |
| `.history-list-empty` | 空状态容器 |

### 响应式断点

| 屏幕尺寸 | 网格列数 | 卡片最小宽度 |
|----------|----------|--------------|
| < 375px | 1 列 | 100% |
| 375px - 767px | 自适应 | 280px |
| 768px - 1023px | 自适应 | 240px |
| ≥ 1024px | 自适应 | 220px |

### 颜色方案

| 元素 | 颜色 | 说明 |
|------|------|------|
| 视频标签背景 | rgba(37, 99, 235, 0.1) | 蓝色半透明 |
| 视频标签文字 | #2563EB | 蓝色 |
| 图文标签背景 | rgba(251, 114, 153, 0.1) | 粉色半透明 |
| 图文标签文字 | #FB7299 | 粉色 |
| 卡片背景 | #F8FAFC | 浅灰蓝 |
| 卡片悬停背景 | #F1F5F9 | 深一点的灰蓝 |
| 删除按钮文字 | #EF4444 | 红色 |

## 关联组件

- [HomeContent](home-content.md) - 首页内容（集成历史记录）
- [VideoDetailPage](video-detail-page.md) - 视频详情页（历史记录跳转目标）
- [ConfirmModal](confirm-modal.md) - 确认对话框（清空确认）

## 存储位置

- **存储类型**：localStorage
- **存储键名**：`pilinote-history`
- **数据格式**：JSON 序列化的 HistoryItem 数组
- **持久化中间件**：Zustand persist

## 注意事项

1. **隐私保护**：历史记录仅存储在浏览器本地，不会上传到服务器
2. **存储限制**：localStorage 有约 5MB 的存储限制
3. **浏览器兼容性**：需要支持 localStorage 的现代浏览器
4. **时间显示**：时间戳使用浏览器本地时间
5. **ID 唯一性**：使用 bvid 或 opusId 作为唯一标识

## 更新日志

### 2026-04-13 - UI 优化：简化操作布局

#### 优化
- **布局调整**：
  - 清空历史按钮移至头部，位于历史记录数量右侧
  - 删除底部 `.history-list-actions` 容器
  - 清空按钮改为纯图标样式（只显示垃圾桶图标）
- **删除图标优化**：
  - 卡片删除按钮改为纯图标样式
  - 去掉按钮背景和边框，只保留图标功能
  - 悬停时红色高亮
- **样式更新**：
  - 新增 `.history-list-header-actions` 样式（头部操作区域）
  - `.history-card-delete-btn` 改为 `.history-card-delete-icon`
  - 清空按钮从底部大按钮改为头部小图标

### 2026-04-13 - 历史记录功能上线

#### 新增
- **HistoryStore**：基于 Zustand 的状态管理器
  - 支持添加、删除、清空历史记录
  - 持久化存储到 localStorage
  - 最多保存 20 条记录
- **HistoryCard 组件**：单条历史记录卡片
  - 显示类型标签（视频/图文）
  - 显示相对时间
  - 支持删除操作
  - 点击跳转到详情页
- **HistoryList 组件**：历史记录列表
  - 响应式网格布局
  - 空状态提示
  - 清空所有记录功能
  - 确认对话框
- **样式设计**：
  - 移动端优先的响应式设计
  - 平滑的悬停和点击动画
  - 清晰的类型标识颜色
  - 无障碍支持（ARIA 属性）

#### 集成
- **HomeContent 组件**：解析成功后自动添加到历史记录
- **index.css**：新增历史记录相关样式

---

[返回上级](./README.md)