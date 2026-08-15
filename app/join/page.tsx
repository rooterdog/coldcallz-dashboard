'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

function JoinForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [invite, setInvite] = useState<{ id: string; email: string; organization_id: string } | null>(null)
  const [status, setStatus] = useState<'loading' | 'form' | 'done' | 'error'>('loading')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); return }

    const supabase = createClient()
    supabase
      .from('invites')
      .select('id, email, organization_id')
      .eq('token', token)
      .is('accepted_at', null)
      .single()
      .then(({ data }) => {
        if (!data) { setStatus('error'); return }
        setInvite(data)
        setEmail(data.email)
        setStatus('form')
      })
  }, [token])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!invite) return
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (!name.trim()) { setError('Please enter your name.'); return }
    setSaving(true)
    setError('')

    const supabase = createClient()

    // Sign up as a brand new user — no session hijacking possible
    const { data, error: signupError } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { data: { full_name: name.trim() } }
    })

    if (signupError) {
      // If user already exists, try signing in instead
      if (signupError.message.includes('already registered')) {
        const { error: signinError } = await supabase.auth.signInWithPassword({
          email: invite.email,
          password,
        })
        if (signinError) {
          setError('This email is already registered. Please use your existing password.')
          setSaving(false)
          return
        }
      } else {
        setError(signupError.message)
        setSaving(false)
        return
      }
    }

    const userId = data?.user?.id
    if (!userId && !data) { setError('Signup failed. Please try again.'); setSaving(false); return }

    // Get current user after signup/signin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Could not establish session.'); setSaving(false); return }

    // Create profile linked to org
    await supabase.from('user_profiles').upsert({
      user_id: user.id,
      full_name: name.trim(),
      organization_id: invite.organization_id,
      role: 'rep',
    }, { onConflict: 'user_id' })

    // Mark invite accepted
    await supabase.from('invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id)

    setStatus('done')
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#080C18] flex items-center justify-center">
        <p className="text-[#5A6A84]">Checking invite...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#080C18] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-[#FB7185] text-lg font-bold">Invalid or expired invite link.</p>
          <p className="text-[#5A6A84] text-sm mt-2">Ask your manager to send a new invite.</p>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen bg-[#080C18] flex items-center justify-center">
        <p className="text-emerald-400 text-lg font-bold">✅ Account ready! Taking you to the dashboard...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080C18] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-[#38BDF8]">ColdCallz</h1>
          <p className="text-[#5A6A84] mt-2">You&apos;ve been invited to join a team</p>
        </div>

        <form onSubmit={handleSignup} className="bg-[#141B2D] rounded-2xl p-6 border border-[#1E2A42] space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#5A6A84] uppercase tracking-wider mb-2">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="First Last"
              required
              className="w-full bg-[#0F1623] border border-[#1E2A42] rounded-xl px-4 py-3 text-[#E8EDF5] focus:outline-none focus:border-[#38BDF8] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#5A6A84] uppercase tracking-wider mb-2">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full bg-[#0F1623] border border-[#1E2A42] rounded-xl px-4 py-3 text-[#5A6A84] cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#5A6A84] uppercase tracking-wider mb-2">Create Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              className="w-full bg-[#0F1623] border border-[#1E2A42] rounded-xl px-4 py-3 text-[#E8EDF5] focus:outline-none focus:border-[#38BDF8] transition-colors"
            />
          </div>

          {error && <p className="text-[#FB7185] text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#38BDF8] text-[#080C18] font-black py-3 rounded-xl hover:bg-[#7DD3FC] transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating account...' : 'Create Account & Join Team'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080C18] flex items-center justify-center"><p className="text-[#5A6A84]">Loading...</p></div>}>
      <JoinForm />
    </Suspense>
  )
}
