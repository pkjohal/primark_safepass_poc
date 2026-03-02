import { useCallback, useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../lib/utils'
import PageHeader from '../components/layout/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import type { EvacuationEvent } from '../lib/types'

interface EvacuationWithMeta extends EvacuationEvent {
  activatedByName: string
  closedByName: string | null
  durationMinutes: number | null
}

interface EvacuationVisitRow {
  id: string
  actual_arrival: string | null
  visitor: { name: string; company: string | null; visitor_type: string }
  host: { name: string }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function EvacuationHistoryScreen() {
  const { site } = useAuth()

  const [evacuations, setEvacuations] = useState<EvacuationWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<EvacuationWithMeta | null>(null)
  const [visitors, setVisitors] = useState<EvacuationVisitRow[]>([])
  const [visitorsLoading, setVisitorsLoading] = useState(false)

  const load = useCallback(async () => {
    if (!site) return
    setLoading(true)

    const { data: events } = await supabase
      .from('evacuation_events')
      .select('*')
      .eq('site_id', site.id)
      .not('closed_at', 'is', null)
      .order('activated_at', { ascending: false })

    if (!events || events.length === 0) {
      setEvacuations([])
      setLoading(false)
      return
    }

    const memberIds = [...new Set([
      ...events.map((e: EvacuationEvent) => e.activated_by),
      ...events.map((e: EvacuationEvent) => e.closed_by).filter(Boolean),
    ])] as string[]

    const { data: members } = await supabase
      .from('members')
      .select('id, name')
      .in('id', memberIds)

    const memberMap = Object.fromEntries(
      ((members ?? []) as { id: string; name: string }[]).map((m) => [m.id, m.name])
    )

    setEvacuations(events.map((e: EvacuationEvent) => ({
      ...e,
      activatedByName: memberMap[e.activated_by] ?? 'Unknown',
      closedByName: e.closed_by ? (memberMap[e.closed_by] ?? 'Unknown') : null,
      durationMinutes: e.closed_at
        ? Math.round((new Date(e.closed_at).getTime() - new Date(e.activated_at).getTime()) / 60000)
        : null,
    })))
    setLoading(false)
  }, [site])

  useEffect(() => { load() }, [load])

  async function openDetail(ev: EvacuationWithMeta) {
    setSelected(ev)
    setVisitorsLoading(true)
    const { data } = await supabase
      .from('visits')
      .select(`
        id,
        actual_arrival,
        visitor:visitors(name, company, visitor_type),
        host:members!visits_host_user_id_fkey(name)
      `)
      .eq('site_id', ev.site_id)
      .lte('actual_arrival', ev.activated_at)
      .or(`actual_departure.is.null,actual_departure.gte.${ev.activated_at}`)
      .order('actual_arrival')
    setVisitors((data as unknown as EvacuationVisitRow[]) ?? [])
    setVisitorsLoading(false)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Evacuation History"
        subtitle="Record of all past evacuation events at this site"
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
        </div>
      ) : evacuations.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="w-7 h-7 text-mid-grey" />}
          title="No past evacuations"
        />
      ) : (
        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-light-grey">
                <th className="text-left py-3 px-5 text-xs font-medium text-mid-grey uppercase tracking-wide">Date &amp; Time</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-mid-grey uppercase tracking-wide hidden sm:table-cell">Duration</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-mid-grey uppercase tracking-wide">Headcount</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-mid-grey uppercase tracking-wide hidden md:table-cell">Activated By</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-mid-grey uppercase tracking-wide hidden lg:table-cell">Notes</th>
                <th className="py-3 px-5" />
              </tr>
            </thead>
            <tbody>
              {evacuations.map((ev) => {
                const allAccounted = ev.headcount_accounted >= ev.headcount_at_activation
                return (
                  <tr key={ev.id} className="border-t border-border-grey hover:bg-light-grey/50 transition-colors">
                    <td className="py-4 px-5">
                      <div className="text-sm font-semibold text-navy">{formatDate(ev.activated_at, 'date-only')}</div>
                      <div className="text-xs text-mid-grey">{formatDate(ev.activated_at, 'time-only')}</div>
                    </td>
                    <td className="py-4 px-5 hidden sm:table-cell text-sm text-charcoal">
                      {ev.durationMinutes !== null ? formatDuration(ev.durationMinutes) : '—'}
                    </td>
                    <td className="py-4 px-5">
                      <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${
                        allAccounted ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'
                      }`}>
                        {ev.headcount_accounted}/{ev.headcount_at_activation} accounted
                      </span>
                    </td>
                    <td className="py-4 px-5 hidden md:table-cell text-sm text-charcoal">{ev.activatedByName}</td>
                    <td className="py-4 px-5 hidden lg:table-cell text-sm text-mid-grey max-w-xs truncate">
                      {ev.notes ?? <span className="italic text-border-grey">None</span>}
                    </td>
                    <td className="py-4 px-5">
                      <button
                        onClick={() => openDetail(ev)}
                        className="text-xs text-primark-blue hover:underline font-medium"
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-start justify-between p-6 border-b border-border-grey shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="w-5 h-5 text-danger" />
                  <h2 className="text-lg font-bold text-navy">Evacuation Event</h2>
                </div>
                <p className="text-sm text-mid-grey">{formatDate(selected.activated_at, 'absolute')}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-mid-grey hover:text-charcoal transition-colors ml-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-light-grey rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-navy">{selected.headcount_at_activation}</div>
                  <div className="text-xs text-mid-grey mt-0.5">On Site</div>
                </div>
                <div className="bg-success-bg rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-success">{selected.headcount_accounted}</div>
                  <div className="text-xs text-mid-grey mt-0.5">Accounted</div>
                </div>
                <div className={`rounded-xl p-4 text-center ${selected.headcount_at_activation - selected.headcount_accounted > 0 ? 'bg-danger-bg' : 'bg-success-bg'}`}>
                  <div className={`text-2xl font-bold ${selected.headcount_at_activation - selected.headcount_accounted > 0 ? 'text-danger' : 'text-success'}`}>
                    {selected.headcount_at_activation - selected.headcount_accounted}
                  </div>
                  <div className="text-xs text-mid-grey mt-0.5">Unaccounted</div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-light-grey rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-mid-grey">Activated by</span>
                  <span className="font-medium text-navy">{selected.activatedByName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-mid-grey">Activated at</span>
                  <span className="font-medium text-navy">{formatDate(selected.activated_at, 'absolute')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-mid-grey">Closed by</span>
                  <span className="font-medium text-navy">{selected.closedByName ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-mid-grey">Closed at</span>
                  <span className="font-medium text-navy">{formatDate(selected.closed_at, 'absolute')}</span>
                </div>
                {selected.durationMinutes !== null && (
                  <div className="flex justify-between border-t border-border-grey pt-2 mt-1">
                    <span className="text-mid-grey">Duration</span>
                    <span className="font-bold text-navy">{formatDuration(selected.durationMinutes)}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selected.notes && (
                <div>
                  <p className="text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">Incident Notes</p>
                  <p className="text-sm text-charcoal bg-warning-bg rounded-xl p-4">{selected.notes}</p>
                </div>
              )}

              {/* Visitor manifest */}
              <div>
                <p className="text-xs font-medium text-mid-grey uppercase tracking-wide mb-2">
                  Visitors On-Site at Activation
                </p>
                {visitorsLoading ? (
                  <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 skeleton rounded-lg" />)}</div>
                ) : visitors.length === 0 ? (
                  <p className="text-sm text-mid-grey italic py-2">No visitors were on-site at the time of activation.</p>
                ) : (
                  <div className="border border-border-grey rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-light-grey">
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-mid-grey">Name</th>
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-mid-grey hidden sm:table-cell">Company</th>
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-mid-grey">Type</th>
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-mid-grey hidden md:table-cell">Host</th>
                          <th className="text-left py-2.5 px-4 text-xs font-medium text-mid-grey">In Since</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visitors.map((v, i) => (
                          <tr key={v.id} className={`border-t border-border-grey ${i % 2 === 0 ? '' : 'bg-light-grey/40'}`}>
                            <td className="py-2.5 px-4 font-medium text-navy">{v.visitor.name}</td>
                            <td className="py-2.5 px-4 text-charcoal hidden sm:table-cell">{v.visitor.company ?? '—'}</td>
                            <td className="py-2.5 px-4">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                v.visitor.visitor_type === 'internal_staff'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {v.visitor.visitor_type === 'internal_staff' ? 'Internal' : 'Third Party'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-charcoal hidden md:table-cell">{v.host.name}</td>
                            <td className="py-2.5 px-4 text-charcoal">{formatDate(v.actual_arrival, 'time-only')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
