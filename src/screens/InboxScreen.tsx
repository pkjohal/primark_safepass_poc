import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../hooks/useNotifications'
import { useAuditLog } from '../hooks/useAuditLog'
import NotificationRow from '../components/notifications/NotificationRow'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/layout/PageHeader'

export default function InboxScreen() {
  const { user } = useAuth()
  const { notifications, loading, markRead, acknowledge } = useNotifications(user?.id)
  const { log } = useAuditLog()

  async function handleAcknowledge(id: string) {
    await acknowledge(id)
    if (user) {
      await log('notification_acknowledged', 'notification', id, user.id)
    }
  }

  const unread = notifications.filter((n) => !n.is_read).length

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Inbox"
        subtitle={unread > 0 ? `${unread} unread notification${unread > 1 ? 's' : ''}` : 'All caught up'}
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 skeleton rounded-xl" />)}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="📬"
          title="No notifications"
          message="You'll receive alerts here for visitor check-ins, escort requests, and other events."
        />
      ) : (
        <div className="bg-white rounded-xl shadow-card divide-y divide-border-grey overflow-hidden">
          {notifications.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onClick={() => markRead(n.id)}
              onAcknowledge={n.requires_acknowledgement && !n.acknowledged_at
                ? () => handleAcknowledge(n.id)
                : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
