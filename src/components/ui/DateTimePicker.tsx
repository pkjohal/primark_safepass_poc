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
    const newIsMinDate = d === minDate
    // Keep existing hour if still valid, else fall back to minHour (today) or '09' (future)
    const nextHour = hourPart && (!newIsMinDate || hourPart >= minHour)
      ? hourPart
      : (newIsMinDate ? minHour : '09')
    // On today at the current hour, snap minutes to first valid 5-min slot >= minMin
    const nextMin = newIsMinDate && nextHour === minHour
      ? (MINUTES.find((m) => m >= minMin) ?? '00')
      : (minPart || '00')
    emit(d, nextHour, nextMin)
  }

  function handleHourChange(h: string) {
    const d = datePart || new Date().toISOString().slice(0, 10)
    // If switching to the current hour on today, snap minutes forward if needed
    const needsSnap = d === minDate && h === minHour && minPart < minMin
    const nextMin = needsSnap ? (MINUTES.find((m) => m >= minMin) ?? '00') : (minPart || '00')
    emit(d, h, nextMin)
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
