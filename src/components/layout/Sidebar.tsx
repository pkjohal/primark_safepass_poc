import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, CalendarPlus, ClipboardCheck,
  Users, ShieldOff, Settings, SlidersHorizontal,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { hasMinRole } from '../../lib/permissions'

interface NavItem {
  to: string
  label: string
  end?: boolean
  minRole?: string
  icon: React.ReactNode
}

interface NavSection {
  label?: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    items: [
      {
        to: '/',
        end: true,
        label: 'Dashboard',
        icon: <LayoutDashboard className="w-[18px] h-[18px]" />,
      },
    ],
  },
  {
    label: 'Visits',
    items: [
      {
        to: '/upcoming',
        label: 'Upcoming Visits',
        icon: <Calendar className="w-[18px] h-[18px]" />,
      },
      {
        to: '/schedule',
        label: 'Schedule Visit',
        minRole: 'reception',
        icon: <CalendarPlus className="w-[18px] h-[18px]" />,
      },
      {
        to: '/pre-approvals',
        label: 'Pre-Approvals',
        minRole: 'reception',
        icon: <ClipboardCheck className="w-[18px] h-[18px]" />,
      },
    ],
  },
  {
    label: 'Visitors',
    items: [
      {
        to: '/visitors',
        label: 'Visitors',
        icon: <Users className="w-[18px] h-[18px]" />,
      },
      {
        to: '/deny-list',
        label: 'Deny List',
        minRole: 'site_admin',
        icon: <ShieldOff className="w-[18px] h-[18px]" />,
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        to: '/site-config',
        label: 'Site Config',
        minRole: 'site_admin',
        icon: <Settings className="w-[18px] h-[18px]" />,
      },
      {
        to: '/admin',
        label: 'Admin',
        minRole: 'site_admin',
        icon: <SlidersHorizontal className="w-[18px] h-[18px]" />,
      },
    ],
  },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: Props) {
  const { user, site } = useAuth()
  const location = useLocation()

  function isVisible(item: NavItem) {
    if (!item.minRole) return true
    return user ? hasMinRole(user.role, item.minRole) : false
  }

  const navContent = (
    <div className="flex flex-col h-full">
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {navSections.map((section) => {
          const visibleItems = section.items.filter(isVisible)
          if (visibleItems.length === 0) return null

          return (
            <div key={section.label ?? '__top'}>
              {section.label && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-3 mb-1">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = item.end
                    ? location.pathname === item.to
                    : location.pathname === item.to || location.pathname.startsWith(item.to + '/')

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primark-blue text-white'
                          : 'text-mid-grey hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Site info at bottom */}
      {site && (
        <div className="p-4 border-t border-white/10 shrink-0">
          <p className="text-white text-xs font-medium truncate">{site.name}</p>
          <p className="text-mid-grey text-xs mt-0.5">{site.site_code}</p>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-navy flex-col flex-shrink-0 border-r border-white/10">
        {navContent}
      </aside>

      {/* Mobile drawer overlay */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={onClose}
          />
          <aside className="fixed left-0 top-0 bottom-0 z-50 w-64 bg-navy flex flex-col md:hidden">
            <div className="flex items-center justify-between px-4 h-16 border-b border-white/10 shrink-0">
              <div className="flex items-baseline gap-2">
                <span className="font-primark uppercase text-primark-blue" style={{ fontSize: '20px' }}>PRIMARK</span>
                <span className="text-mid-grey text-xs">SafePass</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-mid-grey hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {navContent}
          </aside>
        </>
      )}
    </>
  )
}
