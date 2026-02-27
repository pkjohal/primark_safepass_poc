import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useVisits } from '../hooks/useVisits'
import { useEscalation } from '../hooks/useEscalation'
import { getDisplayStatus, formatDate } from '../lib/utils'
import StatCard from '../components/ui/StatCard'
import VisitorRow from '../components/visitors/VisitorRow'
import SearchBar from '../components/ui/SearchBar'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import type { VisitWithVisitor } from '../lib/types'

export default function HomeScreen() {
  const navigate = useNavigate()
  const { user, site, isReception, isSiteAdmin, activeEvacuation } = useAuth()
  const { todaysVisits, checkedInVisits, loading } = useVisits()
  const [search, setSearch] = useState('')
  const [showEvacConfirm, setShowEvacConfirm] = useState(false)

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

  const unescortedVisits = checkedInVisits.filter((v) => v.access_status === 'unescorted')
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
            onClick={() => setShowEvacConfirm(true)}
            className="flex items-center gap-2 bg-danger text-white px-5 py-3 rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors min-h-btn"
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
              onClick={() => navigate('/visitors/new?walkin=true')}
              className="flex items-center gap-1.5 bg-primark-blue text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primark-blue-dark transition-colors min-h-btn"
            >
              + Walk-In
            </button>
          )}
        </div>

        <SearchBar
          placeholder="Search visitors, company..."
          onSearch={setSearch}
          className="mb-4"
        />

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 skeleton rounded-lg" />
            ))}
          </div>
        ) : filteredScheduled.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No visitors expected"
            message={search ? 'No visitors match your search' : 'No scheduled visitors for today'}
            action={isReception && !activeEvacuation ? { label: 'Register Walk-In', onClick: () => navigate('/visitors/new?walkin=true') } : undefined}
          />
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
                </tr>
              </thead>
              <tbody>
                {filteredScheduled.map((visit) => (
                  <VisitorRow
                    key={visit.id}
                    visit={visit}
                    onClick={isReception ? () => navigate(`/checkin/${visit.id}`) : undefined}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live status board (reception + admin only) */}
      {isReception && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatusSection
            title="Awaiting Escort"
            colour="amber"
            visits={awaitingEscort}
            onAction={(v) => navigate(`/checkin/${v.id}`)}
          />
          <StatusSection
            title="Overdue"
            colour="red"
            visits={overdueVisits}
            onAction={(v) => navigate(`/checkin/${v.id}`)}
          />
          <StatusSection
            title="On-Site — Unescorted"
            colour="green"
            visits={unescortedVisits}
          />
        </div>
      )}

      {/* Evacuation confirmation */}
      {showEvacConfirm && (
        <ConfirmDialog
          title="Activate Emergency Evacuation?"
          message="This will immediately suspend all check-ins and sign-outs and display an evacuation alert to all logged-in users. This action should only be used in a genuine emergency."
          confirmLabel="Activate Evacuation"
          variant="danger"
          onConfirm={() => { setShowEvacConfirm(false); navigate('/evacuation?activate=true') }}
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
}: {
  title: string
  colour: 'green' | 'amber' | 'red'
  visits: VisitWithVisitor[]
  onAction?: (v: VisitWithVisitor) => void
}) {
  const borderColour = {
    green: 'border-success',
    amber: 'border-warning',
    red: 'border-danger',
  }[colour]

  const headerColour = {
    green: 'text-success',
    amber: 'text-warning',
    red: 'text-danger',
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
              className={`flex items-center justify-between p-2.5 rounded-lg bg-light-grey ${onAction ? 'cursor-pointer hover:bg-border-grey transition-colors' : ''}`}
              onClick={() => onAction?.(v)}
            >
              <div>
                <div className="text-sm font-semibold text-navy">{v.visitor.name}</div>
                <div className="text-xs text-mid-grey">
                  {v.visitor.company} · Since {formatDate(v.actual_arrival, 'time-only')}
                </div>
              </div>
              <div className="text-xs text-mid-grey">{v.host.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
