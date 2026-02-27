interface Props {
  icon?: React.ReactNode
  title: string
  message?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export default function EmptyState({ icon, title, message, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-light-grey flex items-center justify-center mb-4 text-mid-grey text-2xl">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-navy mb-1">{title}</h3>
      {message && <p className="text-sm text-mid-grey mb-6 max-w-xs">{message}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 bg-primark-blue text-white rounded-lg font-medium text-sm hover:bg-primark-blue-dark transition-colors min-h-btn"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
