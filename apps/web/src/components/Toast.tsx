import { useState, useEffect, createContext, useContext, ReactNode } from 'react'

// Toast类型
type ToastType = 'success' | 'error' | 'warning' | 'info'

// Toast数据接口
interface ToastData {
  id: string
  message: string
  type: ToastType
  duration?: number
}

// Toast上下文接口
interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void
  hideToast: (id: string) => void
}

// 创建上下文
const ToastContext = createContext<ToastContextType | null>(null)

// 生成唯一ID
const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Toast组件
function Toast({ message, type, duration = 3000, onClose }: ToastData & { onClose: () => void }) {
  const [isVisible, setIsVisible] = useState(true)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev - (100 / (duration / 50))
        return Math.max(0, newProgress)
      })
    }, 50)

    return () => clearInterval(interval)
  }, [duration])

  const icons = {
    success: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    error: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    warning: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    info: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  }

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

  const theme = themes[type]
  const icon = icons[type]

  return (
    <div
      className={`fixed z-[10000] transition-all duration-300 ease-out ${
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95'
      }`}
      role="alert"
      aria-live="polite"
      style={{
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)'
      }}
    >
      <div 
        className="relative flex items-center gap-3 px-4 py-3 shadow-lg pointer-events-auto border"
        style={{
          backgroundColor: theme.bg,
          color: 'var(--color-text-primary)',
          borderColor: theme.border,
          boxShadow: 'var(--shadow-lg)',
          backdropFilter: 'blur(12px)',
          borderRadius: '16px',
          minHeight: '48px',
          maxWidth: 'calc(100vw - 32px)',
          width: 'auto',
          minWidth: '320px'
        }}
      >
        {/* 图标 */}
        <div 
          className="flex-shrink-0 flex items-center justify-center"
          style={{ 
            color: theme.icon,
            width: '20px',
            height: '20px'
          }}
        >
          {icon}
        </div>

        {/* 消息 */}
        <span 
          className="text-sm font-medium leading-[1.4] tracking-tight flex-1" 
          style={{ 
            color: 'var(--color-text-primary)',
            fontSize: '14px'
          }}
        >
          {message}
        </span>

        {/* 关闭按钮 */}
        <button
          onClick={() => {
            setIsVisible(false)
            setTimeout(onClose, 300)
          }}
          className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full hover:bg-black/5 transition-colors"
          style={{ 
            color: 'var(--color-text-tertiary)',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer'
          }}
          aria-label="关闭"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* 进度条 */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden"
          style={{ 
            backgroundColor: theme.progress,
            borderRadius: '0 0 16px 16px'
          }}
        >
          <div 
            className="h-full transition-all duration-50 ease-linear"
            style={{ 
              width: `${progress}%`,
              opacity: 0.3
            }}
          />
        </div>
      </div>

      {/* 响应式样式 */}
      <style>{`
        @media (max-width: 640px) {
          div[role="alert"] > div {
            min-width: calc(100vw - 32px);
            padding: 12px;
          }
          
          div[role="alert"] > div span {
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  )
}

// Toast Provider组件
interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const showToast = (message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = generateId()
    const newToast: ToastData = { id, message, type, duration }
    setToasts(prev => [...prev, newToast])
  }

  const hideToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <div className="toast-portal">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={() => hideToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// Toast Hook
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}