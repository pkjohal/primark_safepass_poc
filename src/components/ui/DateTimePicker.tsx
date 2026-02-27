interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  min?: string
  required?: boolean
  error?: string
}

export default function DateTimePicker({ label, value, onChange, min, required, error }: Props) {
  return (
    <div>
      <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-danger ml-1">*</span>}
      </label>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        required={required}
        className={`w-full px-3 py-2.5 border rounded-lg text-sm text-charcoal bg-white min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue focus:border-transparent ${
          error ? 'border-danger' : 'border-border-grey'
        }`}
      />
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  )
}
