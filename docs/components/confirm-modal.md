# ConfirmModal 确认弹窗

## 概述

基于 Modal 的确认弹窗组件，用于需要用户确认的操作。

## 文件位置

`apps/web/src/components/ConfirmModal.tsx`

## Props

```typescript
interface ConfirmModalProps {
  isOpen: boolean           // 是否显示
  onClose: () => void        // 取消回调
  onConfirm: () => void      // 确认回调
  title: string              // 标题
  message: string           // 消息内容
  confirmText?: string      // 确认按钮文字
  cancelText?: string        // 取消按钮文字
  confirmVariant?: 'primary' | 'danger'  // 确认按钮样式
  loading?: boolean         // 加载状态
}
```

## 按钮样式

| variant | 用途 | 颜色 |
|---------|------|------|
| primary | 普通确认 | #2563EB |
| danger | 危险操作 | #DC2626 |

## 使用示例

```tsx
import ConfirmModal from './components/ConfirmModal'

function MyComponent() {
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDelete = () => {
    // 执行删除操作
    api.delete()
  }

  return (
    <ConfirmModal
      isOpen={showConfirm}
      onClose={() => setShowConfirm(false)}
      onConfirm={handleDelete}
      title="确认删除"
      message="确定要删除这个视频吗？此操作不可恢复。"
      confirmText="删除"
      confirmVariant="danger"
    />
  )
}
```

## 依赖组件

- [Modal](modal.md) - 基础弹窗组件

## 关联组件

- [AlertModal](alert-modal.md) - 警告弹窗
- [Toast](toast.md) - 轻量提示

---

[返回上级](./README.md)