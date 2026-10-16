'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'
import Chip from '@/components/ui/Chip'
import ChipRow from '@/components/ui/ChipRow'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import type { AdminTab, AdminNavigate } from '@/components/admin/types'

const AdminOverview = dynamic(() => import('@/components/admin/AdminOverview'))
const AdminShops = dynamic(() => import('@/components/admin/AdminShops'))
const AdminReviews = dynamic(() => import('@/components/admin/AdminReviews'))
const AdminPhotos = dynamic(() => import('@/components/admin/AdminPhotos'))
const AdminUsers = dynamic(() => import('@/components/admin/AdminUsers'))

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'overview', label: '概要' },
  { key: 'shops', label: '店舗' },
  { key: 'reviews', label: 'レビュー' },
  { key: 'photos', label: '写真' },
  { key: 'users', label: 'ユーザー' },
]

const TAB_STORAGE_KEY = 'shoptutor_admin_tab'

export default function AdminPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState<AdminTab>('overview')
  // 概要の数字から各タブへ移るときの初期の絞り込み
  const [initialFilter, setInitialFilter] = useState<string | null>(null)

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const res = await fetch('/api/admin/check')
      const data = await res.json()

      if (!data.isAdmin) {
        router.replace('/')
        return
      }

      try {
        const saved = window.sessionStorage.getItem(TAB_STORAGE_KEY) as AdminTab | null
        if (saved && TABS.some((t) => t.key === saved)) setTab(saved)
      } catch {
        // 復元できなければ概要から
      }
      setChecking(false)
    }
    check()
  }, [router])

  const changeTab = (next: AdminTab, filter: string | null = null) => {
    setTab(next)
    setInitialFilter(filter)
    try {
      window.sessionStorage.setItem(TAB_STORAGE_KEY, next)
    } catch {
      // 保存失敗は無視
    }
    window.scrollTo({ top: 0 })
  }
  const navigate: AdminNavigate = (next, filter) => changeTab(next, filter ?? null)

  if (checking) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col gap-3 max-w-5xl mx-auto">
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="app-header sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 pt-3 flex items-center gap-2">
          <BackButton />
          <h1 className="font-display text-xl text-slate-900">管理画面</h1>
        </div>
        <ChipRow className="max-w-5xl mx-auto py-2">
          {TABS.map((t) => (
            <Chip key={t.key} selected={tab === t.key} onClick={() => changeTab(t.key)}>
              {t.label}
            </Chip>
          ))}
        </ChipRow>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* 絞り込みを渡し直せるよう、タブ＋初期の絞り込みでキーを変える */}
        {tab === 'overview' && <AdminOverview onNavigate={navigate} />}
        {tab === 'shops' && <AdminShops key={`shops:${initialFilter}`} initialFilter={initialFilter} />}
        {tab === 'reviews' && <AdminReviews key={`reviews:${initialFilter}`} initialFilter={initialFilter} />}
        {tab === 'photos' && <AdminPhotos />}
        {tab === 'users' && <AdminUsers />}
      </div>
    </div>
  )
}
