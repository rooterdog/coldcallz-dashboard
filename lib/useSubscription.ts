'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type SubscriptionTier = 'free' | 'pro' | 'team'
export type SubscriptionStatus = 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete' | null

export function useSubscription() {
  const [tier, setTier] = useState<SubscriptionTier>('free')
  const [status, setStatus] = useState<SubscriptionStatus>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('user_profiles')
        .select('subscription_tier, subscription_status')
        .eq('user_id', user.id)
        .single()
      setTier((data?.subscription_tier as SubscriptionTier) || 'free')
      setStatus((data?.subscription_status as SubscriptionStatus) || null)
      setLoading(false)
    })
  }, [])

  const isPro = tier === 'pro' || tier === 'team'
  const isTeam = tier === 'team'
  const isFree = tier === 'free'

  return { tier, status, loading, isPro, isTeam, isFree }
}
