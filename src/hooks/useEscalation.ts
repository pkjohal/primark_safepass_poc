import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Site } from '../lib/types'

const POLL_INTERVAL_MS = 30_000

/**
 * Client-side escalation polling — only runs for reception/site_admin users.
 * Every 30 seconds, checks for unacknowledged escort_required notifications
 * that have exceeded the site's escalation window and triggers escalation.
 */
export function useEscalation(site: Site | null, userId: string | null, isReception: boolean) {
  useEffect(() => {
    if (!site || !userId || !isReception) return

    async function runEscalationCheck() {
      if (!site || !userId) return
      const cutoff = new Date(Date.now() - site.notification_escalation_minutes * 60 * 1000).toISOString()

      // Find unacknowledged escort_required notifications older than the escalation window
      const { data: stale } = await supabase
        .from('messages')
        .select('*, visit:visits(id, visitor_id, site_id)')
        .eq('notification_type', 'escort_required')
        .eq('requires_acknowledgement', true)
        .is('acknowledged_at', null)
        .eq('escalated', false)
        .lt('created_at', cutoff)

      if (!stale || stale.length === 0) return

      for (const notif of stale) {
        const visitId = notif.visit_id
        if (!visitId) continue

        // Find backup contact for this visit
        const { data: hostContacts } = await supabase
          .from('visit_host_contacts')
          .select('user_id, is_backup')
          .eq('visit_id', visitId)
          .eq('is_backup', true)

        let escalateTo: string | null = null
        let escalationType: string = 'escalation_reception'

        if (hostContacts && hostContacts.length > 0) {
          // Check if backup has already been escalated to (has an escalation notification)
          const { data: alreadyEsc } = await supabase
            .from('messages')
            .select('id, acknowledged_at')
            .eq('visit_id', visitId)
            .eq('notification_type', 'escalation')
            .maybeSingle()

          if (!alreadyEsc) {
            // First escalation — go to backup contact
            escalateTo = hostContacts[0].user_id
            escalationType = 'escalation'
          } else if (!alreadyEsc.acknowledged_at) {
            // Backup also hasn't acknowledged — second escalation window check
            const backupCutoff = new Date(Date.now() - site!.notification_escalation_minutes * 60 * 1000).toISOString()
            if (alreadyEsc && new Date((alreadyEsc as { id: string; acknowledged_at: string | null }).id).toISOString() < backupCutoff) {
              escalationType = 'escalation_reception'
            } else {
              continue
            }
          } else {
            continue // backup already acknowledged
          }
        }

        if (escalationType === 'escalation_reception') {
          // Get all reception/admin users at the site
          const { data: staffUsers } = await supabase
            .from('members')
            .select('id')
            .eq('site_id', site!.id)
            .in('role', ['reception', 'site_admin'])
            .eq('is_active', true)

          if (!staffUsers) continue

          for (const staff of staffUsers) {
            await supabase.from('messages').insert({
              recipient_type: 'user',
              recipient_user_id: staff.id,
              visit_id: visitId,
              notification_type: 'escalation_reception',
              title: 'Escalation: Host not responding',
              body: `No host has acknowledged the escort request for visit ${visitId}. Please follow up manually.`,
              requires_acknowledgement: false,
            })
          }
        } else if (escalateTo) {
          await supabase.from('messages').insert({
            recipient_type: 'user',
            recipient_user_id: escalateTo,
            visit_id: visitId,
            notification_type: 'escalation',
            title: 'Escalation: Visitor awaiting escort',
            body: 'The primary host has not responded. Please collect the visitor.',
            requires_acknowledgement: true,
          })
        }

        // Mark original as escalated
        await supabase
          .from('messages')
          .update({ escalated: true })
          .eq('id', notif.id)

        // Audit log
        await supabase.from('audit_trail').insert({
          action: 'escalation_triggered',
          entity_type: 'notification',
          entity_id: notif.id,
          user_id: userId,
          details: { visit_id: visitId, escalation_type: escalationType },
        })
      }
    }

    runEscalationCheck()
    const interval = setInterval(runEscalationCheck, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [site, userId, isReception])
}
