import Modal from './Modal'

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

export default function ConfirmModal({
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

  const getButtonClass = (variant: string, disabled: boolean) => {
    const baseClass = "px-5 py-3 border-none rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150 ease-out min-h-[44px] min-w-[44px] touch-manipulation"
    const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : ""
    
    if (variant === 'primary') {
      return `${baseClass} bg-primary-600 text-white shadow-primary ${!disabled ? 'hover:bg-primary-700 hover:shadow-primary-hover' : ''} ${disabledClass}`
    } else if (variant === 'danger') {
      return `${baseClass} bg-error-600 text-white shadow-error ${!disabled ? 'hover:bg-error-700 hover:shadow-error-hover' : ''} ${disabledClass}`
    } else {
      return `${baseClass} dark:bg-secondary-700 dark:text-secondary-200 dark:hover:bg-secondary-600 dark:hover:text-secondary-100 bg-secondary-100 text-secondary-600 ${!disabled ? 'hover:bg-secondary-200 hover:text-secondary-800' : ''} ${disabledClass}`
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
            className={getButtonClass('cancel', loading)}
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            className={getButtonClass(confirmVariant, loading)}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? '处理中...' : confirmText}
          </button>
        </>
      }
    >
      <p className="m-0 text-base dark:text-slate-300 text-slate-600 leading-relaxed">{message}</p>
    </Modal>
  )
}