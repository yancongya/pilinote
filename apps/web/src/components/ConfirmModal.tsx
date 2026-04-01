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