import { useState, useEffect } from 'react'

interface Props {
  onComplete: (pin: string) => void
  error?: boolean
  disabled?: boolean
}

const PIN_LENGTH = 4

export default function PinPad({ onComplete, error = false, disabled = false }: Props) {
  const [digits, setDigits] = useState<string[]>([])

  useEffect(() => {
    if (error) {
      setDigits([])
    }
  }, [error])

  function press(val: string) {
    if (disabled) return
    if (val === 'backspace') {
      setDigits((d) => d.slice(0, -1))
      return
    }
    const next = [...digits, val]
    setDigits(next)
    if (next.length === PIN_LENGTH) {
      onComplete(next.join(''))
    }
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace']

  return (
    <div className="flex flex-col items-center gap-4">
      {/* PIN dots */}
      <div className="flex gap-4">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              i < digits.length
                ? 'bg-primark-blue border-primark-blue'
                : 'bg-white border-border-grey'
            }`}
          />
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {keys.map((key, idx) => {
          if (key === '') return <div key={idx} />
          if (key === 'backspace') {
            return (
              <button
                key={idx}
                onClick={() => press('backspace')}
                disabled={disabled || digits.length === 0}
                className="flex items-center justify-center h-14 rounded-xl bg-light-grey text-charcoal font-semibold text-lg hover:bg-border-grey active:scale-95 transition-all disabled:opacity-40 select-none"
                aria-label="Backspace"
              >
                ←
              </button>
            )
          }
          return (
            <button
              key={idx}
              onClick={() => press(key)}
              disabled={disabled || digits.length >= PIN_LENGTH}
              className="flex items-center justify-center h-14 rounded-xl bg-white border border-border-grey text-navy font-semibold text-xl hover:bg-primark-blue-light hover:border-primark-blue active:scale-95 transition-all disabled:opacity-40 select-none shadow-card"
            >
              {key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
