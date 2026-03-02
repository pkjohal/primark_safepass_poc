import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Link2Off, ClipboardCheck, FileText, LogIn, LogOut,
  Calendar, Bell, Lock, Check, Clock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useVisitors } from '../hooks/useVisitors'
import { useVisits } from '../hooks/useVisits'
import { useNotifications } from '../hooks/useNotifications'
import { useInduction } from '../hooks/useInduction'
import { formatDate, isToday } from '../lib/utils'
import InductionViewer from '../components/visits/InductionViewer'
import DocumentViewer from '../components/visits/DocumentViewer'
import NotificationRow from '../components/notifications/NotificationRow'
import type { Visitor, VisitWithVisitor, VisitDocument, Site, InductionRecord } from '../lib/types'
import toast from 'react-hot-toast'

export default function SelfServiceScreen() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
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
  const [inductionRecord, setInductionRecord] = useState<InductionRecord | null>(null)
  const [latestInductionRecord, setLatestInductionRecord] = useState<InductionRecord | null>(null)
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
          const { valid, record } = await checkInductionValid(v.id, siteData as Site)
          setInductionRequired(!valid)
          setInductionRecord(record)

          // Fetch the most recent induction record regardless of version/expiry (for status display)
          const { data: latestRec } = await supabase
            .from('induction_records')
            .select('*')
            .eq('visitor_id', v.id)
            .eq('site_id', siteData.id)
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          setLatestInductionRecord(latestRec as InductionRecord | null)
        }

        // Find pending documents across upcoming visits
        const upcomingVisitIds = vs.filter((vv) => vv.status === 'scheduled').map((vv) => vv.id)
        if (upcomingVisitIds.length > 0) {
          setPendingVisitId(upcomingVisitIds[0])
          const { data: docs } = await supabase
            .from('visit_documents')
            .select('*')
            .in('visit_id', upcomingVisitIds)
            .eq('accepted', false)
          const pendingDocs = (docs as VisitDocument[]) ?? []
          setPendingDocuments(pendingDocs)
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
    const { valid, record } = await checkInductionValid(visitor.id, site)
    setInductionRequired(!valid)
    setInductionRecord(record)
    setLatestInductionRecord(record)
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
          <div className="w-14 h-14 rounded-full bg-light-grey flex items-center justify-center mx-auto mb-4">
            <Link2Off className="w-7 h-7 text-mid-grey" />
          </div>
          <h1 className="text-xl font-bold text-navy mb-2">Link expired or invalid</h1>
          <p className="text-mid-grey text-sm">{error || 'This self-service link is no longer valid.'}</p>
        </div>
      </div>
    )
  }

  const todayVisit = visits.find((v) => v.status === 'scheduled' && isToday(v.planned_arrival))
  const checkedInVisit = visits.find((v) => v.status === 'checked_in')
  const now = new Date()
  const upcomingVisits = visits.filter((v) => v.status === 'scheduled' && new Date(v.planned_arrival) >= now)
  const pastVisits = visits.filter((v) =>
    v.status === 'departed' ||
    v.status === 'cancelled' ||
    (v.status === 'scheduled' && new Date(v.planned_arrival) < now)
  )
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="min-h-screen bg-light-grey">
      {/* Header */}
      <div className="bg-navy px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="font-primark uppercase text-primark-blue leading-none" style={{ fontSize: '22px' }}>PRIMARK</div>
            <div className="text-white/50 text-xs mt-0.5">SafePass · Visitor Portal</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full hidden sm:inline-flex ${
              visitor.visitor_type === 'internal_staff'
                ? 'bg-primark-blue/20 text-primark-blue'
                : 'bg-white/10 text-white/70'
            }`}>
              {visitor.visitor_type === 'internal_staff' ? 'Internal Staff' : 'Third Party'}
            </span>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors border border-white/20 hover:border-white/40 rounded-lg px-3 py-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Exit Portal
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {activeView === 'home' && (
          <div className="space-y-4">
            {/* Profile card */}
            <div className="bg-white rounded-xl shadow-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-xl font-bold text-navy">{visitor.name}</h1>
                  <p className="text-sm text-mid-grey">{visitor.email}</p>
                  {visitor.company && <p className="text-sm text-mid-grey">{visitor.company}</p>}
                </div>
                <div className="w-12 h-12 rounded-full bg-primark-blue-light flex items-center justify-center text-primark-blue font-bold text-xl shrink-0">
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
            {(inductionRequired || pendingDocuments.length > 0 || (todayVisit && visitor.visitor_type === 'internal_staff' && !checkedInVisit)) && (
              <div className="bg-white rounded-xl shadow-card p-5">
                <h2 className="text-base font-semibold text-navy mb-4">Actions Required</h2>
                <div className="space-y-3">
                  {inductionRequired && site && (
                    <ActionButton
                      icon={<ClipboardCheck className="w-6 h-6" />}
                      label="Complete H&S Induction"
                      description="Required before your next visit"
                      colour="amber"
                      onClick={() => setActiveView('induction')}
                    />
                  )}
                  {pendingDocuments.length > 0 && (
                    <ActionButton
                      icon={<FileText className="w-6 h-6" />}
                      label={`Review Documents (${pendingDocuments.length})`}
                      description="Documents requiring your acceptance"
                      colour="amber"
                      onClick={() => setActiveView('documents')}
                    />
                  )}
                  {todayVisit && visitor.visitor_type === 'internal_staff' && !checkedInVisit && (
                    <ActionButton
                      icon={<LogIn className="w-6 h-6" />}
                      label="Check In"
                      description={`${todayVisit.purpose} · ${formatDate(todayVisit.planned_arrival, 'time-only')}`}
                      colour="blue"
                      onClick={handleSelfCheckIn}
                      loading={checkingIn}
                    />
                  )}
                </div>
              </div>
            )}

            {/* ── Active visit ── */}
            {checkedInVisit && (
              <ActiveVisitCard visit={checkedInVisit} site={site} onSignOut={handleSignOut} signingOut={signingOut} />
            )}

            {/* ── Upcoming visits ── */}
            <div className="bg-white rounded-xl shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border-grey flex items-center gap-2">
                <Calendar className="w-4 h-4 text-mid-grey" />
                <h2 className="text-base font-semibold text-navy">Upcoming Visits</h2>
              </div>
              {upcomingVisits.length === 0 ? (
                <div className="p-6 text-center text-sm text-mid-grey">No upcoming visits scheduled.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-light-grey text-left">
                        <th className="px-5 py-2.5 text-xs font-medium text-mid-grey uppercase tracking-wide">Date & Time</th>
                        <th className="px-5 py-2.5 text-xs font-medium text-mid-grey uppercase tracking-wide">Purpose</th>
                        <th className="px-5 py-2.5 text-xs font-medium text-mid-grey uppercase tracking-wide hidden sm:table-cell">Host</th>
                        <th className="px-5 py-2.5 text-xs font-medium text-mid-grey uppercase tracking-wide">H&S</th>
                        <th className="px-5 py-2.5 text-xs font-medium text-mid-grey uppercase tracking-wide hidden sm:table-cell">Docs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingVisits.map((v) => (
                        <tr key={v.id} className="border-t border-border-grey">
                          <td className="px-5 py-3 whitespace-nowrap">
                            <div className="text-xs font-semibold text-navy">{formatDate(v.planned_arrival, 'date-only')}</div>
                            <div className="text-xs text-mid-grey">{formatDate(v.planned_arrival, 'time-only')} – {formatDate(v.planned_departure, 'time-only')}</div>
                          </td>
                          <td className="px-5 py-3 text-charcoal max-w-[160px] truncate">{v.purpose}</td>
                          <td className="px-5 py-3 text-charcoal hidden sm:table-cell">{v.host.name}</td>
                          <td className="px-5 py-3">
                            {v.induction_completed || !inductionRequired
                              ? <Check className="w-4 h-4 text-success" />
                              : <button onClick={() => setActiveView('induction')} className="text-xs font-semibold text-warning underline">Required</button>
                            }
                          </td>
                          <td className="px-5 py-3 hidden sm:table-cell">
                            {pendingDocuments.length === 0
                              ? <Check className="w-4 h-4 text-success" />
                              : <button onClick={() => setActiveView('documents')} className="text-xs font-semibold text-warning underline">Review</button>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Past visits ── */}
            <div className="bg-white rounded-xl shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border-grey flex items-center gap-2">
                <Clock className="w-4 h-4 text-mid-grey" />
                <h2 className="text-base font-semibold text-navy">Past Visits</h2>
              </div>
              {pastVisits.length === 0 ? (
                <div className="p-6 text-center text-sm text-mid-grey">No past visits on record.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-light-grey text-left">
                        <th className="px-5 py-2.5 text-xs font-medium text-mid-grey uppercase tracking-wide">Date</th>
                        <th className="px-5 py-2.5 text-xs font-medium text-mid-grey uppercase tracking-wide">Purpose</th>
                        <th className="px-5 py-2.5 text-xs font-medium text-mid-grey uppercase tracking-wide hidden sm:table-cell">Host</th>
                        <th className="px-5 py-2.5 text-xs font-medium text-mid-grey uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastVisits.map((v) => (
                        <tr key={v.id} className="border-t border-border-grey">
                          <td className="px-5 py-3 text-charcoal whitespace-nowrap">{formatDate(v.planned_arrival, 'date-only')}</td>
                          <td className="px-5 py-3 text-charcoal max-w-[160px] truncate">{v.purpose}</td>
                          <td className="px-5 py-3 text-charcoal hidden sm:table-cell">{v.host.name}</td>
                          <td className="px-5 py-3">
                            {v.status === 'departed' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-bg text-success">Attended</span>
                            )}
                            {v.status === 'cancelled' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-light-grey text-mid-grey">Cancelled</span>
                            )}
                            {v.status === 'scheduled' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-bg text-warning">Missed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* H&S Induction status card */}
            {site && (
              <InductionStatusCard
                site={site}
                required={inductionRequired}
                validRecord={inductionRecord}
                latestRecord={latestInductionRecord}
                onStartInduction={() => setActiveView('induction')}
              />
            )}

            {/* Nav buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveView('notifications')}
                className="relative p-4 bg-white rounded-xl shadow-card text-left hover:bg-light-grey transition-colors"
              >
                <Bell className="w-6 h-6 text-mid-grey mb-1" />
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
                <Lock className="w-6 h-6 text-mid-grey mb-1" />
                <div className="text-sm font-semibold text-navy">Privacy & Data</div>
              </button>
            </div>
          </div>
        )}

        {/* ── Sub-views: centred narrow column ── */}
        {activeView !== 'home' && (
          <div className="max-w-lg mx-auto space-y-4">
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
        )}
      </div>
    </div>
  )
}

function InductionStatusCard({
  site, required, validRecord, latestRecord, onStartInduction,
}: {
  site: Site
  required: boolean
  validRecord: InductionRecord | null
  latestRecord: InductionRecord | null
  onStartInduction: () => void
}) {
  const VALIDITY_DAYS = 28

  // Determine reason induction is required
  let reason: 'first_visit' | 'content_updated' | 'expired' | null = null
  if (required) {
    if (!latestRecord) {
      reason = 'first_visit'
    } else if (latestRecord.content_version !== site.hs_content_version) {
      reason = 'content_updated'
    } else {
      reason = 'expired'
    }
  }

  // Days remaining / days ago
  const daysSinceCompletion = validRecord
    ? Math.floor((Date.now() - new Date(validRecord.completed_at).getTime()) / 86_400_000)
    : latestRecord
    ? Math.floor((Date.now() - new Date(latestRecord.completed_at).getTime()) / 86_400_000)
    : null
  const daysRemaining = validRecord ? VALIDITY_DAYS - daysSinceCompletion! : null

  const reasonLabel: Record<NonNullable<typeof reason>, string> = {
    first_visit:      'No previous induction found for this site',
    content_updated:  `Site content updated to version ${site.hs_content_version} — re-induction required`,
    expired:          `Last completed ${daysSinceCompletion} day${daysSinceCompletion === 1 ? '' : 's'} ago — expired after ${VALIDITY_DAYS} days`,
  }

  return (
    <div className="bg-white rounded-xl shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border-grey flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-mid-grey" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h3 className="text-sm font-semibold text-navy">H&S Induction</h3>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          required ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success'
        }`}>
          {required ? 'Required' : 'Up to date'}
        </span>
      </div>

      <div className="px-5 py-4 space-y-3">
        {!required && validRecord && (
          <>
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-success-bg text-success flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">✓</span>
              <div>
                <p className="text-sm text-charcoal">Valid for <span className="font-semibold text-navy">{site.name}</span></p>
                <p className="text-xs text-mid-grey mt-0.5">
                  Completed {new Date(validRecord.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' '}· Content version {validRecord.content_version}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-success-bg rounded-lg px-3 py-2">
              <div className="flex-1 bg-white rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-success h-full rounded-full transition-all"
                  style={{ width: `${Math.max(0, (daysRemaining! / VALIDITY_DAYS) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-success shrink-0">{daysRemaining} day{daysRemaining === 1 ? '' : 's'} remaining</span>
            </div>
          </>
        )}

        {required && (
          <>
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-warning-bg text-warning flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">!</span>
              <p className="text-sm text-charcoal">{reason ? reasonLabel[reason] : 'Induction required'}</p>
            </div>
            {(site.hs_video_url || site.hs_written_content) && (
              <p className="text-xs text-mid-grey pl-8">
                {site.hs_video_url && site.hs_written_content
                  ? 'Includes a safety video and written guidance'
                  : site.hs_video_url
                  ? 'Includes a safety video'
                  : 'Includes written health & safety guidance'}
              </p>
            )}
            <button
              onClick={onStartInduction}
              className="w-full mt-1 py-3 bg-primark-blue text-white rounded-xl font-semibold text-sm hover:bg-primark-blue-dark transition-colors"
            >
              Complete Induction →
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ActiveVisitCard({ visit, site, onSignOut, signingOut }: { visit: VisitWithVisitor; site: Site | null; onSignOut: () => void; signingOut: boolean }) {
  const now = Date.now()
  const start = visit.actual_arrival ? new Date(visit.actual_arrival).getTime() : new Date(visit.planned_arrival).getTime()
  const end = new Date(visit.planned_departure).getTime()
  const total = end - start
  const elapsed = now - start
  const progress = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0
  const msRemaining = end - now
  const isOverdue = msRemaining < 0

  function formatRemaining(ms: number) {
    const abs = Math.abs(ms)
    const h = Math.floor(abs / 3_600_000)
    const m = Math.floor((abs % 3_600_000) / 60_000)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  return (
    <div className="bg-white rounded-xl shadow-card overflow-hidden border-l-4 border-success">
      <div className="px-5 py-4 flex items-center justify-between border-b border-border-grey">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
          </span>
          <h3 className="text-sm font-semibold text-navy">Currently Checked In</h3>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isOverdue ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'}`}>
          {isOverdue ? `Overdue by ${formatRemaining(msRemaining)}` : `${formatRemaining(msRemaining)} remaining`}
        </span>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-mid-grey uppercase tracking-wide mb-0.5">Purpose</p>
            <p className="font-medium text-navy">{visit.purpose}</p>
          </div>
          <div>
            <p className="text-xs text-mid-grey uppercase tracking-wide mb-0.5">Host</p>
            <p className="font-medium text-navy">{visit.host.name}</p>
          </div>
          {site && (
            <div>
              <p className="text-xs text-mid-grey uppercase tracking-wide mb-0.5">Site</p>
              <p className="font-medium text-navy">{site.name}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-mid-grey uppercase tracking-wide mb-0.5">Checked in</p>
            <p className="font-medium text-navy">
              {visit.actual_arrival ? formatDate(visit.actual_arrival, 'time-only') : formatDate(visit.planned_arrival, 'time-only')}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-mid-grey mb-1.5">
            <span>{visit.actual_arrival ? formatDate(visit.actual_arrival, 'time-only') : formatDate(visit.planned_arrival, 'time-only')}</span>
            <span>{formatDate(visit.planned_departure, 'time-only')}</span>
          </div>
          <div className="w-full bg-light-grey rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isOverdue ? 'bg-danger' : 'bg-success'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <button
          onClick={onSignOut}
          disabled={signingOut}
          className="w-full mt-1 py-3 border-2 border-success bg-success-bg text-success rounded-xl font-semibold text-sm hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </div>
  )
}

function ActionButton({
  icon, label, description, colour, onClick, loading = false,
}: {
  icon: ReactNode
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
      <span className="shrink-0">{icon}</span>
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
