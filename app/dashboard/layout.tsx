'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [userName, setUserName] = useState('')
  const [isManager, setIsManager] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUserName(user.user_metadata?.full_name?.split(' ')[0] || user.email || '')

      // Ensure user_profile exists (creates one for new/solo users)
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, organization_id')
        .eq('user_id', user.id)
        .single()

      if (!profile) {
        await supabase.from('user_profiles').insert({
          user_id: user.id,
          full_name: user.user_metadata?.full_name || null,
          organization_id: null,
          role: 'solo',
        })
      } else {
        setIsManager(profile.role === 'manager')
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: '🏠' },
    { href: '/dashboard/visits', label: 'Visits', icon: '📋' },
    { href: '/dashboard/follow-ups', label: 'Follow-Ups', icon: '🔔' },
    ...(isManager ? [{ href: '/dashboard/team', label: 'Team', icon: '👥' }] : []),
  ]

  return (
    <div className="min-h-screen bg-[#080C18] flex">
      {/* Sidebar */}
      <aside className="w-56 bg-[#0F1623] border-r border-[#1E2A42] flex flex-col fixed h-full">
        <div className="p-6 border-b border-[#1E2A42]">
          <h1 className="text-xl font-black text-[#38BDF8]">ColdCallz</h1>
          <p className="text-xs text-[#5A6A84] mt-1">Hey, {userName}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-[#1E2A42] text-[#38BDF8]'
                  : 'text-[#5A6A84] hover:text-[#E8EDF5] hover:bg-[#141B2D]'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-[#1E2A42]">
          <button
            onClick={signOut}
            className="w-full text-left px-3 py-2 text-sm text-[#5A6A84] hover:text-[#FB7185] transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-56 p-8">
        {children}
      </main>
    </div>
  )
}
