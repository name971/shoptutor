'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Store, ChevronRight, Settings2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

type OwnerShop = { id: string; name: string }

// ログイン中のユーザーがプレミアム店舗のオーナーなら、その店舗を返す（それ以外は null）
function useOwnedShop(): OwnerShop | null {
  const [shop, setShop] = useState<OwnerShop | null>(null)
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      // 未ログインなら問い合わせない（端末のセッションを見るだけ）
      const { data } = await createClient().auth.getSession()
      if (!data.session) return
      const res = await fetch('/api/owner/check').catch(() => null)
      const json = res?.ok ? await res.json() : null
      if (!cancelled && json?.isOwner) setShop({ id: json.shop.id, name: json.shop.name })
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])
  return shop
}

// マイページに出すオーナー画面への入口（オーナーのときだけ表示）
export function OwnerEntryCard() {
  const shop = useOwnedShop()
  if (!shop) return null
  return (
    <Link href="/owner" className="surface p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
      <span className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
        <Store size={22} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-slate-900">オーナー画面</span>
        <span className="block text-xs text-slate-500 truncate">{shop.name}の閲覧数・レビュー・店舗情報</span>
      </span>
      <ChevronRight size={18} className="text-slate-300 flex-shrink-0" />
    </Link>
  )
}

// 店舗詳細に出す「この店を管理する」（その店のオーナーにだけ表示）
export function OwnerManageLink({ shopId }: { shopId: string }) {
  const shop = useOwnedShop()
  if (!shop || shop.id !== shopId) return null
  return (
    <Link
      href="/owner"
      className="surface px-4 h-12 flex items-center gap-2 text-sm font-bold text-blue-700 hover:shadow-md transition-shadow"
    >
      <Settings2 size={18} />
      <span className="flex-1">この店を管理する（オーナー画面）</span>
      <ChevronRight size={18} className="text-blue-300" />
    </Link>
  )
}
