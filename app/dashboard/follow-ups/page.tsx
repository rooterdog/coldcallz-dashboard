'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import UpgradeBanner from '@/components/UpgradeBanner'

type FollowUp = {
  id: string
  description: string
  due_date: string | null
  completed: boolean
  visit_id: string
  visits: { business_name: string | null; visit_time: string; user_id: string } | { business_name: string | null; visit_time: string; user_id: string }[] | null
}

type RepOption = { user_id: string; full_name: string }

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [showCompleted, setShowCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [isPro, setIsPro] = useState(false)
  const [reps, setReps] = useState<RepOption[]>([])
  const [repNames, setRepNames] = useState<Record<string, string>>({})
  const [repFilter, setRepFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  useEffect(() => { init() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (isPro) loadFollowUps() }, [showCompleted]) // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
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
      setReps(members?.map(m => ({ user_id: m.user_id, full_name: m.full_name || 'Unknown' })) || [])
    }

    if (pro) loadFollowUps()
    else setLoading(false)
  }

  async function loadFollowUps() {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('follow_ups')
      .select('id, description, due_date, completed, visit_id, visits(business_name, visit_time, user_id)')
      .order('due_date', { ascending: true, nullsFirst: false })
    if (!showCompleted) query = query.eq('completed', false)
    const { data } = await query
    setFollowUps(data || [])
    setLoading(false)
  }

  async function toggleComplete(f: FollowUp) {
    const supabase = createClient()
    await supabase.from('follow_ups').update({ completed: !f.completed }).eq('id', f.id)
    loadFollowUps()
  }

  function parseLocalDate(d: string) {
    const [year, month, day] = d.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  function formatDueDate(d: string) {
    return parseLocalDate(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  function dueDateColor(d: string) {
    const today = new Date(); today.setHours(0,0,0,0)
    const date = parseLocalDate(d)
    if (date < today) return 'text-[#FB7185]'
    if (date.getTime() === today.getTime()) return 'text-[#38BDF8]'
    return 'text-[#5A6A84]'
  }

  function getVisit(f: FollowUp) {
    return Array.isArray(f.visits) ? f.visits[0] : f.visits
  }

  const filtered = followUps.filter(f => {
    const visit = getVisit(f)
    if (repFilter !== 'all' && visit?.user_id !== repFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      f.description.toLowerCase().includes(q) ||
      visit?.business_name?.toLowerCase().includes(q)
    )
  })

  const open = filtered.filter(f => !f.completed)

  if (loading) return <div className="text-[#5A6A84]">Loading...</div>

  if (!isPro) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-2xl font-black text-[#E8EDF5]">Follow-Ups</h2>
          <p className="text-[#5A6A84] mt-1">Stay on top of your pipeline</p>
        </div>
        <UpgradeBanner message="Follow-up reminders are a Pro feature. Upgrade to track, schedule, and manage follow-ups on all your visits." />
        <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] p-8 text-center opacity-40 pointer-events-none select-none">
          <p className="text-4xl mb-3">🔔</p>
          <p className="text-[#E8EDF5] font-bold mb-1">No follow-ups visible</p>
          <p className="text-[#5A6A84] text-sm">Upgrade to Pro to unlock this feature</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-[#E8EDF5]">Follow-Ups</h2>
          <p className="text-[#5A6A84] mt-1">{open.length} open</p>
        </div>
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="text-xs text-[#5A6A84] hover:text-[#E8EDF5] transition-colors"
        >
          {showCompleted ? 'Hide completed' : 'Show completed'}
        </button>
      </div>

      {/* Search + Rep filter */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6A84] text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search follow-ups or business..."
            className="w-full bg-[#141B2D] border border-[#1E2A42] rounded-xl pl-9 pr-4 py-2 text-[#E8EDF5] text-sm focus:outline-none focus:border-[#38BDF8] transition-colors placeholder:text-[#3A4A62]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A6A84] hover:text-[#E8EDF5] text-xs">✕</button>
          )}
        </div>
        {isManager && reps.length > 0 && (
          <select
            value={repFilter}
            onChange={e => setRepFilter(e.target.value)}
            className="bg-[#141B2D] border border-[#1E2A42] rounded-xl px-3 py-2 text-sm text-[#E8EDF5] focus:outline-none focus:border-[#38BDF8] transition-colors"
          >
            <option value="all">All Reps</option>
            {reps.map(r => (
              <option key={r.user_id} value={r.user_id}>{r.full_name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] divide-y divide-[#1E2A42] overflow-hidden">
        {filtered.length === 0 && (
          <p className="text-[#5A6A84] text-sm p-6">All caught up! ✅</p>
        )}
        {filtered.map(f => {
          const visit = getVisit(f)
          return (
            <div key={f.id} className={`flex items-start gap-4 px-6 py-4 ${f.completed ? 'opacity-50' : ''}`}>
              <button onClick={() => toggleComplete(f)} className="mt-0.5 text-xl flex-shrink-0">
                {f.completed ? '✅' : '⬜'}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-medium ${f.completed ? 'line-through text-[#5A6A84]' : 'text-[#E8EDF5]'}`}>
                    {f.description}
                  </p>
                  {isManager && visit?.user_id && repNames[visit.user_id] && (
                    <span className="text-xs font-semibold bg-purple-400/10 text-purple-400 px-2 py-0.5 rounded-full">
                      {repNames[visit.user_id]}
                    </span>
                  )}
                </div>
                {visit?.business_name && (
                  <Link href={`/dashboard/visits/${f.visit_id}`} className="text-xs text-[#38BDF8] hover:underline mt-1 block">
                    📍 {visit.business_name}
                  </Link>
                )}
                {f.due_date && (
                  <p className={`text-xs mt-1 font-medium ${f.completed ? 'text-[#5A6A84]' : dueDateColor(f.due_date)}`}>
                    📅 {formatDueDate(f.due_date)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
