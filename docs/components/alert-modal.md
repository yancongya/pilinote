# AlertModal 警告弹窗

## 概述

基于 Modal 的警告弹窗组件，用于显示提示信息。

## 文件位置

`apps/web/src/components/AlertModal.tsx`

## Props

```typescript
interface AlertModalProps {
  isOpen: boolean           // 是否显示
  onClose: () => void       // 关闭回调
  title: string             // 标题
  message: string          // 消息内容（支持换行）
  type?: 'info' | 'success' | 'warning' | 'error'  // 类型
}
```

## 类型样式

| 类型 | 背景色 | 边框色 | 文字色 |
|------|--------|--------|--------|
| info | #EFF6FF | #BFDBFE | #1E40AF |
| success | #F0FDF4 | #BBF7D0 | #166534 |
| warning | #FFFBEB | #FDE68A | #92400E |
| error | #FEF2F2 | #FECACA | #991B1B |

## 使用示例

```tsx
import AlertModal from './components/AlertModal'

function MyComponent() {
  const [showAlert, setShowAlert] = useState(false)

  return (
    <AlertModal
      isOpen={showAlert}
      onClose={() => setShowAlert(false)}
      title="操作提示"
      message="您的操作已成功完成\n感谢使用"
      type="success"
    />
  )
}
```

## 依赖组件

- [Modal](modal.md) - 基础弹窗组件

## 关联组件

- [ConfirmModal](confirm-modal.md) - 确认弹窗
- [Toast](toast.md) - 轻量提示

---

[返回上级](./README.md)