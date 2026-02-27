import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useVisits } from '../hooks/useVisits'
import { useVisitors } from '../hooks/useVisitors'
import { useNotifications } from '../hooks/useNotifications'
import { useAuditLog } from '../hooks/useAuditLog'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/layout/PageHeader'
import SearchBar from '../components/ui/SearchBar'
import DateTimePicker from '../components/ui/DateTimePicker'
import type { Visitor, SafeUser } from '../lib/types'
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

  const { user, site } = useAuth()
  const { createVisit } = useVisits()
  const { getById, search, visitors } = useVisitors()
  const { sendNotification } = useNotifications()
  const { log } = useAuditLog()

  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null)
  const [visitorSearch, setVisitorSearch] = useState('')
  const [allUsers, setAllUsers] = useState<SafeUser[]>([])
  const [hostContactId, setHostContactId] = useState<string>(user?.id ?? '')
  const [backupContactId, setBackupContactId] = useState<string>('')
  const [plannedArrival, setPlannedArrival] = useState('')
  const [plannedDeparture, setPlannedDeparture] = useState('')
  const [purpose, setPurpose] = useState('')
  const [documents, setDocuments] = useState<DocumentDraft[]>([])
  const [showDocForm, setShowDocForm] = useState(false)
  const [newDocName, setNewDocName] = useState('')
  const [newDocContent, setNewDocContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (preselectedVisitorId) {
      getById(preselectedVisitorId).then((v) => { if (v) setSelectedVisitor(v) })
    }
  }, [preselectedVisitorId, getById])

  useEffect(() => {
    if (!site) return
    supabase
      .from('members')
      .select('id,name,username,email,site_id,role,is_active,created_at,updated_at')
      .eq('site_id', site.id)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setAllUsers((data as SafeUser[]) ?? []))
  }, [site])

  const handleVisitorSearch = useCallback((q: string) => {
    setVisitorSearch(q)
    if (q) search(q)
  }, [search])

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
    if (!plannedArrival) errs.arrival = 'Select a planned arrival time'
    if (!plannedDeparture) errs.departure = 'Select an expected departure time'
    if (plannedArrival && plannedDeparture && plannedDeparture <= plannedArrival) {
      errs.departure = 'Departure must be after arrival'
    }
    if (!purpose.trim()) errs.purpose = 'Purpose is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !selectedVisitor || !user || !site) return
    setLoading(true)

    try {
      const hostId = hostContactId || user.id
      const visit = await createVisit({
        visitor_id: selectedVisitor.id,
        site_id: site.id,
        host_user_id: hostId,
        purpose: purpose.trim(),
        planned_arrival: new Date(plannedArrival).toISOString(),
        planned_departure: new Date(plannedDeparture).toISOString(),
        is_walk_in: isWalkIn,
      })

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
        title: `Visit scheduled: ${site.name}`,
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

  const now = new Date().toISOString().slice(0, 16)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader
        title={isWalkIn ? 'Register Walk-In Visit' : 'Schedule Visit'}
        subtitle="Create a new visit for a visitor"
        backTo="/"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Visitor selection */}
        <div className="bg-white rounded-xl shadow-card p-5">
          <h2 className="text-base font-semibold text-navy mb-4">Visitor</h2>
          {selectedVisitor ? (
            <div className="flex items-center justify-between p-3 bg-primark-blue-light rounded-lg">
              <div>
                <div className="text-sm font-semibold text-navy">{selectedVisitor.name}</div>
                <div className="text-xs text-mid-grey">{selectedVisitor.email} · {selectedVisitor.company}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVisitor(null)}
                className="text-xs text-primark-blue hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <SearchBar
                placeholder="Search by name or email..."
                onSearch={handleVisitorSearch}
                className="mb-3"
              />
              {errors.visitor && <p className="text-xs text-danger mb-2">{errors.visitor}</p>}
              {visitorSearch && visitors.length > 0 && (
                <div className="border border-border-grey rounded-lg divide-y divide-border-grey max-h-48 overflow-y-auto">
                  {visitors.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => { setSelectedVisitor(v); setVisitorSearch('') }}
                      className="w-full text-left px-4 py-3 hover:bg-light-grey transition-colors"
                    >
                      <div className="text-sm font-medium text-navy">{v.name}</div>
                      <div className="text-xs text-mid-grey">{v.email} · {v.company}</div>
                    </button>
                  ))}
                </div>
              )}
              {visitorSearch && visitors.length === 0 && (
                <button
                  type="button"
                  onClick={() => navigate(`/visitors/new?walkin=${isWalkIn}`)}
                  className="w-full text-sm text-primark-blue hover:underline text-center py-2"
                >
                  + Create new visitor profile
                </button>
              )}
            </div>
          )}
        </div>

        {/* Visit details */}
        <div className="bg-white rounded-xl shadow-card p-5 space-y-4">
          <h2 className="text-base font-semibold text-navy">Visit Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <DateTimePicker
              label="Planned Arrival"
              value={plannedArrival}
              onChange={setPlannedArrival}
              min={now}
              required
              error={errors.arrival}
            />
            <DateTimePicker
              label="Expected Departure"
              value={plannedDeparture}
              onChange={setPlannedDeparture}
              min={plannedArrival || now}
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
