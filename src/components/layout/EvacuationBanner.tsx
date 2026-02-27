import { useNavigate } from 'react-router-dom'
import type { EvacuationEvent } from '../../lib/types'

interface Props {
  event: EvacuationEvent
}

export default function EvacuationBanner({ event: _event }: Props) {
  const navigate = useNavigate()

  return (
    <div className="bg-alert-red text-white px-6 py-3 flex items-center justify-between no-print">
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5 shrink-0 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd" />
        </svg>
        <span className="font-bold uppercase tracking-wide text-sm">
          EVACUATION IN PROGRESS
        </span>
        <span className="text-sm text-red-200">
          — Check-ins and sign-outs are suspended
        </span>
      </div>
      <button
        onClick={() => navigate('/evacuation')}
        className="text-sm font-semibold underline text-white hover:text-red-200 transition-colors shrink-0"
      >
        View Evacuation
      </button>
    </div>
  )
}
