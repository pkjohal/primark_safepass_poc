import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useVisitors } from '../hooks/useVisitors'
import { useVisits } from '../hooks/useVisits'
import { usePreApprovals } from '../hooks/usePreApprovals'
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
  const { user, site, isSiteAdmin, isReception } = useAuth()
  const { getById, updateVisitor } = useVisitors()
  const { getVisitsForVisitor } = useVisits()
  const { getForVisitorSite } = usePreApprovals()
  const { checkDenyList } = useDenyList()
  const { log } = useAuditLog()

  const [visitor, setVisitor] = useState<Visitor | null>(null)
  const [visits, setVisits] = useState<VisitWithVisitor[]>([])
  const [preApproval, setPreApproval] = useState<PreApproval | null>(null)
  const [denyEntry, setDenyEntry] = useState<DenyListEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAnonConfirm, setShowAnonConfirm] = useState(false)
  const [anonLoading, setAnonLoading] = useState(false)

  useEffect(() => {
    if (!id || !site) return
    Promise.all([
      getById(id),
      getVisitsForVisitor(id),
      getForVisitorSite(id, site.id),
    ]).then(async ([v, vs, pa]) => {
      setVisitor(v)
      setVisits(vs)
      setPreApproval(pa)
      if (v) {
        const deny = await checkDenyList(v, site.id)
        setDenyEntry(deny)
      }
      setLoading(false)
    })
  }, [id, site, getById, getVisitsForVisitor, getForVisitorSite, checkDenyList])

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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title={visitor.is_anonymised ? 'Anonymised Visitor' : visitor.name}
        subtitle={visitor.company ?? undefined}
        backTo="/visitors"
        actions={
          <div className="flex gap-2">
            {isReception && (
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
          <p className="text-sm font-bold text-danger">⚠ This visitor is on the deny list</p>
          <p className="text-sm text-charcoal mt-1">{denyEntry.reason}</p>
          {denyEntry.is_permanent && <p className="text-xs text-mid-grey mt-1">Permanent ban</p>}
          {denyEntry.expires_at && <p className="text-xs text-mid-grey mt-1">Expires: {formatDate(denyEntry.expires_at, 'date-only')}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile details */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-card p-5">
            <h2 className="text-base font-semibold text-navy mb-4">Profile Details</h2>
            <dl className="space-y-3">
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
                  {preApproval ? (
                    <div>
                      <StatusPill status={preApproval.status} />
                      {preApproval.expires_at && (
                        <p className="text-xs text-mid-grey mt-1">Expires {formatDate(preApproval.expires_at, 'date-only')}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-mid-grey">None</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Visit history */}
        <div className="lg:col-span-2">
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
