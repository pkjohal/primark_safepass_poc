import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import type { Notification } from '../lib/types'

export function useNotifications(userId?: string, visitorId?: string) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!userId && !visitorId) return
    setLoading(true)

    let query = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (userId) query = query.eq('recipient_user_id', userId)
    else if (visitorId) query = query.eq('recipient_visitor_id', visitorId)

    const { data } = await query
    setNotifications((data as Notification[]) ?? [])
    setLoading(false)
  }, [userId, visitorId])

  useEffect(() => {
    fetch()
    if (!userId && !visitorId) return

    const filter = userId
      ? `recipient_user_id=eq.${userId}`
      : `recipient_visitor_id=eq.${visitorId}`

    const channel = supabase
      .channel(`notifications:${userId ?? visitorId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter },
        (payload) => {
          const n = payload.new as Notification
          setNotifications((prev) => [n, ...prev])
          toast(n.title, { icon: '🔔', duration: 5000 })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter },
        () => fetch()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, visitorId, fetch])

  const markRead = useCallback(async (id: string) => {
    await supabase.from('messages').update({ is_read: true }).eq('id', id)
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n))
  }, [])

  const acknowledge = useCallback(async (id: string) => {
    await supabase
      .from('messages')
      .update({ acknowledged_at: new Date().toISOString(), is_read: true })
      .eq('id', id)
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, acknowledged_at: new Date().toISOString(), is_read: true } : n)
    )
  }, [])

  const sendNotification = useCallback(async (payload: {
    recipient_type: 'user' | 'visitor'
    recipient_user_id?: string
    recipient_visitor_id?: string
    visit_id?: string
    notification_type: string
    title: string
    body: string
    action_url?: string
    requires_acknowledgement?: boolean
  }): Promise<void> => {
    const { error } = await supabase.from('messages').insert(payload)
    if (error) throw error
  }, [])

  return { notifications, loading, fetch, markRead, acknowledge, sendNotification }
}
