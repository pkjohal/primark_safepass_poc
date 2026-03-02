import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEvacuation } from '../hooks/useEvacuation'
import { useAuditLog } from '../hooks/useAuditLog'
import { formatDate } from '../lib/utils'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import type { VisitWithVisitor } from '../lib/types'
import toast from 'react-hot-toast'

export default function EvacuationScreen() {
  const navigate = useNavigate()
  const { user, site, activeEvacuation, setActiveEvacuation } = useAuth()
  const { close, updateHeadcount, getCheckedInVisitors } = useEvacuation()
  const { log } = useAuditLog()

  const [visitors, setVisitors] = useState<VisitWithVisitor[]>([])
  const [accounted, setAccounted] = useState<Set<string>>(new Set())
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
      setActiveEvacuation(null)
      toast.success('Evacuation closed — normal operations resumed')
      setShowCloseConfirm(false)
      navigate('/')
    } catch {
      toast.error('Failed to close evacuation')
    } finally {
      setClosing(false)
    }
  }

  if (!activeEvacuation) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-card p-8 text-center">
          <div className="w-16 h-16 bg-danger-bg rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-danger" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-navy mb-2">No Active Evacuation</h2>
          <p className="text-mid-grey mb-6 text-sm">There is no active evacuation event for this site.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-primark-blue text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-primark-blue-dark transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const unaccountedCount = visitors.length - accounted.size

  return (
    <div>
      {/* ── Red emergency banner (hidden when printing) ───────────────── */}
      <div className="bg-alert-red text-white no-print">
        <div className="p-6 max-w-4xl mx-auto">
          <div className="text-center py-6 border-4 border-white/30 rounded-2xl mb-6 animate-pulse">
            <svg className="w-12 h-12 mx-auto mb-3" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <h1 className="text-3xl font-black uppercase tracking-widest mb-1">EMERGENCY EVACUATION ACTIVE</h1>
            <p className="text-red-200 text-sm">Check-ins and sign-outs are suspended</p>
          </div>

          {/* Headcount bar */}
          <div className="bg-alert-red-dark rounded-xl p-5 mb-6 grid grid-cols-3 text-center">
            <div>
              <div className="text-4xl font-black">{visitors.length}</div>
              <div className="text-red-200 text-sm">On Site</div>
            </div>
            <div>
              <div className="text-4xl font-black text-green-300">{accounted.size}</div>
              <div className="text-red-200 text-sm">Accounted</div>
            </div>
            <div>
              <div className={`text-4xl font-black ${unaccountedCount > 0 ? 'text-yellow-300' : 'text-green-300'}`}>
                {unaccountedCount}
              </div>
              <div className="text-red-200 text-sm">Unaccounted</div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => window.print()}
              className="flex-1 bg-white text-alert-red font-bold py-3 rounded-xl hover:bg-red-50 transition-colors"
            >
              Print Headcount List
            </button>
            {accounted.size >= visitors.length && (
              <button
                onClick={() => setShowCloseConfirm(true)}
                className="flex-1 bg-alert-red-dark text-white font-bold py-3 rounded-xl border-2 border-white hover:bg-red-900 transition-colors"
              >
                Close Evacuation
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Headcount register (on-screen + printed) ──────────────────── */}
      <div className="max-w-4xl mx-auto p-6">

        {/* Document header — print only */}
        <div className="print-only mb-6 pb-4 border-b-2 border-black">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wide">Evacuation Headcount Register</h1>
              <p className="text-sm mt-1">Site: <strong>{site?.name}</strong></p>
              <p className="text-sm">Activated: <strong>{formatDate(activeEvacuation.activated_at, 'absolute')}</strong></p>
              <p className="text-sm">Printed: <strong>{new Date().toLocaleString('en-IE')}</strong></p>
            </div>
            <div className="text-right text-sm space-y-0.5">
              <p>On site: <strong>{visitors.length}</strong></p>
              <p>Accounted: <strong>{accounted.size}</strong></p>
              <p>Unaccounted: <strong>{unaccountedCount}</strong></p>
            </div>
          </div>
        </div>

        {/* On-screen register header */}
        <div className="no-print flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-navy">Headcount Register</h2>
            <p className="text-sm text-mid-grey">Check off each visitor as you account for them at the assembly point</p>
          </div>
        </div>

        {visitors.length === 0 ? (
          <p className="text-sm text-mid-grey py-8 text-center">No visitors were on-site at the time of activation.</p>
        ) : (
          <div className="bg-white rounded-xl shadow-card overflow-hidden">
            <table className="w-full text-sm border-collapse evacuation-register">
              <thead>
                <tr className="bg-navy text-white">
                  <th className="py-3 px-4 text-left font-semibold no-print w-10"></th>
                  <th className="py-3 px-4 text-center font-semibold print-only w-14">Status</th>
                  <th className="py-3 px-4 text-left font-semibold">Name</th>
                  <th className="py-3 px-4 text-left font-semibold hidden sm:table-cell">Company</th>
                  <th className="py-3 px-4 text-left font-semibold">Type</th>
                  <th className="py-3 px-4 text-left font-semibold hidden md:table-cell">Host</th>
                  <th className="py-3 px-4 text-left font-semibold">In Since</th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((v, i) => (
                  <tr
                    key={v.id}
                    className={`border-t border-border-grey ${
                      accounted.has(v.id) ? 'bg-green-50' : i % 2 === 0 ? 'bg-white' : 'bg-light-grey/40'
                    }`}
                  >
                    <td className="py-3 px-4 no-print">
                      <input
                        type="checkbox"
                        checked={accounted.has(v.id)}
                        onChange={() => handleMarkAccounted(v.id)}
                        className="w-5 h-5 rounded text-success focus:ring-success cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4 print-only text-center font-bold text-base">
                      {accounted.has(v.id) ? '✓' : '□'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-navy">{v.visitor.name}</td>
                    <td className="py-3 px-4 text-charcoal hidden sm:table-cell">{v.visitor.company ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        v.visitor.visitor_type === 'internal_staff'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {v.visitor.visitor_type === 'internal_staff' ? 'Internal' : 'Third Party'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-charcoal hidden md:table-cell">{v.host.name}</td>
                    <td className="py-3 px-4 text-charcoal">{formatDate(v.actual_arrival, 'time-only')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Signature block — print only */}
        <div className="print-only mt-10 pt-6 border-t border-gray-300 grid grid-cols-2 gap-12">
          <div>
            <p className="text-sm font-semibold mb-10">Evacuation Warden Signature:</p>
            <div className="border-b border-black mb-1"></div>
            <p className="text-xs text-gray-500">Name &amp; Date</p>
          </div>
          <div>
            <p className="text-sm font-semibold mb-10">All Persons Accounted — Confirmed By:</p>
            <div className="border-b border-black mb-1"></div>
            <p className="text-xs text-gray-500">Name &amp; Date</p>
          </div>
        </div>
      </div>

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
