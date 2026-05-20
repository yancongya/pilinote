import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  closeOnOverlayClick?: boolean
  showCloseButton?: boolean
  className?: string
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  showCloseButton = true,
  className = '',
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const firstFocusableRef = useRef<HTMLButtonElement>(null)
  const scrollYRef = useRef<number>(0)

  // ESC键关闭模态框
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // 防止背景滚动，同时避免 iOS/Safari 在切换 overflow 时把页面滚回顶部：
      // 记录当前滚动位置，把 body 固定住。
      scrollYRef.current = window.scrollY || 0
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollYRef.current}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.width = '100%'
      document.body.style.overflow = 'hidden'
      // 聚焦到模态框
      setTimeout(() => {
        firstFocusableRef.current?.focus()
      }, 100)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Restore scroll locking
      const top = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.width = ''
      document.body.style.overflow = 'unset'
      const y = top ? Math.abs(parseInt(top, 10)) : scrollYRef.current
      if (!Number.isNaN(y)) {
        window.scrollTo(0, y)
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose()
    }
  }

  const sizeClasses = {
    sm: 'max-w-[360px]',
    md: 'max-w-[440px]',
    lg: 'max-w-[800px]',
  }

  return (
    <div 
      className="settings-modal-overlay fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150 ease-out"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div 
        ref={modalRef}
        className={`settings-modal-panel dark:bg-slate-800 dark:border-slate-700 bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full overflow-hidden animate-in zoom-in-95 duration-200 ease-out max-h-[calc(100vh-40px)] flex flex-col ${sizeClasses[size]} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        {(title || showCloseButton) && (
          <div className="settings-modal-header flex items-center justify-between p-5 border-b dark:border-slate-700 border-slate-200 flex-shrink-0">
            {title && (
              <h3 id="modal-title" className="settings-modal-title text-lg font-bold dark:text-slate-100 text-slate-800 leading-tight">{title}</h3>
            )}
            {showCloseButton && (
              <button
                ref={firstFocusableRef}
                className="w-10 h-10 min-w-[40px] min-h-[40px] border-none bg-transparent rounded-xl cursor-pointer flex items-center justify-center text-slate-500 dark:text-slate-300 transition-colors duration-150 ease-out hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100 active:bg-slate-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary-600 focus-visible:outline-offset-2 settings-modal-close"
                onClick={onClose}
                aria-label="关闭"
                tabIndex={0}
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* 内容 */}
        <div className="settings-modal-body p-6 overflow-y-auto flex-1">
          {children}
        </div>

        {/* 底部 */}
        {footer && (
          <div className="settings-modal-footer flex items-center gap-3 p-4 border-t dark:border-slate-700 border-slate-200 justify-end flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
