import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useVisits } from '../hooks/useVisits'
import { useVisitors } from '../hooks/useVisitors'
import { useNotifications } from '../hooks/useNotifications'
import { useAuditLog } from '../hooks/useAuditLog'
import { useInduction } from '../hooks/useInduction'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/layout/PageHeader'
import TimePicker from '../components/ui/TimePicker'
import type { Visitor, SafeUser, Site } from '../lib/types'
import toast from 'react-hot-toast'

interface DocumentDraft {
  document_name: string
  document_content: string
}

export default function ScheduleVisitScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const preselectedVisitorId = params.get('visitor_id')
  const isWalkIn = params.get('walkin') === 'true'

  const { user, site, isSiteAdmin } = useAuth()
  const { createVisit, updateVisit } = useVisits()
  const { getById, visitors } = useVisitors()
  const { sendNotification } = useNotifications()
  const { log } = useAuditLog()
  const { checkInductionValid } = useInduction()

  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null)
  const [selectedSite, setSelectedSite] = useState<Site | null>(site)
  const [allSites, setAllSites] = useState<Site[]>([])
  const [allUsers, setAllUsers] = useState<SafeUser[]>([])
  const [hostContactId, setHostContactId] = useState<string>(user?.id ?? '')
  const [backupContactId, setBackupContactId] = useState<string>('')

  const pad = (n: number) => String(n).padStart(2, '0')
  const roundUpTo5Min = (d: Date) => {
    const m = Math.ceil(d.getMinutes() / 5) * 5
    if (m >= 60) return `${pad(d.getHours() + 1)}:00`
    return `${pad(d.getHours())}:${pad(m)}`
  }
  const now = new Date()
  const initialDate = isWalkIn ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` : ''
  const initialArrival = isWalkIn ? roundUpTo5Min(now) : ''
  const initialDeparture = isWalkIn ? roundUpTo5Min(new Date(now.getTime() + 60 * 60 * 1000)) : ''

  const [visitDate, setVisitDate] = useState(initialDate)
  const [arrivalTime, setArrivalTime] = useState(initialArrival)
  const [departureTime, setDepartureTime] = useState(initialDeparture)
  const [purpose, setPurpose] = useState('')
  const [documents, setDocuments] = useState<DocumentDraft[]>([])
  const [showDocForm, setShowDocForm] = useState(false)
  const [newDocName, setNewDocName] = useState('')
  const [newDocContent, setNewDocContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [checkedInVisitorIds, setCheckedInVisitorIds] = useState<Set<string>>(new Set())

  // Load all sites for admin location picker
  useEffect(() => {
    if (!isSiteAdmin) return
    supabase
      .from('sites')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setAllSites((data as Site[]) ?? []))
  }, [isSiteAdmin])

  useEffect(() => {
    if (!selectedSite) return
    supabase
      .from('visits')
      .select('visitor_id')
      .eq('site_id', selectedSite.id)
      .eq('status', 'checked_in')
      .then(({ data }) => setCheckedInVisitorIds(new Set((data ?? []).map((r: { visitor_id: string }) => r.visitor_id))))
  }, [selectedSite])

  useEffect(() => {
    if (preselectedVisitorId) {
      getById(preselectedVisitorId).then((v) => { if (v) setSelectedVisitor(v) })
    }
  }, [preselectedVisitorId, getById])

  // Re-fetch members whenever the selected site changes; reset host/backup selections
  useEffect(() => {
    if (!selectedSite) return
    supabase
      .from('members')
      .select('id,name,username,email,site_id,role,is_active,created_at,updated_at')
      .eq('site_id', selectedSite.id)
      .eq('is_active', true)
      .in('role', ['host', 'reception'])
      .order('name')
      .then(({ data }) => {
        const members = (data as SafeUser[]) ?? []
        setAllUsers(members)
        // Default host to the logged-in user if they belong to this site, otherwise first member
        const selfInSite = members.find((m) => m.id === user?.id)
        setHostContactId(selfInSite ? selfInSite.id : (members[0]?.id ?? ''))
        setBackupContactId('')
      })
  }, [selectedSite, user?.id])

  function addDocument() {
    if (!newDocName.trim() || !newDocContent.trim()) return
    setDocuments((d) => [...d, { document_name: newDocName.trim(), document_content: newDocContent.trim() }])
    setNewDocName('')
    setNewDocContent('')
    setShowDocForm(false)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!selectedVisitor) errs.visitor = 'Select a visitor'
    if (!visitDate) errs.date = 'Select a visit date'
    if (!arrivalTime) errs.arrival = 'Select an arrival time'
    if (!departureTime) errs.departure = 'Select a departure time'
    if (arrivalTime && departureTime && departureTime <= arrivalTime) {
      errs.departure = 'Departure must be after arrival'
    }
    if (!purpose.trim()) errs.purpose = 'Purpose is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !selectedVisitor || !user || !selectedSite) return
    setLoading(true)

    try {
      const hostId = hostContactId || user.id
      const visit = await createVisit({
        visitor_id: selectedVisitor.id,
        site_id: selectedSite.id,
        host_user_id: hostId,
        purpose: purpose.trim(),
        planned_arrival: new Date(`${visitDate}T${arrivalTime}`).toISOString(),
        planned_departure: new Date(`${visitDate}T${departureTime}`).toISOString(),
        is_walk_in: isWalkIn,
      })

      // If visitor already has a valid induction, mark it complete on this visit
      const { valid: inductionValid, record: inductionRecord } = await checkInductionValid(selectedVisitor.id, selectedSite)
      if (inductionValid && inductionRecord) {
        await updateVisit(visit.id, {
          induction_completed: true,
          induction_completed_at: inductionRecord.completed_at,
          induction_version: inductionRecord.content_version,
        })
      }

      // Insert host contacts
      const contacts = [{ visit_id: visit.id, user_id: hostId, is_backup: false }]
      if (backupContactId && backupContactId !== hostId) {
        contacts.push({ visit_id: visit.id, user_id: backupContactId, is_backup: true })
      }
      await supabase.from('visit_host_contacts').insert(contacts)

      // Insert visit documents
      if (documents.length > 0) {
        await supabase.from('visit_documents').insert(
          documents.map((d) => ({ ...d, visit_id: visit.id }))
        )
      }

      // Send notification to visitor
      await sendNotification({
        recipient_type: 'visitor',
        recipient_visitor_id: selectedVisitor.id,
        visit_id: visit.id,
        notification_type: 'visit_scheduled',
        title: `Visit scheduled: ${selectedSite.name}`,
        body: `You have a visit scheduled for ${purpose.trim()}. Please complete your H&S induction before arriving.`,
        action_url: `/self-service/${selectedVisitor.access_token}`,
      })

      await log('visit_scheduled', 'visit', visit.id, user.id, {
        visitor_id: selectedVisitor.id,
        is_walk_in: isWalkIn,
      })

      toast.success('Visit scheduled')
      navigate('/')
    } catch {
      toast.error('Failed to schedule visit')
    } finally {
      setLoading(false)
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const nowTimeStr = new Date().toTimeString().slice(0, 5)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title={isWalkIn ? 'Register Walk-In Visit' : 'Schedule Visit'}
        subtitle="Create a new visit for a visitor"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Visitor selection */}
        <div className="bg-white rounded-xl shadow-card p-5">
          <h2 className="text-base font-semibold text-navy mb-4">Visitor</h2>
          <select
            value={selectedVisitor?.id ?? ''}
            onChange={(e) => {
              const v = visitors.find((vis) => vis.id === e.target.value) ?? null
              setSelectedVisitor(v)
              setErrors((prev) => ({ ...prev, visitor: '' }))
            }}
            className={`w-full px-3 py-2.5 border rounded-lg text-sm text-charcoal bg-white min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue ${errors.visitor ? 'border-danger' : 'border-border-grey'}`}
          >
            <option value="" disabled>Select a visitor...</option>
            {visitors.map((v) => {
              const checkedIn = checkedInVisitorIds.has(v.id)
              return (
              <option key={v.id} value={v.id} disabled={checkedIn}>
                {v.name} — {v.email}{checkedIn ? ' (currently on-site)' : ''}
              </option>
            )
            })}
          </select>
          {errors.visitor && <p className="text-xs text-danger mt-1">{errors.visitor}</p>}
          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={() => navigate('/visitors/new')}
              className="text-xs text-primark-blue hover:underline"
            >
              + Create new visitor profile
            </button>
          </div>
        </div>

        {/* Visit details */}
        <div className="bg-white rounded-xl shadow-card p-5 space-y-4">
          <h2 className="text-base font-semibold text-navy">Visit Details</h2>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
              Location
            </label>
            {isSiteAdmin ? (
              <select
                value={selectedSite?.id ?? ''}
                onChange={(e) => {
                  const s = allSites.find((x) => x.id === e.target.value) ?? null
                  setSelectedSite(s)
                }}
                className="w-full px-3 py-2.5 border border-border-grey rounded-lg text-sm text-charcoal bg-white min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue"
              >
                <option value="" disabled>Select a location...</option>
                {allSites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 border border-border-grey rounded-lg bg-light-grey">
                <svg className="w-4 h-4 text-mid-grey shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm text-charcoal">{selectedSite?.name ?? '—'}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
              Visit Date <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => { setVisitDate(e.target.value); setArrivalTime(''); setDepartureTime(''); setErrors((p) => ({ ...p, date: '' })) }}
              min={isWalkIn ? undefined : todayStr}
              required
              className={`w-full px-3 py-2.5 border rounded-lg text-sm text-charcoal bg-white min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue ${errors.date ? 'border-danger' : 'border-border-grey'}`}
            />
            {errors.date && <p className="text-xs text-danger mt-1">{errors.date}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TimePicker
              label="Arrival Time"
              value={arrivalTime}
              onChange={(v) => { setArrivalTime(v); setDepartureTime(''); setErrors((p) => ({ ...p, arrival: '' })) }}
              min={visitDate === todayStr ? nowTimeStr : undefined}
              disabled={!visitDate}
              required
              error={errors.arrival}
            />
            <TimePicker
              label="Departure Time"
              value={departureTime}
              onChange={(v) => { setDepartureTime(v); setErrors((p) => ({ ...p, departure: '' })) }}
              min={arrivalTime || undefined}
              disabled={!visitDate || !arrivalTime}
              required
              error={errors.departure}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
              Purpose of Visit <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => { setPurpose(e.target.value); setErrors((e2) => ({ ...e2, purpose: '' })) }}
              className={`w-full px-3 py-2.5 border rounded-lg text-sm text-charcoal bg-white min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue ${errors.purpose ? 'border-danger' : 'border-border-grey'}`}
              placeholder="e.g. Server room maintenance"
            />
            {errors.purpose && <p className="text-xs text-danger mt-1">{errors.purpose}</p>}
          </div>

          {/* Host contacts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
                Primary Host
              </label>
              <select
                value={hostContactId}
                onChange={(e) => setHostContactId(e.target.value)}
                className="w-full px-3 py-2.5 border border-border-grey rounded-lg text-sm text-charcoal bg-white min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
                Backup Contact (optional)
              </label>
              <select
                value={backupContactId}
                onChange={(e) => setBackupContactId(e.target.value)}
                className="w-full px-3 py-2.5 border border-border-grey rounded-lg text-sm text-charcoal bg-white min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue"
              >
                <option value="">None</option>
                {allUsers.filter((u) => u.id !== hostContactId).map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="bg-white rounded-xl shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-navy">Attached Documents</h2>
            <button
              type="button"
              onClick={() => setShowDocForm(true)}
              className="text-sm text-primark-blue font-medium hover:underline"
            >
              + Attach Document
            </button>
          </div>

          {documents.length === 0 && !showDocForm && (
            <p className="text-sm text-mid-grey">No documents attached. Optional — attach NDAs or legal documents.</p>
          )}

          {documents.map((doc, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-light-grey rounded-lg mb-2">
              <span className="text-sm font-medium text-navy">{doc.document_name}</span>
              <button
                type="button"
                onClick={() => setDocuments((d) => d.filter((_, j) => j !== i))}
                className="text-danger text-xs hover:underline"
              >
                Remove
              </button>
            </div>
          ))}

          {showDocForm && (
            <div className="border border-border-grey rounded-xl p-4 space-y-3 mt-3">
              <input
                type="text"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                placeholder="Document name (e.g. NDA)"
                className="w-full px-3 py-2 border border-border-grey rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primark-blue"
              />
              <textarea
                value={newDocContent}
                onChange={(e) => setNewDocContent(e.target.value)}
                placeholder="Document content (Markdown supported)"
                rows={6}
                className="w-full px-3 py-2 border border-border-grey rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primark-blue resize-y"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDocForm(false)}
                  className="px-4 py-2 border border-border-grey rounded-lg text-sm text-charcoal"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addDocument}
                  disabled={!newDocName.trim() || !newDocContent.trim()}
                  className="px-4 py-2 bg-primark-blue text-white rounded-lg text-sm font-medium hover:bg-primark-blue-dark disabled:opacity-50"
                >
                  Add Document
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primark-blue text-white py-4 rounded-xl font-semibold text-base hover:bg-primark-blue-dark transition-colors disabled:opacity-50 min-h-btn-primary"
        >
          {loading ? 'Scheduling...' : 'Schedule Visit'}
        </button>
      </form>
    </div>
  )
}
