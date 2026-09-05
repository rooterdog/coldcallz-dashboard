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
  phone: string | null
  notes_summary: string | null
}

type RepOption = { user_id: string; full_name: string }

const STATUS_FILTERS = ['all', 'completed', 'prospect', 'attempted'] as const
type StatusFilter = typeof STATUS_FILTERS[number]

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [repFilter, setRepFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [isPro, setIsPro] = useState(false)
  const [reps, setReps] = useState<RepOption[]>([])
  const [repNames, setRepNames] = useState<Record<string, string>>({})

  useEffect(() => { init() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadVisits() }, [statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setIsPro((tier === 'pro' || tier === 'team') && (status === 'active' || status === 'trialing'))

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

    loadVisits()
  }

  async function loadVisits() {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('visits')
      .select('id, user_id, visit_time, status, business_name, address, phone, notes_summary')
      .order('visit_time', { ascending: false })
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    const { data } = await query
    setVisits(data || [])
    setLoading(false)
  }

  const filtered = visits.filter(v => {
    if (repFilter !== 'all' && v.user_id !== repFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      v.business_name?.toLowerCase().includes(q) ||
      v.address?.toLowerCase().includes(q) ||
      v.notes_summary?.toLowerCase().includes(q) ||
      v.phone?.toLowerCase().includes(q)
    )
  })

  async function exportCSV() {
    const supabase = createClient()
    const { data } = await supabase
      .from('visits')
      .select('visit_time, status, business_name, address, phone, website, notes_summary, user_id')
      .order('visit_time', { ascending: false })
    if (!data) return
    const headers = isManager
      ? ['Date', 'Rep', 'Status', 'Business', 'Address', 'Phone', 'Website', 'Notes']
      : ['Date', 'Status', 'Business', 'Address', 'Phone', 'Website', 'Notes']
    const rows = data.map(v => {
      const base = [
        new Date(v.visit_time).toLocaleString(),
        v.status,
        v.business_name || '',
        v.address || '',
        v.phone || '',
        v.website || '',
        (v.notes_summary || '').replace(/\n/g, ' '),
      ]
      return isManager ? [new Date(v.visit_time).toLocaleString(), repNames[v.user_id] || '', ...base.slice(1)] : base
    })
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `coldcallz-visits-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  function statusColor(status: string) {
    if (status === 'completed') return 'bg-emerald-400/10 text-emerald-400'
    if (status === 'prospect') return 'bg-amber-400/10 text-amber-400'
    if (status === 'attempted') return 'bg-blue-400/10 text-blue-400'
    return 'bg-[#1E2A42] text-[#5A6A84]'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-[#E8EDF5]">Visits</h2>
          <p className="text-[#5A6A84] mt-1">{filtered.length} records{search && ` matching "${search}"`}</p>
        </div>
        {isPro ? (
          <button
            onClick={exportCSV}
            className="bg-[#141B2D] border border-[#1E2A42] text-[#E8EDF5] px-4 py-2 rounded-xl text-sm font-semibold hover:border-[#38BDF8] transition-colors"
          >
            ⬇️ Export CSV
          </button>
        ) : (
          <Link
            href="/dashboard/billing"
            className="bg-[#141B2D] border border-amber-400/30 text-amber-300 px-4 py-2 rounded-xl text-sm font-semibold hover:border-amber-400 transition-colors"
            title="Upgrade to Pro to export CSV"
          >
            🔒 Export CSV
          </Link>
        )}
      </div>

      {!isPro && (
        <UpgradeBanner message="You're on the Free plan — limited to 5 visits/day. Upgrade to Pro for unlimited visits, AI summaries, and CSV export." />
      )}

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6A84] text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search business, address, notes..."
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

          <div className="flex gap-2">
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors capitalize ${
                  statusFilter === f
                    ? 'bg-[#38BDF8] text-[#080C18]'
                    : 'bg-[#141B2D] text-[#5A6A84] hover:text-[#E8EDF5] border border-[#1E2A42]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] overflow-hidden">
        {loading ? (
          <p className="text-[#5A6A84] p-6">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-[#5A6A84] p-6">{search ? `No visits matching "${search}"` : 'No visits found.'}</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E2A42]">
                {['Date', ...(isManager ? ['Rep'] : []), 'Status', 'Business', 'Address', 'Notes'].map(h => (
                  <th key={h} className="text-left text-xs font-bold text-[#5A6A84] uppercase tracking-wider px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2A42]">
              {filtered.map(visit => (
                <tr key={visit.id} className="hover:bg-[#1E2A42] transition-colors">
                  <td className="px-6 py-4 text-xs text-[#5A6A84] whitespace-nowrap">
                    {new Date(visit.visit_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </td>
                  {isManager && (
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold bg-purple-400/10 text-purple-400 px-2 py-1 rounded-full">
                        {repNames[visit.user_id] || '—'}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${statusColor(visit.status)}`}>
                      {visit.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/visits/${visit.id}`} className="text-sm font-semibold text-[#38BDF8] hover:underline">
                      {visit.business_name || '—'}
                    </Link>
                    {visit.phone && <p className="text-xs text-[#5A6A84] mt-0.5">{visit.phone}</p>}
                  </td>
                  <td className="px-6 py-4 text-xs text-[#5A6A84] max-w-[180px] truncate">{visit.address || '—'}</td>
                  <td className="px-6 py-4 text-xs text-[#5A6A84] max-w-[240px]">
                    <p className="line-clamp-2">{visit.notes_summary || '—'}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
