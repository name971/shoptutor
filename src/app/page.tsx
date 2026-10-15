'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ShopListItem,
  FORMAT_FILTER_OPTIONS as FORMATS,
  RECOMMEND_SORT_OPTIONS as SORT_OPTIONS,
} from '@/types'
import { createClient } from '@/lib/supabase'
import ShopCard from '@/components/shop/ShopCard'
import AuthStatus from '@/components/auth/AuthStatus'
import { computeRecommendScores } from '@/lib/recommend'
import Chip from '@/components/ui/Chip'
import BottomSheet from '@/components/ui/BottomSheet'
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react'

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
  const [sheetOpen, setSheetOpen] = useState(false)
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
  const areaLabel = prefectureFilter ?? expandedRegion
  const sheetFilterCount = (areaLabel ? 1 : 0) + (wpnOnly ? 1 : 0) + (meisterOnly ? 1 : 0)
  const sortLabel = SORT_OPTIONS.find((o) => o.key === selectedSort)?.label

  const clearArea = () => {
    setPrefectureFilter(null)
    setExpandedRegion(null)
  }

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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー：検索＋フォーマット1段＋絞り込みボタン */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 pt-2 flex items-center gap-3">
          <div className="font-bold text-base text-gray-900 whitespace-nowrap">ShopTutor</div>
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
          <AuthStatus />
        </div>
        <div className="max-w-lg mx-auto px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold border-[1.5px] border-gray-800 text-gray-800 bg-white whitespace-nowrap flex-shrink-0"
          >
            <SlidersHorizontal size={14} />
            絞り込み
            {sheetFilterCount > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] inline-flex items-center justify-center">
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
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-3 flex flex-col gap-3">
        {/* 絞り込み中の条件（✕で個別に解除） */}
        {sheetFilterCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {areaLabel && <ActiveFilter label={areaLabel} onRemove={clearArea} />}
            {wpnOnly && <ActiveFilter label="WPNプレミアム" onRemove={() => setWpnOnly(false)} />}
            {meisterOnly && <ActiveFilter label="マイスター" onRemove={() => setMeisterOnly(false)} />}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            {areaLabel ?? '全国'}の店舗
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
          <div className="text-center text-gray-400 text-sm py-8">読み込み中...</div>
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
                  <Chip key={p} selected={prefectureFilter === p} onClick={() => setPrefectureFilter(prefectureFilter === p ? null : p)}>
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
