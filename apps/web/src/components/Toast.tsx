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
    success: { bg: 'bg-green-500', icon: 'bg-green-500' },
    error: { bg: 'bg-red-600', icon: 'bg-red-600' },
    warning: { bg: 'bg-amber-600', icon: 'bg-amber-600' },
    info: { bg: 'bg-blue-600', icon: 'bg-blue-600' },
  }

  const theme = themes[type]

  return (
    <div
      className={`fixed top-5 left-1/2 -translate-x-1/2 -translate-y-4 z-[10000] transition-all duration-300 ease-out ${
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95'
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-white rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.06),0_6px_16px_rgba(0,0,0,0.08)] pointer-events-auto max-w-[calc(100vw-32px)]">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${theme.icon}`} />
        <span className="text-sm font-medium text-slate-800 leading-[1.3] tracking-tight">
          {message}
        </span>
      </div>
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