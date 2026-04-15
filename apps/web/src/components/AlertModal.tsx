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
    info: { 
      bg: 'bg-info-50 dark:bg-info-950', 
      border: 'border-info-200 dark:border-info-900', 
      text: 'text-info-800 dark:text-info-200' 
    },
    success: { 
      bg: 'bg-success-50 dark:bg-success-950', 
      border: 'border-success-200 dark:border-success-900', 
      text: 'text-success-800 dark:text-success-200' 
    },
    warning: { 
      bg: 'bg-warning-50 dark:bg-warning-950', 
      border: 'border-warning-200 dark:border-warning-900', 
      text: 'text-warning-800 dark:text-warning-200' 
    },
    error: { 
      bg: 'bg-error-50 dark:bg-error-950', 
      border: 'border-error-200 dark:border-error-900', 
      text: 'text-error-800 dark:text-error-200' 
    },
  }

  const color = colors[type]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
footer={
        <button
          className="px-5 py-3 border-none rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150 ease-out min-h-[44px] min-w-[44px] touch-manipulation bg-primary-600 text-white shadow-primary hover:bg-primary-700 hover:shadow-primary-hover focus-visible:outline-2 focus-visible:outline-primary-600 focus-visible:outline-offset-2"
          onClick={onClose}
        >
          确定
        </button>
      }
    >
      <div className={`p-4 rounded-lg border ${color.bg} ${color.border} ${color.text}`}>
        <p className="m-0 text-sm leading-[1.8]" dangerouslySetInnerHTML={{ __html: message.replace(/\n/g, '<br/>') }}></p>
      </div>
    </Modal>
  )
}