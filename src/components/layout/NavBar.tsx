import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const roleBadgeColour: Record<string, string> = {
  host:       'bg-primark-blue-light text-primark-blue',
  reception:  'bg-warning-bg text-warning',
  site_admin: 'bg-danger-bg text-danger',
}

const roleLabel: Record<string, string> = {
  host:       'Host',
  reception:  'Reception',
  site_admin: 'Site Admin',
}

export default function NavBar() {
  const { user, site, logout, unreadNotificationCount } = useAuth()
  const navigate = useNavigate()

  return (
    <nav className="h-16 bg-navy flex items-center justify-between px-6 shrink-0 z-10">
      {/* Left: Branding */}
      <div className="flex flex-col">
        <span className="text-primark-blue font-bold uppercase tracking-[0.15em] text-lg leading-none">
          PRIMARK
        </span>
        <span className="text-mid-grey text-xs">SafePass</span>
      </div>

      {/* Right: User info + actions */}
      {user && (
        <div className="flex items-center gap-4">
          {site && (
            <span className="text-mid-grey text-sm hidden sm:block">{site.name}</span>
          )}

          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium hidden sm:block">{user.name}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleBadgeColour[user.role] ?? 'bg-light-grey text-charcoal'}`}>
              {roleLabel[user.role] ?? user.role}
            </span>
          </div>

          {/* Notification bell */}
          <button
            onClick={() => navigate('/inbox')}
            className="relative text-mid-grey hover:text-white transition-colors p-1"
            aria-label="Notifications"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadNotificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-danger text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
              </span>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="text-mid-grey hover:text-white text-sm transition-colors hidden sm:block"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  )
}
