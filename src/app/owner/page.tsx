'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ExternalLink } from 'lucide-react'
import type { OwnedShop } from '@/lib/owner-auth'
import BackButton from '@/components/ui/BackButton'
import Chip from '@/components/ui/Chip'
import ChipRow from '@/components/ui/ChipRow'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import OwnerShopForm from '@/components/owner/OwnerShopForm'
import OwnerCoverUpload from '@/components/owner/OwnerCoverUpload'

const OwnerOverview = dynamic(() => import('@/components/owner/OwnerOverview'))
const OwnerAnalytics = dynamic(() => import('@/components/owner/OwnerAnalytics'))
const OwnerCompare = dynamic(() => import('@/components/owner/OwnerCompare'))

const TABS = [
  { key: 'overview', label: '概要' },
  { key: 'compare', label: '地域比較' },
  { key: 'analytics', label: '訪問者分析' },
  { key: 'info', label: '店舗情報' },
] as const
type Tab = (typeof TABS)[number]['key']

const TAB_STORAGE_KEY = 'shoptutor_owner_tab'

export default function OwnerPage() {
  const router = useRouter()
  const [shop, setShop] = useState<OwnedShop | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    const check = async () => {
      const res = await fetch('/api/owner/check')
      const data = await res.json()

      if (!data.isOwner) {
        router.replace('/')
        return
      }

      try {
        const saved = window.sessionStorage.getItem(TAB_STORAGE_KEY) as Tab | null
        if (saved && TABS.some((t) => t.key === saved)) setTab(saved)
      } catch {
        // 復元できなければ概要から
      }
      setShop(data.shop)
    }
    check()
  }, [router])

  const changeTab = (next: Tab) => {
    setTab(next)
    try {
      window.sessionStorage.setItem(TAB_STORAGE_KEY, next)
    } catch {
      // 保存失敗は無視
    }
    window.scrollTo({ top: 0 })
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col gap-3 max-w-lg mx-auto">
        <SkeletonBlock className="h-8 w-48" />
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="app-header sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 pt-3 flex items-center gap-2">
          <BackButton />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-blue-600 leading-none">オーナー画面</div>
            <div className="text-base font-bold text-slate-900 truncate">{shop.name}</div>
          </div>
          <Link
            href={`/shops/${shop.id}`}
            className="flex-shrink-0 h-8 px-3 rounded-full border border-slate-200 text-xs font-bold text-slate-700 inline-flex items-center gap-1 hover:bg-slate-50"
          >
            店舗ページ
            <ExternalLink size={13} />
          </Link>
        </div>
        <ChipRow className="max-w-lg mx-auto py-2">
          {TABS.map((t) => (
            <Chip key={t.key} selected={tab === t.key} onClick={() => changeTab(t.key)}>
              {t.label}
            </Chip>
          ))}
        </ChipRow>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
        {tab === 'overview' && <OwnerOverview shop={shop} />}
        {tab === 'info' && (
          <>
            <OwnerShopForm shop={shop} />
            <OwnerCoverUpload initialUrls={shop.cover_photo_urls} />
          </>
        )}
        {tab === 'analytics' && <OwnerAnalytics />}
        {tab === 'compare' && <OwnerCompare />}
      </div>
    </div>
  )
}
