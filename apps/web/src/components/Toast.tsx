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
      setTimeout(onClose, 300) // 等待淡出动画完成
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const icons = {
    success: (
      <svg className="toast-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    error: (
      <svg className="toast-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
    warning: (
      <svg className="toast-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    info: (
      <svg className="toast-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    ),
  }

  const colors = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      icon: 'text-green-500',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: 'text-red-500',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      icon: 'text-yellow-500',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: 'text-blue-500',
    },
  }

  const color = colors[type]

  return (
    <div
      className={`toast-container ${isVisible ? 'toast-visible' : 'toast-hidden'}`}
      role="alert"
      aria-live="polite"
    >
      <div className={`toast-content ${color.bg} ${color.border} ${color.text}`}>
        <div className={`toast-icon-container ${color.icon}`}>
          {icons[type]}
        </div>
        <p className="toast-message">{message}</p>
        <button
          className="toast-close-btn"
          onClick={() => {
            setIsVisible(false)
            setTimeout(onClose, 300)
          }}
          aria-label="关闭提示"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="toast-close-icon">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <style>{`
        .toast-container {
          position: fixed;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 2000;
          pointer-events: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .toast-visible {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }

        .toast-hidden {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }

        .toast-content {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          min-width: 300px;
          max-width: 90vw;
          pointer-events: auto;
        }

        .toast-icon-container {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
        }

        .toast-icon {
          width: 100%;
          height: 100%;
        }

        .toast-message {
          margin: 0;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.4;
          flex: 1;
        }

        .toast-close-btn {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          border: none;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.6;
          transition: all 0.15s ease;
        }

        .toast-close-btn:hover {
          opacity: 1;
          background: rgba(0, 0, 0, 0.05);
        }

        .toast-close-btn:focus-visible {
          outline: 2px solid currentColor;
          outline-offset: 2px;
        }

        .toast-close-icon {
          width: 14px;
          height: 14px;
        }

        @media (max-width: 640px) {
          .toast-container {
            top: auto;
            bottom: 80px;
            left: 16px;
            right: 16px;
            transform: none;
          }

          .toast-visible {
            transform: translateY(0);
          }

          .toast-hidden {
            transform: translateY(20px);
          }

          .toast-content {
            min-width: auto;
            width: 100%;
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