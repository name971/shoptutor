'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  ShopListItem,
  FORMAT_FILTER_OPTIONS as FORMATS,
  RECOMMEND_SORT_OPTIONS as SORT_OPTIONS,
} from '@/types'
import { createClient } from '@/lib/supabase'
import ShopCard from '@/components/shop/ShopCard'
import AuthStatus from '@/components/auth/AuthStatus'
import { computeRecommendScores } from '@/lib/recommend'
import type { MapBounds } from '@/components/map/ShopMap'

const ShopMap = dynamic(() => import('@/components/map/ShopMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <p className="text-gray-400 text-sm">地図を読み込み中...</p>
    </div>
  ),
})

const FILTERS_STORAGE_KEY = 'shoptutor_map_filters'

function loadSavedFilters(): {
  selectedFormat: string | null
  wpnOnly: boolean
  meisterOnly: boolean
  searchQuery: string
} | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(FILTERS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function MapPage() {
  const [shops, setShops] = useState<ShopListItem[]>([])
  const [favoriteCounts, setFavoriteCounts] = useState<Map<string, number>>(new Map())
  const [filtered, setFiltered] = useState<ShopListItem[]>([])
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [selectedSort, setSelectedSort] = useState('recommended')
  const [wpnOnly, setWpnOnly] = useState(false)
  const [meisterOnly, setMeisterOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersRestored, setFiltersRestored] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedShop, setSelectedShop] = useState<ShopListItem | null>(null)
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)
  const [focusTarget, setFocusTarget] = useState<{ shop: ShopListItem; ts: number } | null>(null)
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map')

  const focusOnShop = (shop: ShopListItem) => {
    setFocusTarget({ shop, ts: Date.now() })
    setMobileView('map')
  }

  // サーバーとクライアントの初回描画を一致させるため、sessionStorageからの復元は
  // マウント後のuseEffectで行う（useStateの遅延初期化だとSSR/CSRでハイドレーション不整合が起きる）
  useEffect(() => {
    const saved = loadSavedFilters()
    if (saved) {
      setSelectedFormat(saved.selectedFormat ?? null)
      setWpnOnly(saved.wpnOnly ?? false)
      setMeisterOnly(saved.meisterOnly ?? false)
      setSearchQuery(saved.searchQuery ?? '')
    }
    setFiltersRestored(true)
  }, [])

  useEffect(() => {
    if (!filtersRestored) return
    try {
      window.sessionStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({ selectedFormat, wpnOnly, meisterOnly, searchQuery })
      )
    } catch {
      // 保存失敗は無視
    }
  }, [filtersRestored, selectedFormat, wpnOnly, meisterOnly, searchQuery])

  useEffect(() => {
    const fetchShops = async () => {
      const supabase = createClient()
      const [{ data }, { data: favData }] = await Promise.all([
        supabase
          .from('shops')
          .select(
            'id, name, address, prefecture, lat, lng, is_wpn_premium, is_teaching_meister, is_premium, pr_enabled, first_listed_at, weekly_event_count, commander_count, standard_count, modern_count, pioneer_count, legacy_count, limited_count, review_count, avg_total, view_count'
          )
          .eq('status', 'active'),
        supabase.from('shop_favorites').select('shop_id'),
      ])
      if (data) {
        setShops(data)
        setFiltered(data)
      }
      if (favData) {
        const counts = new Map<string, number>()
        favData.forEach((f) => counts.set(f.shop_id, (counts.get(f.shop_id) ?? 0) + 1))
        setFavoriteCounts(counts)
      }
      setLoading(false)
    }
    fetchShops()
  }, [])

  const recommendScores = useMemo(
    () => computeRecommendScores(shops, favoriteCounts),
    [shops, favoriteCounts]
  )

  useEffect(() => {
    let result = [...shops]

    const query = searchQuery.trim().toLowerCase()
    if (query) {
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.prefecture.toLowerCase().includes(query) ||
          s.address.toLowerCase().includes(query)
      )
    }

    if (selectedFormat) {
      const key = `${selectedFormat}_count`
      result = result.filter((s) => (s as any)[key] > 0)
    }

    if (wpnOnly) {
      result = result.filter((s) => s.is_wpn_premium)
    }

    if (meisterOnly) {
      result = result.filter((s) => s.is_teaching_meister)
    }

    result.sort((a, b) => {
      if (selectedSort === 'recommended') {
        return (recommendScores.get(b.id) ?? 0) - (recommendScores.get(a.id) ?? 0)
      }
      if (selectedSort === 'event')   return b.weekly_event_count - a.weekly_event_count
      if (selectedSort === 'rating')  return (b.avg_total ?? 0) - (a.avg_total ?? 0)
      return 0
    })

    setFiltered(result)
  }, [shops, searchQuery, selectedFormat, wpnOnly, meisterOnly, selectedSort, recommendScores])

  const inBounds = (s: ShopListItem) =>
    !mapBounds ||
    (s.lat !== null &&
      s.lng !== null &&
      s.lat <= mapBounds.north &&
      s.lat >= mapBounds.south &&
      s.lng <= mapBounds.east &&
      s.lng >= mapBounds.west)

  const visibleInList = filtered.filter(inBounds)

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-3 z-10">
        <div className="font-bold text-base text-gray-800">地図</div>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="店舗名・エリアで検索"
          className="flex-1 bg-gray-100 rounded-lg px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
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
        <div className="flex items-center gap-2 pl-2 ml-1 border-l border-gray-200 flex-shrink-0">
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
          <button
            onClick={() => setMeisterOnly(!meisterOnly)}
            className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition-colors ${
              meisterOnly
                ? 'bg-orange-50 border-orange-400 text-orange-700'
                : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            マイスター
          </button>
        </div>
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

      {/* スマホ用：地図／リスト切り替えタブ */}
      <div className="flex md:hidden border-b bg-white">
        <button
          onClick={() => setMobileView('map')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            mobileView === 'map' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'
          }`}
        >
          地図
        </button>
        <button
          onClick={() => setMobileView('list')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            mobileView === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'
          }`}
        >
          リスト（{visibleInList.length}）
        </button>
      </div>

      {/* マップ＋リスト */}
      <div className="flex-1 flex overflow-hidden">
        {/* マップ */}
        <div className={`flex-1 relative ${mobileView === 'list' ? 'hidden md:block' : ''}`}>
          {!loading && (
            <ShopMap
              shops={filtered}
              visibleCount={visibleInList.length}
              onShopSelect={setSelectedShop}
              onBoundsChange={setMapBounds}
              focusShop={focusTarget?.shop}
              focusToken={focusTarget?.ts}
            />
          )}
        </div>

        {/* 店舗リスト */}
        <div
          className={`w-full md:w-80 border-l bg-gray-50 overflow-y-auto ${
            mobileView === 'map' ? 'hidden md:block' : ''
          }`}
        >
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
                <ShopCard
                  key={shop.id}
                  shop={shop}
                  isPr={shop.is_premium && shop.pr_enabled}
                  showPrefecture={false}
                  onClick={() => focusOnShop(shop)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
