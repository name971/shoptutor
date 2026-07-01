'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Shop } from '@/types'
import { createClient } from '@/lib/supabase'
import ShopCard from '@/components/shop/ShopCard'
import AuthStatus from '@/components/auth/AuthStatus'
import type { MapBounds } from '@/components/map/ShopMap'

const ShopMap = dynamic(() => import('@/components/map/ShopMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <p className="text-gray-400 text-sm">地図を読み込み中...</p>
    </div>
  ),
})

const FORMATS = [
  { key: 'commander', label: 'コマンダー' },
  { key: 'standard',  label: 'スタンダード' },
  { key: 'modern',    label: 'モダン' },
  { key: 'pioneer',   label: 'パイオニア' },
  { key: 'legacy',    label: 'レガシー' },
  { key: 'limited',   label: 'リミテッド' },
]

const SORT_OPTIONS = [
  { key: 'event',   label: 'イベント数順' },
  { key: 'rating',  label: '評価順' },
]

export default function MapPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [filtered, setFiltered] = useState<Shop[]>([])
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [selectedSort, setSelectedSort] = useState('event')
  const [wpnOnly, setWpnOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)

  useEffect(() => {
    const fetchShops = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('shops')
        .select('*')
        .eq('status', 'active')
      if (data) {
        setShops(data)
        setFiltered(data)
      }
      setLoading(false)
    }
    fetchShops()
  }, [])

  useEffect(() => {
    let result = [...shops]

    if (selectedFormat) {
      const key = `${selectedFormat}_count`
      result = result.filter((s) => (s as any)[key] > 0)
    }

    if (wpnOnly) {
      result = result.filter((s) => s.is_wpn_premium)
    }

    result.sort((a, b) => {
      if (selectedSort === 'event')   return b.weekly_event_count - a.weekly_event_count
      if (selectedSort === 'rating')  return (b.avg_total ?? 0) - (a.avg_total ?? 0)
      return 0
    })

    setFiltered(result)
  }, [shops, selectedFormat, wpnOnly, selectedSort])

  const visibleInList = mapBounds
    ? filtered.filter(
        (s) =>
          s.lat !== null &&
          s.lng !== null &&
          s.lat <= mapBounds.north &&
          s.lat >= mapBounds.south &&
          s.lng <= mapBounds.east &&
          s.lng >= mapBounds.west
      )
    : filtered

  return (
    <div className="h-screen flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-3 z-10">
        <div className="font-bold text-base text-gray-800">ShopTutor</div>
        <div className="flex-1 bg-gray-100 rounded-lg px-3 py-1.5 text-sm text-gray-400">
          店舗名・エリアで検索
        </div>
        <Link href="/favorites" className="text-xs font-medium text-gray-500 whitespace-nowrap">
          ★ お気に入り
        </Link>
        <AuthStatus />
      </div>

      {/* フィルター */}
      <div className="bg-white border-b px-4 py-2 flex gap-2 overflow-x-auto z-10">
        {FORMATS.map((f) => (
          <button
            key={f.key}
            onClick={() => setSelectedFormat(selectedFormat === f.key ? null : f.key)}
            className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition-colors ${
              selectedFormat === f.key
                ? 'bg-blue-50 border-blue-400 text-blue-700'
                : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setWpnOnly(!wpnOnly)}
          className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition-colors ${
            wpnOnly
              ? 'bg-yellow-50 border-yellow-400 text-yellow-700'
              : 'bg-white border-gray-200 text-gray-600'
          }`}
        >
          WPNプレミアム
        </button>
        <select
          value={selectedSort}
          onChange={(e) => setSelectedSort(e.target.value)}
          className="ml-auto text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* マップ＋リスト */}
      <div className="flex-1 flex overflow-hidden">
        {/* マップ */}
        <div className="flex-1 relative">
          {!loading && (
            <ShopMap
              shops={filtered}
              onShopSelect={setSelectedShop}
              onBoundsChange={setMapBounds}
            />
          )}
        </div>

        {/* 店舗リスト */}
        <div className="w-80 border-l bg-gray-50 overflow-y-auto">
          <div className="px-3 py-2 text-xs text-gray-500 border-b bg-white">
            {visibleInList.length}件表示（表示中の地図範囲）
          </div>
          <div className="p-2 flex flex-col gap-2">
            {loading ? (
              <div className="text-center text-gray-400 text-sm py-8">読み込み中...</div>
            ) : visibleInList.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">店舗が見つかりませんでした</div>
            ) : (
              visibleInList.map((shop) => (
                <ShopCard key={shop.id} shop={shop} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}