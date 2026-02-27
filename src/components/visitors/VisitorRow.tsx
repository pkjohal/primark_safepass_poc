import type { VisitWithVisitor } from '../../lib/types'
import { formatDate, getDisplayStatus } from '../../lib/utils'
import StatusPill from '../ui/StatusPill'

interface Props {
  visit: VisitWithVisitor
  onClick?: () => void
  onCheckIn?: () => void
}

function PreArrivalIcon({ done }: { done: boolean }) {
  return done ? (
    <span className="text-success" title="Complete">✓</span>
  ) : (
    <span className="text-danger" title="Outstanding">✗</span>
  )
}

export default function VisitorRow({ visit, onClick, onCheckIn }: Props) {
  const displayStatus = getDisplayStatus(visit)
  const hasDocuments = visit.documents_accepted !== undefined

  return (
    <tr
      className={`border-b border-border-grey transition-colors ${onClick ? 'cursor-pointer hover:bg-primark-blue-light' : ''}`}
      onClick={onClick}
    >
      <td className="py-3 px-4 text-sm text-charcoal whitespace-nowrap">
        {formatDate(visit.planned_arrival, 'time-only')}
      </td>
      <td className="py-3 px-4">
        <div className="text-sm font-semibold text-navy">{visit.visitor.name}</div>
        {visit.visitor.company && (
          <div className="text-xs text-mid-grey">{visit.visitor.company}</div>
        )}
      </td>
      <td className="py-3 px-4 hidden sm:table-cell">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          visit.visitor.visitor_type === 'internal_staff'
            ? 'bg-primark-blue-light text-primark-blue'
            : 'bg-light-grey text-mid-grey'
        }`}>
          {visit.visitor.visitor_type === 'internal_staff' ? 'Internal' : '3rd Party'}
        </span>
      </td>
      <td className="py-3 px-4 hidden md:table-cell">
        <div className="text-sm text-charcoal">{visit.host.name}</div>
      </td>
      <td className="py-3 px-4 hidden lg:table-cell">
        <div className="text-sm text-mid-grey truncate max-w-[160px]">{visit.purpose}</div>
      </td>
      <td className="py-3 px-4 hidden sm:table-cell">
        <div className="flex gap-2 text-sm">
          <span title="H&S Induction">
            H&S: <PreArrivalIcon done={visit.induction_completed} />
          </span>
          {hasDocuments && (
            <span title="Documents">
              Docs: <PreArrivalIcon done={visit.documents_accepted} />
            </span>
          )}
        </div>
      </td>
      <td className="py-3 px-4">
        <StatusPill
          status={displayStatus === 'checked_in' && visit.access_status === 'awaiting_escort'
            ? 'awaiting_escort'
            : displayStatus
          }
        />
      </td>
      {onCheckIn && (
        <td className="py-3 px-4">
          <button
            onClick={(e) => { e.stopPropagation(); onCheckIn() }}
            className="px-3 py-1.5 bg-primark-blue text-white text-xs font-semibold rounded-lg hover:bg-primark-blue-dark transition-colors whitespace-nowrap"
          >
            Check In
          </button>
        </td>
      )}
    </tr>
  )
}
