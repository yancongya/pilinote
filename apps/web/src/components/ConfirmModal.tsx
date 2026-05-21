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

  const confirmClass =
    confirmVariant === 'danger'
      ? 'settings-button settings-button-danger settings-confirm-danger'
      : 'settings-button settings-button-primary settings-confirm-primary'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footerAlign="stretch"
      footer={
        <div className="settings-confirm-actions">
          <button
            className="settings-button settings-button-secondary settings-confirm-secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            className={confirmClass}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? '处理中...' : confirmText}
          </button>
        </div>
      }
    >
      <p className="m-0 text-[15px] dark:text-slate-300 text-slate-600 leading-relaxed">{message}</p>
    </Modal>
  )
}
