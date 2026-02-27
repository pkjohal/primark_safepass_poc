import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../hooks/useNotifications'
import NotificationRow from '../notifications/NotificationRow'

const ROLE_LABELS: Record<string, string> = {
  host:       'Host',
  reception:  'Reception',
  site_admin: 'Site Admin',
}

interface Props {
  onMenuToggle: () => void
}

export default function NavBar({ onMenuToggle }: Props) {
  const { user, site, logout, unreadNotificationCount } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  const { notifications, markRead, acknowledge } = useNotifications(user?.id)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <header className="h-16 bg-navy flex items-center px-4 gap-4 flex-shrink-0 relative z-30">

      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="md:hidden p-2 text-mid-grey hover:text-white transition-colors"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Branding */}
      <div className="flex items-baseline gap-2">
        <span className="font-primark uppercase text-primark-blue" style={{ fontSize: '24px' }}>PRIMARK</span>
        <span className="text-mid-grey text-sm">SafePass</span>
      </div>

      <div className="flex-1" />

      {/* Bell + dropdown */}
      <div className="relative" ref={bellRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative p-2 text-mid-grey hover:text-white transition-colors"
          aria-label="Notifications"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadNotificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-danger text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1">
              {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-border-grey overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-grey">
              <h3 className="text-sm font-semibold text-navy">Notifications</h3>
              {unreadNotificationCount > 0 && (
                <span className="text-xs text-mid-grey">{unreadNotificationCount} unread</span>
              )}
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto divide-y divide-border-grey">
              {notifications.length === 0 ? (
                <p className="text-sm text-mid-grey text-center py-8">No notifications</p>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onClick={() => { markRead(n.id); if (n.action_url) { setOpen(false); navigate(n.action_url) } }}
                    onAcknowledge={() => acknowledge(n.id)}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border-grey px-4 py-2.5">
              <button
                onClick={() => { setOpen(false); navigate('/inbox') }}
                className="w-full text-sm text-primark-blue font-medium hover:underline text-center"
              >
                View all notifications
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User info */}
      {user && (
        <div className="flex items-center gap-3 text-sm">
          <div className="text-right hidden sm:block">
            <p className="text-white font-medium leading-none">{user.name}</p>
            <p className="text-mid-grey text-xs mt-0.5">{site?.name}</p>
          </div>
          <span className="bg-primark-blue/20 text-primark-blue text-xs font-semibold rounded-full px-2 py-0.5">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="p-2 text-mid-grey hover:text-white transition-colors"
            aria-label="Logout"
          >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      )}
    </header>
  )
}
