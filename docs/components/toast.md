# Toast 提示组件

## 概述

轻量级提示消息组件，支持多种类型和自动消失。

## 文件位置

`apps/web/src/components/Toast.tsx`

## 类型

| 类型 | 用途 | 颜色 |
|------|------|------|
| success | 成功 | #16A34A |
| error | 错误 | #DC2626 |
| warning | 警告 | #D97706 |
| info | 信息 | #2563EB |

## API

### ToastProvider

```typescript
interface ToastProviderProps {
  children: ReactNode
}

// 提供上下文
<ToastProvider>
  {children}
</ToastProvider>
```

### useToast Hook

```typescript
interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void
  hideToast: (id: string) => void
}

// 使用
const { showToast, hideToast } = useToast()

// 显示提示
showToast('操作成功', 'success', 3000)

// 手动关闭
hideToast(id)
```

## 使用示例

```tsx
import { useToast, ToastProvider } from './components/Toast'

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

function AppContent() {
  const { showToast } = useToast()

  const handleClick = async () => {
    showToast('正在提交...', 'info')
    
    try {
      await api.submit()
      showToast('提交成功', 'success')
    } catch (error) {
      showToast('提交失败', 'error')
    }
  }

  return <button onClick={handleClick}>提交</button>
}
```

## 特性

| 特性 | 说明 |
|------|------|
| 自动消失 | 默认 3 秒后消失 |
| 多个提示 | 支持同时显示多个 |
| 动画效果 | 进出场动画 |
| 移动端适配 | 底部显示 |
| 无障碍 | role="alert" |

## 样式

```css
.toast-wrap {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
}

.toast-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: white;
  border-radius: 100px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.toast-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
```

## 关联组件

- [Modal](modal.md) - 弹窗组件

---

[返回上级](./README.md)