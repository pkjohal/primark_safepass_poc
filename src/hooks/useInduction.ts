import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { INDUCTION_VALIDITY_DAYS } from '../lib/constants'
import type { InductionRecord, Site } from '../lib/types'

export function useInduction() {
  const checkInductionValid = useCallback(async (
    visitorId: string,
    site: Site
  ): Promise<{ valid: boolean; record: InductionRecord | null }> => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - INDUCTION_VALIDITY_DAYS)

    const { data } = await supabase
      .from('induction_records')
      .select('*')
      .eq('visitor_id', visitorId)
      .eq('site_id', site.id)
      .eq('content_version', site.hs_content_version)
      .gte('completed_at', cutoff.toISOString())
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const record = data as InductionRecord | null
    return { valid: !!record, record }
  }, [])

  const completeInduction = useCallback(async (
    visitorId: string,
    siteId: string,
    contentVersion: number,
    visitId: string
  ): Promise<void> => {
    const { error } = await supabase
      .from('induction_records')
      .insert({
        visitor_id: visitorId,
        site_id: siteId,
        content_version: contentVersion,
        visit_id: visitId,
      })
    if (error) throw error

    // Update visit record
    await supabase
      .from('visits')
      .update({
        induction_completed: true,
        induction_completed_at: new Date().toISOString(),
        induction_version: contentVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', visitId)
  }, [])

  return { checkInductionValid, completeInduction }
}
