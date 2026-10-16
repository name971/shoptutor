'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { haversineDistanceKm } from '@/lib/geo'
import { cached } from '@/lib/clientCache'
import {
  jstDateKey,
  jstTimeKey,
  addDaysToKey,
  weekdayOfKey,
  formatDayHeading,
} from '@/lib/eventTime'
import { FORMAT_FILTER_OPTIONS_WITH_OTHER as FORMATS, FORMAT_LABELS, OTHER_FORMAT_KEYS } from '@/types'
import EventRow from '@/components/event/EventRow'
import { SkeletonList } from '@/components/ui/Skeleton'
import { groupByDate } from '@/lib/groupByDate'
import EventNotice from '@/components/shared/EventNotice'
import Chip from '@/components/ui/Chip'
import ChipRow from '@/components/ui/ChipRow'
import AuthStatus from '@/components/auth/AuthStatus'
import { LocateFixed, MapPin, X, Store } from 'lucide-react'

const RADIUS_OPTIONS = [
  { key: '3', label: '3km', km: 3 },
  { key: '5', label: '5km', km: 5 },
  { key: '10', label: '10km', km: 10 },
  { key: 'all', label: '制限なし', km: null },
] as const

type RadiusKey = (typeof RADIUS_OPTIONS)[number]['key']

const PERIODS = [
  { key: 'today', label: '今日' },
  { key: 'tomorrow', label: '明日' },
  { key: 'weekend', label: '今週末' },
  { key: 'week', label: '7日間' },
] as const

type PeriodKey = (typeof PERIODS)[number]['key']

// Supabaseの1回の取得上限（既定1000件）を超えないよう、ページ単位で取得する
const PAGE_SIZE = 50

// 距離の計算に使う店舗の座標（現在地を使うときだけ取得する）
type ShopCoord = {
  id: string
  lat: number | null
  lng: number | null
}

type EventItem = {
  id: string
  shop_id: string
  title: string
  format: string
  held_at: string
  start_time: string | null
  // 店名・都道府県はイベントと一緒に取得する（全店舗の一覧を別に取らずに済む）
  shops: { name: string; prefecture: string } | null
}

const FILTERS_STORAGE_KEY = 'shoptutor_home_events_filters'
// 「現在地を使う」を一度押したユーザーは、次回以降は説明カードを出さずに位置情報を取得する
const LOCATION_OPT_IN_KEY = 'shoptutor_location_opt_in'
const LOCATION_SKIPPED_KEY = 'shoptutor_location_skipped'

// 現在地はページを再読み込みするまでメモリ上に保持する（保存はしない）
let lastKnownLocation: { lat: number; lng: number } | null = null

type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'skipped' | 'unsupported'

function loadSavedFilters(): {
  radiusKey: RadiusKey
  selectedFormat: string | null
  period: PeriodKey
} | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(FILTERS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// 期間の開始日・終了日（JSTの日付キー）
function periodRange(period: PeriodKey): { from: string; to: string } {
  const today = jstDateKey()
  if (period === 'today') return { from: today, to: today }
  if (period === 'tomorrow') {
    const tomorrow = addDaysToKey(today, 1)
    return { from: tomorrow, to: tomorrow }
  }
  if (period === 'weekend') {
    const weekday = weekdayOfKey(today)
    if (weekday === 0) return { from: today, to: today }
    const saturday = addDaysToKey(today, 6 - weekday)
    return { from: saturday, to: addDaysToKey(saturday, 1) }
  }
  return { from: today, to: addDaysToKey(today, 6) }
}

export default function HomePage() {
  // 同じ訪問中にタブを移動して戻ってきたときは、前回の現在地をそのまま使う（取り直しによる二重取得を防ぐ）
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(() => lastKnownLocation)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>(() => (lastKnownLocation ? 'granted' : 'idle'))
  const [radiusKey, setRadiusKey] = useState<RadiusKey>('5')
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [formatFromProfile, setFormatFromProfile] = useState(false)
  const [period, setPeriod] = useState<PeriodKey>('today')
  const [filtersRestored, setFiltersRestored] = useState(false)
  const [shopCoords, setShopCoords] = useState<ShopCoord[] | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestIdRef = useRef(0)

  // サーバーとクライアントの初回描画を一致させるため、sessionStorageからの復元は
  // マウント後のuseEffectで行う（useStateの遅延初期化だとSSR/CSRでハイドレーション不整合が起きる）
  useEffect(() => {
    const saved = loadSavedFilters()
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ブラウザ保存領域や端末の状態は描画後にしか読めないため（初回描画で読むとSSRと不一致になる）
      setRadiusKey(saved.radiusKey ?? '5')
      setSelectedFormat(saved.selectedFormat ?? null)
      setPeriod(saved.period ?? 'today')
      setFiltersRestored(true)
      return
    }
    // 保存済みの条件がなければ、ログインユーザーのメインフォーマットで最初から絞り込む
    const preselectMainFormat = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('main_format')
            .eq('id', user.id)
            .maybeSingle()
          const mainFormat = profile?.main_format
          if (mainFormat && FORMATS.some((f) => f.key === mainFormat)) {
            setSelectedFormat(mainFormat)
            setFormatFromProfile(true)
          }
        }
      } finally {
        setFiltersRestored(true)
      }
    }
    preselectMainFormat()
  }, [])

  useEffect(() => {
    if (!filtersRestored) return
    try {
      window.sessionStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({ radiusKey, selectedFormat, period })
      )
    } catch {
      // 保存失敗は無視
    }
  }, [filtersRestored, radiusKey, selectedFormat, period])

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported')
      return
    }
    setLocationStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastKnownLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLocation(lastKnownLocation)
        setLocationStatus('granted')
        try {
          localStorage.setItem(LOCATION_OPT_IN_KEY, '1')
          localStorage.removeItem(LOCATION_SKIPPED_KEY)
        } catch {
          // 保存失敗は無視
        }
      },
      () => setLocationStatus('denied')
    )
  }

  const skipLocation = () => {
    setLocationStatus('skipped')
    try {
      localStorage.setItem(LOCATION_SKIPPED_KEY, '1')
    } catch {
      // 保存失敗は無視
    }
  }

  // いきなり許可ダイアログを出さず、以前に許可済みの場合のみ自動で取得する
  useEffect(() => {
    if (lastKnownLocation) return
    if (!navigator.geolocation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ブラウザ保存領域や端末の状態は描画後にしか読めないため（初回描画で読むとSSRと不一致になる）
      setLocationStatus('unsupported')
      return
    }
    let optedIn = false
    let skipped = false
    try {
      optedIn = localStorage.getItem(LOCATION_OPT_IN_KEY) === '1'
      skipped = localStorage.getItem(LOCATION_SKIPPED_KEY) === '1'
    } catch {
      // 読み込み失敗は未設定として扱う
    }
    if (optedIn) {
      requestLocation()
      return
    }
    if (skipped) {
      setLocationStatus('skipped')
      return
    }
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((result) => {
        if (result.state === 'granted') requestLocation()
      })
      .catch(() => {})
  }, [])

  // 店舗の座標は現在地を使うときだけ必要（距離の計算・半径での絞り込み）
  useEffect(() => {
    if (!location) return
    cached('home:shop-coords', 10 * 60 * 1000, async () => {
      const { data, error } = await createClient()
        .from('shops')
        .select('id, lat, lng')
        .eq('status', 'active')
      if (error) throw error
      return (data ?? []) as ShopCoord[]
    })
      .then(setShopCoords)
      .catch(() => setShopCoords([]))
  }, [location])

  const radiusKm = RADIUS_OPTIONS.find((r) => r.key === radiusKey)?.km ?? null
  const isRadiusLimited = location !== null && radiusKm !== null

  // 現在地からの距離と、半径内の店舗
  const { distanceById, targetShopIds } = useMemo(() => {
    const distances = new Map<string, number>()
    const ids: string[] = []
    if (location) {
      ;(shopCoords ?? []).forEach((s) => {
        if (s.lat === null || s.lng === null) return
        const distance = haversineDistanceKm(location.lat, location.lng, s.lat, s.lng)
        distances.set(s.id, distance)
        if (radiusKm === null || distance <= radiusKm) ids.push(s.id)
      })
    }
    return { distanceById: distances, targetShopIds: ids }
  }, [shopCoords, location, radiusKm])

  const fetchPage = useCallback(
    async (offset: number) => {
      const supabase = createClient()
      const { from, to } = periodRange(period)
      const today = jstDateKey()

      let query = supabase
        .from('events')
        .select('id, shop_id, title, format, held_at, start_time, shops!inner(name, prefecture, status)', {
          count: 'exact',
        })
        .gte('held_at', from)
        .lte('held_at', to)

      // 半径で絞る場合は対象店舗のIDで、全国の場合は店舗のstatusで絞る
      // （全国分のIDを並べるとURLが長くなりすぎるため）
      if (isRadiusLimited) {
        query = query.in('shop_id', targetShopIds)
      } else {
        query = query.eq('shops.status', 'active')
      }

      // 今日の分は、開始時刻を過ぎたイベントを除く（時刻不明のものは残す）
      if (from === today) {
        query = query.or(`held_at.gt.${today},start_time.gte.${jstTimeKey()},start_time.is.null`)
      }

      if (selectedFormat === 'other') {
        query = query.in('format', OTHER_FORMAT_KEYS)
      } else if (selectedFormat) {
        query = query.eq('format', selectedFormat)
      }

      return query
        .order('held_at', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
    },
    [period, selectedFormat, targetShopIds, isRadiusLimited]
  )

  useEffect(() => {
    // 保存済み条件・メインフォーマットの反映が終わるまでは取得しない（二重取得とチラつき防止）
    // 現在地を使うときは、半径内の店舗を決めるための座標が届くまで待つ
    if (!filtersRestored || (isRadiusLimited && shopCoords === null)) return
    const requestId = ++requestIdRef.current

    const load = async () => {
      setLoading(true)
      if (isRadiusLimited && targetShopIds.length === 0) {
        setEvents([])
        setTotalCount(0)
        setLoading(false)
        return
      }
      const { data, count } = await fetchPage(0)
      if (requestId !== requestIdRef.current) return
      setEvents((data ?? []) as unknown as EventItem[])
      setTotalCount(count ?? null)
      setLoading(false)
    }
    load()
  }, [filtersRestored, isRadiusLimited, shopCoords, targetShopIds, fetchPage])

  const loadMore = async () => {
    const requestId = requestIdRef.current
    setLoadingMore(true)
    const { data } = await fetchPage(events.length)
    if (requestId === requestIdRef.current) {
      setEvents((prev) => [...prev, ...((data ?? []) as unknown as EventItem[])])
    }
    setLoadingMore(false)
  }

  const groups = useMemo(() => groupByDate(events), [events])

  const showLocationPrompt = !location && (locationStatus === 'idle' || locationStatus === 'requesting')
  const hasMore = totalCount !== null && events.length < totalCount

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="app-header sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 pt-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-display text-sm text-blue-600 leading-none mb-1">ShopTutor</div>
            <h1 className="font-display text-2xl text-slate-900 leading-tight">どこで遊ぶ？</h1>
          </div>
          <div className="flex items-center gap-2">
            {location ? (
              <label className="inline-flex items-center gap-1 h-8 pl-2.5 pr-1 rounded-full border border-gray-200 text-xs text-gray-700">
                <MapPin size={14} className="text-blue-600" />
                現在地から
                <select
                  value={radiusKey}
                  onChange={(e) => setRadiusKey(e.target.value as RadiusKey)}
                  aria-label="現在地からの距離"
                  className="bg-transparent font-bold text-gray-900 focus:outline-none"
                >
                  {RADIUS_OPTIONS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.km === null ? r.label : `${r.label}以内`}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              !showLocationPrompt &&
              locationStatus !== 'unsupported' && (
                <button
                  type="button"
                  onClick={requestLocation}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-full border border-gray-200 text-xs text-gray-700"
                >
                  <LocateFixed size={14} className="text-blue-600" />
                  現在地を使う
                </button>
              )
            )}
            <AuthStatus />
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 pt-3">
          <div className="flex bg-gray-100 rounded-xl p-1" role="group" aria-label="期間">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                aria-pressed={period === p.key}
                className={`flex-1 h-8 rounded-lg text-sm font-medium transition-colors ${
                  period === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <ChipRow className="max-w-lg mx-auto py-2">
          <Chip
            selected={selectedFormat === null}
            onClick={() => {
              setSelectedFormat(null)
              setFormatFromProfile(false)
            }}
          >
            すべて
          </Chip>
          {FORMATS.map((f) => (
            <Chip
              key={f.key}
              selected={selectedFormat === f.key}
              onClick={() => {
                setSelectedFormat(selectedFormat === f.key ? null : f.key)
                setFormatFromProfile(false)
              }}
            >
              {f.label}
            </Chip>
          ))}
        </ChipRow>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-3">
        {showLocationPrompt && (
          <div className="surface p-3 flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <LocateFixed size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-900">近くのイベントを見る</div>
              <div className="text-[11px] text-slate-500">位置は距離の計算だけに使います</div>
            </div>
            <button
              type="button"
              onClick={requestLocation}
              disabled={locationStatus === 'requesting'}
              className="h-9 px-3 rounded-full bg-blue-600 text-white text-xs font-bold disabled:opacity-60 flex-shrink-0"
            >
              {locationStatus === 'requesting' ? '取得中…' : '現在地を使う'}
            </button>
            <button
              type="button"
              onClick={skipLocation}
              aria-label="使わずに全国のイベントを見る"
              className="p-1 -mr-1 text-slate-400 hover:text-slate-600 flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {locationStatus === 'denied' && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">位置情報を使えないため、全国のイベントを表示しています</p>
        )}

        {formatFromProfile && selectedFormat && (
          <button
            type="button"
            onClick={() => {
              setSelectedFormat(null)
              setFormatFromProfile(false)
            }}
            className="self-start inline-flex items-center gap-1 h-7 pl-3 pr-2 rounded-full text-xs font-medium bg-green-50 text-green-800"
            aria-label="メインフォーマットでの絞り込みを解除"
          >
            メインの{FORMAT_LABELS[selectedFormat]}で表示中
            <X size={14} />
          </button>
        )}

        <EventNotice />

        {loading ? (
          <SkeletonList kind="event" />
        ) : events.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8 flex flex-col items-center gap-3">
            該当するイベントが見つかりませんでした
            {period !== 'week' && (
              <button type="button" onClick={() => setPeriod('week')} className="text-blue-600 font-medium">
                7日間で探す
              </button>
            )}
            {location && radiusKey !== 'all' && (
              <button type="button" onClick={() => setRadiusKey('all')} className="text-blue-600 font-medium">
                距離の制限を外す
              </button>
            )}
          </div>
        ) : (
          <>
            {groups.map((group) => (
              <section key={group.date} className="flex flex-col gap-2">
                <h2 className="text-sm font-bold text-slate-900 pt-1">{formatDayHeading(group.date)}</h2>
                {group.items.map((event) => {
                  const distance = distanceById.get(event.shop_id)
                  return (
                    <EventRow
                      key={event.id}
                      href={`/shops/${event.shop_id}`}
                      startTime={event.start_time}
                      shopName={event.shops?.name}
                      title={event.title}
                      format={event.format}
                      meta={distance !== undefined ? `${distance.toFixed(1)}km` : event.shops?.prefecture}
                    />
                  )
                })}
              </section>
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full h-11 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {loadingMore ? '読み込み中...' : `もっと見る（残り${totalCount - events.length}件）`}
              </button>
            )}
          </>
        )}

        <Link
          href="/shops"
          className="mt-2 flex items-center gap-3 surface p-3 hover:shadow-md"
        >
          <span className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0">
            <Store size={20} />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-gray-900">店舗から探す</span>
            <span className="block text-xs text-gray-500">エリア・地図・評価で全国の公認店舗を探せます</span>
          </span>
        </Link>
      </div>
    </div>
  )
}
