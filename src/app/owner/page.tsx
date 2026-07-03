'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { OwnedShop } from '@/lib/owner-auth'
import OwnerShopForm from '@/components/owner/OwnerShopForm'
import OwnerCoverUpload from '@/components/owner/OwnerCoverUpload'
import OwnerAnalytics from '@/components/owner/OwnerAnalytics'
import OwnerReviewSummary from '@/components/owner/OwnerReviewSummary'

export default function OwnerPage() {
  const router = useRouter()
  const [shop, setShop] = useState<OwnedShop | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const check = async () => {
      const res = await fetch('/api/owner/check')
      const data = await res.json()

      if (!data.isOwner) {
        router.replace('/')
        return
      }

      setShop(data.shop)
      setChecking(false)
    }
    check()
  }, [router])

  if (checking || !shop) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <div className="font-bold text-sm">オーナーダッシュボード</div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
        <div className="bg-white rounded-xl border p-3 flex items-center justify-between gap-2">
          <div className="font-bold text-base text-gray-900">{shop.name}</div>
          <Link href={`/shops/${shop.id}`} className="text-xs text-blue-600 hover:underline flex-shrink-0">
            店舗ページを見る →
          </Link>
        </div>
        <OwnerReviewSummary shop={shop} />
        <OwnerShopForm shop={shop} />
        <OwnerCoverUpload initialUrls={shop.cover_photo_urls} />
        <OwnerAnalytics />
      </div>
    </div>
  )
}
