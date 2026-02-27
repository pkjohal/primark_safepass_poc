import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { isToday } from '../lib/utils'
import type { Visit, VisitWithVisitor } from '../lib/types'

export function useVisits() {
  const { site } = useAuth()
  const [todaysVisits, setTodaysVisits] = useState<VisitWithVisitor[]>([])
  const [checkedInVisits, setCheckedInVisits] = useState<VisitWithVisitor[]>([])
  const [loading, setLoading] = useState(true)

  const fetchVisits = useCallback(async () => {
    if (!site) return
    setLoading(true)

    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

    const { data } = await supabase
      .from('visits')
      .select(`
        *,
        visitor:visitors(*),
        host:members!visits_host_user_id_fkey(id,name,username,email,site_id,role,is_active,created_at,updated_at)
      `)
      .eq('site_id', site.id)
      .or(`planned_arrival.gte.${startOfDay},status.eq.checked_in`)
      .lt('planned_arrival', endOfDay)
      .neq('status', 'cancelled')
      .order('planned_arrival')

    const all = (data as VisitWithVisitor[]) ?? []
    setTodaysVisits(all.filter((v) => isToday(v.planned_arrival) && v.status === 'scheduled'))
    setCheckedInVisits(all.filter((v) => v.status === 'checked_in'))
    setLoading(false)
  }, [site])

  // Initial load + Realtime subscription
  useEffect(() => {
    fetchVisits()
    if (!site) return

    const channel = supabase
      .channel(`visits:site:${site.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits', filter: `site_id=eq.${site.id}` },
        () => fetchVisits()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [site, fetchVisits])

  const getVisitById = useCallback(async (id: string): Promise<VisitWithVisitor | null> => {
    const { data } = await supabase
      .from('visits')
      .select(`
        *,
        visitor:visitors(*),
        host:members!visits_host_user_id_fkey(id,name,username,email,site_id,role,is_active,created_at,updated_at)
      `)
      .eq('id', id)
      .single()
    return (data as VisitWithVisitor) ?? null
  }, [])

  const getVisitsForVisitor = useCallback(async (visitorId: string): Promise<VisitWithVisitor[]> => {
    const { data } = await supabase
      .from('visits')
      .select(`
        *,
        visitor:visitors(*),
        host:members!visits_host_user_id_fkey(id,name,username,email,site_id,role,is_active,created_at,updated_at)
      `)
      .eq('visitor_id', visitorId)
      .order('planned_arrival', { ascending: false })
    return (data as VisitWithVisitor[]) ?? []
  }, [])

  const createVisit = useCallback(async (payload: {
    visitor_id: string
    site_id: string
    host_user_id: string
    purpose: string
    planned_arrival: string
    planned_departure: string
    is_walk_in?: boolean
  }): Promise<Visit> => {
    const { data, error } = await supabase
      .from('visits')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data as Visit
  }, [])

  const updateVisit = useCallback(async (id: string, updates: Partial<Visit>): Promise<void> => {
    const { error } = await supabase
      .from('visits')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }, [])

  const getUpcomingVisits = useCallback(async (): Promise<VisitWithVisitor[]> => {
    if (!site) return []
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('visits')
      .select(`
        *,
        visitor:visitors(*),
        host:members!visits_host_user_id_fkey(id,name,username,email,site_id,role,is_active,created_at,updated_at)
      `)
      .eq('site_id', site.id)
      .gte('planned_arrival', tomorrow.toISOString())
      .eq('status', 'scheduled')
      .order('planned_arrival')
    return (data as VisitWithVisitor[]) ?? []
  }, [site])

  return { todaysVisits, checkedInVisits, loading, fetchVisits, getVisitById, getVisitsForVisitor, createVisit, updateVisit, getUpcomingVisits }
}
