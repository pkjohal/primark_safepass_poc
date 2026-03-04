import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useVisitors } from '../hooks/useVisitors'
import { useVisits } from '../hooks/useVisits'
import { usePreApprovals } from '../hooks/usePreApprovals'
import { useNotifications } from '../hooks/useNotifications'
import { useDenyList } from '../hooks/useDenyList'
import { useAuditLog } from '../hooks/useAuditLog'
import { useAuth } from '../context/AuthContext'
import { formatDate, getDisplayStatus } from '../lib/utils'
import PageHeader from '../components/layout/PageHeader'
import StatusPill from '../components/ui/StatusPill'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import type { Visitor, VisitWithVisitor, DenyListEntry, PreApproval } from '../lib/types'
import toast from 'react-hot-toast'

export default function VisitorProfileScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, site, isSiteAdmin, isHost, isReception } = useAuth()
  const { getById, updateVisitor } = useVisitors()
  const { getVisitsForVisitor } = useVisits()
  const { getForVisitorSite, request } = usePreApprovals()
  const { sendNotification } = useNotifications()
  const { checkDenyList } = useDenyList()
  const { log } = useAuditLog()

  const [visitor, setVisitor] = useState<Visitor | null>(null)
  const [visits, setVisits] = useState<VisitWithVisitor[]>([])
  const [preApproval, setPreApproval] = useState<PreApproval | null>(null)
  const [latestPreApproval, setLatestPreApproval] = useState<PreApproval | null>(null)
  const [denyEntry, setDenyEntry] = useState<DenyListEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAnonConfirm, setShowAnonConfirm] = useState(false)
  const [anonLoading, setAnonLoading] = useState(false)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [requestJustification, setRequestJustification] = useState('')
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    if (!id || !site) return
    Promise.all([
      getById(id),
      getVisitsForVisitor(id),
      getForVisitorSite(id, site.id),
      supabase
        .from('pre_approvals')
        .select('*')
        .eq('visitor_id', id)
        .eq('site_id', site.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(async ([v, vs, pa, { data: latest }]) => {
      setVisitor(v)
      setVisits(vs)
      setPreApproval(pa)
      setLatestPreApproval(latest as PreApproval ?? null)
      if (v) {
        const deny = await checkDenyList(v, site.id)
        setDenyEntry(deny)
      }
      setLoading(false)
    })
  }, [id, site, getById, getVisitsForVisitor, getForVisitorSite, checkDenyList])

  async function handleRequestPreApproval() {
    if (!visitor || !user || !site) return
    setRequesting(true)
    try {
      await request({ visitor_id: visitor.id, site_id: site.id, requested_by: user.id, reason: requestJustification })
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
            title: `Pre-approval request: ${visitor.name}`,
            body: `${user.name} has requested unescorted access for ${visitor.name}. Justification: ${requestJustification || 'None provided'}`,
          })
        ))
      }
      await log('pre_approval_requested', 'pre_approval', null, user.id, { visitor_id: visitor.id })
      toast.success('Pre-approval request submitted')
      setShowRequestForm(false)
      setRequestJustification('')
      setLatestPreApproval({ status: 'pending' } as PreApproval)
    } catch {
      toast.error('Failed to submit request')
    } finally {
      setRequesting(false)
    }
  }

  async function handleAnonymise() {
    if (!visitor || !user) return
    setAnonLoading(true)
    try {
      await updateVisitor(visitor.id, {
        name: 'Anonymised Visitor',
        email: `anonymised-${visitor.id}@deleted.local`,
        phone: null,
        company: null,
        is_anonymised: true,
      })
      await log('visitor_anonymised', 'visitor', visitor.id, user.id, { original_email: visitor.email })
      toast.success('Visitor anonymised')
      navigate('/visitors')
    } catch {
      toast.error('Anonymisation failed')
    } finally {
      setAnonLoading(false)
      setShowAnonConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="h-8 w-48 skeleton rounded mb-6" />
        <div className="bg-white rounded-xl shadow-card p-6 space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-6 skeleton rounded" />)}
        </div>
      </div>
    )
  }

  if (!visitor) {
    return <div className="p-6 text-center text-mid-grey">Visitor not found</div>
  }

  const canRequestPreApproval =
    visitor.visitor_type === 'third_party' &&
    !isSiteAdmin &&
    !visitor.is_anonymised &&
    (!latestPreApproval || ['rejected', 'revoked', 'expired'].includes(latestPreApproval.status))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title={visitor.is_anonymised ? 'Anonymised Visitor' : visitor.name}
        subtitle={visitor.company ?? undefined}
        backTo="/visitors"
        actions={
          <div className="flex gap-2">
            {isHost && (
              <button
                onClick={() => navigate(`/schedule?visitor_id=${visitor.id}`)}
                className="bg-primark-blue text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primark-blue-dark transition-colors"
              >
                Schedule Visit
              </button>
            )}
            {isSiteAdmin && !visitor.is_anonymised && (
              <button
                onClick={() => setShowAnonConfirm(true)}
                className="border border-danger text-danger px-4 py-2 rounded-lg text-sm font-semibold hover:bg-danger-bg transition-colors"
              >
                Anonymise
              </button>
            )}
          </div>
        }
      />

      {/* Deny list alert */}
      {denyEntry && (
        <div className="bg-danger-bg border border-danger rounded-xl p-4 mb-6">
          <p className="text-sm font-bold text-danger flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" /> This visitor is on the deny list</p>
          <p className="text-sm text-charcoal mt-1">{denyEntry.reason}</p>
          {denyEntry.is_permanent && <p className="text-xs text-mid-grey mt-1">Permanent ban</p>}
          {denyEntry.expires_at && <p className="text-xs text-mid-grey mt-1">Expires: {formatDate(denyEntry.expires_at, 'date-only')}</p>}
        </div>
      )}

      <div className="space-y-6">
        {/* Profile details */}
        <div className="bg-white rounded-xl shadow-card p-5">
          <h2 className="text-base font-semibold text-navy mb-4">Profile Details</h2>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <ProfileField label="Name" value={visitor.name} />
            <ProfileField label="Email" value={visitor.email} />
            <ProfileField label="Phone" value={visitor.phone ?? '—'} />
            <ProfileField label="Company" value={visitor.company ?? '—'} />
            <div>
              <dt className="text-xs font-medium text-mid-grey uppercase tracking-wide mb-0.5">Type</dt>
              <dd>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  visitor.visitor_type === 'internal_staff'
                    ? 'bg-primark-blue-light text-primark-blue'
                    : 'bg-light-grey text-mid-grey'
                }`}>
                  {visitor.visitor_type === 'internal_staff' ? 'Internal Staff' : 'Third Party'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-mid-grey uppercase tracking-wide mb-0.5">Pre-Approval</dt>
              <dd>
                {latestPreApproval ? (
                  <div>
                    <StatusPill status={latestPreApproval.status} />
                    {preApproval?.expires_at && (
                      <p className="text-xs text-mid-grey mt-1">Expires {formatDate(preApproval.expires_at, 'date-only')}</p>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-mid-grey">None</span>
                )}
                {canRequestPreApproval && !showRequestForm && (
                  <button
                    onClick={() => setShowRequestForm(true)}
                    className="mt-1.5 text-xs text-primark-blue hover:underline block"
                  >
                    Request pre-approval
                  </button>
                )}
              </dd>
            </div>
          </dl>
        </div>

        {/* Pre-approval request form */}
        {showRequestForm && (
          <div className="bg-white rounded-xl shadow-card p-5">
            <h2 className="text-base font-semibold text-navy mb-4">Request Pre-Approval</h2>
            <p className="text-sm text-charcoal mb-4">
              Request unescorted access for <strong>{visitor.name}</strong> at {site?.name}. A site admin will be notified to review the request.
            </p>
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
              <button
                onClick={() => { setShowRequestForm(false); setRequestJustification('') }}
                className="flex-1 py-2.5 border border-border-grey rounded-xl text-sm text-charcoal"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestPreApproval}
                disabled={requesting}
                className="flex-1 py-2.5 bg-primark-blue text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {requesting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        )}

        {/* Visit history */}
        <div className="bg-white rounded-xl shadow-card p-5">
          <h2 className="text-base font-semibold text-navy mb-4">Visit History ({visits.length})</h2>
          {visits.length === 0 ? (
            <p className="text-sm text-mid-grey">No visits on record.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-2 pr-4 text-xs font-medium text-mid-grey uppercase tracking-wide">Date</th>
                    <th className="py-2 pr-4 text-xs font-medium text-mid-grey uppercase tracking-wide">Site</th>
                    <th className="py-2 pr-4 text-xs font-medium text-mid-grey uppercase tracking-wide">Purpose</th>
                    <th className="py-2 pr-4 text-xs font-medium text-mid-grey uppercase tracking-wide">Host</th>
                    <th className="py-2 pr-4 text-xs font-medium text-mid-grey uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr
                      key={v.id}
                      className="border-t border-border-grey cursor-pointer hover:bg-light-grey"
                      onClick={() => isReception ? navigate(`/checkin/${v.id}`) : undefined}
                    >
                      <td className="py-3 pr-4 text-charcoal whitespace-nowrap">
                        {formatDate(v.planned_arrival, 'date-only')}
                      </td>
                      <td className="py-3 pr-4 text-charcoal whitespace-nowrap">{v.site?.name ?? '—'}</td>
                      <td className="py-3 pr-4 text-charcoal max-w-[160px] truncate">{v.purpose}</td>
                      <td className="py-3 pr-4 text-charcoal">{v.host.name}</td>
                      <td className="py-3 pr-4">
                        <StatusPill status={getDisplayStatus(v) === 'checked_in' && v.access_status === 'awaiting_escort' ? 'awaiting_escort' : getDisplayStatus(v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAnonConfirm && (
        <ConfirmDialog
          title="Anonymise this visitor?"
          message="This will permanently remove all identifying information (name, email, phone, company) from this visitor record. Visit history, induction records, and audit logs are retained. This cannot be undone."
          confirmLabel={anonLoading ? 'Anonymising...' : 'Anonymise Visitor'}
          variant="danger"
          onConfirm={handleAnonymise}
          onCancel={() => setShowAnonConfirm(false)}
        />
      )}
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-mid-grey uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-charcoal">{value}</dd>
    </div>
  )
}
