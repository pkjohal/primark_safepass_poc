import { useNavigate } from 'react-router-dom'

interface Props {
  title: string
  subtitle?: string
  backTo?: string
  actions?: React.ReactNode
}

export default function PageHeader({ title, subtitle, backTo, actions }: Props) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            className="text-mid-grey hover:text-charcoal p-1.5 rounded-lg hover:bg-light-grey transition-colors"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-navy leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-mid-grey mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
