# BatchActionsBar 批量操作栏

## 概述

视频批量操作栏组件，提供批量选择和批量下载功能。

## 文件位置

`apps/web/src/components/BatchActionsBar.tsx`

## Props

```typescript
interface BatchActionsBarProps {
  batchMode: boolean        // 是否在批量模式
  selectedCount: number   // 已选数量
  onEnterBatchMode: () => void  // 进入批量模式
  onExitBatchMode: () => void  // 退出批量模式
  onBatchDownload: () => void  // 批量下载
  loading: boolean        // 加载状态
}
```

## 状态转换

```
普通模式 ──点击──▶ 批量选择模式
    ▲                      │
    │                      │
    └────点击取消──────────┘
```

## 使用示例

```tsx
import BatchActionsBar from './components/BatchActionsBar'

function MyComponent() {
  const [batchMode, setBatchMode] = useState(false)
  const [selectedCount, setSelectedCount] = useState(0)

  const handleBatchDownload = async () => {
    // 批量下载选中视频
    for (const bvid of selectedVideos) {
      await api.addToDownloadQueue({ bvid })
    }
  }

  return (
    <BatchActionsBar
      batchMode={batchMode}
      selectedCount={selectedCount}
      onEnterBatchMode={() => setBatchMode(true)}
      onExitBatchMode={() => setBatchMode(false)}
      onBatchDownload={handleBatchDownload}
      loading={false}
    />
  )
}
```

## 按钮配置

| 状态 | 按钮 | 说明 |
|------|------|------|
| 非批量模式 | 批量下载 | 进入批量选择 |
| 批量模式 | 取消 | 退出批量选择 |
| 批量模式 | 下载 (N) | 批量下载选中项 |

## 关联组件

- [VideoListContainer](video-list-container.md) - 视频列表容器
- VideoListCard：源码位于 `apps/web/src/pages/components/VideoListCard.tsx`（当前无独立 docs 条目时以源码为准）

---

[返回上级](./README.md)
