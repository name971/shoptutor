'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Store, Star, User, type LucideIcon } from 'lucide-react'

const TABS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: '/', icon: CalendarDays, label: 'イベント' },
  { href: '/shops', icon: Store, label: '店舗' },
  { href: '/favorites', icon: Star, label: 'お気に入り' },
  { href: '/mypage', icon: User, label: 'マイページ' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 app-header shadow-[0_-1px_0_rgba(15,23,42,0.06)] pb-[env(safe-area-inset-bottom)]">
      <div className="h-16 flex items-stretch max-w-lg mx-auto">
        {TABS.map((tab) => {
          const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
                isActive ? 'text-slate-900 font-bold' : 'text-slate-500 font-medium hover:text-slate-700'
              }`}
            >
              <span
                className={`flex items-center justify-center h-7 w-14 rounded-full transition-colors ${
                  isActive ? 'bg-blue-100 text-blue-700' : ''
                }`}
              >
                <Icon size={21} strokeWidth={isActive ? 2.4 : 2} />
              </span>
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
