'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'

const AdminShops = dynamic(() => import('@/components/admin/AdminShops'))
const AdminReviews = dynamic(() => import('@/components/admin/AdminReviews'))
const AdminPhotos = dynamic(() => import('@/components/admin/AdminPhotos'))
const AdminUsers = dynamic(() => import('@/components/admin/AdminUsers'))

const TABS = [
  { key: 'shops', label: '店舗管理' },
  { key: 'reviews', label: 'レビュー管理' },
  { key: 'photos', label: '写真管理' },
  { key: 'users', label: 'ユーザー管理' },
] as const

export default function AdminPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('shops')

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

      setChecking(false)
    }
    check()
  }, [router])

  if (checking) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-2">
          <BackButton />
          <div className="font-bold text-sm">管理画面</div>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {tab === 'shops' && <AdminShops />}
        {tab === 'reviews' && <AdminReviews />}
        {tab === 'photos' && <AdminPhotos />}
        {tab === 'users' && <AdminUsers />}
      </div>
    </div>
  )
}
