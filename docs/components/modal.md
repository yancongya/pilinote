# Modal 弹窗组件

## 概述

通用弹窗组件，支持自定义标题、内容、底部操作栏。

## 文件位置

`apps/web/src/components/Modal.tsx`

## Props

```typescript
interface ModalProps {
  isOpen: boolean           // 是否显示
  onClose: () => void      // 关闭回调
  title?: string          // 标题
  children: React.ReactNode  // 内容
  footer?: React.ReactNode  // 底部操作栏
  size?: 'sm' | 'md' | 'lg'  // 尺寸
  closeOnOverlayClick?: boolean  // 点击遮罩关闭
  showCloseButton?: boolean     // 显示关闭按钮
  className?: string          // 自定义类名
}
```

## 使用示例

```tsx
import Modal from './components/Modal'

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button onClick={() => setIsOpen(true)}>打开弹窗</button>
      
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="确认操作"
        size="md"
        footer={
          <button onClick={() => setIsOpen(false)}>取消</button>
        }
      >
        <p>确定要执行此操作吗？</p>
      </Modal>
    </>
  )
}
```

## 功能特性

| 特性 | 说明 |
|------|------|
| ESC关闭 | 按 ESC 键关闭弹窗 |
| 焦点管理 | 自动聚焦到第一个可聚焦元素 |
| 背景滚动锁 | 打开时禁止背景滚动 |
| 移动端适配 | 底部弹出式布局 |
| 无障碍 | 支持 aria 属性 |

## 样式定制

```css
/* 尺寸 */
.modal-panel-sm { max-width: 360px; }
.modal-panel-md { max-width: 440px; }
.modal-panel-lg { max-width: 800px; }

/* 移动端 */
@media (max-width: 640px) {
  .modal-overlay { align-items: flex-end; }
  .modal-panel { border-radius: 16px 16px 0 0; }
}
```

## 关联组件

- [AlertModal](alert-modal.md) - 警告弹窗
- [ConfirmModal](confirm-modal.md) - 确认弹窗
- [Toast](toast.md) - 提示消息

---

[返回上级](./README.md)