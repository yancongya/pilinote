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
function Toast({ id, message, type, duration = 3000, onClose }: ToastData & { onClose: () => void }) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const icons = {
    success: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    error: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
    warning: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    info: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  }

  const themes = {
    success: { bg: '#16A34A', icon: '#16A34A' },
    error: { bg: '#DC2626', icon: '#DC2626' },
    warning: { bg: '#D97706', icon: '#D97706' },
    info: { bg: '#2563EB', icon: '#2563EB' },
  }

  const theme = themes[type]

  return (
    <div
      className={`toast-wrap ${isVisible ? 'toast-in' : 'toast-out'}`}
      role="alert"
      aria-live="polite"
    >
      <div className="toast-pill">
        <span className="toast-dot" style={{ backgroundColor: theme.icon }} />
        <span className="toast-msg">{message}</span>
      </div>

      <style>{`
        .toast-wrap {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%) translateY(-16px);
          z-index: 10000;
          pointer-events: none;
        }

        .toast-in {
          animation: tIn 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.1) forwards;
        }

        .toast-out {
          animation: tOut 0.2s ease-in forwards;
        }

        @keyframes tIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(0.92); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }

        @keyframes tOut {
          from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          to { opacity: 0; transform: translateX(-50%) translateY(-8px) scale(0.96); }
        }

        .toast-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px 8px 10px;
          background: #fff;
          border-radius: 100px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 6px 16px rgba(0,0,0,0.08);
          pointer-events: auto;
          max-width: calc(100vw - 32px);
          white-space: nowrap;
        }

        .toast-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .toast-msg {
          font-size: 13px;
          font-weight: 500;
          color: #1E293B;
          line-height: 1.3;
          letter-spacing: -0.01em;
        }

        @media (max-width: 640px) {
          .toast-wrap {
            top: auto;
            bottom: calc(env(safe-area-inset-bottom, 8px) + 24px);
            left: 16px;
            right: 16px;
            transform: translateY(16px);
          }

          .toast-in {
            animation: tInM 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.1) forwards;
          }

          .toast-out {
            animation: tOutM 0.2s ease-in forwards;
          }

          @keyframes tInM {
            from { opacity: 0; transform: translateY(12px) scale(0.96); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }

          @keyframes tOutM {
            from { opacity: 1; transform: translateY(0) scale(1); }
            to { opacity: 0; transform: translateY(8px) scale(0.96); }
          }

          .toast-pill {
            width: 100%;
            justify-content: center;
            padding: 10px 16px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .toast-in, .toast-out {
            animation-duration: 0.01ms;
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
