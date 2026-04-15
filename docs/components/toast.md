# Toast 提示组件

## 概述

轻量级提示消息组件，支持多种类型和自动消失。

## 文件位置

`apps/web/src/components/Toast.tsx`

## 类型

### 亮色模式

| 类型 | 用途 | 背景色 | 文字色 |
|------|------|--------|--------|
| success | 成功 | #F0FDF4 | #16A34A |
| error | 错误 | #FEE2E2 | #DC2626 |
| warning | 警告 | #FFFBEB | #D97706 |
| info | 信息 | #EFF6FF | #2563EB |

### 暗色模式

| 类型 | 用途 | 背景色 | 文字色 |
|------|------|--------|--------|
| success | 成功 | var(--color-success-50) | var(--color-success-600) |
| error | 错误 | var(--color-error-50) | var(--color-error-600) |
| warning | 警告 | var(--color-warning-50) | var(--color-warning-600) |
| info | 信息 | var(--color-info-50) | var(--color-info-600) |

## 主题支持

组件使用 CSS 变量系统，自动适配亮色和暗色模式：

```tsx
// 组件样式使用 CSS 变量
const typeStyles = {
  success: {
    background: 'var(--color-success-50)',
    color: 'var(--color-success-600)'
  },
  error: {
    background: 'var(--color-error-50)',
    color: 'var(--color-error-600)'
  },
  // ...
}
```

## 样式说明

### 亮色模式

```css
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

### 暗色模式

```css
.dark .toast-pill {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.dark .toast-dot {
  background: var(--color-text-secondary);
}
```

## 关联文档

- [主题系统设计](../web/theme-system.md) - 完整的主题系统设计文档
- [设计令牌系统](../web/theme-system.md#设计令牌系统) - CSS 变量系统说明

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