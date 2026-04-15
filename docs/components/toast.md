# Toast 提示组件

## 概述

现代化的提示消息组件，支持多种类型、自动消失、手动关闭和进度显示，完美适配手机和电脑模式。

## 文件位置

`apps/web/src/components/Toast.tsx`

## 最新设计特性

### 视觉设计
- **现代化图标**：每种状态都有独特的SVG图标
- **进度条**：底部显示剩余时间进度
- **关闭按钮**：支持手动关闭操作
- **毛玻璃效果**：backdrop-filter模糊背景
- **流畅动画**：300ms过渡动画

### 响应式布局
- **手机模式** (< 640px)：紧凑布局，padding: 12px，字体: 13px
- **平板模式** (641px - 1024px)：适中布局，padding-top: 20px
- **电脑模式** (> 1025px)：宽敞布局，padding-top: 32px，最大宽度: 800px

## 类型

### 亮色模式

| 类型 | 用途 | 背景色 | 边框色 | 图标色 | 进度条色 |
|------|------|--------|--------|--------|----------|
| success | 成功 | #F0FDF4 | #BBF7D0 | #16A34A | #16A34A |
| error | 错误 | #FEF2F2 | #FECACA | #DC2626 | #DC2626 |
| warning | 警告 | #FFFBEB | #FDE68A | #D97706 | #D97706 |
| info | 信息 | #EFF6FF | #BFDBFE | #2563EB | #2563EB |

### 暗色模式

| 类型 | 用途 | 背景色 | 边框色 | 图标色 | 进度条色 |
|------|------|--------|--------|--------|----------|
| success | 成功 | rgba(34, 197, 94, 0.1) | rgba(34, 197, 94, 0.2) | #22C55E | #22C55E |
| error | 错误 | rgba(239, 68, 68, 0.1) | rgba(239, 68, 68, 0.2) | #EF4444 | #EF4444 |
| warning | 警告 | rgba(245, 158, 11, 0.1) | rgba(245, 158, 11, 0.2) | #F59E0B | #F59E0B |
| info | 信息 | rgba(59, 130, 246, 0.1) | rgba(59, 130, 246, 0.2) | #3B82F6 | #3B82F6 |

## 图标系统

### 成功图标
```svg
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
  <polyline points="22 4 12 14.01 9 11.01" />
</svg>
```

### 错误图标
```svg
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
  <circle cx="12" cy="12" r="10" />
  <line x1="15" y1="9" x2="9" y2="15" />
  <line x1="9" y1="9" x2="15" y2="15" />
</svg>
```

### 警告图标
```svg
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
  <line x1="12" y1="9" x2="12" y2="13" />
  <line x1="12" y1="17" x2="12.01" y2="17" />
</svg>
```

### 信息图标
```svg
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
  <circle cx="12" cy="12" r="10" />
  <line x1="12" y1="16" x2="12" y2="12" />
  <line x1="12" y1="8" x2="12.01" y2="8" />
</svg>
```

## 主题支持

组件使用 CSS 变量系统，自动适配亮色和暗色模式：

```tsx
const themes = {
  success: { 
    bg: 'var(--color-success-50)', 
    border: 'var(--color-success-200)', 
    icon: 'var(--color-success-600)',
    progress: 'var(--color-success-600)'
  },
  error: { 
    bg: 'var(--color-error-50)', 
    border: 'var(--color-error-200)', 
    icon: 'var(--color-error-600)',
    progress: 'var(--color-error-600)'
  },
  warning: { 
    bg: 'var(--color-warning-50)', 
    border: 'var(--color-warning-200)', 
    icon: 'var(--color-warning-600)',
    progress: 'var(--color-warning-600)'
  },
  info: { 
    bg: 'var(--color-info-50)', 
    border: 'var(--color-info-200)', 
    icon: 'var(--color-info-600)',
    progress: 'var(--color-info-600)'
  },
}
```

## 样式规格

### 尺寸规范
- **圆角**：16px
- **最小高度**：48px
- **最小宽度**：320px
- **最大宽度**：calc(100vw - 32px)
- **图标大小**：20x20px
- **关闭按钮**：7x7px
- **进度条高度**：4px

### 间距规范
- **手机模式**：padding: 12px, gap: 12px
- **平板模式**：padding: 14px, gap: 12px
- **电脑模式**：padding: 16px, gap: 12px

### 响应式断点
```css
/* 手机端 */
@media (max-width: 640px) {
  padding: 12px;
  font-size: 13px;
}

/* 平板端 */
@media (min-width: 641px) and (max-width: 1024px) {
  padding-top: 14px;
}

/* 桌面端 */
@media (min-width: 1025px) {
  padding: 16px;
  max-width: 800px;
}
```

## 关联文档

- [主题系统设计](../web/theme-system.md) - 完整的主题系统设计文档
- [设计令牌系统](../web/theme-system.md#设计令牌系统) - CSS 变量系统说明
- [主布局组件](./main-layout.md) - 主要布局和主题切换功能

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

// 显示提示（默认3秒）
showToast('操作成功', 'success')

// 自定义持续时间
showToast('请稍候...', 'info', 5000)

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
      showToast('提交成功', 'success', 2000)
    } catch (error) {
      showToast('提交失败', 'error', 5000)
    }
  }

  return <button onClick={handleClick}>提交</button>
}
```

## 特性

| 特性 | 说明 |
|------|------|
| 自动消失 | 默认 3 秒后消失，可自定义 |
| 手动关闭 | 点击关闭按钮立即关闭 |
| 进度显示 | 底部进度条显示剩余时间 |
| 多个提示 | 支持同时显示多个，垂直堆叠 |
| 动画效果 | 进出场动画 + 缩放效果 |
| 响应式 | 完美适配手机、平板、电脑 |
| 无障碍 | role="alert", aria-live="polite" |
| 毛玻璃 | backdrop-filter 模糊效果 |
| 深色适配 | 完美支持暗色模式 |

## 技术实现

### 进度条实现
```tsx
const [progress, setProgress] = useState(100)

useEffect(() => {
  const interval = setInterval(() => {
    setProgress(prev => {
      const newProgress = prev - (100 / (duration / 50))
      return Math.max(0, newProgress)
    })
  }, 50)

  return () => clearInterval(interval)
}, [duration])
```

### 暗色模式适配
```tsx
// 使用CSS变量实现主题切换
<div style={{
  backgroundColor: 'var(--color-success-50)',
  // 暗色模式: rgba(34, 197, 94, 0.1)
  // 亮色模式: #F0FDF4
  color: 'var(--color-text-primary)'
}}
```

## 关联组件

- [Modal](modal.md) - 弹窗组件
- [AlertModal](alert-modal.md) - 警告弹窗组件
- [ConfirmModal](confirm-modal.md) - 确认弹窗组件

---

[返回上级](./README.md)