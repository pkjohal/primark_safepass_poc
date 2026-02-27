import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePreApprovals } from '../hooks/usePreApprovals'
import { useVisitors } from '../hooks/useVisitors'
import { useNotifications } from '../hooks/useNotifications'
import { useAuditLog } from '../hooks/useAuditLog'
import { formatDate } from '../lib/utils'
import PageHeader from '../components/layout/PageHeader'
import StatusPill from '../components/ui/StatusPill'
import SearchBar from '../components/ui/SearchBar'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import type { PreApproval, Visitor, SafeUser } from '../lib/types'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

interface EnrichedApproval extends PreApproval {
  visitor?: Visitor
  requester?: SafeUser
}

export default function PreApprovalScreen() {
  const { user, site, isSiteAdmin } = useAuth()
  const { getAll, getForUser, approve, reject, revoke, request } = usePreApprovals()
  const { search, visitors } = useVisitors()
  const { sendNotification } = useNotifications()
  const { log } = useAuditLog()

  const [approvals, setApprovals] = useState<EnrichedApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null)

  // Request form state (for hosts)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null)
  const [requestJustification, setRequestJustification] = useState('')
  const [visitorSearch, setVisitorSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!site || !user) return
    setLoading(true)
    const list = isSiteAdmin ? await getAll(site.id) : await getForUser(user.id)

    // Enrich with visitor + requester data
    const enriched: EnrichedApproval[] = await Promise.all(
      list.map(async (pa) => {
        const { data: v } = await supabase.from('visitors').select('*').eq('id', pa.visitor_id).single()
        const { data: r } = await supabase
          .from('members')
          .select('id,name,username,email,site_id,role,is_active,created_at,updated_at')
          .eq('id', pa.requested_by)
          .single()
        return { ...pa, visitor: v as Visitor, requester: r as SafeUser }
      })
    )
    setApprovals(enriched)
    setLoading(false)
  }, [site, user, isSiteAdmin, getAll, getForUser])

  useEffect(() => { load() }, [load])

  async function handleApprove(id: string, visitorId: string) {
    if (!user || !site) return
    try {
      await approve(id, user.id, site.pre_approval_default_days)
      await sendNotification({
        recipient_type: 'user',
        recipient_user_id: user.id,
        notification_type: 'pre_approval_decision',
        title: 'Pre-approval request approved',
        body: `Unescorted access has been approved. The approval expires in ${site.pre_approval_default_days} days.`,
      })
      await log('pre_approval_approved', 'pre_approval', id, user.id, { visitor_id: visitorId })
      toast.success('Pre-approval approved')
      load()
    } catch {
      toast.error('Failed to approve')
    }
  }

  async function handleReject() {
    if (!rejectTarget || !user) return
    try {
      await reject(rejectTarget, rejectReason, user.id)
      await log('pre_approval_rejected', 'pre_approval', rejectTarget, user.id, { reason: rejectReason })
      toast.success('Request rejected')
      setRejectTarget(null)
      setRejectReason('')
      load()
    } catch {
      toast.error('Failed to reject')
    }
  }

  async function handleRevoke(id: string) {
    if (!user) return
    try {
      await revoke(id, user.id)
      await log('pre_approval_revoked', 'pre_approval', id, user.id)
      toast.success('Pre-approval revoked')
      setRevokeTarget(null)
      load()
    } catch {
      toast.error('Failed to revoke')
    }
  }

  async function handleRequest() {
    if (!selectedVisitor || !user || !site) return
    setSubmitting(true)
    try {
      await request({
        visitor_id: selectedVisitor.id,
        site_id: site.id,
        requested_by: user.id,
        reason: requestJustification,
      })
      // Notify site admins
      const { data: admins } = await supabase
        .from('members')
        .select('id')
        .eq('site_id', site.id)
        .eq('role', 'site_admin')
        .eq('is_active', true)
      if (admins) {
        await Promise.all(admins.map((a: { id: string }) =>
          sendNotification({
            recipient_type: 'user',
            recipient_user_id: a.id,
            notification_type: 'pre_approval_request',
            title: `Pre-approval request: ${selectedVisitor.name}`,
            body: `${user.name} has requested unescorted access for ${selectedVisitor.name} (${selectedVisitor.company ?? 'No company'}). Justification: ${requestJustification || 'None provided'}`,
          })
        ))
      }
      await log('pre_approval_requested', 'pre_approval', null, user.id, {
        visitor_id: selectedVisitor.id,
      })
      toast.success('Request submitted')
      setShowRequestForm(false)
      setSelectedVisitor(null)
      setRequestJustification('')
      load()
    } catch {
      toast.error('Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const pending = approvals.filter((a) => a.status === 'pending')
  const active = approvals.filter((a) => a.status === 'approved')
  const historical = approvals.filter((a) => !['pending', 'approved'].includes(a.status))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Pre-Approvals"
        subtitle="Manage unescorted access for third-party visitors"
        actions={
          !isSiteAdmin ? (
            <button
              onClick={() => setShowRequestForm(true)}
              className="bg-primark-blue text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primark-blue-dark transition-colors min-h-btn"
            >
              + Request Access
            </button>
          ) : undefined
        }
      />

      {/* Request form (hosts only) */}
      {showRequestForm && !isSiteAdmin && (
        <div className="bg-white rounded-xl shadow-card p-5 mb-6">
          <h2 className="text-base font-semibold text-navy mb-4">Request Unescorted Access</h2>
          {selectedVisitor ? (
            <div className="flex items-center justify-between p-3 bg-primark-blue-light rounded-lg mb-4">
              <div>
                <div className="text-sm font-semibold text-navy">{selectedVisitor.name}</div>
                <div className="text-xs text-mid-grey">{selectedVisitor.email}</div>
              </div>
              <button onClick={() => setSelectedVisitor(null)} className="text-xs text-primark-blue hover:underline">Change</button>
            </div>
          ) : (
            <div className="mb-4">
              <SearchBar
                placeholder="Search for a third-party visitor..."
                onSearch={(q) => { setVisitorSearch(q); if (q) search(q) }}
                className="mb-2"
              />
              {visitorSearch && visitors.filter((v) => v.visitor_type === 'third_party').length > 0 && (
                <div className="border border-border-grey rounded-lg divide-y max-h-40 overflow-y-auto">
                  {visitors.filter((v) => v.visitor_type === 'third_party').map((v) => (
                    <button key={v.id} type="button" onClick={() => { setSelectedVisitor(v); setVisitorSearch('') }}
                      className="w-full text-left px-4 py-2.5 hover:bg-light-grey text-sm">
                      {v.name} — {v.company}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="mb-4">
            <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">Justification (optional)</label>
            <textarea
              value={requestJustification}
              onChange={(e) => setRequestJustification(e.target.value)}
              rows={3}
              placeholder="Why does this visitor need unescorted access?"
              className="w-full px-3 py-2.5 border border-border-grey rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primark-blue"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowRequestForm(false)} className="flex-1 py-2.5 border border-border-grey rounded-xl text-sm text-charcoal">Cancel</button>
            <button onClick={handleRequest} disabled={!selectedVisitor || submitting}
              className="flex-1 py-2.5 bg-primark-blue text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 skeleton rounded-xl" />)}</div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <ApprovalSection title="Pending Requests" items={pending}
              onApprove={isSiteAdmin ? handleApprove : undefined}
              onReject={isSiteAdmin ? (id) => setRejectTarget(id) : undefined}
            />
          )}
          {active.length > 0 && (
            <ApprovalSection title="Active Approvals" items={active}
              onRevoke={isSiteAdmin ? (id) => setRevokeTarget(id) : undefined}
            />
          )}
          {historical.length > 0 && (
            <ApprovalSection title="History" items={historical} />
          )}
          {approvals.length === 0 && (
            <EmptyState icon="📋" title="No pre-approvals" message="No pre-approval requests yet." />
          )}
        </div>
      )}

      {rejectTarget && (
        <ConfirmDialog
          title="Reject pre-approval request"
          message="Please provide a reason for rejection."
          confirmLabel="Reject"
          variant="danger"
          onConfirm={handleReject}
          onCancel={() => { setRejectTarget(null); setRejectReason('') }}
        >
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (required)"
            rows={3}
            className="w-full px-3 py-2 border border-border-grey rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primark-blue"
          />
        </ConfirmDialog>
      )}

      {revokeTarget && (
        <ConfirmDialog
          title="Revoke this pre-approval?"
          message="This will immediately revoke the visitor's unescorted access status. They will require an escort on their next visit."
          confirmLabel="Revoke Access"
          variant="danger"
          onConfirm={() => handleRevoke(revokeTarget)}
          onCancel={() => setRevokeTarget(null)}
        />
      )}
    </div>
  )
}

function ApprovalSection({ title, items, onApprove, onReject, onRevoke }: {
  title: string
  items: EnrichedApproval[]
  onApprove?: (id: string, visitorId: string) => void
  onReject?: (id: string) => void
  onRevoke?: (id: string) => void
}) {
  return (
    <div className="bg-white rounded-xl shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border-grey">
        <h2 className="text-sm font-semibold text-navy uppercase tracking-wide">{title} ({items.length})</h2>
      </div>
      <div className="divide-y divide-border-grey">
        {items.map((pa) => (
          <div key={pa.id} className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-navy">{pa.visitor?.name ?? 'Unknown visitor'}</div>
              <div className="text-xs text-mid-grey">{pa.visitor?.company} · Requested by {pa.requester?.name ?? '—'}</div>
              {pa.expires_at && <div className="text-xs text-mid-grey">Expires {formatDate(pa.expires_at, 'date-only')}</div>}
              {pa.reason && <div className="text-xs text-charcoal mt-1 italic">"{pa.reason}"</div>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <StatusPill status={pa.status} />
              {onApprove && pa.status === 'pending' && (
                <button onClick={() => onApprove(pa.id, pa.visitor_id)}
                  className="text-xs font-semibold text-white bg-success px-3 py-1.5 rounded-lg hover:opacity-90">
                  Approve
                </button>
              )}
              {onReject && pa.status === 'pending' && (
                <button onClick={() => onReject(pa.id)}
                  className="text-xs font-semibold text-danger border border-danger px-3 py-1.5 rounded-lg hover:bg-danger-bg">
                  Reject
                </button>
              )}
              {onRevoke && pa.status === 'approved' && (
                <button onClick={() => onRevoke(pa.id)}
                  className="text-xs font-semibold text-danger border border-danger px-3 py-1.5 rounded-lg hover:bg-danger-bg">
                  Revoke
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
