import Modal from './Modal'

interface AlertModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  showConfirm?: boolean
  onConfirm?: () => void
}

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  showConfirm = false,
  onConfirm,
}: AlertModalProps) {
  const confirmClass =
    type === 'error'
      ? 'settings-modal-button settings-modal-button-danger'
      : 'settings-modal-button settings-modal-button-confirm'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-3">
          {showConfirm && (
            <button
              className="settings-modal-button settings-modal-button-cancel"
              onClick={onClose}
            >
              取消
            </button>
          )}
          <button
            className={confirmClass}
            onClick={() => {
              if (showConfirm && onConfirm) {
                onConfirm()
              }
              onClose()
            }}
          >
            {showConfirm ? '确认' : '确定'}
          </button>
        </div>
      }
    >
      <div className="grid gap-3">
        <p
          className="settings-modal-text"
          dangerouslySetInnerHTML={{ __html: message.replace(/\n/g, '<br/>') }}
        />
      </div>
    </Modal>
  )
}
