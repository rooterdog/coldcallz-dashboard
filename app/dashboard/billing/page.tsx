'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

type Profile = {
  subscription_tier: string
  subscription_status: string
  trial_ends_at: string | null
  current_period_ends_at: string | null
}

function BillingContent() {
  const searchParams = useSearchParams()
  const success = searchParams.get('success')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [managing, setManaging] = useState(false)
  const [seats, setSeats] = useState(3)

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('user_profiles')
      .select('subscription_tier, subscription_status, trial_ends_at, current_period_ends_at')
      .eq('user_id', user.id)
      .single()
    setProfile(data)
    setLoading(false)
  }

  async function checkout(priceId: string, skipTrial = false) {
    setUpgrading(priceId + (skipTrial ? '_skip' : ''))
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, seats, skipTrial }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Checkout error: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      alert('Failed to start checkout. Please try again.')
      console.error(err)
    }
    setUpgrading(null)
  }

  async function manageSubscription() {
    setManaging(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const { url } = await res.json()
    if (url) window.location.href = url
    setManaging(false)
  }

  const tier = profile?.subscription_tier || 'free'
  const status = profile?.subscription_status || 'active'
  const isTrialing = status === 'trialing'
  const isPaid = tier !== 'free'
  const trialEnd = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null
  const periodEnd = profile?.current_period_ends_at ? new Date(profile.current_period_ends_at) : null

  const PRO_MONTHLY = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || ''
  const PRO_ANNUAL = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL || ''
  const TEAM = process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM || ''

  if (loading) return <div className="text-[#5A6A84]">Loading...</div>

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-2xl font-black text-[#E8EDF5]">Billing</h2>
        <p className="text-[#5A6A84] mt-1">Manage your ColdCallz subscription</p>
      </div>

      {success && (
        <div className="bg-emerald-400/10 border border-emerald-400/30 rounded-2xl p-4">
          <p className="text-emerald-400 font-semibold">✅ Subscription activated! Welcome to ColdCallz Pro.</p>
        </div>
      )}

      {/* Current plan */}
      <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] p-6">
        <h3 className="text-xs font-bold text-[#5A6A84] uppercase tracking-wider mb-4">Current Plan</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-black text-[#E8EDF5] capitalize">{tier === 'free' ? 'Free' : tier === 'pro' ? 'Pro' : 'Team'}</p>
            {isTrialing && trialEnd && (
              <p className="text-amber-400 text-sm mt-1">Trial ends {trialEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            )}
            {isPaid && !isTrialing && periodEnd && (
              <p className="text-[#5A6A84] text-sm mt-1">Renews {periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            )}
            {tier === 'free' && (
              <p className="text-[#5A6A84] text-sm mt-1">5 visits/day · Transcript only · No web dashboard</p>
            )}
          </div>
          {isPaid && (
            <button
              onClick={manageSubscription}
              disabled={managing}
              className="bg-[#1E2A42] text-[#E8EDF5] px-4 py-2 rounded-xl text-sm font-semibold hover:border-[#38BDF8] border border-[#1E2A42] transition-colors disabled:opacity-50"
            >
              {managing ? 'Loading...' : 'Manage / Cancel'}
            </button>
          )}
        </div>
      </div>

      {/* Plans */}
      {!isPaid && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#5A6A84] uppercase tracking-wider">Upgrade</h3>

          {/* Pro Monthly */}
          <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-lg font-black text-[#E8EDF5]">Pro <span className="text-[#5A6A84] text-sm font-normal">· Monthly</span></p>
                <p className="text-3xl font-black text-[#38BDF8] mt-1">$12<span className="text-sm text-[#5A6A84] font-normal">/mo</span></p>
              </div>
              <span className="bg-[#38BDF8]/10 text-[#38BDF8] text-xs font-bold px-3 py-1 rounded-full">14-day free trial</span>
            </div>
            <ul className="space-y-2 mb-6">
              {['Unlimited visits', 'Full AI summaries', 'Web dashboard', 'Follow-up reminders', 'Photos & CSV export'].map(f => (
                <li key={f} className="text-sm text-[#5A6A84] flex items-center gap-2"><span className="text-emerald-400">✓</span>{f}</li>
              ))}
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => checkout(PRO_MONTHLY)}
                disabled={!!upgrading}
                className="flex-1 bg-[#38BDF8] text-[#080C18] font-black py-3 rounded-xl hover:bg-[#7DD3FC] transition-colors disabled:opacity-50 text-sm"
              >
                {upgrading === PRO_MONTHLY ? 'Loading...' : 'Start Free Trial'}
              </button>
              <button
                onClick={() => checkout(PRO_MONTHLY, true)}
                disabled={!!upgrading}
                className="flex-1 bg-[#1E2A42] text-[#E8EDF5] font-semibold py-3 rounded-xl hover:border-[#38BDF8] border border-[#1E2A42] transition-colors disabled:opacity-50 text-sm"
              >
                {upgrading === PRO_MONTHLY + '_skip' ? 'Loading...' : 'Subscribe Now — $12/mo'}
              </button>
            </div>
          </div>

          {/* Pro Annual */}
          <div className="bg-[#141B2D] rounded-2xl border border-[#38BDF8]/40 p-6 relative">
            <div className="absolute -top-3 left-6">
              <span className="bg-[#38BDF8] text-[#080C18] text-xs font-black px-3 py-1 rounded-full">BEST VALUE — 2 months free</span>
            </div>
            <div className="flex items-start justify-between mb-4 mt-2">
              <div>
                <p className="text-lg font-black text-[#E8EDF5]">Pro <span className="text-[#5A6A84] text-sm font-normal">· Annual</span></p>
                <p className="text-3xl font-black text-[#38BDF8] mt-1">$99<span className="text-sm text-[#5A6A84] font-normal">/yr</span></p>
                <p className="text-xs text-[#5A6A84] mt-1">$8.25/mo — save $45/yr</p>
              </div>
              <span className="bg-[#38BDF8]/10 text-[#38BDF8] text-xs font-bold px-3 py-1 rounded-full">14-day free trial</span>
            </div>
            <ul className="space-y-2 mb-6">
              {['Everything in Pro Monthly', 'Save $45 per year', 'Priority support'].map(f => (
                <li key={f} className="text-sm text-[#5A6A84] flex items-center gap-2"><span className="text-emerald-400">✓</span>{f}</li>
              ))}
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => checkout(PRO_ANNUAL)}
                disabled={!!upgrading}
                className="flex-1 bg-[#38BDF8] text-[#080C18] font-black py-3 rounded-xl hover:bg-[#7DD3FC] transition-colors disabled:opacity-50 text-sm"
              >
                {upgrading === PRO_ANNUAL ? 'Loading...' : 'Start Free Trial'}
              </button>
              <button
                onClick={() => checkout(PRO_ANNUAL, true)}
                disabled={!!upgrading}
                className="flex-1 bg-[#1E2A42] text-[#E8EDF5] font-semibold py-3 rounded-xl hover:border-[#38BDF8] border border-[#1E2A42] transition-colors disabled:opacity-50 text-sm"
              >
                {upgrading === PRO_ANNUAL + '_skip' ? 'Loading...' : 'Subscribe Now — $99/yr'}
              </button>
            </div>
          </div>

          {/* Team */}
          <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-lg font-black text-[#E8EDF5]">Team <span className="text-[#5A6A84] text-sm font-normal">· Per seat</span></p>
                <p className="text-3xl font-black text-[#38BDF8] mt-1">$9<span className="text-sm text-[#5A6A84] font-normal">/seat/mo</span></p>
                <p className="text-xs text-[#5A6A84] mt-1">Minimum 3 seats</p>
              </div>
              <span className="bg-purple-400/10 text-purple-400 text-xs font-bold px-3 py-1 rounded-full">Manager dashboard</span>
            </div>
            <ul className="space-y-2 mb-4">
              {['Everything in Pro', 'Manager activity dashboard', 'Rep invite & onboarding', 'Team reporting & CSV'].map(f => (
                <li key={f} className="text-sm text-[#5A6A84] flex items-center gap-2"><span className="text-emerald-400">✓</span>{f}</li>
              ))}
            </ul>
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm text-[#5A6A84]">Seats:</label>
              <div className="flex items-center gap-2 bg-[#0F1623] border border-[#1E2A42] rounded-xl px-3 py-2">
                <button onClick={() => setSeats(s => Math.max(3, s - 1))} className="text-[#5A6A84] hover:text-[#E8EDF5] w-6 text-center">−</button>
                <span className="text-[#E8EDF5] font-bold w-6 text-center">{seats}</span>
                <button onClick={() => setSeats(s => s + 1)} className="text-[#5A6A84] hover:text-[#E8EDF5] w-6 text-center">+</button>
              </div>
              <span className="text-[#5A6A84] text-sm">= <span className="text-[#38BDF8] font-bold">${seats * 9}/mo</span></span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => checkout(TEAM)}
                disabled={!!upgrading}
                className="flex-1 bg-[#38BDF8] text-[#080C18] font-black py-3 rounded-xl hover:bg-[#7DD3FC] transition-colors disabled:opacity-50 text-sm"
              >
                {upgrading === TEAM ? 'Loading...' : 'Start Free Trial'}
              </button>
              <button
                onClick={() => checkout(TEAM, true)}
                disabled={!!upgrading}
                className="flex-1 bg-[#1E2A42] text-[#E8EDF5] font-semibold py-3 rounded-xl hover:border-[#38BDF8] border border-[#1E2A42] transition-colors disabled:opacity-50 text-sm"
              >
                {upgrading === TEAM + '_skip' ? 'Loading...' : `Subscribe — $${seats * 9}/mo`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="text-[#5A6A84]">Loading...</div>}>
      <BillingContent />
    </Suspense>
  )
}
