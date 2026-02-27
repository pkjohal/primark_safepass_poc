interface Props {
  value: number | string
  label: string
  colour?: 'blue' | 'green' | 'amber' | 'red' | 'grey'
  icon?: React.ReactNode
  onClick?: () => void
}

const colourMap = {
  blue:  { bg: 'bg-primark-blue-light', text: 'text-primark-blue',  border: 'border-primark-blue' },
  green: { bg: 'bg-success-bg',         text: 'text-success',       border: 'border-success' },
  amber: { bg: 'bg-warning-bg',         text: 'text-warning',       border: 'border-warning' },
  red:   { bg: 'bg-danger-bg',          text: 'text-danger',        border: 'border-danger' },
  grey:  { bg: 'bg-light-grey',         text: 'text-mid-grey',      border: 'border-border-grey' },
}

export default function StatCard({ value, label, colour = 'blue', icon, onClick }: Props) {
  const c = colourMap[colour]
  return (
    <div
      className={`rounded-xl p-5 shadow-card bg-white border-l-4 ${c.border} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-4xl font-bold leading-none ${c.text}`}>{value}</div>
          <div className="text-sm font-medium text-mid-grey mt-2 uppercase tracking-wide">{label}</div>
        </div>
        {icon && (
          <div className={`p-2 rounded-lg ${c.bg}`}>
            <span className={c.text}>{icon}</span>
          </div>
        )}
      </div>
    </div>
  )
}
