import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { DenyListEntry, Visitor } from '../lib/types'

export function useDenyList() {
  const checkDenyList = useCallback(async (
    visitor: Visitor,
    siteId: string
  ): Promise<DenyListEntry | null> => {
    // Primary match: visitor_id
    const { data: byId } = await supabase
      .from('deny_list')
      .select('*')
      .eq('site_id', siteId)
      .eq('visitor_id', visitor.id)
      .eq('is_active', true)
      .or('is_permanent.eq.true,expires_at.gt.' + new Date().toISOString())
      .maybeSingle()

    if (byId) return byId as DenyListEntry

    // Fallback: email match
    if (!visitor.email) return null
    const { data: byEmail } = await supabase
      .from('deny_list')
      .select('*')
      .eq('site_id', siteId)
      .ilike('visitor_email', visitor.email)
      .eq('is_active', true)
      .or('is_permanent.eq.true,expires_at.gt.' + new Date().toISOString())
      .maybeSingle()

    return (byEmail as DenyListEntry) ?? null
  }, [])

  const getDenyListEntries = useCallback(async (siteId: string): Promise<DenyListEntry[]> => {
    const { data } = await supabase
      .from('deny_list')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
    return (data as DenyListEntry[]) ?? []
  }, [])

  const addToDenyList = useCallback(async (payload: {
    visitor_id?: string
    visitor_name: string
    visitor_email?: string
    site_id: string
    reason: string
    is_permanent: boolean
    expires_at?: string
    added_by: string
  }): Promise<void> => {
    const { error } = await supabase.from('deny_list').insert(payload)
    if (error) throw error
  }, [])

  const updateDenyListEntry = useCallback(async (id: string, updates: Partial<DenyListEntry>): Promise<void> => {
    const { error } = await supabase
      .from('deny_list')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }, [])

  const removeDenyListEntry = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('deny_list')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }, [])

  return { checkDenyList, getDenyListEntries, addToDenyList, updateDenyListEntry, removeDenyListEntry }
}
