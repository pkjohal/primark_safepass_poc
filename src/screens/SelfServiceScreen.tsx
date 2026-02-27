import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useVisitors } from '../hooks/useVisitors'
import { useVisits } from '../hooks/useVisits'
import { useNotifications } from '../hooks/useNotifications'
import { useInduction } from '../hooks/useInduction'
import { formatDate, isToday } from '../lib/utils'
import InductionViewer from '../components/visits/InductionViewer'
import DocumentViewer from '../components/visits/DocumentViewer'
import NotificationRow from '../components/notifications/NotificationRow'
import type { Visitor, VisitWithVisitor, VisitDocument, Site } from '../lib/types'
import toast from 'react-hot-toast'

export default function SelfServiceScreen() {
  const { token } = useParams<{ token: string }>()
  const { getByToken, updateVisitor } = useVisitors()
  const { getVisitsForVisitor, updateVisit } = useVisits()
  const { checkInductionValid, completeInduction } = useInduction()

  const [visitor, setVisitor] = useState<Visitor | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [site, setSite] = useState<Site | null>(null)
  const [visits, setVisits] = useState<VisitWithVisitor[]>([])
  const [pendingDocuments, setPendingDocuments] = useState<VisitDocument[]>([])
  const [pendingVisitId, setPendingVisitId] = useState<string | null>(null)
  const [inductionRequired, setInductionRequired] = useState(false)
  const [activeView, setActiveView] = useState<'home' | 'induction' | 'documents' | 'notifications' | 'gdpr'>('home')
  const [editingPhone, setEditingPhone] = useState(false)
  const [phone, setPhone] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const { notifications, markRead } = useNotifications(undefined, visitor?.id)

  useEffect(() => {
    if (!token) { setError('Invalid link'); setLoading(false); return }
    getByToken(token).then(async (v) => {
      if (!v || v.is_anonymised) {
        setError('This link has expired or is invalid.')
        setLoading(false)
        return
      }
      setVisitor(v)
      setPhone(v.phone ?? '')

      // Get the site from the visitor's most recent visit
      const vs = await getVisitsForVisitor(v.id)
      setVisits(vs)

      if (vs.length > 0) {
        const { data: siteData } = await supabase.from('sites').select('*').eq('id', vs[0].site_id).single()
        if (siteData) {
          setSite(siteData as Site)

          // Check induction requirement
          const { valid } = await checkInductionValid(v.id, siteData as Site)
          setInductionRequired(!valid)
        }

        // Find pending documents across upcoming visits
        const upcomingVisitIds = vs.filter((vv) => vv.status === 'scheduled').map((vv) => vv.id)
        if (upcomingVisitIds.length > 0) {
          const { data: docs } = await supabase
            .from('visit_documents')
            .select('*')
            .in('visit_id', upcomingVisitIds)
            .eq('accepted', false)
          const pendingDocs = (docs as VisitDocument[]) ?? []
          setPendingDocuments(pendingDocs)
          if (pendingDocs.length > 0) setPendingVisitId(upcomingVisitIds[0])
        }
      }

      setLoading(false)
    })
  }, [token, getByToken, getVisitsForVisitor, checkInductionValid])

  async function handleSavePhone() {
    if (!visitor) return
    setSavingPhone(true)
    try {
      await updateVisitor(visitor.id, { phone: phone || null })
      setVisitor((v) => v ? { ...v, phone: phone || null } : v)
      setEditingPhone(false)
      toast.success('Phone number updated')
    } catch {
      toast.error('Failed to update phone')
    } finally {
      setSavingPhone(false)
    }
  }

  async function handleInductionComplete() {
    if (!visitor || !site || !pendingVisitId) return
    await completeInduction(visitor.id, site.id, site.hs_content_version, pendingVisitId)
    setInductionRequired(false)
    setActiveView('home')
    toast.success('Induction completed')
  }

  async function handleDocumentsAccepted() {
    if (!pendingVisitId) return
    const now = new Date().toISOString()
    await supabase.from('visit_documents').update({ accepted: true, accepted_at: now }).eq('visit_id', pendingVisitId)
    await updateVisit(pendingVisitId, { documents_accepted: true, documents_accepted_at: now })
    setPendingDocuments([])
    setActiveView('home')
    toast.success('Documents accepted')
  }

  async function handleSelfCheckIn() {
    if (!visitor || !site) return
    const todayVisit = visits.find((v) => v.status === 'scheduled' && isToday(v.planned_arrival))
    if (!todayVisit) { toast.error('No visit scheduled for today'); return }

    setCheckingIn(true)
    try {
      await updateVisit(todayVisit.id, {
        status: 'checked_in',
        actual_arrival: new Date().toISOString(),
        access_status: 'unescorted',
      })
      // Refresh visits
      const vs = await getVisitsForVisitor(visitor.id)
      setVisits(vs)
      toast.success('Checked in successfully')
    } catch {
      toast.error('Check-in failed')
    } finally {
      setCheckingIn(false)
    }
  }

  async function handleSignOut() {
    if (!visitor) return
    const checkedInVisit = visits.find((v) => v.status === 'checked_in')
    if (!checkedInVisit) { toast.error('No active check-in found'); return }

    setSigningOut(true)
    try {
      await updateVisit(checkedInVisit.id, {
        status: 'departed',
        actual_departure: new Date().toISOString(),
      })
      const vs = await getVisitsForVisitor(visitor.id)
      setVisits(vs)
      toast.success('Signed out — goodbye!')
    } catch {
      toast.error('Sign-out failed')
    } finally {
      setSigningOut(false)
    }
  }

  async function submitGdprRequest(type: 'access' | 'deletion') {
    if (!visitor || !site) return
    // Find a site_admin to notify
    const { data: admins } = await supabase.from('members').select('id').eq('site_id', site.id).eq('role', 'site_admin').eq('is_active', true)
    if (admins && admins.length > 0) {
      await supabase.from('messages').insert(
        admins.map((a: { id: string }) => ({
          recipient_type: 'user',
          recipient_user_id: a.id,
          notification_type: 'checkin_host_alert',
          title: `GDPR ${type === 'access' ? 'Data Access' : 'Data Deletion'} Request`,
          body: `Visitor ${visitor.name} (${visitor.email}) has submitted a GDPR ${type === 'access' ? 'data access' : 'data deletion'} request. Please action via the Visitor Profile screen.`,
        }))
      )
    }
    toast.success(`${type === 'access' ? 'Data access' : 'Data deletion'} request submitted`)
    setActiveView('home')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-light-grey flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primark-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !visitor) {
    return (
      <div className="min-h-screen bg-light-grey flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-navy mb-2">Link expired or invalid</h1>
          <p className="text-mid-grey text-sm">{error || 'This self-service link is no longer valid.'}</p>
        </div>
      </div>
    )
  }

  const todayVisit = visits.find((v) => v.status === 'scheduled' && isToday(v.planned_arrival))
  const checkedInVisit = visits.find((v) => v.status === 'checked_in')
  const upcomingVisits = visits.filter((v) => v.status === 'scheduled')
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="min-h-screen bg-light-grey">
      {/* Header */}
      <div className="bg-navy px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <div className="text-primark-blue font-bold uppercase tracking-[0.15em] text-lg">PRIMARK</div>
            <div className="text-mid-grey text-xs">SafePass · Visitor Portal</div>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            visitor.visitor_type === 'internal_staff'
              ? 'bg-primark-blue-light text-primark-blue'
              : 'bg-light-grey text-mid-grey'
          }`}>
            {visitor.visitor_type === 'internal_staff' ? 'Internal Staff' : 'Third Party'}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-4">
        {activeView === 'home' && (
          <>
            {/* Profile card */}
            <div className="bg-white rounded-xl shadow-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-xl font-bold text-navy">{visitor.name}</h1>
                  <p className="text-sm text-mid-grey">{visitor.email}</p>
                  {visitor.company && <p className="text-sm text-mid-grey">{visitor.company}</p>}
                </div>
                <div className="w-12 h-12 rounded-full bg-primark-blue-light flex items-center justify-center text-primark-blue font-bold text-xl">
                  {visitor.name.charAt(0).toUpperCase()}
                </div>
              </div>

              {/* Phone */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-mid-grey uppercase tracking-wide">Phone</span>
                  {!editingPhone && (
                    <button onClick={() => setEditingPhone(true)} className="text-xs text-primark-blue hover:underline">Edit</button>
                  )}
                </div>
                {editingPhone ? (
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="flex-1 px-3 py-2 border border-border-grey rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primark-blue"
                      placeholder="+353 85 123 4567"
                    />
                    <button onClick={handleSavePhone} disabled={savingPhone}
                      className="px-3 py-2 bg-primark-blue text-white rounded-lg text-sm font-medium disabled:opacity-50">
                      Save
                    </button>
                    <button onClick={() => setEditingPhone(false)} className="px-3 py-2 border border-border-grey rounded-lg text-sm text-charcoal">Cancel</button>
                  </div>
                ) : (
                  <p className="text-sm text-charcoal">{visitor.phone ?? 'Not provided'}</p>
                )}
              </div>
            </div>

            {/* Pending actions */}
            {(inductionRequired || pendingDocuments.length > 0 || (todayVisit && visitor.visitor_type === 'internal_staff') || checkedInVisit) && (
              <div className="bg-white rounded-xl shadow-card p-5">
                <h2 className="text-base font-semibold text-navy mb-4">Actions Required</h2>
                <div className="space-y-3">
                  {inductionRequired && site && (
                    <ActionButton
                      icon="📋"
                      label="Complete H&S Induction"
                      description="Required before your next visit"
                      colour="amber"
                      onClick={() => setActiveView('induction')}
                    />
                  )}
                  {pendingDocuments.length > 0 && (
                    <ActionButton
                      icon="📄"
                      label={`Review Documents (${pendingDocuments.length})`}
                      description="Documents requiring your acceptance"
                      colour="amber"
                      onClick={() => setActiveView('documents')}
                    />
                  )}
                  {todayVisit && visitor.visitor_type === 'internal_staff' && !checkedInVisit && (
                    <ActionButton
                      icon="✅"
                      label="Check In"
                      description={`${todayVisit.purpose} · ${formatDate(todayVisit.planned_arrival, 'time-only')}`}
                      colour="blue"
                      onClick={handleSelfCheckIn}
                      loading={checkingIn}
                    />
                  )}
                  {checkedInVisit && (
                    <ActionButton
                      icon="🚪"
                      label="Sign Out"
                      description={`Currently checked in · Since ${formatDate(checkedInVisit.actual_arrival, 'time-only')}`}
                      colour="green"
                      onClick={handleSignOut}
                      loading={signingOut}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Upcoming visits */}
            {upcomingVisits.length > 0 && (
              <div className="bg-white rounded-xl shadow-card p-5">
                <h2 className="text-base font-semibold text-navy mb-4">Upcoming Visits</h2>
                <div className="space-y-3">
                  {upcomingVisits.slice(0, 5).map((v) => (
                    <div key={v.id} className="p-3 bg-light-grey rounded-lg">
                      <div className="text-sm font-semibold text-navy">{v.purpose}</div>
                      <div className="text-xs text-mid-grey mt-0.5">
                        {formatDate(v.planned_arrival, 'absolute')} · Host: {v.host.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nav buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveView('notifications')}
                className="relative p-4 bg-white rounded-xl shadow-card text-left hover:bg-light-grey transition-colors"
              >
                <div className="text-2xl mb-1">🔔</div>
                <div className="text-sm font-semibold text-navy">Notifications</div>
                {unreadCount > 0 && (
                  <span className="absolute top-3 right-3 bg-danger text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveView('gdpr')}
                className="p-4 bg-white rounded-xl shadow-card text-left hover:bg-light-grey transition-colors"
              >
                <div className="text-2xl mb-1">🔒</div>
                <div className="text-sm font-semibold text-navy">Privacy & Data</div>
              </button>
            </div>
          </>
        )}

        {activeView === 'induction' && site && (
          <div className="bg-white rounded-xl shadow-card p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-navy">H&S Induction</h2>
              <button onClick={() => setActiveView('home')} className="text-sm text-primark-blue hover:underline">← Back</button>
            </div>
            <InductionViewer site={site} onComplete={handleInductionComplete} />
          </div>
        )}

        {activeView === 'documents' && (
          <div className="bg-white rounded-xl shadow-card p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-navy">Documents</h2>
              <button onClick={() => setActiveView('home')} className="text-sm text-primark-blue hover:underline">← Back</button>
            </div>
            <DocumentViewer documents={pendingDocuments} onAcceptAll={handleDocumentsAccepted} />
          </div>
        )}

        {activeView === 'notifications' && (
          <div className="bg-white rounded-xl shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border-grey flex items-center justify-between">
              <h2 className="text-base font-semibold text-navy">Notifications</h2>
              <button onClick={() => setActiveView('home')} className="text-sm text-primark-blue hover:underline">← Back</button>
            </div>
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-mid-grey text-sm">No notifications yet</div>
            ) : (
              <div className="divide-y divide-border-grey">
                {notifications.map((n) => (
                  <NotificationRow key={n.id} notification={n} onClick={() => markRead(n.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'gdpr' && (
          <div className="bg-white rounded-xl shadow-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-navy">Privacy & Data Rights</h2>
              <button onClick={() => setActiveView('home')} className="text-sm text-primark-blue hover:underline">← Back</button>
            </div>
            <p className="text-sm text-charcoal">
              Under GDPR, you have the right to access, correct, and request deletion of your personal data held by Primark.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => submitGdprRequest('access')}
                className="w-full py-3 border border-primark-blue text-primark-blue rounded-xl font-semibold text-sm hover:bg-primark-blue-light transition-colors"
              >
                Request My Data
              </button>
              <button
                onClick={() => submitGdprRequest('deletion')}
                className="w-full py-3 border border-danger text-danger rounded-xl font-semibold text-sm hover:bg-danger-bg transition-colors"
              >
                Request Data Deletion
              </button>
            </div>
            <p className="text-xs text-mid-grey">
              Your request will be sent to the site data controller. Note: some data may be retained for safety compliance and audit purposes.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ActionButton({
  icon, label, description, colour, onClick, loading = false,
}: {
  icon: string
  label: string
  description?: string
  colour: 'blue' | 'amber' | 'green'
  onClick: () => void
  loading?: boolean
}) {
  const colourClasses = {
    blue:  'border-primark-blue bg-primark-blue-light text-primark-blue',
    amber: 'border-warning bg-warning-bg text-warning',
    green: 'border-success bg-success-bg text-success',
  }[colour]

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full flex items-center gap-3 p-4 border-2 rounded-xl text-left transition-opacity disabled:opacity-60 ${colourClasses}`}
    >
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="flex-1">
        <div className="font-semibold text-sm">{loading ? 'Please wait...' : label}</div>
        {description && <div className="text-xs opacity-75 mt-0.5">{description}</div>}
      </div>
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
