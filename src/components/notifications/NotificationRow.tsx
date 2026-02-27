import type { Notification } from '../../lib/types'
import { formatDate } from '../../lib/utils'

interface Props {
  notification: Notification
  onClick?: () => void
  onAcknowledge?: () => void
}

const typeIcon: Record<string, string> = {
  visit_scheduled:        '📅',
  visit_cancelled:        '❌',
  visit_amended:          '✏️',
  checkin_host_alert:     '✅',
  escort_required:        '🚶',
  escalation:             '⚠️',
  escalation_reception:   '🚨',
  host_reminder:          '🔔',
  pre_approval_request:   '📋',
  pre_approval_decision:  '✍️',
  deny_list_alert:        '🚫',
  evacuation_activated:   '🔴',
  walk_in_host_confirm:   '🚪',
}

export default function NotificationRow({ notification: n, onClick, onAcknowledge }: Props) {
  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-colors ${
        n.is_read ? 'bg-white' : 'bg-primark-blue-light'
      } hover:bg-light-grey`}
      onClick={onClick}
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center text-lg shrink-0">
        {typeIcon[n.notification_type] ?? '📨'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold ${n.is_read ? 'text-charcoal' : 'text-navy'} leading-snug`}>
            {n.title}
          </p>
          <span className="text-xs text-mid-grey whitespace-nowrap shrink-0">
            {formatDate(n.created_at, 'relative')}
          </span>
        </div>
        <p className="text-xs text-mid-grey mt-0.5 line-clamp-2">{n.body}</p>

        {/* Acknowledge button */}
        {n.requires_acknowledgement && !n.acknowledged_at && onAcknowledge && (
          <button
            onClick={(e) => { e.stopPropagation(); onAcknowledge() }}
            className="mt-2 text-xs font-semibold text-white bg-primark-blue px-3 py-1.5 rounded-lg hover:bg-primark-blue-dark transition-colors"
          >
            Acknowledge — I'm coming to collect
          </button>
        )}
        {n.acknowledged_at && (
          <p className="mt-1 text-xs text-success font-medium">
            ✓ Acknowledged {formatDate(n.acknowledged_at, 'relative')}
          </p>
        )}
      </div>

      {/* Unread dot */}
      {!n.is_read && (
        <div className="w-2.5 h-2.5 bg-primark-blue rounded-full shrink-0 mt-1.5" />
      )}
    </div>
  )
}
