'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ShopListItem } from '@/types'
import { createClient } from '@/lib/supabase'
import ShopCard from '@/components/shop/ShopCard'
import AuthStatus from '@/components/auth/AuthStatus'
import { computeRecommendScores } from '@/lib/recommend'

const REGIONS = [
  { name: '北海道・東北', prefectures: ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'] },
  { name: '関東', prefectures: ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'] },
  { name: '甲信越・北陸', prefectures: ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県'] },
  { name: '東海', prefectures: ['岐阜県', '静岡県', '愛知県', '三重県'] },
  { name: '関西', prefectures: ['滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'] },
  { name: '中国', prefectures: ['鳥取県', '島根県', '岡山県', '広島県', '山口県'] },
  { name: '四国', prefectures: ['徳島県', '香川県', '愛媛県', '高知県'] },
  { name: '九州・沖縄', prefectures: ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'] },
]

const FORMATS = [
  { key: 'commander', label: 'コマンダー' },
  { key: 'standard',  label: 'スタンダード' },
  { key: 'modern',    label: 'モダン' },
  { key: 'pioneer',   label: 'パイオニア' },
  { key: 'legacy',    label: 'レガシー' },
  { key: 'limited',   label: 'リミテッド' },
]

const SORT_OPTIONS = [
  { key: 'recommended', label: 'おすすめ順' },
  { key: 'rating',  label: '評価順' },
  { key: 'event',   label: 'イベント数順' },
]

const PAGE_SIZE = 20

const FILTERS_STORAGE_KEY = 'shoptutor_home_filters'

function loadSavedFilters(): {
  prefectureFilter: string | null
  expandedRegion: string | null
  selectedFormat: string | null
  wpnOnly: boolean
  meisterOnly: boolean
  searchQuery: string
  visibleCount: number
} | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(FILTERS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function HomePage() {
  const [shops, setShops] = useState<ShopListItem[]>([])
  const [favoriteCounts, setFavoriteCounts] = useState<Map<string, number>>(new Map())
  const [filtered, setFiltered] = useState<ShopListItem[]>([])
  const [prefectureFilter, setPrefectureFilter] = useState<string | null>(null)
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [selectedSort, setSelectedSort] = useState('recommended')
  const [wpnOnly, setWpnOnly] = useState(false)
  const [meisterOnly, setMeisterOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersRestored, setFiltersRestored] = useState(false)
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const isFirstFilterRun = useRef(true)

  // サーバーとクライアントの初回描画を一致させるため、sessionStorageからの復元は
  // マウント後のuseEffectで行う（useStateの遅延初期化だとSSR/CSRでハイドレーション不整合が起きる）
  useEffect(() => {
    const saved = loadSavedFilters()
    if (saved) {
      setPrefectureFilter(saved.prefectureFilter ?? null)
      setExpandedRegion(saved.expandedRegion ?? null)
      setSelectedFormat(saved.selectedFormat ?? null)
      setWpnOnly(saved.wpnOnly ?? false)
      setMeisterOnly(saved.meisterOnly ?? false)
      setSearchQuery(saved.searchQuery ?? '')
      setVisibleCount(saved.visibleCount ?? PAGE_SIZE)
    }
    setFiltersRestored(true)
  }, [])

  useEffect(() => {
    const fetchShops = async () => {
      const supabase = createClient()
      const [{ data }, { data: favData }] = await Promise.all([
        supabase
          .from('shops')
          .select(
            'id, name, address, prefecture, lat, lng, is_wpn_premium, is_teaching_meister, first_listed_at, weekly_event_count, commander_count, standard_count, modern_count, pioneer_count, legacy_count, limited_count, review_count, avg_total, view_count'
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

  const availablePrefectureSet = useMemo(
    () => new Set(shops.map((s) => s.prefecture)),
    [shops]
  )

  const visibleRegions = useMemo(
    () =>
      REGIONS.map((r) => ({
        name: r.name,
        prefectures: r.prefectures.filter((p) => availablePrefectureSet.has(p)),
      })).filter((r) => r.prefectures.length > 0),
    [availablePrefectureSet]
  )

  useEffect(() => {
    let result = [...shops]

    if (prefectureFilter) {
      result = result.filter((s) => s.prefecture === prefectureFilter)
    } else if (expandedRegion) {
      const region = REGIONS.find((r) => r.name === expandedRegion)
      if (region) {
        result = result.filter((s) => region.prefectures.includes(s.prefecture))
      }
    }

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
      if (selectedSort === 'event')  return b.weekly_event_count - a.weekly_event_count
      if (selectedSort === 'rating') return (b.avg_total ?? 0) - (a.avg_total ?? 0)
      return 0
    })

    setFiltered(result)
    if (shops.length === 0) {
      // データ取得前の初回パスでは何もしない
    } else if (isFirstFilterRun.current) {
      // データ取得後の最初のパスでは、復元したvisibleCountを維持する
      isFirstFilterRun.current = false
    } else {
      setVisibleCount(PAGE_SIZE)
    }
  }, [shops, prefectureFilter, expandedRegion, searchQuery, selectedFormat, wpnOnly, meisterOnly, selectedSort, recommendScores])

  useEffect(() => {
    if (!filtersRestored) return
    try {
      window.sessionStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({
          prefectureFilter,
          expandedRegion,
          selectedFormat,
          wpnOnly,
          meisterOnly,
          searchQuery,
          visibleCount,
        })
      )
    } catch {
      // 保存失敗は無視
    }
  }, [filtersRestored, prefectureFilter, expandedRegion, selectedFormat, wpnOnly, meisterOnly, searchQuery, visibleCount])

  const visibleShops = filtered.slice(0, visibleCount)
  const formatLabel = FORMATS.find((f) => f.key === selectedFormat)?.label

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-3 sticky top-0 z-10">
        <div className="font-bold text-base text-gray-800">ShopTutor</div>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="店舗名・エリアで検索"
          className="flex-1 bg-gray-100 rounded-lg px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
        <AuthStatus />
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
        {/* エリアから探す */}
        <div className="bg-white rounded-xl border p-3">
          <div className="font-medium text-sm mb-2">📍 エリアから探す</div>
          <div className="flex flex-wrap gap-1.5">
            {visibleRegions.map((region) => (
              <button
                key={region.name}
                onClick={() => setExpandedRegion(expandedRegion === region.name ? null : region.name)}
                className={`px-3 py-1.5 rounded-full text-xs border whitespace-nowrap transition-colors ${
                  expandedRegion === region.name
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : region.prefectures.includes(prefectureFilter ?? '')
                      ? 'bg-blue-50 border-blue-400 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {region.name}
              </button>
            ))}
          </div>

          {expandedRegion && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t">
              {visibleRegions
                .find((r) => r.name === expandedRegion)
                ?.prefectures.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPrefectureFilter(prefectureFilter === p ? null : p)}
                    className={`px-2.5 py-1 rounded-full text-xs border whitespace-nowrap transition-colors ${
                      prefectureFilter === p
                        ? 'bg-blue-50 border-blue-400 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* フォーマットから探す */}
        <div className="bg-white rounded-xl border p-3">
          <div className="font-medium text-sm mb-2">🎴 フォーマットから探す</div>
          <div className="flex flex-wrap gap-1.5">
            {FORMATS.map((f) => (
              <button
                key={f.key}
                onClick={() => setSelectedFormat(selectedFormat === f.key ? null : f.key)}
                className={`px-3 py-1.5 rounded-full text-xs border whitespace-nowrap transition-colors ${
                  selectedFormat === f.key
                    ? 'bg-blue-50 border-blue-400 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 現在の絞り込み＋二次フィルター */}
        <div className="flex items-center gap-2 flex-wrap">
          {(prefectureFilter || expandedRegion || formatLabel) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {prefectureFilter ? (
                <button
                  onClick={() => setPrefectureFilter(null)}
                  className="px-2.5 py-1 rounded-full text-xs bg-blue-600 text-white flex items-center gap-1"
                >
                  {prefectureFilter} ✕
                </button>
              ) : (
                expandedRegion && (
                  <button
                    onClick={() => setExpandedRegion(null)}
                    className="px-2.5 py-1 rounded-full text-xs bg-blue-600 text-white flex items-center gap-1"
                  >
                    {expandedRegion} ✕
                  </button>
                )
              )}
              {formatLabel && (
                <button
                  onClick={() => setSelectedFormat(null)}
                  className="px-2.5 py-1 rounded-full text-xs bg-blue-600 text-white flex items-center gap-1"
                >
                  {formatLabel} ✕
                </button>
              )}
            </div>
          )}
          <button
            onClick={() => setWpnOnly(!wpnOnly)}
            className={`px-2.5 py-1 rounded-full text-xs border whitespace-nowrap transition-colors ${
              wpnOnly
                ? 'bg-yellow-50 border-yellow-400 text-yellow-700'
                : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            WPNプレミアム
          </button>
          <button
            onClick={() => setMeisterOnly(!meisterOnly)}
            className={`px-2.5 py-1 rounded-full text-xs border whitespace-nowrap transition-colors ${
              meisterOnly
                ? 'bg-orange-50 border-orange-400 text-orange-700'
                : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            マイスター
          </button>
          <select
            value={selectedSort}
            onChange={(e) => setSelectedSort(e.target.value)}
            className="ml-auto text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 flex-shrink-0"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 店舗一覧 */}
        <div>
          <div className="text-xs text-gray-500 mb-2">
            {prefectureFilter ?? expandedRegion ?? '全国'}のおすすめ店舗　{filtered.length}件
          </div>

          {loading ? (
            <div className="text-center text-gray-400 text-sm py-8">読み込み中...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8">店舗が見つかりませんでした</div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {visibleShops.map((shop) => (
                  <ShopCard key={shop.id} shop={shop} showPrefecture={prefectureFilter === null} />
                ))}
              </div>
              {filtered.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                  className="w-full text-center text-sm text-blue-600 hover:underline mt-4 py-2"
                >
                  もっと見る
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
