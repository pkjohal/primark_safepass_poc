import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ROLE_LABELS: Record<string, string> = {
  host:       'Host',
  reception:  'Reception',
  site_admin: 'Site Admin',
}

export default function NavBar() {
  const { user, site, logout, unreadNotificationCount } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="h-16 bg-navy flex items-center px-6 gap-4 flex-shrink-0 relative z-30">

      {/* Branding */}
      <div className="flex items-baseline gap-2">
        <span className="font-primark uppercase text-primark-blue" style={{ fontSize: '24px' }}>PRIMARK</span>
        <span className="text-mid-grey text-sm">SafePass</span>
      </div>

      <div className="flex-1" />

      {/* Bell */}
      <button
        onClick={() => navigate('/inbox')}
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
            {/* LogOut icon */}
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
