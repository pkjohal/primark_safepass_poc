import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PinPad from '../components/ui/PinPad'
import type { SafeUser } from '../lib/types'

export default function LoginScreen() {
  const { login, site } = useAuth()
  const navigate = useNavigate()

  const [members, setMembers] = useState<SafeUser[]>([])
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [pinError, setPinError] = useState(false)
  const [loading, setLoading] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase
      .from('members')
      .select('id, name, username, email, site_id, role, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setMembers((data as SafeUser[]) ?? []))
  }, [])

  useEffect(() => {
    if (pinError) {
      cardRef.current?.classList.add('shake')
      const t = setTimeout(() => {
        cardRef.current?.classList.remove('shake')
        setPinError(false)
      }, 500)
      return () => clearTimeout(t)
    }
  }, [pinError])

  async function handlePinComplete(pin: string) {
    if (!username) {
      setError('Please select your name')
      setPinError(true)
      return
    }
    setLoading(true)
    setError('')
    const ok = await login(username, pin)
    setLoading(false)
    if (ok) {
      navigate('/', { replace: true })
    } else {
      setError('Incorrect PIN. Please try again.')
      setPinError(true)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy to-primark-blue flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Branding */}
        <div className="text-center mb-8">
          <p className="text-primark-blue font-bold uppercase tracking-[0.15em] leading-none" style={{ fontSize: '42px' }}>PRIMARK</p>
          <p className="text-white/70 text-sm mt-1">SafePass — Visitor Access Management</p>
        </div>

        {/* Card */}
        <div
          ref={cardRef}
          className="bg-white rounded-2xl shadow-2xl p-8"
        >

          {/* Site (informational) */}
          {site && (
            <div className="mb-6">
              <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
                Site
              </label>
              <div className="w-full px-3 py-2.5 border border-border-grey rounded-lg text-sm text-charcoal bg-light-grey">
                {site.name}
              </div>
            </div>
          )}

          {/* Name dropdown */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
              Name
            </label>
            <select
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError('') }}
              className="w-full border-2 border-border-grey rounded-xl px-4 py-3 text-[15px] text-charcoal focus:outline-none focus:border-primark-blue focus:ring-2 focus:ring-primark-blue/20 bg-white"
            >
              <option value="" disabled>Select your name...</option>
              {members.map(m => (
                <option key={m.id} value={m.username}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* PIN */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-3 text-center">
              Enter PIN
            </label>
            <PinPad
              onComplete={handlePinComplete}
              error={pinError}
              disabled={loading}
            />
          </div>

          {/* Error / loading */}
          {error && (
            <p className="text-danger text-sm text-center mt-3 font-medium">{error}</p>
          )}
          {loading && (
            <p className="text-mid-grey text-sm text-center mt-3">Verifying...</p>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-white/50 text-xs mt-6">
          Internal use only • Authorised staff only
        </p>
      </div>
    </div>
  )
}
