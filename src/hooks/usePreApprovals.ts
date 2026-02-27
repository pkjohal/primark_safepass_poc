import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { PreApproval } from '../lib/types'

export function usePreApprovals() {
  const getForVisitorSite = useCallback(async (
    visitorId: string,
    siteId: string
  ): Promise<PreApproval | null> => {
    const { data } = await supabase
      .from('pre_approvals')
      .select('*')
      .eq('visitor_id', visitorId)
      .eq('site_id', siteId)
      .eq('status', 'approved')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    return (data as PreApproval) ?? null
  }, [])

  const getAll = useCallback(async (siteId: string): Promise<PreApproval[]> => {
    const { data } = await supabase
      .from('pre_approvals')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
    return (data as PreApproval[]) ?? []
  }, [])

  const getForUser = useCallback(async (userId: string): Promise<PreApproval[]> => {
    const { data } = await supabase
      .from('pre_approvals')
      .select('*')
      .eq('requested_by', userId)
      .order('created_at', { ascending: false })
    return (data as PreApproval[]) ?? []
  }, [])

  const request = useCallback(async (payload: {
    visitor_id: string
    site_id: string
    requested_by: string
    reason?: string
  }): Promise<void> => {
    const { error } = await supabase.from('pre_approvals').insert(payload)
    if (error) throw error
  }, [])

  const approve = useCallback(async (id: string, approvedBy: string, defaultDays: number): Promise<void> => {
    const expires = new Date()
    expires.setDate(expires.getDate() + defaultDays)
    const { error } = await supabase
      .from('pre_approvals')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        expires_at: expires.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw error
  }, [])

  const reject = useCallback(async (id: string, reason: string, approvedBy: string): Promise<void> => {
    const { error } = await supabase
      .from('pre_approvals')
      .update({
        status: 'rejected',
        reason,
        approved_by: approvedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw error
  }, [])

  const revoke = useCallback(async (id: string, revokedBy: string): Promise<void> => {
    const { error } = await supabase
      .from('pre_approvals')
      .update({
        status: 'revoked',
        revoked_by: revokedBy,
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw error
  }, [])

  return { getForVisitorSite, getAll, getForUser, request, approve, reject, revoke }
}
