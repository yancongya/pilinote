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

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

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
