import { useEffect, useRef, useState } from 'react'

interface Props {
  placeholder?: string
  onSearch: (value: string) => void
  defaultValue?: string
  className?: string
}

export default function SearchBar({ placeholder = 'Search...', onSearch, defaultValue = '', className = '' }: Props) {
  const [value, setValue] = useState(defaultValue)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onSearch(value), 300)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [value, onSearch])

  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 text-mid-grey w-4 h-4"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 border border-border-grey rounded-lg text-sm text-charcoal bg-white min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue focus:border-transparent placeholder:text-mid-grey"
      />
      {value && (
        <button
          onClick={() => setValue('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-mid-grey hover:text-charcoal"
          aria-label="Clear"
        >
          ×
        </button>
      )}
    </div>
  )
}
