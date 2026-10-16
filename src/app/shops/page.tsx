'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  ShopListItem,
  FORMAT_FILTER_OPTIONS as FORMATS,
  RECOMMEND_SORT_OPTIONS as SORT_OPTIONS,
  FORMAT_HEX,
  FORMAT_LABELS,
} from '@/types'
import { createClient } from '@/lib/supabase'
import ShopCard from '@/components/shop/ShopCard'
import { SkeletonList } from '@/components/ui/Skeleton'
import AuthStatus from '@/components/auth/AuthStatus'
import { computeRecommendScores } from '@/lib/recommend'
import { cached, peekCached } from '@/lib/clientCache'
import { getFormatCount } from '@/lib/shopFormat'
import Chip from '@/components/ui/Chip'
import ChipRow from '@/components/ui/ChipRow'
import BottomSheet from '@/components/ui/BottomSheet'
import { Search, SlidersHorizontal, X, ChevronDown, ChevronLeft, List, Map as MapIcon, Info } from 'lucide-react'
import type { MapBounds } from '@/components/map/ShopMap'
import { REGIONS, cityOf } from '@/lib/area'
import AreaPicker from '@/components/shop/AreaPicker'

const ShopMap = dynamic(() => import('@/components/map/ShopMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <p className="text-gray-400 text-sm">地図を読み込み中...</p>
    </div>
  ),
})

type View = 'list' | 'map'

const PAGE_SIZE = 20

const FILTERS_STORAGE_KEY = 'shoptutor_shops_filters_v2'
// 前回見た都道府県（次に来たときエリア選択の先頭に出す）。端末に残す
const LAST_PREFECTURE_KEY = 'shoptutor_last_prefecture'
const SHOP_LIST_CACHE_KEY = 'shops:list'
const FAVORITE_COUNTS_CACHE_KEY = 'shops:favorite-counts'

function loadSavedFilters(): {
  prefectureFilter: string | null
  cityFilter?: string | null
  browseAll?: boolean
  expandedRegion: string | null
  selectedFormat: string | null
  wpnOnly: boolean
  meisterOnly: boolean
  searchQuery: string
  visibleCount: number
  view?: View
} | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(FILTERS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function ShopsPage() {
  // タブを移動して戻ってきたときは、保持している一覧ですぐ表示する（読み込み中を出さない）
  const [shops, setShops] = useState<ShopListItem[]>(() => peekCached<ShopListItem[]>(SHOP_LIST_CACHE_KEY) ?? [])
  const [favoriteCounts, setFavoriteCounts] = useState<Map<string, number>>(
    () => peekCached<Map<string, number>>(FAVORITE_COUNTS_CACHE_KEY) ?? new Map()
  )
  const [filtered, setFiltered] = useState<ShopListItem[]>(shops)
  const [prefectureFilter, setPrefectureFilter] = useState<string | null>(null)
  const [cityFilter, setCityFilter] = useState<string | null>(null)
  // エリアを選ばずに全国の一覧を見ている
  const [browseAll, setBrowseAll] = useState(false)
  const [lastPrefecture, setLastPrefecture] = useState<string | null>(null)
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [selectedSort, setSelectedSort] = useState('recommended')
  const [wpnOnly, setWpnOnly] = useState(false)
  const [meisterOnly, setMeisterOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersRestored, setFiltersRestored] = useState(false)
  const [loading, setLoading] = useState(shops.length === 0)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [sheetOpen, setSheetOpen] = useState(false)
  // MTGの店舗は主要な街に集まっているため、地図より先に都道府県から選んでもらう（リスト表示＝エリア選択から始める）
  const [view, setView] = useState<View>('list')
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)
  const [focusTarget, setFocusTarget] = useState<{ shop: ShopListItem; ts: number } | null>(null)
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const [mobileListOpen, setMobileListOpen] = useState(false)
  const isFirstFilterRun = useRef(true)

  // サーバーとクライアントの初回描画を一致させるため、sessionStorageからの復元は
  // マウント後のuseEffectで行う（useStateの遅延初期化だとSSR/CSRでハイドレーション不整合が起きる）
  useEffect(() => {
    const saved = loadSavedFilters()
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ブラウザ保存領域や端末の状態は描画後にしか読めないため（初回描画で読むとSSRと不一致になる）
      setPrefectureFilter(saved.prefectureFilter ?? null)
      setCityFilter(saved.cityFilter ?? null)
      setBrowseAll(saved.browseAll ?? false)
      setExpandedRegion(saved.expandedRegion ?? null)
      setSelectedFormat(saved.selectedFormat ?? null)
      setWpnOnly(saved.wpnOnly ?? false)
      setMeisterOnly(saved.meisterOnly ?? false)
      setSearchQuery(saved.searchQuery ?? '')
      setVisibleCount(saved.visibleCount ?? PAGE_SIZE)
      setView(saved.view ?? 'list')
    }
    try {
      setLastPrefecture(window.localStorage.getItem(LAST_PREFECTURE_KEY))
    } catch {
      // 読めない環境では出さない
    }
    // 旧「地図」タブ（/map）からのリダイレクトは ?view=map で地図表示から始める
    if (new URLSearchParams(window.location.search).get('view') === 'map') {
      setView('map')
    }
    setFiltersRestored(true)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    // 店舗一覧とお気に入り数は数分では変わらないため、タブを移動して戻ってきたときは保持分を使う
    Promise.all([
      cached(SHOP_LIST_CACHE_KEY, 5 * 60 * 1000, async () => {
        const { data, error } = await supabase
          .from('shops')
          .select(
            'id, name, address, prefecture, lat, lng, is_wpn_premium, is_teaching_meister, is_premium, pr_enabled, first_listed_at, weekly_event_count, commander_count, standard_count, modern_count, pioneer_count, legacy_count, limited_count, review_count, avg_total, view_count, cover_photo_urls'
          )
          .eq('status', 'active')
        if (error) throw error
        return (data ?? []) as ShopListItem[]
      }),
      cached(FAVORITE_COUNTS_CACHE_KEY, 5 * 60 * 1000, async () => {
        const { data, error } = await supabase.from('shop_favorite_counts').select('shop_id, favorite_count')
        if (error) throw error
        return new Map((data ?? []).map((r) => [r.shop_id as string, r.favorite_count as number]))
      }).catch(() => new Map<string, number>()),
    ])
      .then(([list, counts]) => {
        setShops(list)
        setFiltered(list)
        setFavoriteCounts(counts)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
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

  // 店舗ごとの市区町村（住所から取り出す）
  const cityById = useMemo(() => new Map(shops.map((s) => [s.id, cityOf(s.address)])), [shops])

  // エリア以外の条件（検索・フォーマット・特徴）で絞った店舗。エリア選択の件数にも使う
  const baseFiltered = useMemo(() => {
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
      result = result.filter((s) => getFormatCount(s, selectedFormat) > 0)
    }

    if (wpnOnly) {
      result = result.filter((s) => s.is_wpn_premium)
    }

    if (meisterOnly) {
      result = result.filter((s) => s.is_teaching_meister)
    }
    return result
  }, [shops, searchQuery, selectedFormat, wpnOnly, meisterOnly])

  useEffect(() => {
    let result = [...baseFiltered]

    if (prefectureFilter) {
      result = result.filter((s) => s.prefecture === prefectureFilter)
      if (cityFilter) result = result.filter((s) => cityById.get(s.id) === cityFilter)
    } else if (expandedRegion) {
      const region = REGIONS.find((r) => r.name === expandedRegion)
      if (region) {
        result = result.filter((s) => region.prefectures.includes(s.prefecture))
      }
    }

    result.sort((a, b) => {
      if (selectedSort === 'recommended') {
        return (recommendScores.get(b.id) ?? 0) - (recommendScores.get(a.id) ?? 0)
      }
      if (selectedSort === 'event')  return b.weekly_event_count - a.weekly_event_count
      if (selectedSort === 'rating') return (b.avg_total ?? 0) - (a.avg_total ?? 0)
      return 0
    })

    // eslint-disable-next-line react-hooks/set-state-in-effect -- ブラウザ保存領域や端末の状態は描画後にしか読めないため（初回描画で読むとSSRと不一致になる）
    setFiltered(result)
    if (shops.length === 0) {
      // データ取得前の初回パスでは何もしない
    } else if (isFirstFilterRun.current) {
      // データ取得後の最初のパスでは、復元したvisibleCountを維持する
      isFirstFilterRun.current = false
    } else {
      setVisibleCount(PAGE_SIZE)
    }
  }, [shops, baseFiltered, prefectureFilter, cityFilter, cityById, expandedRegion, selectedSort, recommendScores])

  useEffect(() => {
    if (!filtersRestored) return
    try {
      window.sessionStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({
          prefectureFilter,
          cityFilter,
          browseAll,
          expandedRegion,
          selectedFormat,
          wpnOnly,
          meisterOnly,
          searchQuery,
          visibleCount,
          view,
        })
      )
    } catch {
      // 保存失敗は無視
    }
  }, [filtersRestored, prefectureFilter, cityFilter, browseAll, expandedRegion, selectedFormat, wpnOnly, meisterOnly, searchQuery, visibleCount, view])

  // エリアを選んだら地図をそのエリアの店舗に合わせる（他の絞り込みでは地図を動かさない）
  const areaShops = useMemo(() => {
    if (prefectureFilter) {
      return shops.filter((s) => s.prefecture === prefectureFilter && (!cityFilter || cityById.get(s.id) === cityFilter))
    }
    if (expandedRegion) {
      const region = REGIONS.find((r) => r.name === expandedRegion)
      return region ? shops.filter((s) => region.prefectures.includes(s.prefecture)) : null
    }
    return null
  }, [shops, prefectureFilter, cityFilter, cityById, expandedRegion])

  const inBounds = (s: ShopListItem) =>
    !mapBounds ||
    (s.lat !== null &&
      s.lng !== null &&
      s.lat <= mapBounds.north &&
      s.lat >= mapBounds.south &&
      s.lng <= mapBounds.east &&
      s.lng >= mapBounds.west)
  const visibleInMap = view === 'map' ? filtered.filter(inBounds) : []
  // 絞り込みで対象外になった店舗は選択解除扱いにする
  const selectedShop = selectedShopId ? filtered.find((s) => s.id === selectedShopId) ?? null : null

  const visibleShops = filtered.slice(0, visibleCount)
  // エリアも検索語もまだ決めていないときは、店舗一覧ではなく都道府県の選択を出す
  const showAreaPicker = view === 'list' && !prefectureFilter && !expandedRegion && !searchQuery.trim() && !browseAll
  const areaLabel = prefectureFilter ?? expandedRegion
  const sheetFilterCount = (areaLabel ? 1 : 0) + (wpnOnly ? 1 : 0) + (meisterOnly ? 1 : 0)
  const sortLabel = SORT_OPTIONS.find((o) => o.key === selectedSort)?.label

  const clearArea = () => {
    setPrefectureFilter(null)
    setCityFilter(null)
    setExpandedRegion(null)
  }

  // 都道府県を選ぶ（市区町村の絞り込みは解除し、次回のために覚えておく）
  const selectPrefecture = (prefecture: string | null) => {
    setPrefectureFilter(prefecture)
    setCityFilter(null)
    setBrowseAll(false)
    if (!prefecture) return
    setExpandedRegion(REGIONS.find((r) => r.prefectures.includes(prefecture))?.name ?? null)
    setLastPrefecture(prefecture)
    try {
      window.localStorage.setItem(LAST_PREFECTURE_KEY, prefecture)
    } catch {
      // 保存できない環境では覚えない
    }
  }

  // エリア選択に戻る
  const backToAreaPicker = () => {
    clearArea()
    setBrowseAll(false)
  }

  // 選んだ都道府県の市区町村（店舗の多い順）
  const cityOptions = useMemo(() => {
    if (!prefectureFilter) return []
    const counts = new Map<string, number>()
    for (const s of baseFiltered) {
      if (s.prefecture !== prefectureFilter) continue
      const city = cityById.get(s.id)
      if (city) counts.set(city, (counts.get(city) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
  }, [baseFiltered, prefectureFilter, cityById])

  const prefectureCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of baseFiltered) counts.set(s.prefecture, (counts.get(s.prefecture) ?? 0) + 1)
    return counts
  }, [baseFiltered])

  const clearSheetFilters = () => {
    clearArea()
    setWpnOnly(false)
    setMeisterOnly(false)
    setSelectedSort('recommended')
  }

  const selectRegion = (name: string) => {
    if (expandedRegion === name) {
      clearArea()
      return
    }
    setExpandedRegion(name)
    setPrefectureFilter(null)
  }

  const header = (
    <div className={`app-header z-10 ${view === 'list' ? 'sticky top-0' : ''}`}>
      <div className={`${view === 'list' ? 'max-w-lg' : ''} mx-auto px-4 pt-2 flex items-center gap-2`}>
        <label className="flex-1 min-w-0 flex items-center gap-2 bg-gray-100 rounded-lg px-3 h-9 focus-within:ring-2 focus-within:ring-blue-300">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="店舗名・エリアで検索"
            aria-label="店舗名・エリアで検索"
            className="flex-1 min-w-0 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} aria-label="検索語を消す" className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
        </label>
        <div className="flex bg-gray-100 rounded-lg p-0.5 flex-shrink-0" role="group" aria-label="表示の切り替え">
          {([
            { key: 'list', label: 'リスト', Icon: List },
            { key: 'map', label: '地図', Icon: MapIcon },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              aria-pressed={view === key}
              aria-label={`${label}で表示`}
              className={`h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                view === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <AuthStatus />
      </div>
      <ChipRow className={`${view === 'list' ? 'max-w-lg' : ''} mx-auto py-2`}>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold border-[1.5px] border-gray-800 text-gray-800 bg-white whitespace-nowrap flex-shrink-0"
        >
          <SlidersHorizontal size={14} />
          絞り込み
          {sheetFilterCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[11px] inline-flex items-center justify-center">
              {sheetFilterCount}
            </span>
          )}
        </button>
        {FORMATS.map((f) => (
          <Chip
            key={f.key}
            selected={selectedFormat === f.key}
            onClick={() => setSelectedFormat(selectedFormat === f.key ? null : f.key)}
          >
            {f.label}
          </Chip>
        ))}
      </ChipRow>
    </div>
  )

  const sheet = (
      <BottomSheet
        open={sheetOpen}
        title="絞り込み"
        onClose={() => setSheetOpen(false)}
        footer={
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <button
              type="button"
              onClick={clearSheetFilters}
              className="h-11 rounded-xl border border-gray-200 text-sm font-bold text-gray-700"
            >
              クリア
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="h-11 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"
            >
              {filtered.length}件を表示
            </button>
          </div>
        }
      >
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-gray-500">エリア</h3>
          <div className="flex flex-wrap gap-2">
            {visibleRegions.map((region) => (
              <Chip key={region.name} selected={expandedRegion === region.name} onClick={() => selectRegion(region.name)}>
                {region.name}
              </Chip>
            ))}
          </div>
          {expandedRegion && (
            <div className="flex flex-wrap gap-2 pl-3 border-l-2 border-blue-100">
              {visibleRegions
                .find((r) => r.name === expandedRegion)
                ?.prefectures.map((p) => (
                  <Chip key={p} selected={prefectureFilter === p} onClick={() => selectPrefecture(prefectureFilter === p ? null : p)}>
                    {p}
                  </Chip>
                ))}
            </div>
          )}
        </section>

        <section className="flex flex-col">
          <h3 className="text-xs font-bold text-gray-500 mb-1">店舗の特徴</h3>
          <Toggle label="WPNプレミアム" checked={wpnOnly} onChange={setWpnOnly} />
          <Toggle label="ティーチングマイスター" checked={meisterOnly} onChange={setMeisterOnly} />
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-gray-500">並び順</h3>
          <div className="flex bg-gray-100 rounded-xl p-1">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setSelectedSort(o.key)}
                aria-pressed={selectedSort === o.key}
                className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors ${
                  selectedSort === o.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                {o.label.replace('順', '')}
              </button>
            ))}
          </div>
        </section>
      </BottomSheet>
  )

  if (view === 'map') {
    const selectShopFromList = (shop: ShopListItem) => {
      setSelectedShopId(shop.id)
      // 同じ店舗を続けて選んでも地図が移動するよう、毎回異なる値を渡す
      setFocusTarget((prev) => ({ shop, ts: (prev?.ts ?? 0) + 1 }))
      setMobileListOpen(false)
    }

    return (
      <div className="h-[calc(100dvh_-_4rem_-_env(safe-area-inset-bottom))] flex flex-col">
        {header}
        <div className="flex-1 flex overflow-hidden">
          {/* Leafletのペイン（z-index 400〜）が絞り込みシートより前に出ないよう、地図を独立した重なり順に閉じ込める */}
          <div className="flex-1 relative isolate">
            {!loading && (
              <ShopMap
                shops={filtered}
                visibleCount={visibleInMap.length}
                onBoundsChange={setMapBounds}
                onShopSelect={(shop) => setSelectedShopId(shop.id)}
                onMapClick={() => setSelectedShopId(null)}
                focusShop={focusTarget?.shop}
                focusToken={focusTarget?.ts}
                fitShops={areaShops}
                selectedShopId={selectedShop?.id ?? null}
                highlightFormat={selectedFormat}
              />
            )}

            <MapLegend format={selectedFormat} />

            {/* ピンを選んだ店舗のプレビュー */}
            {selectedShop ? (
              <div className="absolute z-[1000] bottom-3 inset-x-3 md:right-auto md:w-96">
                <div className="relative shadow-lg rounded-xl">
                  <ShopCard shop={selectedShop} isPr={selectedShop.is_premium && selectedShop.pr_enabled} />
                  <button
                    type="button"
                    onClick={() => setSelectedShopId(null)}
                    aria-label="閉じる"
                    className="absolute -top-3 -right-1 w-8 h-8 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-500"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMobileListOpen(true)}
                className="md:hidden absolute z-[1000] bottom-4 left-1/2 -translate-x-1/2 h-11 px-4 rounded-full bg-white shadow-lg border border-gray-200 text-sm font-bold text-gray-900 inline-flex items-center gap-2 whitespace-nowrap"
              >
                <List size={16} />
                この範囲の店舗 <span className="tabular-nums">{visibleInMap.length}</span>件
              </button>
            )}

            {/* スマホ：表示範囲内の店舗リスト（下から引き出す） */}
            {mobileListOpen && (
              <div className="md:hidden absolute z-[1001] inset-x-0 bottom-0 h-[65%] bg-gray-50 rounded-t-2xl shadow-[0_-8px_24px_rgba(0,0,0,0.18)] flex flex-col">
                <button
                  type="button"
                  onClick={() => setMobileListOpen(false)}
                  className="flex-shrink-0 bg-white rounded-t-2xl border-b px-4 pt-2 pb-3 flex flex-col items-center gap-2"
                  aria-label="リストを閉じる"
                >
                  <span className="h-1 w-9 rounded-full bg-gray-200" />
                  <span className="w-full flex items-center justify-between text-sm">
                    <span className="font-bold text-gray-900">
                      この範囲の店舗 <span className="tabular-nums">{visibleInMap.length}</span>件
                    </span>
                    <ChevronDown size={18} className="text-gray-500" />
                  </span>
                </button>
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                  {visibleInMap.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-8">この範囲に店舗はありません</div>
                  ) : (
                    visibleInMap.slice(0, 100).map((shop) => (
                      <ShopCard
                        key={shop.id}
                        shop={shop}
                        isPr={shop.is_premium && shop.pr_enabled}
                        onClick={() => selectShopFromList(shop)}
                      />
                    ))
                  )}
                  {visibleInMap.length > 100 && (
                    <p className="text-center text-xs text-gray-500 py-2">地図を拡大すると、残り{visibleInMap.length - 100}件も表示されます</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* PC幅では地図の右に表示範囲内の店舗を並べる */}
          <div className="hidden md:block w-80 border-l bg-gray-50 overflow-y-auto">
            <div className="px-3 py-2 text-xs text-gray-600 border-b bg-white">
              表示中の範囲 <span className="font-bold text-gray-900 tabular-nums">{visibleInMap.length}</span>件
            </div>
            <div className="p-2 flex flex-col gap-2">
              {visibleInMap.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8">この範囲に店舗はありません</div>
              ) : (
                visibleInMap.map((shop) => (
                  <ShopCard
                    key={shop.id}
                    shop={shop}
                    isPr={shop.is_premium && shop.pr_enabled}
                    showPrefecture={false}
                    onClick={() => selectShopFromList(shop)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
        {sheet}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {header}

      {showAreaPicker ? (
        <AreaPicker
          regions={visibleRegions}
          counts={prefectureCounts}
          total={baseFiltered.length}
          loading={loading}
          lastPrefecture={lastPrefecture && availablePrefectureSet.has(lastPrefecture) ? lastPrefecture : null}
          onSelect={selectPrefecture}
          onBrowseAll={() => setBrowseAll(true)}
        />
      ) : (
      <div className="max-w-lg mx-auto px-4 py-3 flex flex-col gap-3">
        {/* 選んだエリア（戻るとエリア選択へ） */}
        {(areaLabel || browseAll) && !searchQuery.trim() && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={backToAreaPicker}
                className="-ml-2 h-9 pl-1 pr-2 inline-flex items-center gap-0.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
              >
                <ChevronLeft size={18} />
                エリア
              </button>
              <h2 className="font-display text-xl text-gray-900">{areaLabel ?? '全国'}</h2>
            </div>
            {cityOptions.length > 1 && (
              <ChipRow>
                <Chip selected={cityFilter === null} onClick={() => setCityFilter(null)}>
                  すべて
                </Chip>
                {cityOptions.map(([city, n]) => (
                  <Chip key={city} selected={cityFilter === city} onClick={() => setCityFilter(cityFilter === city ? null : city)}>
                    {city}
                    <span className="ml-1 tabular-nums opacity-70">{n}</span>
                  </Chip>
                ))}
              </ChipRow>
            )}
          </div>
        )}

        {/* 絞り込み中の条件（✕で個別に解除）。エリアは上の見出しで分かるので、検索中だけ出す */}
        {(wpnOnly || meisterOnly || (areaLabel && searchQuery.trim())) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {areaLabel && searchQuery.trim() && <ActiveFilter label={areaLabel} onRemove={clearArea} />}
            {wpnOnly && <ActiveFilter label="WPNプレミアム" onRemove={() => setWpnOnly(false)} />}
            {meisterOnly && <ActiveFilter label="マイスター" onRemove={() => setMeisterOnly(false)} />}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            {cityFilter ?? areaLabel ?? '全国'}の店舗
            {!loading && (
              <>
                {' '}<span className="font-bold text-gray-900 tabular-nums">{filtered.length}</span>件
              </>
            )}
          </span>
          <button type="button" onClick={() => setSheetOpen(true)} className="inline-flex items-center gap-0.5 py-1 hover:text-gray-900">
            {sortLabel}
            <ChevronDown size={14} />
          </button>
        </div>

        {loading ? (
          <SkeletonList kind="shop" />
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8 flex flex-col items-center gap-3">
            店舗が見つかりませんでした
            {(sheetFilterCount > 0 || selectedFormat || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  clearSheetFilters()
                  setSelectedFormat(null)
                  setSearchQuery('')
                }}
                className="text-blue-600 text-sm font-medium"
              >
                条件をすべてクリア
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {visibleShops.map((shop) => (
                <ShopCard key={shop.id} shop={shop} isPr={shop.is_premium && shop.pr_enabled} showPrefecture={prefectureFilter === null} />
              ))}
            </div>
            {filtered.length > visibleCount && (
              <button
                onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                className="w-full h-11 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                もっと見る（残り{filtered.length - visibleCount}件）
              </button>
            )}
          </>
        )}
      </div>
      )}

      {sheet}
    </div>
  )
}

function ActiveFilter({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`${label}の絞り込みを解除`}
      className="inline-flex items-center gap-1 h-7 pl-3 pr-2 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
    >
      {label}
      <X size={14} />
    </button>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between py-3 border-b border-gray-100 text-sm text-gray-800"
    >
      {label}
      <span className={`relative w-10 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}

function MapLegend({ format }: { format: string | null }) {
  const [open, setOpen] = useState(false)

  if (format) {
    return (
      <div className="absolute z-[1000] top-3 left-3 max-w-[calc(100%-5rem)] bg-white/95 rounded-xl shadow-md border border-gray-200 px-3 py-2 text-xs text-gray-700 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: FORMAT_HEX[format] }} />
        数字＝{FORMAT_LABELS[format]}の週の開催回数
      </div>
    )
  }

  return (
    <div className="absolute z-[1000] top-3 left-3 max-w-[calc(100%-5rem)] bg-white/95 rounded-xl shadow-md border border-gray-200 text-xs text-gray-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="px-3 py-2 flex items-center gap-1.5"
      >
        <Info size={14} className="text-gray-400" />
        数字＝週のイベント数
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-2.5 flex flex-col gap-1.5">
          <div className="text-gray-500">色＝その店で一番多いフォーマット</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {FORMATS.map((f) => (
              <span key={f.key} className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: FORMAT_HEX[f.key] }} />
                {f.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
              イベントなし
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
