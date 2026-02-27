import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { AuditLogEntry } from '../lib/types'
import type { AuditAction, AuditEntityType } from '../lib/constants'

export function useAuditLog() {
  const log = useCallback(async (
    action: AuditAction,
    entityType: AuditEntityType,
    entityId: string | null,
    userId: string | null,
    details?: Record<string, unknown>
  ): Promise<void> => {
    await supabase.from('audit_trail').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      user_id: userId,
      details: details ?? null,
    })
  }, [])

  const getForEntity = useCallback(async (
    entityType: AuditEntityType,
    entityId: string
  ): Promise<AuditLogEntry[]> => {
    const { data } = await supabase
      .from('audit_trail')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
    return (data as AuditLogEntry[]) ?? []
  }, [])

  return { log, getForEntity }
}
