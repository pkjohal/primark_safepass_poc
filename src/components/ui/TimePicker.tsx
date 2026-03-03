interface Props {
  label: string
  value: string        // "HH:mm"
  onChange: (value: string) => void
  min?: string         // "HH:mm"
  disabled?: boolean
  required?: boolean
  error?: string
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

export default function TimePicker({ label, value, onChange, min, disabled, required, error }: Props) {
  const hourPart = value.slice(0, 2)
  const minPart = value.slice(3, 5)
  const minHour = min?.slice(0, 2) ?? ''
  const minMin = min?.slice(3, 5) ?? ''

  function handleHourChange(h: string) {
    const needsSnap = minHour && h === minHour && minPart < minMin
    const nextMin = needsSnap ? (MINUTES.find((m) => m >= minMin) ?? '00') : (minPart || '00')
    onChange(`${h}:${nextMin}`)
  }

  function handleMinChange(m: string) {
    if (hourPart) onChange(`${hourPart}:${m}`)
  }

  const availableHours = HOURS.filter((h) => !minHour || h >= minHour)

  const availableMins = MINUTES.filter((m) => {
    if (!minHour || !hourPart) return true
    if (hourPart > minHour) return true
    if (hourPart === minHour) return m >= minMin
    return false
  })

  const selectBase = `px-2 py-2.5 border rounded-lg text-sm text-charcoal bg-white min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue focus:border-transparent ${
    error ? 'border-danger' : 'border-border-grey'
  }`

  return (
    <div>
      <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-danger ml-1">*</span>}
      </label>
      <div className="flex gap-2">
        <select
          value={hourPart}
          onChange={(e) => handleHourChange(e.target.value)}
          disabled={disabled}
          className={`flex-1 ${selectBase}`}
        >
          <option value="" disabled>HH</option>
          {availableHours.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <select
          value={minPart}
          onChange={(e) => handleMinChange(e.target.value)}
          disabled={disabled || !hourPart}
          className={`flex-1 ${selectBase}`}
        >
          <option value="" disabled>MM</option>
          {availableMins.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  )
}
