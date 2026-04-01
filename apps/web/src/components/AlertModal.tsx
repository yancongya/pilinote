import Modal from './Modal'

interface AlertModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
}

export default function AlertModal({
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