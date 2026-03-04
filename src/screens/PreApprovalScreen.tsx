import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePreApprovals } from '../hooks/usePreApprovals'
import { useNotifications } from '../hooks/useNotifications'
import { useAuditLog } from '../hooks/useAuditLog'
import { useVisits } from '../hooks/useVisits'
import { formatDate, getDisplayStatus } from '../lib/utils'
import PageHeader from '../components/layout/PageHeader'
import StatusPill from '../components/ui/StatusPill'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import type { PreApproval, Visitor, SafeUser, VisitWithVisitor } from '../lib/types'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

interface EnrichedApproval extends PreApproval {
  visitor?: Visitor
  requester?: SafeUser
}

export default function PreApprovalScreen() {
  const { user, site, isSiteAdmin } = useAuth()
  const { getAll, approve, reject, revoke } = usePreApprovals()
  const { sendNotification } = useNotifications()
  const { log } = useAuditLog()
  const { getVisitsForVisitor } = useVisits()

  const [approvals, setApprovals] = useState<EnrichedApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null)
  const [viewTarget, setViewTarget] = useState<EnrichedApproval | null>(null)
  const [viewVisits, setViewVisits] = useState<VisitWithVisitor[]>([])
  const [viewVisitsLoading, setViewVisitsLoading] = useState(false)

  const load = useCallback(async () => {
    if (!site) return
    setLoading(true)
    const list = await getAll(site.id)

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
  }, [site, getAll])

  useEffect(() => { load() }, [load])

  async function openView(pa: EnrichedApproval) {
    setViewTarget(pa)
    setViewVisits([])
    if (pa.visitor_id) {
      setViewVisitsLoading(true)
      const visits = await getVisitsForVisitor(pa.visitor_id)
      setViewVisits(visits)
      setViewVisitsLoading(false)
    }
  }

  async function handleApprove(id: string, visitorId: string) {
    if (!user || !site || !isSiteAdmin) return
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
      setViewTarget(null)
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

  const pending = approvals.filter((a) => a.status === 'pending')
  const active = approvals.filter((a) => a.status === 'approved')
  const historical = approvals.filter((a) => !['pending', 'approved'].includes(a.status))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Pre-Approvals"
        subtitle="Manage unescorted access for third-party visitors"
      />

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 skeleton rounded-xl" />)}</div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <ApprovalSection title="Approved Visitors" items={active} onView={openView} />
          )}
          {pending.length > 0 && (
            <ApprovalSection title="Pending Requests" items={pending} onView={openView} />
          )}
          {historical.length > 0 && (
            <ApprovalSection title="History" items={historical} onView={openView} />
          )}
          {approvals.length === 0 && (
            <EmptyState icon={<ClipboardList className="w-7 h-7 text-mid-grey" />} title="No pre-approvals" message="No pre-approval requests yet." />
          )}
        </div>
      )}

      {/* View modal */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-border-grey shrink-0">
              <div>
                <h2 className="text-base font-semibold text-navy">{viewTarget.visitor?.name ?? 'Unknown visitor'}</h2>
                {viewTarget.visitor?.company && (
                  <p className="text-sm text-mid-grey mt-0.5">{viewTarget.visitor.company}</p>
                )}
              </div>
              <button
                onClick={() => setViewTarget(null)}
                className="p-1.5 text-mid-grey hover:text-charcoal transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
              {/* Request details */}
              <div>
                <h3 className="text-xs font-semibold text-mid-grey uppercase tracking-wide mb-3">Request Details</h3>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <dt className="text-xs text-mid-grey mb-0.5">Status</dt>
                    <dd><StatusPill status={viewTarget.status} /></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-mid-grey mb-0.5">Visitor type</dt>
                    <dd className="text-sm text-charcoal">
                      {viewTarget.visitor?.visitor_type === 'internal_staff' ? 'Internal staff' : 'Third party'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-mid-grey mb-0.5">Requested by</dt>
                    <dd className="text-sm text-charcoal">{viewTarget.requester?.name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-mid-grey mb-0.5">Requested on</dt>
                    <dd className="text-sm text-charcoal">{formatDate(viewTarget.created_at, 'date-only')}</dd>
                  </div>
                  {viewTarget.expires_at && (
                    <div>
                      <dt className="text-xs text-mid-grey mb-0.5">Expires</dt>
                      <dd className="text-sm text-charcoal">{formatDate(viewTarget.expires_at, 'date-only')}</dd>
                    </div>
                  )}
                  {viewTarget.visitor?.email && (
                    <div>
                      <dt className="text-xs text-mid-grey mb-0.5">Email</dt>
                      <dd className="text-sm text-charcoal">{viewTarget.visitor.email}</dd>
                    </div>
                  )}
                </dl>
                {viewTarget.reason && (
                  <div className="mt-3 p-3 bg-light-grey rounded-lg">
                    <p className="text-xs text-mid-grey mb-1">Justification</p>
                    <p className="text-sm text-charcoal italic">"{viewTarget.reason}"</p>
                  </div>
                )}
              </div>

              {/* Visit history */}
              <div>
                <h3 className="text-xs font-semibold text-mid-grey uppercase tracking-wide mb-3">Visit History</h3>
                {viewVisitsLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-8 skeleton rounded" />)}
                  </div>
                ) : viewVisits.length === 0 ? (
                  <p className="text-sm text-mid-grey">No visits on record.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left">
                          <th className="py-1.5 pr-4 text-xs font-medium text-mid-grey uppercase tracking-wide">Date</th>
                          <th className="py-1.5 pr-4 text-xs font-medium text-mid-grey uppercase tracking-wide">Site</th>
                          <th className="py-1.5 pr-4 text-xs font-medium text-mid-grey uppercase tracking-wide">Purpose</th>
                          <th className="py-1.5 pr-4 text-xs font-medium text-mid-grey uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewVisits.map((v) => (
                          <tr key={v.id} className="border-t border-border-grey">
                            <td className="py-2.5 pr-4 text-charcoal whitespace-nowrap">{formatDate(v.planned_arrival, 'date-only')}</td>
                            <td className="py-2.5 pr-4 text-charcoal whitespace-nowrap">{v.site?.name ?? '—'}</td>
                            <td className="py-2.5 pr-4 text-charcoal max-w-[160px] truncate">{v.purpose}</td>
                            <td className="py-2.5 pr-4"><StatusPill status={getDisplayStatus(v)} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            {isSiteAdmin && (viewTarget.status === 'pending' || viewTarget.status === 'approved') && (
              <div className="px-6 py-4 border-t border-border-grey shrink-0 flex justify-end gap-3">
                {viewTarget.status === 'pending' && (
                  <>
                    <button
                      onClick={() => { setRejectTarget(viewTarget.id); setViewTarget(null) }}
                      className="text-sm font-semibold text-danger border border-danger px-4 py-2 rounded-lg hover:bg-danger-bg transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(viewTarget.id, viewTarget.visitor_id)}
                      className="text-sm font-semibold text-white bg-success px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Approve
                    </button>
                  </>
                )}
                {viewTarget.status === 'approved' && (
                  <button
                    onClick={() => { setRevokeTarget(viewTarget.id); setViewTarget(null) }}
                    className="text-sm font-semibold text-danger border border-danger px-4 py-2 rounded-lg hover:bg-danger-bg transition-colors"
                  >
                    Revoke Access
                  </button>
                )}
              </div>
            )}
          </div>
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

function ApprovalSection({ title, items, onView }: {
  title: string
  items: EnrichedApproval[]
  onView: (pa: EnrichedApproval) => void
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
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <StatusPill status={pa.status} />
              <button
                onClick={() => onView(pa)}
                className="text-xs font-semibold text-primark-blue border border-primark-blue px-3 py-1.5 rounded-lg hover:bg-primark-blue-light transition-colors"
              >
                View
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
