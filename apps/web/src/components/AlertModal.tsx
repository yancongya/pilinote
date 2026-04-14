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
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
    success: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
    error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' },
  }

  const color = colors[type]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <button
          className="px-5 py-3 border-none rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150 ease-out min-h-[44px] min-w-[44px] touch-manipulation bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.2)] hover:bg-blue-700 hover:shadow-[0_4px_12px_rgba(37,99,235,0.3)] focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
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