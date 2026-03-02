import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PinPad from '../components/ui/PinPad'
import type { SafeUser, Site, Visitor } from '../lib/types'

type Step = 'select' | 'location' | 'staff' | 'visitor'

export default function LoginScreen() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('select')

  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [members, setMembers] = useState<SafeUser[]>([])
  const [visitors, setVisitors] = useState<Visitor[]>([])

  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [pinError, setPinError] = useState(false)
  const [loading, setLoading] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const [selectedVisitorToken, setSelectedVisitorToken] = useState('')

  // Load sites and visitors on mount
  useEffect(() => {
    supabase
      .from('sites')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setSites((data as Site[]) ?? []))

    supabase
      .from('visitors')
      .select('id,name,email,company,visitor_type,access_token,created_by,is_anonymised,created_at,updated_at')
      .eq('is_anonymised', false)
      .order('name')
      .then(({ data }) => setVisitors((data as Visitor[]) ?? []))
  }, [])

  // Load members filtered to the selected site
  useEffect(() => {
    if (!selectedSiteId) return
    supabase
      .from('members')
      .select('id,name,username,email,site_id,role,is_active,created_at,updated_at')
      .eq('is_active', true)
      .eq('site_id', selectedSiteId)
      .order('name')
      .then(({ data }) => setMembers((data as SafeUser[]) ?? []))
  }, [selectedSiteId])

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

  function handleBack() {
    if (step === 'staff') {
      setStep('location')
      setUsername('')
      setError('')
    } else {
      setStep('select')
      setSelectedSiteId('')
      setSelectedVisitorToken('')
      setError('')
    }
  }

  function handleSiteChange(siteId: string) {
    setSelectedSiteId(siteId)
    setUsername('')
    setError('')
  }

  function handleLocationContinue() {
    if (selectedSiteId) setStep('staff')
  }

  async function handlePinComplete(pin: string) {
    if (!username) { setError('Please select your name'); setPinError(true); return }
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

  const selectedSite = sites.find((s) => s.id === selectedSiteId)

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy to-primark-blue flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Branding */}
        <div className="text-center mb-8">
          <p className="font-primark uppercase text-primark-blue leading-none" style={{ fontSize: '42px' }}>PRIMARK</p>
          <p className="text-white/70 text-sm mt-1">SafePass — Visitor Access Management</p>
        </div>

        {/* ── Step 1: Select type ── */}
        {step === 'select' && (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setStep('location')}
              className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center justify-center gap-3 hover:bg-primark-blue-light transition-colors group"
            >
              <div className="w-14 h-14 rounded-xl bg-navy flex items-center justify-center group-hover:bg-primark-blue transition-colors">
                <svg className="w-7 h-7 text-primark-blue group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-navy">Staff</span>
            </button>

            <button
              onClick={() => setStep('visitor')}
              className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center justify-center gap-3 hover:bg-primark-blue-light transition-colors group"
            >
              <div className="w-14 h-14 rounded-xl bg-primark-blue-light flex items-center justify-center group-hover:bg-primark-blue transition-colors">
                <svg className="w-7 h-7 text-primark-blue group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-navy">Visitor</span>
            </button>
          </div>
        )}

        {/* ── Step 2: Location selection ── */}
        {step === 'location' && (
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-mid-grey hover:text-charcoal mb-6 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-navy flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-primark-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-navy leading-none">Select Location</h2>
                <p className="text-xs text-mid-grey mt-0.5">Choose your store to continue</p>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">Store</label>
              <select
                value={selectedSiteId}
                onChange={(e) => handleSiteChange(e.target.value)}
                className="w-full border-2 border-border-grey rounded-xl px-4 py-3 text-[15px] text-charcoal focus:outline-none focus:border-primark-blue focus:ring-2 focus:ring-primark-blue/20 bg-white"
              >
                <option value="" disabled>Select your store...</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleLocationContinue}
              disabled={!selectedSiteId}
              className="w-full bg-primark-blue text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-primark-blue-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── Step 3: Staff login ── */}
        {step === 'staff' && (
          <div ref={cardRef} className="bg-white rounded-2xl shadow-2xl p-8">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-mid-grey hover:text-charcoal mb-6 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-navy flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-primark-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-navy leading-none">Staff Sign In</h2>
                <p className="text-xs text-mid-grey mt-0.5">Select your name and enter your PIN</p>
              </div>
            </div>

            {selectedSite && (
              <div className="flex items-center gap-1.5 mb-5 px-0.5">
                <svg className="w-3.5 h-3.5 text-mid-grey shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs text-mid-grey">{selectedSite.name}</span>
              </div>
            )}

            <div className="mb-5">
              <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">Name</label>
              <select
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError('') }}
                className="w-full border-2 border-border-grey rounded-xl px-4 py-3 text-[15px] text-charcoal focus:outline-none focus:border-primark-blue focus:ring-2 focus:ring-primark-blue/20 bg-white"
              >
                <option value="" disabled>Select your name...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.username}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-3 text-center">Enter PIN</label>
              <PinPad onComplete={handlePinComplete} error={pinError} disabled={loading} />
            </div>

            {error && <p className="text-danger text-sm text-center font-medium mt-2">{error}</p>}
            {loading && <p className="text-mid-grey text-sm text-center mt-2">Verifying...</p>}
          </div>
        )}

        {/* ── Step 2b: Visitor portal ── */}
        {step === 'visitor' && (
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-mid-grey hover:text-charcoal mb-6 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primark-blue-light flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-primark-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-navy leading-none">Visitor Portal</h2>
                <p className="text-xs text-mid-grey mt-0.5">Select your name to access your portal</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">Your Name</label>
              <select
                value={selectedVisitorToken}
                onChange={(e) => setSelectedVisitorToken(e.target.value)}
                className="w-full border-2 border-border-grey rounded-xl px-4 py-3 text-[15px] text-charcoal focus:outline-none focus:border-primark-blue focus:ring-2 focus:ring-primark-blue/20 bg-white"
              >
                <option value="" disabled>Select your name...</option>
                {visitors.map((v) => (
                  <option key={v.id} value={v.access_token}>
                    {v.name}{v.company ? ` — ${v.company}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6 space-y-2">
              {[
                'Your upcoming visit details & site address',
                'H&S induction — complete before you arrive',
                'Review and accept any required documents',
                'Notifications from the Primark team',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-charcoal">
                  <span className="text-success mt-0.5 shrink-0">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => { if (selectedVisitorToken) navigate(`/self-service/${selectedVisitorToken}`) }}
              disabled={!selectedVisitorToken}
              className="w-full bg-primark-blue text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-primark-blue-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Access My Portal →
            </button>
          </div>
        )}

        <p className="text-center text-white/50 text-xs mt-6">
          Internal use only • Authorised personnel only
        </p>
      </div>
    </div>
  )
}
