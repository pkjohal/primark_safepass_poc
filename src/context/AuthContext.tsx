import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { supabase } from '../lib/supabase'
import { verifyPin } from '../lib/auth'
import { hasMinRole } from '../lib/permissions'
import type { Site, SafeUser, EvacuationEvent } from '../lib/types'

interface AuthContextValue {
  site: Site | null
  user: SafeUser | null
  isHost: boolean
  isReception: boolean
  isSiteAdmin: boolean
  login: (username: string, pin: string) => Promise<boolean>
  logout: () => void
  unreadNotificationCount: number
  activeEvacuation: EvacuationEvent | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [site, setSite] = useState<Site | null>(null)
  const [user, setUser] = useState<SafeUser | null>(null)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [activeEvacuation, setActiveEvacuation] = useState<EvacuationEvent | null>(null)
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const logout = useCallback(() => {
    setUser(null)
    setSite(null)
    setUnreadNotificationCount(0)
    setActiveEvacuation(null)
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
  }, [])

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    inactivityTimer.current = setTimeout(logout, INACTIVITY_TIMEOUT_MS)
  }, [logout])

  // Attach inactivity listeners when logged in
  useEffect(() => {
    if (!user) return
    const events = ['mousemove', 'keydown', 'click', 'touchstart']
    events.forEach((e) => window.addEventListener(e, resetInactivityTimer))
    resetInactivityTimer()
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetInactivityTimer))
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    }
  }, [user, resetInactivityTimer])

  // Realtime: unread notifications for current user
  useEffect(() => {
    if (!user) return

    // Fetch initial unread count
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_user_id', user.id)
      .eq('is_read', false)
      .then(({ count }) => setUnreadNotificationCount(count ?? 0))

    const channel = supabase
      .channel(`notifications:user:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `recipient_user_id=eq.${user.id}`,
        },
        () => {
          // Re-fetch unread count on any change
          supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('recipient_user_id', user.id)
            .eq('is_read', false)
            .then(({ count }) => setUnreadNotificationCount(count ?? 0))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  // Realtime: active evacuation for current site
  useEffect(() => {
    if (!site) return

    // Fetch initial active evacuation
    supabase
      .from('evacuation_events')
      .select('*')
      .eq('site_id', site.id)
      .is('closed_at', null)
      .maybeSingle()
      .then(({ data }) => setActiveEvacuation(data))

    const channel = supabase
      .channel(`evacuation:site:${site.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'evacuation_events',
          filter: `site_id=eq.${site.id}`,
        },
        () => {
          supabase
            .from('evacuation_events')
            .select('*')
            .eq('site_id', site.id)
            .is('closed_at', null)
            .maybeSingle()
            .then(({ data }) => setActiveEvacuation(data))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [site])

  const login = useCallback(async (username: string, pin: string): Promise<boolean> => {
    // Fetch user by username (includes pin_hash for verification only)
    const { data: userRow, error } = await supabase
      .from('members')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single()

    if (error || !userRow) return false

    const valid = await verifyPin(pin, userRow.pin_hash)
    if (!valid) return false

    // Fetch site
    const { data: siteRow } = await supabase
      .from('sites')
      .select('*')
      .eq('id', userRow.site_id)
      .single()

    if (!siteRow) return false

    // Store SafeUser (no pin_hash)
    const { pin_hash: _ph, ...safeUser } = userRow
    setUser(safeUser as SafeUser)
    setSite(siteRow as Site)
    return true
  }, [])

  const isHost = user ? hasMinRole(user.role, 'host') : false
  const isReception = user ? hasMinRole(user.role, 'reception') : false
  const isSiteAdmin = user ? hasMinRole(user.role, 'site_admin') : false

  return (
    <AuthContext.Provider
      value={{
        site,
        user,
        isHost,
        isReception,
        isSiteAdmin,
        login,
        logout,
        unreadNotificationCount,
        activeEvacuation,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
