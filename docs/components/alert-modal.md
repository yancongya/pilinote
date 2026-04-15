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

### 亮色模式

| 类型 | 背景色 | 边框色 | 文字色 |
|------|--------|--------|--------|
| info | #EFF6FF | #BFDBFE | #1E40AF |
| success | #F0FDF4 | #BBF7D0 | #166534 |
| warning | #FFFBEB | #FDE68A | #92400E |
| error | #FEF2F2 | #FECACA | #991B1B |

### 暗色模式

| 类型 | 背景色 | 边框色 | 文字色 |
|------|--------|--------|--------|
| info | var(--color-info-50) | var(--color-info-200) | var(--color-info-700) |
| success | var(--color-success-50) | var(--color-success-200) | var(--color-success-700) |
| warning | var(--color-warning-50) | var(--color-warning-200) | var(--color-warning-700) |
| error | var(--color-error-50) | var(--color-error-200) | var(--color-error-700) |

## 主题支持

组件使用 CSS 变量系统，自动适配亮色和暗色模式：

```tsx
// 组件样式使用 CSS 变量
const typeStyles = {
  info: {
    background: 'var(--color-info-50)',
    border: '1px solid var(--color-info-200)',
    color: 'var(--color-info-700)'
  },
  success: {
    background: 'var(--color-success-50)',
    border: '1px solid var(--color-success-200)',
    color: 'var(--color-success-700)'
  },
  // ...
}
```

## 关联文档

- [主题系统设计](../web/theme-system.md) - 完整的主题系统设计文档
- [设计令牌系统](../web/theme-system.md#设计令牌系统) - CSS 变量系统说明

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