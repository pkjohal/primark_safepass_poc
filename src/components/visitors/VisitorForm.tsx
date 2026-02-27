import { useState } from 'react'
import type { Visitor } from '../../lib/types'

interface FormData {
  name: string
  email: string
  phone: string
  company: string
  visitor_type: 'internal_staff' | 'third_party'
}

interface Props {
  initial?: Partial<FormData>
  onSubmit: (data: FormData) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
  loading?: boolean
  duplicate?: Visitor | null
  onUseDuplicate?: (v: Visitor) => void
}

export default function VisitorForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Create Visitor',
  loading = false,
  duplicate,
  onUseDuplicate,
}: Props) {
  const [form, setForm] = useState<FormData>({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    company: initial?.company ?? '',
    visitor_type: initial?.visitor_type ?? 'third_party',
  })
  const [errors, setErrors] = useState<Partial<FormData>>({})

  function set(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: '' }))
  }

  function validate(): boolean {
    const errs: Partial<FormData> = {}
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters'
    if (!form.email.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    await onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Duplicate warning */}
      {duplicate && (
        <div className="bg-warning-bg border border-warning rounded-lg p-4">
          <p className="text-sm font-semibold text-warning mb-1">Possible duplicate profile found</p>
          <p className="text-sm text-charcoal mb-3">
            A visitor with email <strong>{duplicate.email}</strong> already exists: <strong>{duplicate.name}</strong>
            {duplicate.company ? ` (${duplicate.company})` : ''}
          </p>
          {onUseDuplicate && (
            <button
              type="button"
              onClick={() => onUseDuplicate(duplicate)}
              className="text-sm font-semibold text-primark-blue hover:underline"
            >
              Use existing profile instead
            </button>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
          Full Name <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          className={`w-full px-3 py-2.5 border rounded-lg text-sm text-charcoal bg-white min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue ${errors.name ? 'border-danger' : 'border-border-grey'}`}
          placeholder="John Smith"
        />
        {errors.name && <p className="text-xs text-danger mt-1">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
          Email <span className="text-danger">*</span>
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          className={`w-full px-3 py-2.5 border rounded-lg text-sm text-charcoal bg-white min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue ${errors.email ? 'border-danger' : 'border-border-grey'}`}
          placeholder="john@example.com"
        />
        {errors.email && <p className="text-xs text-danger mt-1">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
          Phone
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          className="w-full px-3 py-2.5 border border-border-grey rounded-lg text-sm text-charcoal bg-white min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue"
          placeholder="+353 85 123 4567"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
          Company / Organisation
        </label>
        <input
          type="text"
          value={form.company}
          onChange={(e) => set('company', e.target.value)}
          className="w-full px-3 py-2.5 border border-border-grey rounded-lg text-sm text-charcoal bg-white min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue"
          placeholder="Acme Ltd"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-2">
          Visitor Type <span className="text-danger">*</span>
        </label>
        <div className="flex gap-3">
          {(['third_party', 'internal_staff'] as const).map((type) => (
            <label key={type} className={`flex-1 flex items-center justify-center gap-2 p-3 border-2 rounded-xl cursor-pointer transition-colors text-sm font-medium ${
              form.visitor_type === type
                ? 'border-primark-blue bg-primark-blue-light text-primark-blue'
                : 'border-border-grey bg-white text-charcoal hover:border-primark-blue'
            }`}>
              <input
                type="radio"
                name="visitor_type"
                value={type}
                checked={form.visitor_type === type}
                onChange={() => set('visitor_type', type)}
                className="sr-only"
              />
              {type === 'third_party' ? 'Third Party' : 'Internal Staff'}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 border border-border-grey rounded-xl text-charcoal font-medium text-sm hover:bg-light-grey transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-3 bg-primark-blue text-white rounded-xl font-semibold text-sm hover:bg-primark-blue-dark transition-colors disabled:opacity-50 min-h-btn-primary"
        >
          {loading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
