import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Check, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useVisits } from '../hooks/useVisits'
import { useAuth } from '../context/AuthContext'
import { INDUCTION_VALIDITY_DAYS } from '../lib/constants'
import { formatDate } from '../lib/utils'
import PageHeader from '../components/layout/PageHeader'
import StatusPill from '../components/ui/StatusPill'
import EmptyState from '../components/ui/EmptyState'
import type { VisitWithVisitor } from '../lib/types'

export default function UpcomingVisitsScreen() {
  const navigate = useNavigate()
  const { isHost, site } = useAuth()
  const { getUpcomingVisits } = useVisits()
  const [visits, setVisits] = useState<VisitWithVisitor[]>([])
  const [validInductions, setValidInductions] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUpcomingVisits().then((data) => {
      setVisits(data)
      setLoading(false)
    })
  }, [getUpcomingVisits])

  useEffect(() => {
    if (!site || visits.length === 0) return
    const visitorIds = [...new Set(visits.map((v) => v.visitor.id))]
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - INDUCTION_VALIDITY_DAYS)
    supabase
      .from('induction_records')
      .select('visitor_id')
      .eq('site_id', site.id)
      .eq('content_version', site.hs_content_version)
      .gte('completed_at', cutoff.toISOString())
      .in('visitor_id', visitorIds)
      .then(({ data }) => {
        setValidInductions(new Set((data ?? []).map((r: { visitor_id: string }) => r.visitor_id)))
      })
  }, [visits, site])

  // Group by date label
  const groups: { label: string; visits: VisitWithVisitor[] }[] = []
  for (const visit of visits) {
    const label = new Date(visit.planned_arrival).toLocaleDateString('en-IE', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
    const existing = groups.find((g) => g.label === label)
    if (existing) existing.visits.push(visit)
    else groups.push({ label, visits: [visit] })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Upcoming Visits"
        subtitle="Scheduled visits from tomorrow onwards"
        actions={
          isHost ? (
            <button
              onClick={() => navigate('/schedule')}
              className="flex items-center gap-2 bg-primark-blue text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primark-blue-dark transition-colors"
            >
              + Schedule Visit
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <div key={i}>
              <div className="h-5 w-40 skeleton rounded mb-3" />
              <div className="space-y-2">
                {[...Array(3)].map((_, j) => <div key={j} className="h-16 skeleton rounded-xl" />)}
              </div>
            </div>
          ))}
        </div>
      ) : visits.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-7 h-7 text-mid-grey" />}
          title="No upcoming visits"
          message="No visits are scheduled beyond today."
          action={isHost ? { label: 'Schedule a Visit', onClick: () => navigate('/schedule') } : undefined}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h2 className="text-sm font-semibold text-mid-grey uppercase tracking-wide mb-3">
                {group.label}
              </h2>
              <div className="bg-white rounded-xl shadow-card divide-y divide-border-grey overflow-hidden">
                {group.visits.map((visit) => (
                  <div
                    key={visit.id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-light-grey transition-colors cursor-pointer"
                    onClick={() => navigate(`/visitors/${visit.visitor.id}`)}
                  >
                    {/* Time */}
                    <div className="text-sm font-semibold text-navy w-14 shrink-0">
                      {formatDate(visit.planned_arrival, 'time-only')}
                    </div>

                    {/* Visitor */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-navy truncate">{visit.visitor.name}</div>
                      <div className="text-xs text-mid-grey truncate">
                        {visit.visitor.company} · {visit.purpose}
                      </div>
                    </div>

                    {/* Host */}
                    <div className="text-sm text-charcoal hidden sm:block w-28 shrink-0 truncate">
                      {visit.host.name}
                    </div>

                    {/* Type */}
                    <span className={`hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                      visit.visitor.visitor_type === 'internal_staff'
                        ? 'bg-primark-blue-light text-primark-blue'
                        : 'bg-light-grey text-mid-grey'
                    }`}>
                      {visit.visitor.visitor_type === 'internal_staff' ? 'Internal' : '3rd Party'}
                    </span>

                    {/* Pre-arrival */}
                    <div className="hidden lg:flex gap-2 text-xs shrink-0">
                      {(() => {
                        const inducted = visit.induction_completed || validInductions.has(visit.visitor.id)
                        return (
                          <span className={inducted ? 'text-success' : 'text-warning'}>
                            H&S {inducted ? <Check className="inline w-3.5 h-3.5" /> : <X className="inline w-3.5 h-3.5" />}
                          </span>
                        )
                      })()}
                    </div>

                    {/* Status */}
                    <div className="shrink-0">
                      <StatusPill status="scheduled" />
                    </div>

                    {/* Arrow */}
                    <svg className="w-4 h-4 text-mid-grey shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
