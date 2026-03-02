import type { ReactNode } from 'react'
import {
  Calendar, CalendarX, PenLine, UserCheck, ArrowRightFromLine,
  AlertTriangle, AlertOctagon, Bell, ClipboardList, ClipboardCheck,
  ShieldAlert, Flame, DoorOpen, Mail,
} from 'lucide-react'
import type { Notification } from '../../lib/types'
import { formatDate } from '../../lib/utils'

interface Props {
  notification: Notification
  onClick?: () => void
  onAcknowledge?: () => void
}

const typeIcon: Record<string, ReactNode> = {
  visit_scheduled:        <Calendar        className="w-5 h-5 text-primark-blue" />,
  visit_cancelled:        <CalendarX       className="w-5 h-5 text-danger" />,
  visit_amended:          <PenLine         className="w-5 h-5 text-charcoal" />,
  checkin_host_alert:     <UserCheck       className="w-5 h-5 text-success" />,
  escort_required:        <ArrowRightFromLine className="w-5 h-5 text-primark-blue" />,
  escalation:             <AlertTriangle   className="w-5 h-5 text-warning" />,
  escalation_reception:   <AlertOctagon    className="w-5 h-5 text-danger" />,
  host_reminder:          <Bell            className="w-5 h-5 text-primark-blue" />,
  pre_approval_request:   <ClipboardList   className="w-5 h-5 text-charcoal" />,
  pre_approval_decision:  <ClipboardCheck  className="w-5 h-5 text-success" />,
  deny_list_alert:        <ShieldAlert     className="w-5 h-5 text-danger" />,
  evacuation_activated:   <Flame           className="w-5 h-5 text-danger" />,
  walk_in_host_confirm:   <DoorOpen        className="w-5 h-5 text-charcoal" />,
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
      <div className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center shrink-0">
        {typeIcon[n.notification_type] ?? <Mail className="w-5 h-5 text-mid-grey" />}
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
