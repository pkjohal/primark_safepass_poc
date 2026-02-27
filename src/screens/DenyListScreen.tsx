import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDenyList } from '../hooks/useDenyList'
import { useVisitors } from '../hooks/useVisitors'
import { useAuditLog } from '../hooks/useAuditLog'
import { formatDate } from '../lib/utils'
import PageHeader from '../components/layout/PageHeader'
import SearchBar from '../components/ui/SearchBar'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import type { DenyListEntry, Visitor } from '../lib/types'
import toast from 'react-hot-toast'

export default function DenyListScreen() {
  const { user, site } = useAuth()
  const { getDenyListEntries, addToDenyList, removeDenyListEntry } = useDenyList()
  const { search, visitors } = useVisitors()
  const { log } = useAuditLog()

  const [entries, setEntries] = useState<DenyListEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)

  // Add form state
  const [linkedVisitor, setLinkedVisitor] = useState<Visitor | null>(null)
  const [manualName, setManualName] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [reason, setReason] = useState('')
  const [isPermanent, setIsPermanent] = useState(true)
  const [expiryDate, setExpiryDate] = useState('')
  const [visitorSearch, setVisitorSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!site) return
    setLoading(true)
    const list = await getDenyListEntries(site.id)
    setEntries(list)
    setLoading(false)
  }, [site, getDenyListEntries])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!user || !site) return
    if (!reason.trim()) { toast.error('Reason is required'); return }
    const name = linkedVisitor?.name || manualName.trim()
    if (!name) { toast.error('Visitor name is required'); return }

    setSubmitting(true)
    try {
      await addToDenyList({
        visitor_id: linkedVisitor?.id,
        visitor_name: name,
        visitor_email: linkedVisitor?.email || manualEmail.trim() || undefined,
        site_id: site.id,
        reason: reason.trim(),
        is_permanent: isPermanent,
        expires_at: !isPermanent && expiryDate ? new Date(expiryDate).toISOString() : undefined,
        added_by: user.id,
      })
      await log('deny_list_added', 'deny_list', null, user.id, { visitor_name: name })
      toast.success('Added to deny list')
      resetForm()
      load()
    } catch {
      toast.error('Failed to add to deny list')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(id: string) {
    if (!user) return
    try {
      await removeDenyListEntry(id)
      await log('deny_list_removed', 'deny_list', id, user.id)
      toast.success('Entry removed')
      setRemoveTarget(null)
      load()
    } catch {
      toast.error('Failed to remove entry')
    }
  }

  function resetForm() {
    setLinkedVisitor(null)
    setManualName('')
    setManualEmail('')
    setReason('')
    setIsPermanent(true)
    setExpiryDate('')
    setVisitorSearch('')
    setShowAddForm(false)
  }

  const now = new Date().toISOString().slice(0, 10)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Deny List"
        subtitle="Manage visitors who are not permitted on-site"
        actions={
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-danger text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors min-h-btn"
          >
            + Add to Deny List
          </button>
        }
      />

      {/* Add form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-card p-5 mb-6 space-y-4">
          <h2 className="text-base font-semibold text-navy">Add to Deny List</h2>

          {/* Visitor search/link */}
          <div>
            <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
              Link to existing visitor profile (optional)
            </label>
            {linkedVisitor ? (
              <div className="flex items-center justify-between p-3 bg-primark-blue-light rounded-lg">
                <div>
                  <div className="text-sm font-semibold text-navy">{linkedVisitor.name}</div>
                  <div className="text-xs text-mid-grey">{linkedVisitor.email}</div>
                </div>
                <button onClick={() => setLinkedVisitor(null)} className="text-xs text-primark-blue hover:underline">Remove link</button>
              </div>
            ) : (
              <div>
                <SearchBar
                  placeholder="Search for visitor to link..."
                  onSearch={(q) => { setVisitorSearch(q); if (q) search(q) }}
                  className="mb-2"
                />
                {visitorSearch && visitors.length > 0 && (
                  <div className="border border-border-grey rounded-lg divide-y max-h-40 overflow-y-auto">
                    {visitors.map((v) => (
                      <button key={v.id} type="button" onClick={() => { setLinkedVisitor(v); setVisitorSearch('') }}
                        className="w-full text-left px-4 py-2.5 hover:bg-light-grey text-sm">
                        {v.name} — {v.email}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Manual entry (if no visitor linked) */}
          {!linkedVisitor && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
                  Name <span className="text-danger">*</span>
                </label>
                <input type="text" value={manualName} onChange={(e) => setManualName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2.5 border border-border-grey rounded-lg text-sm min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue" />
              </div>
              <div>
                <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">Email</label>
                <input type="email" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2.5 border border-border-grey rounded-lg text-sm min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
              Reason <span className="text-danger">*</span>
            </label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)}
              rows={3} placeholder="Reason for denial (required)"
              className="w-full px-3 py-2.5 border border-border-grey rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primark-blue" />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isPermanent} onChange={(e) => setIsPermanent(e.target.checked)}
                className="w-4 h-4 rounded border-border-grey text-primark-blue focus:ring-primark-blue" />
              <span className="text-sm text-charcoal font-medium">Permanent ban</span>
            </label>
            {!isPermanent && (
              <div>
                <label className="text-xs font-medium text-mid-grey uppercase tracking-wide mr-2">Expires</label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} min={now}
                  className="px-3 py-1.5 border border-border-grey rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primark-blue" />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={resetForm} className="flex-1 py-2.5 border border-border-grey rounded-xl text-sm text-charcoal">Cancel</button>
            <button onClick={handleAdd} disabled={submitting}
              className="flex-1 py-2.5 bg-danger text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
              {submitting ? 'Adding...' : 'Add to Deny List'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
      ) : entries.length === 0 ? (
        <EmptyState icon="🛡️" title="Deny list is empty" message="No visitors are currently on the deny list." />
      ) : (
        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-light-grey">
                <th className="text-left py-3 px-5 text-xs font-medium text-mid-grey uppercase tracking-wide">Visitor</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-mid-grey uppercase tracking-wide hidden sm:table-cell">Reason</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-mid-grey uppercase tracking-wide hidden md:table-cell">Expiry</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-mid-grey uppercase tracking-wide">Status</th>
                <th className="py-3 px-5" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isActive = entry.is_active && (entry.is_permanent || !entry.expires_at || new Date(entry.expires_at) > new Date())
                return (
                  <tr key={entry.id} className="border-t border-border-grey hover:bg-light-grey">
                    <td className="py-4 px-5">
                      <div className="text-sm font-semibold text-navy">{entry.visitor_name}</div>
                      {entry.visitor_email && <div className="text-xs text-mid-grey">{entry.visitor_email}</div>}
                    </td>
                    <td className="py-4 px-5 hidden sm:table-cell">
                      <div className="text-sm text-charcoal max-w-xs truncate">{entry.reason}</div>
                    </td>
                    <td className="py-4 px-5 hidden md:table-cell">
                      <div className="text-sm text-charcoal">
                        {entry.is_permanent ? 'Permanent' : entry.expires_at ? formatDate(entry.expires_at, 'date-only') : '—'}
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-danger-bg text-danger' : 'bg-light-grey text-mid-grey'
                      }`}>
                        {isActive ? 'Active' : 'Expired'}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <button
                        onClick={() => setRemoveTarget(entry.id)}
                        className="text-xs text-mid-grey hover:text-danger transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {removeTarget && (
        <ConfirmDialog
          title="Remove deny list entry?"
          message="This visitor will no longer be blocked from checking in."
          confirmLabel="Remove Entry"
          variant="danger"
          onConfirm={() => handleRemove(removeTarget)}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  )
}
