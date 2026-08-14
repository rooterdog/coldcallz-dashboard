'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function JoinPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'set_password' | 'done' | 'error'>('loading')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setStatus('set_password')
      } else {
        setStatus('error')
      }
    })
  }, [])

  async function completeSetup() {
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Session expired. Please use the invite link again.'); setSaving(false); return }

    // Update password and name
    await supabase.auth.updateUser({
      password,
      data: { full_name: name.trim() || undefined }
    })

    // Link to org via security definer function (bypasses RLS on invites)
    await supabase.rpc('accept_invite')

    // Update name on profile after linking
    if (name.trim()) {
      await supabase.from('user_profiles').update({ full_name: name.trim() }).eq('user_id', user.id)
    }

    setStatus('done')
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#080C18] flex items-center justify-center">
        <p className="text-[#5A6A84]">Setting up your account...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#080C18] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-[#FB7185]">Invalid or expired invite link.</p>
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
          <p className="text-[#5A6A84] mt-2">Complete your account setup</p>
        </div>

        <div className="bg-[#141B2D] rounded-2xl p-6 border border-[#1E2A42] space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#5A6A84] uppercase tracking-wider mb-2">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="First Last"
              className="w-full bg-[#0F1623] border border-[#1E2A42] rounded-xl px-4 py-3 text-[#E8EDF5] focus:outline-none focus:border-[#38BDF8] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#5A6A84] uppercase tracking-wider mb-2">Set a Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full bg-[#0F1623] border border-[#1E2A42] rounded-xl px-4 py-3 text-[#E8EDF5] focus:outline-none focus:border-[#38BDF8] transition-colors"
            />
          </div>

          {error && <p className="text-[#FB7185] text-sm">{error}</p>}

          <button
            onClick={completeSetup}
            disabled={saving}
            className="w-full bg-[#38BDF8] text-[#080C18] font-black py-3 rounded-xl hover:bg-[#7DD3FC] transition-colors disabled:opacity-50"
          >
            {saving ? 'Setting up...' : 'Complete Setup'}
          </button>
        </div>
      </div>
    </div>
  )
}
