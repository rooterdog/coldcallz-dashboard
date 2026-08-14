'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Parse hash from URL: #access_token=...&token_type=bearer&type=recovery
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type')

    if (accessToken && type === 'recovery') {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken || '' })
        .then(({ error }) => {
          if (error) { setInvalid(true) } else { setReady(true) }
        })
    } else {
      // Maybe already has a session (came via callback)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) { setReady(true) } else { setInvalid(true) }
      })
    }
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  if (invalid) {
    return (
      <div className="min-h-screen bg-[#080C18] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-[#FB7185]">Invalid or expired reset link.</p>
          <p className="text-[#5A6A84] text-sm mt-2">Please request a new password reset.</p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#080C18] flex items-center justify-center">
        <p className="text-[#5A6A84]">Verifying reset link...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080C18] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-[#38BDF8]">ColdCallz</h1>
          <p className="text-[#5A6A84] mt-2">Set a new password</p>
        </div>
        <form onSubmit={handleReset} className="bg-[#141B2D] rounded-2xl p-6 border border-[#1E2A42] space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#5A6A84] uppercase tracking-wider mb-2">New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-[#0F1623] border border-[#1E2A42] rounded-xl px-4 py-3 text-[#E8EDF5] focus:outline-none focus:border-[#38BDF8] transition-colors"
              placeholder="At least 6 characters"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#5A6A84] uppercase tracking-wider mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className="w-full bg-[#0F1623] border border-[#1E2A42] rounded-xl px-4 py-3 text-[#E8EDF5] focus:outline-none focus:border-[#38BDF8] transition-colors"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-[#FB7185] text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#38BDF8] text-[#080C18] font-black py-3 rounded-xl hover:bg-[#7DD3FC] transition-colors disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
