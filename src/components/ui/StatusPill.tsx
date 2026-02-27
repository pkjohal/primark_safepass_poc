import type { VisitDisplayStatus } from '../../lib/types'

type PillVariant = VisitDisplayStatus | 'awaiting_escort' | 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked' | 'denied' | 'active'

interface Props {
  status: PillVariant
  label?: string
}

const variantMap: Record<string, string> = {
  scheduled:       'bg-light-grey text-mid-grey',
  checked_in:      'bg-success-bg text-success',
  awaiting_escort: 'bg-warning-bg text-warning',
  overdue:         'bg-danger-bg text-danger',
  departed:        'bg-primark-blue-light text-primark-blue',
  cancelled:       'bg-white text-mid-grey border border-border-grey',
  denied:          'bg-white text-danger border border-danger',
  pending:         'bg-warning-bg text-warning',
  approved:        'bg-success-bg text-success',
  rejected:        'bg-danger-bg text-danger',
  expired:         'bg-light-grey text-mid-grey',
  revoked:         'bg-danger-bg text-danger',
  active:          'bg-success-bg text-success',
}

const labelMap: Record<string, string> = {
  scheduled:       'Scheduled',
  checked_in:      'Active — Unescorted',
  awaiting_escort: 'Awaiting Escort',
  overdue:         'Overdue',
  departed:        'Departed',
  cancelled:       'Cancelled',
  denied:          'Denied',
  pending:         'Pending',
  approved:        'Approved',
  rejected:        'Rejected',
  expired:         'Expired',
  revoked:         'Revoked',
  active:          'Active',
}

export default function StatusPill({ status, label }: Props) {
  const classes = variantMap[status] ?? 'bg-light-grey text-mid-grey'
  const text = label ?? labelMap[status] ?? status

  return (
    <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold ${classes}`}>
      {text}
    </span>
  )
}
