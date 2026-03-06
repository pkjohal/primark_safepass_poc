import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, History } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatDate, getDisplayStatus } from '../lib/utils'
import StatusPill from '../components/ui/StatusPill'
import EmptyState from '../components/ui/EmptyState'
import type { VisitWithVisitor } from '../lib/types'

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDayLabel(date: Date): string {
  const today = startOfDay(new Date())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.getTime() === yesterday.getTime()) return 'Yesterday'
  return date.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PastVisitsScreen() {
  const navigate = useNavigate()
  const { site } = useAuth()

  const yesterday = startOfDay(new Date())
  yesterday.setDate(yesterday.getDate() - 1)

  const [selectedDate, setSelectedDate] = useState<Date>(yesterday)
  const [visits, setVisits] = useState<VisitWithVisitor[]>([])
  const [loading, setLoading] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const today = startOfDay(new Date())
  const isAtToday = selectedDate.getTime() >= today.getTime()

  const fetchVisits = useCallback(async () => {
    if (!site) return
    setLoading(true)

    const start = startOfDay(selectedDate)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)

    const { data } = await supabase
      .from('visits')
      .select(`
        *,
        visitor:visitors(*),
        host:members!visits_host_user_id_fkey(id,name,username,email,site_id,role,is_active,created_at,updated_at),
        visit_documents(id)
      `)
      .eq('site_id', site.id)
      .gte('planned_arrival', start.toISOString())
      .lt('planned_arrival', end.toISOString())
      .order('planned_arrival')

    setVisits((data as VisitWithVisitor[]) ?? [])
    setLoading(false)
  }, [site, selectedDate])

  useEffect(() => {
    fetchVisits()
  }, [fetchVisits])

  function shiftDay(delta: number) {
    setSelectedDate((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() + delta)
      return next
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Visit History</h1>
          <p className="text-sm text-mid-grey mt-0.5">Browse all visits by date</p>
        </div>
        <div>
          <button
            onClick={() => dateInputRef.current?.showPicker()}
            className="flex items-center gap-2 bg-primark-blue text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primark-blue-dark transition-colors min-h-btn"
          >
            <CalendarDays className="w-4 h-4" />
            Pick a Date
          </button>
          <input
            ref={dateInputRef}
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={selectedDate.toISOString().slice(0, 10)}
            onChange={(e) => {
              if (!e.target.value) return
              setSelectedDate(startOfDay(new Date(e.target.value + 'T00:00:00')))
            }}
            className="sr-only"
          />
        </div>
      </div>

      {/* Date navigator */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => shiftDay(-1)}
          className="p-2 rounded-lg border border-border-grey bg-white hover:bg-light-grey transition-colors text-charcoal"
          aria-label="Previous day"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 text-center">
          <span className="text-base font-semibold text-navy">{formatDayLabel(selectedDate)}</span>
          {formatDayLabel(selectedDate) === 'Yesterday' ? null : (
            <span className="block text-xs text-mid-grey mt-0.5">
              {selectedDate.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>

        <button
          onClick={() => shiftDay(1)}
          disabled={isAtToday}
          className={`p-2 rounded-lg border border-border-grey bg-white transition-colors ${
            isAtToday ? 'opacity-30 cursor-not-allowed' : 'hover:bg-light-grey text-charcoal'
          }`}
          aria-label="Next day"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Visit list */}
      <div className="bg-white rounded-xl shadow-card p-5">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 skeleton rounded-lg" />
            ))}
          </div>
        ) : visits.length === 0 ? (
          <EmptyState
            icon={<History className="w-7 h-7 text-mid-grey" />}
            title="No visits on this day"
            message="There were no scheduled or completed visits for this date."
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
                  <th className="py-2 px-4 text-xs font-medium text-mid-grey uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit) => (
                  <tr
                    key={visit.id}
                    className="border-b border-border-grey cursor-pointer hover:bg-primark-blue-light transition-colors"
                    onClick={() => navigate(`/visitors/${visit.visitor.id}`)}
                  >
                    <td className="py-3 px-4 text-sm text-charcoal whitespace-nowrap">
                      {formatDate(visit.planned_arrival, 'time-only')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm font-semibold text-navy">{visit.visitor.name}</div>
                      {visit.visitor.company && (
                        <div className="text-xs text-mid-grey">{visit.visitor.company}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        visit.visitor.visitor_type === 'internal_staff'
                          ? 'bg-primark-blue-light text-primark-blue'
                          : 'bg-light-grey text-mid-grey'
                      }`}>
                        {visit.visitor.visitor_type === 'internal_staff' ? 'Internal' : '3rd Party'}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <div className="text-sm text-charcoal">{visit.host.name}</div>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <div className="text-sm text-mid-grey truncate max-w-[160px]">{visit.purpose}</div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusPill
                        status={
                          getDisplayStatus(visit) === 'checked_in' && visit.access_status === 'awaiting_escort'
                            ? 'awaiting_escort'
                            : getDisplayStatus(visit)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
