'use client'

import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'

const HIDDEN_PREFIXES = ['/login', '/onboarding', '/admin']

export default function BottomNavGate() {
  const pathname = usePathname()

  const hidden =
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    /^\/shops\/[^/]+\/review$/.test(pathname)

  if (hidden) return null

  return <BottomNav />
}
