'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  id: string
  user_id: string
  full_name: string | null
  role: string
  created_at: string
}

type Invite = {
  id: string
  email: string
  accepted_at: string | null
  created_at: string
}

type RepStats = {
  user_id: string
  full_name: string | null
  visits_total: number
  visits_this_week: number
  prospects: number
  open_follow_ups: number
}

export default function TeamPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [members, setMembers] = useState<Profile[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [repStats, setRepStats] = useState<RepStats[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [setupMode, setSetupMode] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => { loadTeam() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTeam() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!profile || !profile.organization_id) {
      setSetupMode(true)
      setLoading(false)
      return
    }

    setOrgId(profile.organization_id)

    const [orgRes, membersRes, invitesRes] = await Promise.all([
      supabase.from('organizations').select('name').eq('id', profile.organization_id).single(),
      supabase.from('user_profiles').select('*').eq('organization_id', profile.organization_id),
      supabase.from('invites').select('*').eq('organization_id', profile.organization_id).order('created_at', { ascending: false }),
    ])

    setOrgName(orgRes.data?.name || '')
    setMembers(membersRes.data || [])
    setInvites(invitesRes.data || [])

    // Load stats per rep
    const allMembers = membersRes.data || []
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
    const stats: RepStats[] = []

    for (const m of allMembers) {
      const [totalRes, weekRes, prospectsRes, followUpsRes] = await Promise.all([
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('user_id', m.user_id),
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('user_id', m.user_id).gte('visit_time', weekAgo.toISOString()),
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('user_id', m.user_id).eq('status', 'prospect'),
        supabase.from('follow_ups').select('id, visits!inner(user_id)', { count: 'exact', head: true }).eq('completed', false).eq('visits.user_id', m.user_id),
      ])
      stats.push({
        user_id: m.user_id,
        full_name: m.full_name,
        visits_total: totalRes.count || 0,
        visits_this_week: weekRes.count || 0,
        prospects: prospectsRes.count || 0,
        open_follow_ups: followUpsRes.count || 0,
      })
    }

    setRepStats(stats)
    setLoading(false)
  }

  async function createOrg() {
    if (!newOrgName.trim()) return
    setCreating(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: orgError } = await supabase
      .from('organizations')
      .insert({ name: newOrgName.trim() })

    if (orgError) { setCreating(false); return }

    // Fetch the org we just created via user_profiles after linking
    // First get the org by name since we can't read it back yet (RLS)
    // We'll use a workaround: insert then upsert profile using a raw query approach
    // Instead, fetch all orgs and find ours — but we have no org_id yet.
    // Solution: use service role via edge function, or fetch by name temporarily
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', newOrgName.trim())
      .order('created_at', { ascending: false })
      .limit(1)

    const org = orgs?.[0]
    if (!org) { setCreating(false); return }

    await supabase.from('user_profiles').upsert({
      user_id: user.id,
      full_name: user.user_metadata?.full_name || null,
      organization_id: org.id,
      role: 'manager',
    }, { onConflict: 'user_id' })

    setSetupMode(false)
    loadTeam()
    setCreating(false)
  }

  async function sendInvite() {
    if (!inviteEmail.trim() || !orgId) return
    setInviting(true)
    setInviteMsg('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Record invite
    const { error: inviteError } = await supabase.from('invites').insert({
      organization_id: orgId,
      email: inviteEmail.trim().toLowerCase(),
      invited_by: user.id,
    })

    if (inviteError) {
      setInviteMsg(inviteError.code === '23505' ? 'This email has already been invited.' : 'Error sending invite.')
      setInviting(false)
      return
    }

    // Send invite email via Supabase magic link
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: inviteEmail.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/join`,
        shouldCreateUser: true,
      }
    })

    if (authError) {
      setInviteMsg('Invite recorded but email failed to send. Rep can sign up at ' + window.location.origin + '/join')
    } else {
      setInviteMsg('Invite sent! They will receive an email to join.')
    }

    setInviteEmail('')
    setInviting(false)
    loadTeam()
  }

  async function removeInvite(id: string) {
    const supabase = createClient()
    await supabase.from('invites').delete().eq('id', id)
    setInvites(prev => prev.filter(i => i.id !== id))
  }

  if (loading) return <div className="text-[#5A6A84]">Loading...</div>

  if (setupMode) {
    return (
      <div className="max-w-md space-y-6">
        <div>
          <h2 className="text-2xl font-black text-[#E8EDF5]">Set Up Your Team</h2>
          <p className="text-[#5A6A84] mt-1">Create your organization to invite reps and see their activity.</p>
        </div>
        <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-[#5A6A84] uppercase tracking-wider">Organization / Agency Name</label>
            <input
              value={newOrgName}
              onChange={e => setNewOrgName(e.target.value)}
              placeholder="e.g. Furr Sales Agency"
              className="w-full mt-2 bg-[#0F1623] border border-[#1E2A42] rounded-xl px-4 py-3 text-[#E8EDF5] focus:outline-none focus:border-[#38BDF8] transition-colors"
            />
          </div>
          <button
            onClick={createOrg}
            disabled={creating || !newOrgName.trim()}
            className="w-full bg-[#38BDF8] text-[#080C18] font-black py-3 rounded-xl hover:bg-[#7DD3FC] transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Organization'}
          </button>
        </div>
      </div>
    )
  }

  const pendingInvites = invites.filter(i => !i.accepted_at)

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-[#E8EDF5]">{orgName}</h2>
          <p className="text-[#5A6A84] mt-1">{members.length} {members.length === 1 ? 'member' : 'members'}</p>
        </div>
      </div>

      {/* Rep Stats */}
      <div>
        <h3 className="text-xs font-bold text-[#5A6A84] uppercase tracking-wider mb-3">Team Activity</h3>
        <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E2A42]">
                {['Rep', 'Role', 'Total Visits', 'This Week', 'Prospects', 'Open Follow-Ups'].map(h => (
                  <th key={h} className="text-left text-xs font-bold text-[#5A6A84] uppercase tracking-wider px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2A42]">
              {repStats.map(rep => {
                const member = members.find(m => m.user_id === rep.user_id)
                return (
                  <tr key={rep.user_id} className="hover:bg-[#1E2A42] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-[#E8EDF5]">{rep.full_name || 'Unnamed'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full capitalize ${
                        member?.role === 'manager' ? 'bg-purple-400/10 text-purple-400' : 'bg-[#1E2A42] text-[#5A6A84]'
                      }`}>
                        {member?.role || 'rep'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#38BDF8] font-bold">{rep.visits_total}</td>
                    <td className="px-6 py-4 text-sm text-[#E8EDF5]">{rep.visits_this_week}</td>
                    <td className="px-6 py-4 text-sm text-amber-400">{rep.prospects}</td>
                    <td className="px-6 py-4 text-sm text-[#FB7185]">{rep.open_follow_ups}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite */}
      <div>
        <h3 className="text-xs font-bold text-[#5A6A84] uppercase tracking-wider mb-3">Invite a Rep</h3>
        <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] p-6">
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="rep@yourcompany.com"
              className="flex-1 bg-[#0F1623] border border-[#1E2A42] rounded-xl px-4 py-2.5 text-[#E8EDF5] text-sm focus:outline-none focus:border-[#38BDF8] transition-colors placeholder:text-[#3A4A62]"
              onKeyDown={e => e.key === 'Enter' && sendInvite()}
            />
            <button
              onClick={sendInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="bg-[#38BDF8] text-[#080C18] font-bold px-5 py-2.5 rounded-xl hover:bg-[#7DD3FC] transition-colors disabled:opacity-50 text-sm"
            >
              {inviting ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
          {inviteMsg && (
            <p className={`text-sm mt-3 ${inviteMsg.includes('sent') ? 'text-emerald-400' : 'text-[#FB7185]'}`}>
              {inviteMsg}
            </p>
          )}
        </div>
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-[#5A6A84] uppercase tracking-wider mb-3">Pending Invites</h3>
          <div className="bg-[#141B2D] rounded-2xl border border-[#1E2A42] divide-y divide-[#1E2A42] overflow-hidden">
            {pendingInvites.map(invite => (
              <div key={invite.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm text-[#E8EDF5]">{invite.email}</p>
                  <p className="text-xs text-[#5A6A84] mt-0.5">
                    Invited {new Date(invite.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-amber-400 font-medium">Pending</span>
                  <button
                    onClick={() => removeInvite(invite.id)}
                    className="text-xs text-[#5A6A84] hover:text-[#FB7185] transition-colors"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
