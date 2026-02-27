import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useVisits } from '../hooks/useVisits'
import { useInduction } from '../hooks/useInduction'
import { usePreApprovals } from '../hooks/usePreApprovals'
import { useDenyList } from '../hooks/useDenyList'
import { useNotifications } from '../hooks/useNotifications'
import { useAuditLog } from '../hooks/useAuditLog'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../lib/utils'
import InductionViewer from '../components/visits/InductionViewer'
import DocumentViewer from '../components/visits/DocumentViewer'
import PageHeader from '../components/layout/PageHeader'
import type { VisitWithVisitor, VisitDocument, InductionRecord, DenyListEntry } from '../lib/types'
import toast from 'react-hot-toast'

type Step = 1 | 2 | 3 | 4 | 5

export default function CheckInScreen() {
  const { visitId } = useParams<{ visitId: string }>()
  const navigate = useNavigate()
  const { user, site, activeEvacuation } = useAuth()
  const { getVisitById, updateVisit } = useVisits()
  const { checkInductionValid, completeInduction } = useInduction()
  const { getForVisitorSite } = usePreApprovals()
  const { checkDenyList } = useDenyList()
  const { sendNotification } = useNotifications()
  const { log } = useAuditLog()

  const [visit, setVisit] = useState<VisitWithVisitor | null>(null)
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [inductionRecord, setInductionRecord] = useState<InductionRecord | null>(null)
  const [inductionValid, setInductionValid] = useState(false)
  const [documents, setDocuments] = useState<VisitDocument[]>([])
  const [denyEntry, setDenyEntry] = useState<DenyListEntry | null>(null)
  const [finalAccessStatus, setFinalAccessStatus] = useState<'unescorted' | 'awaiting_escort' | null>(null)
  const [checkedIn, setCheckedIn] = useState(false)

  useEffect(() => {
    if (!visitId || !site) return
    getVisitById(visitId).then(async (v) => {
      if (!v) { setLoading(false); return }
      setVisit(v)

      // Check induction
      const { valid, record } = await checkInductionValid(v.visitor.id, site)
      setInductionValid(valid)
      setInductionRecord(record)

      // Fetch documents
      const { data: docs } = await supabase
        .from('visit_documents')
        .select('*')
        .eq('visit_id', v.id)
        .eq('accepted', false)
      setDocuments((docs as VisitDocument[]) ?? [])

      setLoading(false)
    })
  }, [visitId, site, getVisitById, checkInductionValid])

  async function handleConfirmDetails() {
    if (!visit || !site) return
    if (activeEvacuation) {
      toast.error('Evacuation in progress — check-ins are suspended')
      return
    }
    if (visit.status === 'checked_in') {
      toast.error('This visitor is already checked in')
      return
    }
    if (inductionValid) {
      // Skip induction step
      if (documents.length === 0) {
        await runDenyCheck()
      } else {
        setStep(3)
      }
    } else {
      setStep(2)
    }
  }

  async function handleInductionComplete() {
    if (!visit || !site) return
    setActionLoading(true)
    try {
      await completeInduction(visit.visitor.id, site.id, site.hs_content_version, visit.id)
      setInductionValid(true)
      await log('induction_completed', 'induction_record', visit.id, user?.id ?? null, {
        visitor_id: visit.visitor.id,
        content_version: site.hs_content_version,
      })
      if (documents.length === 0) {
        await runDenyCheck()
      } else {
        setStep(3)
      }
    } catch {
      toast.error('Failed to complete induction')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDocumentsAccepted() {
    if (!visit) return
    setActionLoading(true)
    try {
      const now = new Date().toISOString()
      await supabase
        .from('visit_documents')
        .update({ accepted: true, accepted_at: now })
        .eq('visit_id', visit.id)
      await updateVisit(visit.id, { documents_accepted: true, documents_accepted_at: now })
      await log('document_accepted', 'visit_document', visit.id, user?.id ?? null)
      await runDenyCheck()
    } catch {
      toast.error('Failed to save document acceptance')
    } finally {
      setActionLoading(false)
    }
  }

  async function runDenyCheck() {
    if (!visit || !site) return
    setStep(4)
    const deny = await checkDenyList(visit.visitor, site.id)
    if (deny) {
      setDenyEntry(deny)
      // Send deny list alert to all reception/admin
      const { data: staffUsers } = await supabase
        .from('members')
        .select('id')
        .eq('site_id', site.id)
        .in('role', ['reception', 'site_admin'])
        .eq('is_active', true)

      if (staffUsers) {
        await Promise.all(staffUsers.map((u: { id: string }) =>
          sendNotification({
            recipient_type: 'user',
            recipient_user_id: u.id,
            visit_id: visit.id,
            notification_type: 'deny_list_alert',
            title: `Denied visitor: ${visit.visitor.name}`,
            body: `${visit.visitor.name} from ${visit.visitor.company ?? 'Unknown'} attempted to check in but is on the deny list. Reason: ${deny.reason}`,
          })
        ))
      }
      await log('deny_list_check_blocked', 'visit', visit.id, user?.id ?? null, {
        visitor_id: visit.visitor.id,
        deny_list_id: deny.id,
      })
    } else {
      setDenyEntry(null)
      setStep(5)
      await determineAccessAndCheckIn()
    }
  }

  async function determineAccessAndCheckIn() {
    if (!visit || !site || !user) return
    setActionLoading(true)
    try {
      let accessStatus: 'unescorted' | 'awaiting_escort'

      if (visit.visitor.visitor_type === 'internal_staff') {
        accessStatus = 'unescorted'
      } else {
        const preApproval = await getForVisitorSite(visit.visitor.id, site.id)
        accessStatus = preApproval ? 'unescorted' : 'awaiting_escort'
      }

      setFinalAccessStatus(accessStatus)

      await updateVisit(visit.id, {
        status: 'checked_in',
        actual_arrival: new Date().toISOString(),
        access_status: accessStatus,
        checked_in_by: user.id,
      })

      // Get all host contacts for this visit
      const { data: hostContacts } = await supabase
        .from('visit_host_contacts')
        .select('user_id')
        .eq('visit_id', visit.id)

      if (hostContacts) {
        await Promise.all(hostContacts.map((hc: { user_id: string }) =>
          sendNotification({
            recipient_type: 'user',
            recipient_user_id: hc.user_id,
            visit_id: visit.id,
            notification_type: 'checkin_host_alert',
            title: `${visit.visitor.name} has checked in`,
            body: `${visit.visitor.name} from ${visit.visitor.company ?? 'Unknown'} has arrived for: ${visit.purpose}. Access: ${accessStatus === 'unescorted' ? 'Unescorted' : 'Awaiting Escort'}.`,
          })
        ))

        if (accessStatus === 'awaiting_escort') {
          await Promise.all(hostContacts.map((hc: { user_id: string }) =>
            sendNotification({
              recipient_type: 'user',
              recipient_user_id: hc.user_id,
              visit_id: visit.id,
              notification_type: 'escort_required',
              title: `Visitor awaiting escort: ${visit.visitor.name}`,
              body: `${visit.visitor.name} from ${visit.visitor.company ?? 'Unknown'} has checked in for ${visit.purpose}. They require an escort — please acknowledge and collect.`,
              requires_acknowledgement: true,
            })
          ))
        }
      }

      await log('visit_checked_in', 'visit', visit.id, user.id, {
        visitor_id: visit.visitor.id,
        access_status: accessStatus,
      })

      setCheckedIn(true)
    } catch {
      toast.error('Check-in failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="h-8 w-48 skeleton rounded mb-6" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!visit) {
    return <div className="p-6 text-center text-mid-grey">Visit not found</div>
  }

  // Deny list blocked state
  if (step === 4 && denyEntry) {
    return (
      <div className="min-h-screen bg-danger flex flex-col items-center justify-center p-6 text-white text-center">
        <svg className="w-20 h-20 mb-6" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <h1 className="text-3xl font-bold mb-3">THIS VISITOR IS ON THE DENY LIST</h1>
        <p className="text-xl font-semibold mb-2">{visit.visitor.name}</p>
        <p className="text-red-200 mb-6 max-w-md">{denyEntry.reason}</p>
        <p className="text-sm text-red-200 mb-8">Check-in blocked. Reception and site admin have been notified.</p>
        <button
          onClick={() => navigate('/')}
          className="bg-white text-danger font-bold px-8 py-4 rounded-xl hover:bg-red-50 transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    )
  }

  // Successful check-in confirmation
  if (checkedIn && finalAccessStatus) {
    return (
      <div className="min-h-screen bg-light-grey flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full">
          <div className="w-20 h-20 bg-success-bg rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-navy mb-2">{visit.visitor.name} checked in</h1>
          <p className="text-mid-grey mb-6">{visit.visitor.company}</p>
          <div className={`inline-flex items-center px-5 py-3 rounded-full text-base font-semibold mb-8 ${
            finalAccessStatus === 'unescorted'
              ? 'bg-success-bg text-success'
              : 'bg-warning-bg text-warning'
          }`}>
            {finalAccessStatus === 'unescorted' ? 'Unescorted Access' : 'Awaiting Escort — Host Notified'}
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-primark-blue text-white py-4 rounded-xl font-semibold hover:bg-primark-blue-dark transition-colors min-h-btn-primary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Check-In"
        subtitle={`${visit.visitor.name} · ${visit.visitor.company ?? ''}`}
        backTo="/"
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2, 3] as Step[]).map((s) => (
          <div key={s} className={`flex items-center gap-2 ${s < ([1, 2, 3] as Step[]).length ? 'flex-1' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
              step > s ? 'bg-success text-white' :
              step === s ? 'bg-primark-blue text-white' :
              'bg-light-grey text-mid-grey'
            }`}>
              {step > s ? '✓' : s}
            </div>
            {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-success' : 'bg-border-grey'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1 — Confirm details */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-navy">Confirm Visit Details</h2>

          {activeEvacuation && (
            <div className="bg-danger-bg border border-danger rounded-lg p-3">
              <p className="text-sm font-semibold text-danger">Evacuation in progress — check-ins are suspended</p>
            </div>
          )}

          <dl className="space-y-3">
            <DetailRow label="Visitor" value={visit.visitor.name} />
            <DetailRow label="Company" value={visit.visitor.company ?? '—'} />
            <DetailRow label="Type" value={visit.visitor.visitor_type === 'internal_staff' ? 'Internal Staff' : 'Third Party'} />
            <DetailRow label="Purpose" value={visit.purpose} />
            <DetailRow label="Host" value={visit.host.name} />
            <DetailRow label="Planned Arrival" value={formatDate(visit.planned_arrival, 'absolute')} />
            <DetailRow label="Planned Departure" value={formatDate(visit.planned_departure, 'absolute')} />
            <div>
              <dt className="text-xs font-medium text-mid-grey uppercase tracking-wide mb-1">Pre-Arrival Status</dt>
              <dd className="flex gap-3">
                <span className={`text-sm font-medium ${visit.induction_completed ? 'text-success' : 'text-warning'}`}>
                  {visit.induction_completed ? '✓' : '✗'} H&S Induction
                </span>
                <span className={`text-sm font-medium ${visit.documents_accepted ? 'text-success' : 'text-mid-grey'}`}>
                  {visit.documents_accepted ? '✓' : '—'} Documents
                </span>
              </dd>
            </div>
          </dl>

          <button
            onClick={handleConfirmDetails}
            disabled={!!activeEvacuation}
            className="w-full bg-primark-blue text-white py-4 rounded-xl font-semibold hover:bg-primark-blue-dark transition-colors disabled:opacity-50 min-h-btn-primary"
          >
            Confirm & Continue
          </button>
        </div>
      )}

      {/* Step 2 — H&S Induction */}
      {step === 2 && site && (
        <div className="bg-white rounded-xl shadow-card p-6">
          <h2 className="text-lg font-semibold text-navy mb-2">Health & Safety Induction</h2>
          <p className="text-sm text-mid-grey mb-6">
            {inductionRecord
              ? 'Induction is outdated or expired — visitor must re-complete.'
              : 'No induction on record for this site.'}
          </p>
          <InductionViewer
            site={site}
            onComplete={handleInductionComplete}
            loading={actionLoading}
          />
        </div>
      )}

      {/* Step 3 — Document acceptance */}
      {step === 3 && (
        <div className="bg-white rounded-xl shadow-card p-6">
          <h2 className="text-lg font-semibold text-navy mb-2">Document Acceptance</h2>
          <p className="text-sm text-mid-grey mb-6">
            Please review and accept the following documents before proceeding.
          </p>
          <DocumentViewer
            documents={documents}
            onAcceptAll={handleDocumentsAccepted}
            loading={actionLoading}
          />
        </div>
      )}

      {/* Step 4 — Deny check in progress */}
      {step === 4 && !denyEntry && (
        <div className="bg-white rounded-xl shadow-card p-6 text-center py-12">
          <div className="w-12 h-12 border-4 border-primark-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-mid-grey">Checking security records...</p>
        </div>
      )}

      {/* Step 5 — Access determination in progress */}
      {step === 5 && !checkedIn && (
        <div className="bg-white rounded-xl shadow-card p-6 text-center py-12">
          <div className="w-12 h-12 border-4 border-primark-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-mid-grey">Completing check-in...</p>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <dt className="text-xs font-medium text-mid-grey uppercase tracking-wide w-36 shrink-0 pt-0.5">{label}</dt>
      <dd className="text-sm text-charcoal flex-1">{value}</dd>
    </div>
  )
}
