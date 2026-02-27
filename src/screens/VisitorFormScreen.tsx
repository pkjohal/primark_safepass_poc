import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useVisitors } from '../hooks/useVisitors'
import { useAuditLog } from '../hooks/useAuditLog'
import { useAuth } from '../context/AuthContext'
import VisitorForm from '../components/visitors/VisitorForm'
import PageHeader from '../components/layout/PageHeader'
import type { Visitor } from '../lib/types'
import toast from 'react-hot-toast'

export default function VisitorFormScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isWalkIn = params.get('walkin') === 'true'
  const { user } = useAuth()
  const { createVisitor, checkDuplicate } = useVisitors()
  const { log } = useAuditLog()
  const [loading, setLoading] = useState(false)
  const [duplicate, setDuplicate] = useState<Visitor | null>(null)
  const [bypassDuplicate, setBypassDuplicate] = useState(false)

  async function handleSubmit(form: {
    name: string
    email: string
    phone: string
    company: string
    visitor_type: 'internal_staff' | 'third_party'
  }) {
    if (!user) return
    setLoading(true)
    try {
      // Check for duplicate (by email)
      if (!bypassDuplicate) {
        const dup = await checkDuplicate(form.name, form.email)
        if (dup) {
          setDuplicate(dup)
          setLoading(false)
          return
        }
      }

      const visitor = await createVisitor({
        ...form,
        phone: form.phone || undefined,
        company: form.company || undefined,
        created_by: user.id,
      })

      await log('visitor_created', 'visitor', visitor!.id, user.id, { name: visitor!.name })

      toast.success('Visitor profile created')

      if (isWalkIn) {
        navigate(`/schedule?visitor_id=${visitor!.id}&walkin=true`)
      } else {
        navigate(`/visitors/${visitor!.id}`)
      }
    } catch {
      toast.error('Failed to create visitor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader
        title={isWalkIn ? 'Register Walk-In Visitor' : 'New Visitor Profile'}
        subtitle="Create a new visitor profile"
        backTo={isWalkIn ? '/' : '/visitors'}
      />

      <div className="bg-white rounded-xl shadow-card p-6">
        <VisitorForm
          onSubmit={handleSubmit}
          onCancel={() => navigate(-1)}
          submitLabel={isWalkIn ? 'Create & Schedule Visit' : 'Create Visitor'}
          loading={loading}
          duplicate={bypassDuplicate ? null : duplicate}
          onUseDuplicate={(v) => {
            if (isWalkIn) {
              navigate(`/schedule?visitor_id=${v.id}&walkin=true`)
            } else {
              navigate(`/visitors/${v.id}`)
            }
          }}
        />
        {duplicate && !bypassDuplicate && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setBypassDuplicate(true)}
              className="text-sm text-mid-grey hover:text-charcoal underline"
            >
              Create a new profile anyway
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
