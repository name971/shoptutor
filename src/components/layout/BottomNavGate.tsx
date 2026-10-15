'use client'

import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'

const HIDDEN_PREFIXES = ['/login', '/onboarding', '/admin']

export default function BottomNavGate() {
  const pathname = usePathname()

  const hidden =
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    // 店舗詳細は画面下に固定のアクションバー（お気に入り・レビュー・経路）を出すため非表示
    /^\/shops\/[^/]+(\/review)?$/.test(pathname)

  if (hidden) return null

  return <BottomNav />
}
