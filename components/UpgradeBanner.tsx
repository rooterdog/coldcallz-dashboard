'use client'

import Link from 'next/link'

type Props = {
  message?: string
}

export default function UpgradeBanner({ message = 'This feature requires a Pro plan.' }: Props) {
  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="text-xl">🔒</span>
        <p className="text-amber-300 font-semibold text-sm">{message}</p>
      </div>
      <Link
        href="/dashboard/billing"
        className="shrink-0 bg-amber-400 text-[#080C18] font-black text-sm px-4 py-2 rounded-xl hover:bg-amber-300 transition-colors"
      >
        Upgrade
      </Link>
    </div>
  )
}
