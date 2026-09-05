import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const { priceId, seats, skipTrial } = await request.json()

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('stripe_customer_id, full_name')
    .eq('user_id', user.id)
    .single()

  // Get or create Stripe customer
  let customerId = profile?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: profile?.full_name || undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await supabase.from('user_profiles').update({ stripe_customer_id: customerId }).eq('user_id', user.id)
  }

  const isTeam = priceId === process.env.STRIPE_PRICE_TEAM
  const trialDays = skipTrial ? undefined : 14

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_collection: skipTrial ? 'always' : 'if_required',
    line_items: [{
      price: priceId,
      quantity: isTeam ? (seats || 1) : 1,
    }],
    mode: 'subscription',
    subscription_data: trialDays ? { trial_period_days: trialDays } : undefined,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://dashboard.coldcallz.net'}/dashboard/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://dashboard.coldcallz.net'}/dashboard/billing`,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
