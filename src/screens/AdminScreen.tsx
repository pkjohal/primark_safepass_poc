import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAuditLog } from '../hooks/useAuditLog'
import { hashPin } from '../lib/auth'
import { formatDate } from '../lib/utils'
import PageHeader from '../components/layout/PageHeader'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import type { SafeUser } from '../lib/types'
import toast from 'react-hot-toast'

interface UserForm {
  name: string
  username: string
  email: string
  role: 'host' | 'reception' | 'site_admin'
  pin: string
  pinConfirm: string
}

const defaultForm: UserForm = {
  name: '', username: '', email: '', role: 'host', pin: '', pinConfirm: '',
}

export default function AdminScreen() {
  const { user, site } = useAuth()
  const { log } = useAuditLog()
  const [users, setUsers] = useState<SafeUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<SafeUser | null>(null)
  const [form, setForm] = useState<UserForm>(defaultForm)
  const [formErrors, setFormErrors] = useState<Partial<UserForm>>({})
  const [saving, setSaving] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<SafeUser | null>(null)

  const load = useCallback(async () => {
    if (!site) return
    setLoading(true)
    const { data } = await supabase
      .from('members')
      .select('id,name,username,email,site_id,role,is_active,created_at,updated_at')
      .eq('site_id', site.id)
      .order('name')
    setUsers((data as SafeUser[]) ?? [])
    setLoading(false)
  }, [site])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditTarget(null)
    setForm(defaultForm)
    setFormErrors({})
    setShowForm(true)
  }

  function openEdit(u: SafeUser) {
    setEditTarget(u)
    setForm({ name: u.name, username: u.username, email: u.email ?? '', role: u.role, pin: '', pinConfirm: '' })
    setFormErrors({})
    setShowForm(true)
  }

  function setField(field: keyof UserForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setFormErrors((e) => ({ ...e, [field]: '' }))
  }

  async function validate(): Promise<boolean> {
    const errs: Partial<UserForm> = {}
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters'
    if (!form.username.trim()) errs.username = 'Username is required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email'
    if (!editTarget) {
      if (!/^\d{4}$/.test(form.pin)) errs.pin = 'PIN must be exactly 4 digits'
      if (form.pin !== form.pinConfirm) errs.pinConfirm = 'PINs do not match'
    } else if (form.pin) {
      if (!/^\d{4}$/.test(form.pin)) errs.pin = 'PIN must be exactly 4 digits'
      if (form.pin !== form.pinConfirm) errs.pinConfirm = 'PINs do not match'
    }

    // Check username uniqueness
    if (form.username.trim() && form.username !== editTarget?.username) {
      const { data } = await supabase.from('members').select('id').eq('username', form.username.trim()).maybeSingle()
      if (data) errs.username = 'Username already taken'
    }

    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!user || !site) return
    const valid = await validate()
    if (!valid) return
    setSaving(true)

    try {
      if (editTarget) {
        const updates: Partial<SafeUser & { pin_hash?: string; updated_at: string }> = {
          name: form.name.trim(),
          email: form.email.trim() || null,
          role: form.role,
          updated_at: new Date().toISOString(),
        }
        if (form.pin) updates.pin_hash = await hashPin(form.pin)

        await supabase.from('members').update(updates).eq('id', editTarget.id)
        await log('user_updated', 'user', editTarget.id, user.id, { role: form.role })
        toast.success('User updated')
      } else {
        const pin_hash = await hashPin(form.pin)
        const { data: newUser, error } = await supabase
          .from('members')
          .insert({
            name: form.name.trim(),
            username: form.username.trim().toLowerCase(),
            email: form.email.trim() || null,
            role: form.role,
            pin_hash,
            site_id: site.id,
          })
          .select()
          .single()
        if (error) throw error
        await log('user_created', 'user', newUser.id, user.id, { role: form.role })
        toast.success('User created')
      }
      setShowForm(false)
      load()
    } catch {
      toast.error('Failed to save user')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(target: SafeUser) {
    if (!user) return
    const adminCount = users.filter((u) => u.role === 'site_admin' && u.is_active).length
    if (target.role === 'site_admin' && adminCount <= 1) {
      toast.error('Cannot deactivate the last site admin')
      return
    }
    try {
      await supabase.from('members').update({ is_active: !target.is_active, updated_at: new Date().toISOString() }).eq('id', target.id)
      await log(target.is_active ? 'user_deactivated' : 'user_updated', 'user', target.id, user.id)
      toast.success(target.is_active ? 'User deactivated' : 'User activated')
      setDeactivateTarget(null)
      load()
    } catch {
      toast.error('Failed to update user')
    }
  }

  const roleColour: Record<string, string> = {
    host: 'bg-primark-blue-light text-primark-blue',
    reception: 'bg-warning-bg text-warning',
    site_admin: 'bg-danger-bg text-danger',
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Admin"
        subtitle="Manage users and site settings"
        actions={
          <div className="flex gap-3">
            <a href="/site-config" className="border border-border-grey text-charcoal px-4 py-2 rounded-xl text-sm font-medium hover:bg-light-grey transition-colors">
              Site Config
            </a>
            <button
              onClick={openAdd}
              className="bg-primark-blue text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primark-blue-dark transition-colors min-h-btn"
            >
              + Add User
            </button>
          </div>
        }
      />

      {/* User form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 overflow-y-auto max-h-screen">
            <h2 className="text-lg font-semibold text-navy mb-5">{editTarget ? 'Edit User' : 'Add New User'}</h2>

            <div className="space-y-4">
              <FormField label="Full Name *" error={formErrors.name}>
                <input value={form.name} onChange={(e) => setField('name', e.target.value)}
                  className="input-base" placeholder="Jane Smith" />
              </FormField>

              <FormField label="Username *" error={formErrors.username}>
                <input value={form.username} onChange={(e) => setField('username', e.target.value)}
                  disabled={!!editTarget}
                  className={`input-base ${editTarget ? 'bg-light-grey cursor-not-allowed' : ''}`}
                  placeholder="jane.s" />
              </FormField>

              <FormField label="Email" error={formErrors.email}>
                <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)}
                  className="input-base" placeholder="jane@primark.ie" />
              </FormField>

              <FormField label="Role *">
                <select value={form.role} onChange={(e) => setField('role', e.target.value as UserForm['role'])}
                  className="input-base">
                  <option value="host">Host</option>
                  <option value="reception">Reception</option>
                  <option value="site_admin">Site Admin</option>
                </select>
              </FormField>

              <FormField label={editTarget ? '4-Digit PIN (leave blank to keep current)' : '4-Digit PIN *'} error={formErrors.pin}>
                <input type="password" value={form.pin} onChange={(e) => setField('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="input-base" placeholder="••••" maxLength={4} />
              </FormField>

              {(form.pin || !editTarget) && (
                <FormField label="Confirm PIN *" error={formErrors.pinConfirm}>
                  <input type="password" value={form.pinConfirm} onChange={(e) => setField('pinConfirm', e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="input-base" placeholder="••••" maxLength={4} />
                </FormField>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 border border-border-grey rounded-xl text-charcoal text-sm font-medium">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 bg-primark-blue text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {saving ? 'Saving...' : editTarget ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
      ) : users.length === 0 ? (
        <EmptyState icon="👥" title="No users" action={{ label: 'Add First User', onClick: openAdd }} />
      ) : (
        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-light-grey">
                <th className="text-left py-3 px-5 text-xs font-medium text-mid-grey uppercase tracking-wide">User</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-mid-grey uppercase tracking-wide hidden sm:table-cell">Username</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-mid-grey uppercase tracking-wide">Role</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-mid-grey uppercase tracking-wide hidden md:table-cell">Added</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-mid-grey uppercase tracking-wide">Status</th>
                <th className="py-3 px-5" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={`border-t border-border-grey ${!u.is_active ? 'opacity-50' : ''}`}>
                  <td className="py-4 px-5">
                    <div className="text-sm font-semibold text-navy">{u.name}</div>
                    {u.email && <div className="text-xs text-mid-grey">{u.email}</div>}
                  </td>
                  <td className="py-4 px-5 hidden sm:table-cell text-sm text-charcoal">{u.username}</td>
                  <td className="py-4 px-5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleColour[u.role] ?? 'bg-light-grey text-mid-grey'}`}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-5 hidden md:table-cell text-sm text-mid-grey">{formatDate(u.created_at, 'date-only')}</td>
                  <td className="py-4 px-5">
                    <span className={`text-xs font-medium ${u.is_active ? 'text-success' : 'text-mid-grey'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-4 px-5">
                    <div className="flex gap-3">
                      <button onClick={() => openEdit(u)} className="text-xs text-primark-blue hover:underline">Edit</button>
                      <button
                        onClick={() => setDeactivateTarget(u)}
                        className={`text-xs ${u.is_active ? 'text-danger' : 'text-success'} hover:underline`}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deactivateTarget && (
        <ConfirmDialog
          title={deactivateTarget.is_active ? 'Deactivate user?' : 'Activate user?'}
          message={deactivateTarget.is_active
            ? `${deactivateTarget.name} will no longer be able to log in. Historical records are preserved.`
            : `${deactivateTarget.name} will be able to log in again.`
          }
          confirmLabel={deactivateTarget.is_active ? 'Deactivate' : 'Activate'}
          variant={deactivateTarget.is_active ? 'danger' : 'default'}
          onConfirm={() => handleDeactivate(deactivateTarget)}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}
    </div>
  )
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  )
}
