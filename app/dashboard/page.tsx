'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import UpgradeBanner from '@/components/UpgradeBanner'

type Visit = {
  id: string
  user_id: string
  visit_time: string
  status: string
  business_name: string | null
  address: string | null
  notes_summary: string | null
}

type FollowUp = {
  id: string
  description: string
  due_date: string | null
  completed: boolean
  visits: { business_name: string | null } | { business_name: string | null }[] | null
}

type Stats = {
  today: number
  thisWeek: number
  thisMonth: number
  prospects: number
  followUpsDue: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ today: 0, thisWeek: 0, thisMonth: 0, prospects: 0, followUpsDue: 0 })
  const [recentVisits, setRecentVisits] = useState<Visit[]>([])
  const [dueSoonFollowUps, setDueSoonFollowUps] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [repNames, setRepNames] = useState<Record<string, string>>({})
  const [isPro, setIsPro] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, organization_id, subscription_tier, subscription_status')
      .eq('user_id', user.id)
      .single()

    const tier = profile?.subscription_tier || 'free'
    const status = profile?.subscription_status || null
    const pro = (tier === 'pro' || tier === 'team') && (status === 'active' || status === 'trialing')
    setIsPro(pro)

    const manager = profile?.role === 'manager'
    setIsManager(manager)

    if (manager && profile?.organization_id) {
      const { data: members } = await supabase
        .from('user_profiles')
        .select('user_id, full_name')
        .eq('organization_id', profile.organization_id)
      const map: Record<string, string> = {}
      members?.forEach(m => { map[m.user_id] = m.full_name || 'Unknown' })
      setRepNames(map)
    }

    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0)
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7)
    const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0,0,0,0)
    const today = now.toISOString().split('T')[0]

    const [todayRes, weekRes, monthRes, prospectsRes, followUpsRes, recentRes, dueRes] = await Promise.all([
      supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('visit_time', todayStart.toISOString()),
      supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('visit_time', weekStart.toISOString()),
      supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('visit_time', monthStart.toISOString()),
      supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'prospect'),
      supabase.from('follow_ups').select('*', { count: 'exact', head: true }).eq('completed', false).lte('due_date', today),
      supabase.from('visits').select('id, user_id, visit_time, status, business_name, address, notes_summary').order('visit_time', { ascending: false }).limit(8),
      supabase.from('follow_ups').select('id, description, due_date, completed, visits(business_name)').eq('completed', false).lte('due_date', today).order('due_date', { ascending: true }).limit(5),
    ])

    setStats({
      today: todayRes.count || 0,
      thisWeek: weekRes.count || 0,
      thisMonth: monthRes.count || 0,
      prospects: prospectsRes.count || 0,
      followUpsDue: followUpsRes.count || 0,
    })
    setRecentVisits(recentRes.data || [])
    setDueSoonFollowUps(dueRes.data || [])
    setLoading(false)
  }

  function statusColor(status: string) {
    if (status === 'completed') return 'text-emerald-400'
    if (status === 'prospect') return 'text-amber-400'
    if (status === 'attempted') return 'text-blue-400'
    return 'text-[#5A6A84]'
  }

  function statusLabel(status: string) {
    if (status === 'completed') return '✅ Completed'
    if (status === 'prospect') return '👁️ Prospect'
    if (status === 'attempted') return '🔄 Attempted'
    return status
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  function formatDueDate(d: string) {
    const [year, month, day] = d.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  if (loading) return <div className="text-[#5A6A84]">Loading...</div>

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-black text-[#E8EDF5]">Overview</h2>
        <p className="text-[#5A6A84] mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {!isPro && (
        <UpgradeBanner message="You're on the Free plan — limited to 5 visits/day. Upgrade to Pro for unlimited visits, AI summaries, and more." />
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Today', value: stats.today },
          { label: 'This Week', value: stats.thisWeek },
          { label: 'This Month', value: stats.thisMonth },
          { label: 'Prospects', value: stats.prospects },
          { label: 'Follow-Ups Due', value: stats.followUpsDue, alert: stats.followUpsDue > 0 },
        ].map(stat => (
          <div key={stat.label} className="bg-[#141B2D] rounded-2xl p-5 border border-[#1E2A42]">
            <div className={`text-3xl font-black ${stat.alert ? 'text-[#FB7185]' : 'text-[#38BDF8]'}`}>{stat.value}</div>
            <div className="text-xs text-[#5A6A84] mt-1 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent Visits */}
        <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2A42]">
            <h3 className="font-bold text-[#E8EDF5]">Recent Visits</h3>
            <Link href="/dashboard/visits" className="text-xs text-[#38BDF8] hover:underline">See all</Link>
          </div>
          <div className="divide-y divide-[#1E2A42]">
            {recentVisits.length === 0 && (
              <p className="text-[#5A6A84] text-sm p-6">No visits yet.</p>
            )}
            {recentVisits.map(visit => (
              <Link key={visit.id} href={`/dashboard/visits/${visit.id}`} className="flex items-start gap-3 px-6 py-4 hover:bg-[#1E2A42] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-semibold ${statusColor(visit.status)}`}>{statusLabel(visit.status)}</span>
                    <span className="text-xs text-[#3A4A62]">{formatDate(visit.visit_time)}</span>
                    {isManager && repNames[visit.user_id] && (
                      <span className="text-xs font-semibold bg-purple-400/10 text-purple-400 px-2 py-0.5 rounded-full">
                        {repNames[visit.user_id]}
                      </span>
                    )}
                  </div>
                  {visit.business_name && <p className="text-sm font-semibold text-[#E8EDF5] truncate">{visit.business_name}</p>}
                  {visit.notes_summary && <p className="text-xs text-[#5A6A84] mt-1 line-clamp-2">{visit.notes_summary}</p>}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Follow-ups due */}
        <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2A42]">
            <h3 className="font-bold text-[#E8EDF5]">Follow-Ups Due</h3>
            <Link href="/dashboard/follow-ups" className="text-xs text-[#38BDF8] hover:underline">See all</Link>
          </div>
          {!isPro ? (
            <div className="p-6">
              <p className="text-[#5A6A84] text-sm mb-3">Follow-up reminders are a Pro feature.</p>
              <Link href="/dashboard/billing" className="text-xs text-amber-400 hover:underline font-semibold">Upgrade to unlock →</Link>
            </div>
          ) : (
            <div className="divide-y divide-[#1E2A42]">
              {dueSoonFollowUps.length === 0 && (
                <p className="text-[#5A6A84] text-sm p-6">All caught up! ✅</p>
              )}
              {dueSoonFollowUps.map(f => (
                <div key={f.id} className="px-6 py-4">
                  <p className="text-sm text-[#E8EDF5] font-medium">{f.description}</p>
                  {(() => { const biz = Array.isArray(f.visits) ? f.visits[0]?.business_name : f.visits?.business_name; return biz ? <p className="text-xs text-[#5A6A84] mt-1">📍 {biz}</p> : null })()}
                  {f.due_date && <p className="text-xs text-[#FB7185] mt-1">📅 {formatDueDate(f.due_date)}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
