import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Service role client — bypasses RLS for webhook updates
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function tierFromPriceId(priceId: string): string {
  if (priceId === process.env.STRIPE_PRICE_TEAM) return 'team'
  if (
    priceId === process.env.STRIPE_PRICE_PRO_MONTHLY ||
    priceId === process.env.STRIPE_PRICE_PRO_ANNUAL
  ) return 'pro'
  return 'free'
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 })
  }

  async function updateProfile(customerId: string, updates: Record<string, unknown>) {
    await supabase.from('user_profiles').update(updates).eq('stripe_customer_id', customerId)
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const priceId = sub.items.data[0]?.price.id
      const tier = tierFromPriceId(priceId)
      await updateProfile(sub.customer as string, {
        subscription_tier: tier,
        subscription_status: sub.status,
        trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        current_period_ends_at: new Date(sub.current_period_end * 1000).toISOString(),
      })
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await updateProfile(sub.customer as string, {
        subscription_tier: 'free',
        subscription_status: 'canceled',
        trial_ends_at: null,
        current_period_ends_at: null,
      })
      break
    }
  }

  return NextResponse.json({ received: true })
}
