import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { EvacuationEvent, VisitWithVisitor } from '../lib/types'

export function useEvacuation() {
  const activate = useCallback(async (
    siteId: string,
    activatedBy: string,
    headcount: number
  ): Promise<EvacuationEvent> => {
    const { data, error } = await supabase
      .from('evacuation_events')
      .insert({
        site_id: siteId,
        activated_by: activatedBy,
        headcount_at_activation: headcount,
      })
      .select()
      .single()
    if (error) throw error
    return data as EvacuationEvent
  }, [])

  const close = useCallback(async (
    id: string,
    closedBy: string,
    notes?: string
  ): Promise<void> => {
    const { error } = await supabase
      .from('evacuation_events')
      .update({
        closed_at: new Date().toISOString(),
        closed_by: closedBy,
        notes: notes ?? null,
      })
      .eq('id', id)
    if (error) throw error
  }, [])

  const updateHeadcount = useCallback(async (id: string, accounted: number): Promise<void> => {
    const { error } = await supabase
      .from('evacuation_events')
      .update({ headcount_accounted: accounted })
      .eq('id', id)
    if (error) throw error
  }, [])

  const getCheckedInVisitors = useCallback(async (siteId: string): Promise<VisitWithVisitor[]> => {
    const { data } = await supabase
      .from('visits')
      .select(`
        *,
        visitor:visitors(*),
        host:members!visits_host_user_id_fkey(id,name,username,email,site_id,role,is_active,created_at,updated_at)
      `)
      .eq('site_id', siteId)
      .eq('status', 'checked_in')
      .order('actual_arrival')
    return (data as VisitWithVisitor[]) ?? []
  }, [])

  return { activate, close, updateHeadcount, getCheckedInVisitors }
}
