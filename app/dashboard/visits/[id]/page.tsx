'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Visit = {
  id: string
  visit_time: string
  status: string
  business_name: string | null
  address: string | null
  phone: string | null
  website: string | null
  notes_summary: string | null
  notes_raw: string | null
  audio_url: string | null
}

type FollowUp = {
  id: string
  description: string
  due_date: string | null
  completed: boolean
}

type Media = {
  id: string
  storage_url: string
  type: string
}

const STATUS_OPTIONS = ['completed', 'prospect', 'attempted']

export default function VisitDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [visit, setVisit] = useState<Visit | null>(null)
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Edit fields
  const [editStatus, setEditStatus] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editBusinessName, setEditBusinessName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editPhone, setEditPhone] = useState('')

  useEffect(() => { loadVisit() }, [id])

  async function loadVisit() {
    const supabase = createClient()
    const [visitRes, followUpsRes, mediaRes] = await Promise.all([
      supabase.from('visits').select('*').eq('id', id).single(),
      supabase.from('follow_ups').select('*').eq('visit_id', id).order('due_date'),
      supabase.from('visit_media').select('*').eq('visit_id', id),
    ])
    setVisit(visitRes.data)
    setFollowUps(followUpsRes.data || [])
    setMedia(mediaRes.data || [])
    setLoading(false)
    if (visitRes.data) {
      setEditStatus(visitRes.data.status)
      setEditSummary(visitRes.data.notes_summary || '')
      setEditBusinessName(visitRes.data.business_name || '')
      setEditAddress(visitRes.data.address || '')
      setEditPhone(visitRes.data.phone || '')
    }
  }

  async function saveEdits() {
    if (!visit) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('visits')
      .update({
        status: editStatus,
        notes_summary: editSummary,
        business_name: editBusinessName || null,
        address: editAddress || null,
        phone: editPhone || null,
      })
      .eq('id', visit.id)
      .select()
      .single()
    if (!error && data) {
      setVisit(data)
      setEditing(false)
    }
    setSaving(false)
  }

  async function deleteVisit() {
    if (!visit) return
    if (!confirm('Delete this visit? This cannot be undone.')) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('visits').delete().eq('id', visit.id)
    router.push('/dashboard/visits')
  }

  async function toggleFollowUp(f: FollowUp) {
    const supabase = createClient()
    await supabase.from('follow_ups').update({ completed: !f.completed }).eq('id', f.id)
    setFollowUps(prev => prev.map(fu => fu.id === f.id ? { ...fu, completed: !fu.completed } : fu))
  }

  function formatDueDate(d: string) {
    const [year, month, day] = d.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  function statusStyle(status: string) {
    if (status === 'completed') return 'bg-emerald-400/10 text-emerald-400'
    if (status === 'prospect') return 'bg-amber-400/10 text-amber-400'
    return 'bg-blue-400/10 text-blue-400'
  }

  if (loading) return <div className="text-[#5A6A84]">Loading...</div>
  if (!visit) return <div className="text-[#5A6A84]">Visit not found.</div>

  return (
    <div className="max-w-3xl space-y-6">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/visits" className="text-[#38BDF8] hover:underline text-sm">← Visits</Link>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-1.5 rounded-xl text-sm text-[#5A6A84] hover:text-[#E8EDF5] border border-[#1E2A42] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdits}
                disabled={saving}
                className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-[#38BDF8] text-[#080C18] hover:bg-[#7DD3FC] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-[#141B2D] text-[#E8EDF5] border border-[#1E2A42] hover:border-[#38BDF8] transition-colors"
              >
                Edit
              </button>
              <button
                onClick={deleteVisit}
                disabled={deleting}
                className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-[#141B2D] text-[#FB7185] border border-[#FB718544] hover:border-[#FB7185] transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] p-6">
        <p className="text-xs text-[#5A6A84] mb-3">
          {new Date(visit.visit_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </p>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-[#5A6A84] uppercase tracking-wider">Status</label>
              <div className="flex gap-2 mt-2">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => setEditStatus(s)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${
                      editStatus === s ? statusStyle(s) + ' ring-1 ring-current' : 'bg-[#0F1623] text-[#5A6A84] border border-[#1E2A42]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-[#5A6A84] uppercase tracking-wider">Business Name</label>
              <input value={editBusinessName} onChange={e => setEditBusinessName(e.target.value)}
                className="w-full mt-1 bg-[#0F1623] border border-[#1E2A42] rounded-xl px-3 py-2 text-[#E8EDF5] text-sm focus:outline-none focus:border-[#38BDF8]" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#5A6A84] uppercase tracking-wider">Address</label>
              <input value={editAddress} onChange={e => setEditAddress(e.target.value)}
                className="w-full mt-1 bg-[#0F1623] border border-[#1E2A42] rounded-xl px-3 py-2 text-[#E8EDF5] text-sm focus:outline-none focus:border-[#38BDF8]" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#5A6A84] uppercase tracking-wider">Phone</label>
              <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                className="w-full mt-1 bg-[#0F1623] border border-[#1E2A42] rounded-xl px-3 py-2 text-[#E8EDF5] text-sm focus:outline-none focus:border-[#38BDF8]" />
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              {visit.business_name && <h2 className="text-xl font-black text-[#E8EDF5]">{visit.business_name}</h2>}
              {visit.address && <p className="text-sm text-[#5A6A84] mt-1">📍 {visit.address}</p>}
              {visit.phone && <p className="text-sm text-[#5A6A84] mt-0.5">📞 {visit.phone}</p>}
              {visit.website && <p className="text-sm text-[#5A6A84] mt-0.5">🌐 {visit.website}</p>}
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${statusStyle(visit.status)}`}>
              {visit.status}
            </span>
          </div>
        )}
      </div>

      {/* AI Summary */}
      <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] p-6">
        <h3 className="text-xs font-bold text-[#5A6A84] uppercase tracking-wider mb-3">AI Summary</h3>
        {editing ? (
          <textarea
            value={editSummary}
            onChange={e => setEditSummary(e.target.value)}
            rows={6}
            className="w-full bg-[#0F1623] border border-[#1E2A42] rounded-xl px-3 py-2 text-[#E8EDF5] text-sm focus:outline-none focus:border-[#38BDF8] resize-none"
          />
        ) : (
          <p className="text-[#E8EDF5] text-sm leading-relaxed whitespace-pre-line">{visit.notes_summary || '—'}</p>
        )}
      </div>

      {/* Audio */}
      {visit.audio_url && (
        <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] p-6">
          <h3 className="text-xs font-bold text-[#5A6A84] uppercase tracking-wider mb-3">Original Recording</h3>
          <audio controls src={visit.audio_url} className="w-full" />
        </div>
      )}

      {/* Transcript */}
      {visit.notes_raw && (
        <div className="bg-[#0F1623] rounded-2xl border border-[#1E2A42] p-6">
          <h3 className="text-xs font-bold text-[#5A6A84] uppercase tracking-wider mb-3">Full Transcript</h3>
          <p className="text-[#5A6A84] text-sm leading-relaxed">{visit.notes_raw}</p>
        </div>
      )}

      {/* Photos */}
      {media.length > 0 && (
        <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] p-6">
          <h3 className="text-xs font-bold text-[#5A6A84] uppercase tracking-wider mb-3">Photos ({media.length})</h3>
          <div className="grid grid-cols-2 gap-3">
            {media.map(item => (
              <a key={item.id} href={item.storage_url} target="_blank" rel="noreferrer">
                <img src={item.storage_url} alt="Visit photo" className="w-full h-48 object-cover rounded-xl hover:opacity-90 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Follow-ups */}
      <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] p-6">
        <h3 className="text-xs font-bold text-[#5A6A84] uppercase tracking-wider mb-3">Follow-Ups</h3>
        {followUps.length === 0 ? (
          <p className="text-[#3A4A62] text-sm">No follow-ups for this visit.</p>
        ) : (
          <div className="space-y-2">
            {followUps.map(f => (
              <button
                key={f.id}
                onClick={() => toggleFollowUp(f)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors hover:bg-[#1E2A42] ${f.completed ? 'opacity-50' : 'bg-[#0F1623]'}`}
              >
                <span className="text-base flex-shrink-0">{f.completed ? '✅' : '⬜'}</span>
                <div>
                  <p className={`text-sm ${f.completed ? 'line-through text-[#5A6A84]' : 'text-[#E8EDF5]'}`}>{f.description}</p>
                  {f.due_date && <p className="text-xs text-[#5A6A84] mt-0.5">📅 {formatDueDate(f.due_date)}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
