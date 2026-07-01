'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/', icon: '🏠', label: 'ホーム' },
  { href: '/map', icon: '🗺️', label: '地図' },
  { href: '/events', icon: '📅', label: 'イベント' },
  { href: '/favorites', icon: '★', label: 'お気に入り' },
  { href: '/mypage', icon: '👤', label: 'マイページ' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t h-14 flex items-stretch">
      {TABS.map((tab) => {
        const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              isActive ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
