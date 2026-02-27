import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEvacuation } from '../hooks/useEvacuation'
import { useNotifications } from '../hooks/useNotifications'
import { useAuditLog } from '../hooks/useAuditLog'
import { formatDate } from '../lib/utils'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import type { VisitWithVisitor } from '../lib/types'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function EvacuationScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, site, activeEvacuation } = useAuth()
  const { activate, close, updateHeadcount, getCheckedInVisitors } = useEvacuation()
  const { sendNotification } = useNotifications()
  const { log } = useAuditLog()

  const [visitors, setVisitors] = useState<VisitWithVisitor[]>([])
  const [accounted, setAccounted] = useState<Set<string>>(new Set())
  const [activating, setActivating] = useState(false)
  const [showActivateConfirm, setShowActivateConfirm] = useState(searchParams.get('activate') === 'true')
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [notes, setNotes] = useState('')
  const [closing, setClosing] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (activeEvacuation && site && !initialized.current) {
      initialized.current = true
      getCheckedInVisitors(site.id).then(setVisitors)
    }
  }, [activeEvacuation, site, getCheckedInVisitors])

  async function handleActivate() {
    if (!user || !site) return
    setActivating(true)
    try {
      const checkedIn = await getCheckedInVisitors(site.id)
      const event = await activate(site.id, user.id, checkedIn.length)
      setVisitors(checkedIn)

      // Notify all on-site users
      const { data: staffUsers } = await supabase
        .from('members')
        .select('id')
        .eq('site_id', site.id)
        .eq('is_active', true)
      if (staffUsers) {
        await Promise.all(staffUsers.map((u: { id: string }) =>
          sendNotification({
            recipient_type: 'user',
            recipient_user_id: u.id,
            notification_type: 'evacuation_activated',
            title: '🔴 EVACUATION ACTIVATED',
            body: `Emergency evacuation has been activated at ${site.name} by ${user.name}. Please proceed to the assembly point.`,
          })
        ))
      }

      await log('evacuation_activated', 'evacuation_event', event.id, user.id, {
        headcount: checkedIn.length,
      })
      setShowActivateConfirm(false)
      toast.error('Evacuation activated', { duration: 10000 })
    } catch {
      toast.error('Failed to activate evacuation')
    } finally {
      setActivating(false)
    }
  }

  async function handleMarkAccounted(visitId: string) {
    const next = new Set(accounted)
    if (next.has(visitId)) next.delete(visitId)
    else next.add(visitId)
    setAccounted(next)

    if (activeEvacuation) {
      await updateHeadcount(activeEvacuation.id, next.size)
    }
  }

  async function handleClose() {
    if (!user || !activeEvacuation) return
    setClosing(true)
    try {
      await close(activeEvacuation.id, user.id, notes)
      await log('evacuation_closed', 'evacuation_event', activeEvacuation.id, user.id, {
        headcount_at_activation: activeEvacuation.headcount_at_activation,
        headcount_accounted: accounted.size,
        notes,
      })
      toast.success('Evacuation closed — normal operations resumed')
      setShowCloseConfirm(false)
      navigate('/')
    } catch {
      toast.error('Failed to close evacuation')
    } finally {
      setClosing(false)
    }
  }

  // If no active evacuation and not about to activate, show prompt
  if (!activeEvacuation && !showActivateConfirm) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-card p-8 text-center">
          <div className="w-16 h-16 bg-danger-bg rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-danger" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-navy mb-2">Emergency Evacuation</h2>
          <p className="text-mid-grey mb-6 text-sm">No active evacuation event. Use this only in a genuine emergency.</p>
          <button
            onClick={() => setShowActivateConfirm(true)}
            className="bg-danger text-white px-8 py-4 rounded-xl font-bold text-base hover:bg-red-700 transition-colors"
          >
            Activate Evacuation
          </button>
        </div>

        {showActivateConfirm && (
          <ConfirmDialog
            title="Activate Emergency Evacuation?"
            message="This will suspend all check-ins and sign-outs and display a full-screen evacuation alert to all users. Only use in a genuine emergency."
            confirmLabel={activating ? 'Activating...' : 'Activate Evacuation'}
            variant="danger"
            onConfirm={handleActivate}
            onCancel={() => setShowActivateConfirm(false)}
          />
        )}
      </div>
    )
  }

  const internalVisitors = visitors.filter((v) => v.visitor.visitor_type === 'internal_staff')
  const thirdPartyVisitors = visitors.filter((v) => v.visitor.visitor_type === 'third_party')

  return (
    <div className="min-h-screen bg-alert-red text-white no-print">
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center py-8 border-4 border-white/30 rounded-2xl mb-8 animate-pulse">
          <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <h1 className="text-4xl font-black uppercase tracking-widest mb-2">EMERGENCY EVACUATION ACTIVE</h1>
          <p className="text-red-200">Check-ins and sign-outs are suspended</p>
        </div>

        {/* Headcount bar */}
        <div className="bg-alert-red-dark rounded-xl p-5 mb-6 flex items-center justify-between">
          <div>
            <div className="text-4xl font-black">{visitors.length}</div>
            <div className="text-red-200 text-sm">Visitors on-site</div>
          </div>
          <div className="text-4xl font-bold text-red-200">vs</div>
          <div className="text-right">
            <div className="text-4xl font-black text-white">{accounted.size}</div>
            <div className="text-red-200 text-sm">Accounted for</div>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-black ${accounted.size >= visitors.length ? 'text-green-300' : 'text-yellow-300'}`}>
              {visitors.length - accounted.size}
            </div>
            <div className="text-red-200 text-sm">Unaccounted</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => window.print()}
            className="flex-1 bg-white text-alert-red font-bold py-3 rounded-xl hover:bg-red-50 transition-colors"
          >
            Print Headcount List
          </button>
          <button
            onClick={() => setShowCloseConfirm(true)}
            className="flex-1 bg-alert-red-dark text-white font-bold py-3 rounded-xl border-2 border-white hover:bg-red-900 transition-colors"
          >
            Close Evacuation
          </button>
        </div>

        {/* Visitor lists */}
        {internalVisitors.length > 0 && (
          <VisitorGroup title="Internal Staff" visitors={internalVisitors} accounted={accounted} onToggle={handleMarkAccounted} />
        )}
        {thirdPartyVisitors.length > 0 && (
          <VisitorGroup title="Third Party Visitors" visitors={thirdPartyVisitors} accounted={accounted} onToggle={handleMarkAccounted} />
        )}
        {visitors.length === 0 && (
          <div className="text-center py-12 text-red-200">
            <p className="text-xl font-semibold">No visitors currently on-site</p>
          </div>
        )}
      </div>

      {showActivateConfirm && (
        <ConfirmDialog
          title="Activate Emergency Evacuation?"
          message="This will suspend all check-ins and sign-outs and display a full-screen evacuation alert to all users."
          confirmLabel={activating ? 'Activating...' : 'Activate Evacuation'}
          variant="danger"
          onConfirm={handleActivate}
          onCancel={() => setShowActivateConfirm(false)}
        />
      )}

      {showCloseConfirm && (
        <ConfirmDialog
          title="Close evacuation event?"
          message="This will end the evacuation, remove the alert from all screens, and resume normal operations."
          confirmLabel={closing ? 'Closing...' : 'Close Evacuation'}
          variant="danger"
          onConfirm={handleClose}
          onCancel={() => setShowCloseConfirm(false)}
        >
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about the incident..."
            rows={3}
            className="w-full px-3 py-2 border border-border-grey rounded-lg text-sm text-charcoal resize-none focus:outline-none"
          />
        </ConfirmDialog>
      )}
    </div>
  )
}

function VisitorGroup({
  title, visitors, accounted, onToggle,
}: {
  title: string
  visitors: VisitWithVisitor[]
  accounted: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold uppercase tracking-wide mb-3 text-red-200">{title} ({visitors.length})</h2>
      <div className="space-y-2">
        {visitors.map((v) => (
          <div
            key={v.id}
            className={`flex items-center justify-between p-4 rounded-xl transition-colors ${
              accounted.has(v.id) ? 'bg-green-900/40 border-2 border-green-400' : 'bg-alert-red-dark'
            }`}
          >
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={accounted.has(v.id)}
                onChange={() => onToggle(v.id)}
                className="w-6 h-6 rounded border-white text-green-500 focus:ring-green-400"
              />
              <div>
                <div className="font-semibold text-white">{v.visitor.name}</div>
                <div className="text-sm text-red-200">
                  {v.visitor.company} · Host: {v.host.name} · In since {formatDate(v.actual_arrival, 'time-only')}
                </div>
              </div>
            </div>
            {accounted.has(v.id) && (
              <span className="text-green-300 font-bold text-sm">✓ ACCOUNTED</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
