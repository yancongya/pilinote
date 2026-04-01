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

  // ESC键关闭模态框
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // 防止背景滚动
      document.body.style.overflow = 'hidden'
      // 聚焦到模态框
      setTimeout(() => {
        firstFocusableRef.current?.focus()
      }, 100)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose()
    }
  }

  const sizeClasses = {
    sm: 'modal-panel-sm',
    md: 'modal-panel-md',
    lg: 'modal-panel-lg',
  }

  return (
    <div 
      className="modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div 
        ref={modalRef}
        className={`modal-panel ${sizeClasses[size]} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        {(title || showCloseButton) && (
          <div className="modal-header">
            {title && (
              <h3 id="modal-title" className="modal-title">{title}</h3>
            )}
            {showCloseButton && (
              <button
                ref={firstFocusableRef}
                className="modal-close-btn"
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
        <div className="modal-body">
          {children}
        </div>

        {/* 底部 */}
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
          backdrop-filter: blur(4px);
          animation: fadeIn 150ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-panel {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          width: 100%;
          overflow: hidden;
          animation: scaleIn 200ms cubic-bezier(0.4, 0, 0.2, 1);
          max-height: calc(100vh - 40px);
          display: flex;
          flex-direction: column;
        }

        .modal-panel-sm {
          max-width: 360px;
        }

        .modal-panel-md {
          max-width: 440px;
        }

        .modal-panel-lg {
          max-width: 800px;
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid #E2E8F0;
          flex-shrink: 0;
        }

        .modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #1E293B;
          line-height: 1.4;
        }

        .modal-close-btn {
          width: 32px;
          height: 32px;
          min-width: 32px;
          min-height: 32px;
          border: none;
          background: #F1F5F9;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748B;
          transition: all 0.15s ease;
          touch-action: manipulation;
        }

        .modal-close-btn:hover {
          background: #E2E8F0;
          color: #1E293B;
        }

        .modal-close-btn:active {
          transform: scale(0.95);
        }

        .modal-close-btn:focus-visible {
          outline: 2px solid #2563EB;
          outline-offset: 2px;
        }

        .modal-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }

        .modal-footer {
          display: flex;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid #E2E8F0;
          justify-content: flex-end;
          flex-shrink: 0;
        }

        /* 移动端适配 */
        @media (max-width: 640px) {
          .modal-overlay {
            padding: 16px;
            align-items: flex-end;
          }

          .modal-panel {
            border-radius: 16px 16px 0 0;
            max-height: calc(100vh - 32px);
            margin-bottom: 0;
            animation: slideUp 200ms cubic-bezier(0.4, 0, 0.2, 1);
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(100%);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .modal-header {
            padding: 16px 20px;
            text-align: center;
            position: relative;
          }

          .modal-title {
            font-size: 16px;
            width: 100%;
            text-align: center;
          }

          .modal-close-btn {
            position: absolute;
            left: 20px;
            top: 50%;
            transform: translateY(-50%);
          }

          .modal-body {
            padding: 20px;
          }

          .modal-footer {
            padding: 12px 20px;
            flex-direction: column-reverse;
          }

          .modal-footer button {
            width: 100%;
          }
        }

        /* 减少动画偏好支持 */
        @media (prefers-reduced-motion: reduce) {
          .modal-overlay,
          .modal-panel,
          .modal-close-btn {
            animation: none;
            transition: none;
          }
        }
      `}</style>
    </div>
  )
}

// 确认对话框组件
interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'primary' | 'danger'
  loading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  confirmVariant = 'primary',
  loading = false,
}: ConfirmModalProps) {
  const handleConfirm = () => {
    if (!loading) {
      onConfirm()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            className="confirm-modal-btn confirm-modal-btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            className={`confirm-modal-btn confirm-modal-btn-${confirmVariant}`}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? '处理中...' : confirmText}
          </button>
        </>
      }
    >
      <p className="confirm-modal-message">{message}</p>

      <style>{`
        .confirm-modal-message {
          margin: 0;
          font-size: 15px;
          color: #475569;
          line-height: 1.6;
        }

        .confirm-modal-btn {
          padding: 12px 20px;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          min-height: 44px;
          min-width: 44px;
          touch-action: manipulation;
        }

        .confirm-modal-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .confirm-modal-btn-cancel {
          background: #F1F5F9;
          color: #64748B;
        }

        .confirm-modal-btn-cancel:hover:not(:disabled) {
          background: #E2E8F0;
          color: #475569;
        }

        .confirm-modal-btn-primary {
          background: #2563EB;
          color: white;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
        }

        .confirm-modal-btn-primary:hover:not(:disabled) {
          background: #1D4ED8;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .confirm-modal-btn-danger {
          background: #DC2626;
          color: white;
          box-shadow: 0 2px 8px rgba(220, 38, 38, 0.2);
        }

        .confirm-modal-btn-danger:hover:not(:disabled) {
          background: #B91C1C;
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
        }

        .confirm-modal-btn:focus-visible {
          outline: 2px solid #2563EB;
          outline-offset: 2px;
        }

        @media (max-width: 640px) {
          .confirm-modal-btn {
            width: 100%;
          }
        }
      `}</style>
    </Modal>
  )
}

// 简单的alert组件
interface AlertModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
}: AlertModalProps) {
  const colors = {
    info: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF' },
    success: { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534' },
    warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
    error: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' },
  }

  const color = colors[type]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <button
          className="alert-modal-btn"
          onClick={onClose}
        >
          确定
        </button>
      }
    >
      <div 
        className="alert-modal-content"
        style={{
          background: color.bg,
          border: `1px solid ${color.border}`,
          color: color.text,
        }}
      >
        <p className="alert-modal-message">{message}</p>
      </div>

      <style>{`
        .alert-modal-content {
          padding: 16px;
          border-radius: 8px;
        }

        .alert-modal-message {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
        }

        .alert-modal-btn {
          padding: 12px 20px;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          min-height: 44px;
          min-width: 44px;
          touch-action: manipulation;
          background: #2563EB;
          color: white;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
        }

        .alert-modal-btn:hover {
          background: #1D4ED8;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .alert-modal-btn:focus-visible {
          outline: 2px solid #2563EB;
          outline-offset: 2px;
        }

        @media (max-width: 640px) {
          .alert-modal-btn {
            width: 100%;
          }
        }
      `}</style>
    </Modal>
  )
}