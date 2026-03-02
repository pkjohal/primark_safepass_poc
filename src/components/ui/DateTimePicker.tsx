interface Props {
  label: string
  value: string        // "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void
  min?: string         // "YYYY-MM-DDTHH:mm"
  required?: boolean
  error?: string
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

export default function DateTimePicker({ label, value, onChange, min, required, error }: Props) {
  const datePart = value.slice(0, 10)
  const hourPart = value.slice(11, 13)
  const minPart  = value.slice(14, 16)

  const minDate = min?.slice(0, 10) ?? ''
  const minHour = min?.slice(11, 13) ?? ''
  const minMin  = min?.slice(14, 16) ?? ''

  function emit(d: string, h: string, m: string) {
    if (d && h && m) onChange(`${d}T${h}:${m}`)
  }

  function handleDateChange(d: string) {
    emit(d, hourPart || '09', minPart || '00')
  }

  function handleHourChange(h: string) {
    emit(datePart || new Date().toISOString().slice(0, 10), h, minPart || '00')
  }

  function handleMinChange(m: string) {
    emit(datePart || new Date().toISOString().slice(0, 10), hourPart || '09', m)
  }

  const isMinDate = datePart === minDate

  const availableHours = HOURS.filter((h) => {
    if (!minDate || !datePart || datePart > minDate) return true
    return isMinDate ? h >= minHour : true
  })

  const availableMins = MINUTES.filter((m) => {
    if (!isMinDate || !hourPart) return true
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
        <input
          type="date"
          value={datePart}
          onChange={(e) => handleDateChange(e.target.value)}
          min={minDate || undefined}
          required={required}
          className={`flex-1 ${selectBase}`}
        />
        <select
          value={hourPart}
          onChange={(e) => handleHourChange(e.target.value)}
          disabled={!datePart}
          className={`w-20 shrink-0 ${selectBase}`}
        >
          <option value="" disabled>HH</option>
          {availableHours.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <select
          value={minPart}
          onChange={(e) => handleMinChange(e.target.value)}
          disabled={!datePart || !hourPart}
          className={`w-20 shrink-0 ${selectBase}`}
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
