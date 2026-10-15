'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Map, CalendarDays, Star, User, type LucideIcon } from 'lucide-react'

const TABS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: '/', icon: Home, label: 'ホーム' },
  { href: '/map', icon: Map, label: '地図' },
  { href: '/events', icon: CalendarDays, label: 'イベント' },
  { href: '/favorites', icon: Star, label: 'お気に入り' },
  { href: '/mypage', icon: User, label: 'マイページ' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t pb-[env(safe-area-inset-bottom)]">
      <div className="h-14 flex items-stretch max-w-lg mx-auto">
        {TABS.map((tab) => {
          const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {isActive && <span className="absolute top-0 h-[3px] w-7 rounded-b bg-blue-600" />}
              <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
