import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useVisits } from '../hooks/useVisits'
import { useEscalation } from '../hooks/useEscalation'
import { useEvacuation } from '../hooks/useEvacuation'
import { useNotifications } from '../hooks/useNotifications'
import { useAuditLog } from '../hooks/useAuditLog'
import { getDisplayStatus, formatDate } from '../lib/utils'
import { supabase } from '../lib/supabase'
import StatCard from '../components/ui/StatCard'
import VisitorRow from '../components/visitors/VisitorRow'
import CheckInModal from '../components/visits/CheckInModal'
import SearchBar from '../components/ui/SearchBar'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import type { VisitWithVisitor } from '../lib/types'

export default function HomeScreen() {
  const navigate = useNavigate()
  const { user, site, isHost, isReception, isSiteAdmin, activeEvacuation, setActiveEvacuation } = useAuth()
  const { todaysVisits, checkedInVisits, loading, updateVisit, fetchVisits } = useVisits()
  const [search, setSearch] = useState('')
  const [showEvacConfirm, setShowEvacConfirm] = useState(false)
  const [evacuating, setEvacuating] = useState(false)
  const [checkInVisitId, setCheckInVisitId] = useState<string | null>(null)
  const { activate, getCheckedInVisitors } = useEvacuation()
  const { sendNotification } = useNotifications()
  const { log } = useAuditLog()

  // Escalation polling — only for reception/site_admin
  useEscalation(site, user?.id ?? null, isReception)

  const overdueVisits = checkedInVisits.filter((v) => getDisplayStatus(v) === 'overdue')
  const awaitingEscort = checkedInVisits.filter((v) => v.access_status === 'awaiting_escort')

  const filteredScheduled = todaysVisits.filter((v) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      v.visitor.name.toLowerCase().includes(q) ||
      (v.visitor.company ?? '').toLowerCase().includes(q) ||
      v.host.name.toLowerCase().includes(q)
    )
  })

  const unescortedVisits = checkedInVisits.filter((v) => v.access_status === 'unescorted' && getDisplayStatus(v) !== 'overdue')
  const escortedVisits = checkedInVisits.filter((v) => v.access_status === 'escorted' && getDisplayStatus(v) !== 'overdue')

  async function handleMarkEscorted(v: VisitWithVisitor) {
    await updateVisit(v.id, { access_status: 'escorted' })
    fetchVisits()
  }

  async function handleCheckOut(v: VisitWithVisitor) {
    await updateVisit(v.id, { status: 'departed', actual_departure: new Date().toISOString() })
    fetchVisits()
  }
  async function handleActivateEvacuation() {
    if (!user || !site) return
    setEvacuating(true)
    try {
      const checkedIn = await getCheckedInVisitors(site.id)
      const event = await activate(site.id, user.id, checkedIn.length)
      const { data: staffUsers } = await supabase
        .from('members')
        .select('id')
        .eq('site_id', site.id)
        .eq('is_active', true)
      if (staffUsers) {
        await Promise.all(
          (staffUsers as { id: string }[]).map((u) =>
            sendNotification({
              recipient_type: 'user',
              recipient_user_id: u.id,
              notification_type: 'evacuation_activated',
              title: 'EVACUATION ACTIVATED',
              body: `Emergency evacuation has been activated at ${site.name} by ${user.name}. Please proceed to the assembly point.`,
            })
          )
        )
      }
      await log('evacuation_activated', 'evacuation_event', event.id, user.id, { headcount: checkedIn.length })
      setActiveEvacuation(event)
      setShowEvacConfirm(false)
      navigate('/evacuation')
    } catch {
      toast.error('Failed to activate evacuation')
    } finally {
      setEvacuating(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
          <p className="text-sm text-mid-grey mt-0.5">
            {new Date().toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {isSiteAdmin && (
          <button
            onClick={() => !activeEvacuation && setShowEvacConfirm(true)}
            disabled={!!activeEvacuation}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-colors min-h-btn ${
              activeEvacuation
                ? 'bg-mid-grey text-white cursor-not-allowed opacity-50'
                : 'bg-danger text-white hover:bg-red-700'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Emergency Evacuation
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          value={loading ? '—' : todaysVisits.length}
          label="Expected Today"
          colour="blue"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        />
        <StatCard
          value={loading ? '—' : checkedInVisits.length}
          label="On-Site Now"
          colour={checkedInVisits.length > 0 ? 'amber' : 'green'}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatCard
          value={loading ? '—' : awaitingEscort.length}
          label="Awaiting Escort"
          colour={awaitingEscort.length > 0 ? 'red' : 'green'}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
        />
        <StatCard
          value={loading ? '—' : overdueVisits.length}
          label="Overdue"
          colour={overdueVisits.length > 0 ? 'red' : 'green'}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* Expected visitors — full width */}
      <div className="bg-white rounded-xl shadow-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-navy">Expected Today</h2>
          {isReception && !activeEvacuation && (
            <button
              onClick={() => navigate('/schedule?walkin=true')}
              className="flex items-center gap-1.5 bg-primark-blue text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primark-blue-dark transition-colors min-h-btn"
            >
              + Walk-In
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 skeleton rounded-lg" />
            ))}
          </div>
        ) : todaysVisits.length === 0 ? (
          <p className="text-sm text-mid-grey">No visitors scheduled for today.</p>
        ) : (
          <>
            <SearchBar
              placeholder="Search visitors, company..."
              onSearch={setSearch}
              className="mb-4"
            />
            {filteredScheduled.length === 0 ? (
              <p className="text-sm text-mid-grey">No visitors match your search.</p>
            ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="py-2 px-4 text-xs font-medium text-mid-grey uppercase tracking-wide">Time</th>
                  <th className="py-2 px-4 text-xs font-medium text-mid-grey uppercase tracking-wide">Visitor</th>
                  <th className="py-2 px-4 text-xs font-medium text-mid-grey uppercase tracking-wide hidden sm:table-cell">Type</th>
                  <th className="py-2 px-4 text-xs font-medium text-mid-grey uppercase tracking-wide hidden md:table-cell">Host</th>
                  <th className="py-2 px-4 text-xs font-medium text-mid-grey uppercase tracking-wide hidden lg:table-cell">Purpose</th>
                  <th className="py-2 px-4 text-xs font-medium text-mid-grey uppercase tracking-wide hidden sm:table-cell">Pre-Arrival</th>
                  <th className="py-2 px-4 text-xs font-medium text-mid-grey uppercase tracking-wide">Status</th>
                  {isReception && <th className="py-2 px-4" />}
                </tr>
              </thead>
              <tbody>
                {filteredScheduled.map((visit) => (
                  <VisitorRow
                    key={visit.id}
                    visit={visit}
                    onCheckIn={isReception && !activeEvacuation ? () => setCheckInVisitId(visit.id) : undefined}
                  />
                ))}
              </tbody>
            </table>
          </div>
            )}
          </>
        )}
      </div>

      {/* Live status board */}
      {isHost && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatusSection
            title="Awaiting Escort"
            colour="amber"
            visits={awaitingEscort}
            onAction={isReception && !activeEvacuation ? (v) => navigate(`/checkin/${v.id}`) : undefined}
            secondaryAction={isReception && !activeEvacuation ? {
              label: 'Mark Escorted',
              onAction: handleMarkEscorted,
            } : undefined}
          />
          <StatusSection
            title="On-Site — Escorted"
            colour="blue"
            visits={escortedVisits}
            secondaryAction={isReception && !activeEvacuation ? { label: 'Check Out', onAction: handleCheckOut } : undefined}
          />
          <StatusSection
            title="On-Site — Unescorted"
            colour="green"
            visits={unescortedVisits}
            secondaryAction={isReception && !activeEvacuation ? { label: 'Check Out', onAction: handleCheckOut } : undefined}
          />
          <StatusSection
            title="Overdue"
            colour="red"
            visits={overdueVisits}
            onAction={isReception ? (v) => navigate(`/checkin/${v.id}`) : undefined}
            secondaryAction={isReception && !activeEvacuation ? { label: 'Check Out', onAction: handleCheckOut } : undefined}
          />
        </div>
      )}

      {/* Check-in modal */}
      {checkInVisitId && (
        <CheckInModal
          visitId={checkInVisitId}
          onClose={() => { setCheckInVisitId(null); fetchVisits() }}
        />
      )}

      {/* Evacuation confirmation */}
      {showEvacConfirm && (
        <ConfirmDialog
          title="Activate Emergency Evacuation?"
          message="This will immediately suspend all check-ins and sign-outs and display an evacuation alert to all logged-in users. This action should only be used in a genuine emergency."
          confirmLabel={evacuating ? 'Activating...' : 'Activate Evacuation'}
          variant="danger"
          onConfirm={handleActivateEvacuation}
          onCancel={() => setShowEvacConfirm(false)}
        />
      )}
    </div>
  )
}

function StatusSection({
  title,
  colour,
  visits,
  onAction,
  secondaryAction,
}: {
  title: string
  colour: 'green' | 'amber' | 'red' | 'blue'
  visits: VisitWithVisitor[]
  onAction?: (v: VisitWithVisitor) => void
  secondaryAction?: { label: string; onAction: (v: VisitWithVisitor) => void }
}) {
  const borderColour = {
    green: 'border-success',
    amber: 'border-warning',
    red: 'border-danger',
    blue: 'border-primark-blue',
  }[colour]

  const headerColour = {
    green: 'text-success',
    amber: 'text-warning',
    red: 'text-danger',
    blue: 'text-primark-blue',
  }[colour]

  return (
    <div className={`bg-white rounded-xl shadow-card p-4 border-l-4 ${borderColour}`}>
      <h3 className={`text-sm font-semibold uppercase tracking-wide mb-3 ${headerColour}`}>
        {title} ({visits.length})
      </h3>
      {visits.length === 0 ? (
        <p className="text-sm text-mid-grey">None</p>
      ) : (
        <div className="space-y-2">
          {visits.map((v) => (
            <div
              key={v.id}
              className={`p-2.5 rounded-lg bg-light-grey ${onAction ? 'cursor-pointer hover:bg-border-grey transition-colors' : ''}`}
              onClick={() => onAction?.(v)}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-navy">{v.visitor.name}</div>
                  <div className="text-xs text-mid-grey">
                    {v.visitor.company} · Since {formatDate(v.actual_arrival, 'time-only')}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {(v.access_status === 'escorted' || v.access_status === 'unescorted') && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      v.access_status === 'escorted'
                        ? 'bg-primark-blue-light text-primark-blue'
                        : 'bg-light-grey text-charcoal'
                    }`}>
                      {v.access_status === 'escorted' ? 'Escorted' : 'Unescorted'}
                    </span>
                  )}
                  <span className="text-xs text-mid-grey">{v.host.name}</span>
                </div>
              </div>
              {secondaryAction && (
                <button
                  onClick={(e) => { e.stopPropagation(); secondaryAction.onAction(v) }}
                  className="mt-2 w-full text-xs font-semibold text-primark-blue border border-primark-blue rounded-lg py-1 hover:bg-primark-blue-light transition-colors"
                >
                  {secondaryAction.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
