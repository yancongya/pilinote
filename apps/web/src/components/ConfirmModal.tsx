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
      return `${baseClass} bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.2)] ${!disabled ? 'hover:bg-blue-700 hover:shadow-[0_4px_12px_rgba(37,99,235,0.3)]' : ''} ${disabledClass}`
    } else if (variant === 'danger') {
      return `${baseClass} bg-red-600 text-white shadow-[0_2px_8px_rgba(220,38,38,0.2)] ${!disabled ? 'hover:bg-red-700 hover:shadow-[0_4px_12px_rgba(220,38,38,0.3)]' : ''} ${disabledClass}`
    } else {
      return `${baseClass} bg-slate-100 text-slate-600 ${!disabled ? 'hover:bg-slate-200 hover:text-slate-800' : ''} ${disabledClass}`
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
      <p className="m-0 text-base text-slate-600 leading-relaxed">{message}</p>
    </Modal>
  )
}