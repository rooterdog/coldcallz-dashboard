'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type FollowUp = {
  id: string
  description: string
  due_date: string | null
  completed: boolean
  visit_id: string
  visits: { business_name: string | null, visit_time: string } | { business_name: string | null, visit_time: string }[] | null
}

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [showCompleted, setShowCompleted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadFollowUps() }, [showCompleted]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadFollowUps() {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('follow_ups')
      .select('id, description, due_date, completed, visit_id, visits(business_name, visit_time)')
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

  const open = followUps.filter(f => !f.completed)

  if (loading) return <div className="text-[#5A6A84]">Loading...</div>

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

      <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] divide-y divide-[#1E2A42] overflow-hidden">
        {followUps.length === 0 && (
          <p className="text-[#5A6A84] text-sm p-6">All caught up! ✅</p>
        )}
        {followUps.map(f => (
          <div key={f.id} className={`flex items-start gap-4 px-6 py-4 ${f.completed ? 'opacity-50' : ''}`}>
            <button onClick={() => toggleComplete(f)} className="mt-0.5 text-xl flex-shrink-0">
              {f.completed ? '✅' : '⬜'}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${f.completed ? 'line-through text-[#5A6A84]' : 'text-[#E8EDF5]'}`}>
                {f.description}
              </p>
              {(() => {
                const biz = Array.isArray(f.visits) ? f.visits[0]?.business_name : f.visits?.business_name
                return biz ? (
                  <Link href={`/dashboard/visits/${f.visit_id}`} className="text-xs text-[#38BDF8] hover:underline mt-1 block">
                    📍 {biz}
                  </Link>
                ) : null
              })()}
              {f.due_date && (
                <p className={`text-xs mt-1 font-medium ${f.completed ? 'text-[#5A6A84]' : dueDateColor(f.due_date)}`}>
                  📅 {formatDueDate(f.due_date)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
