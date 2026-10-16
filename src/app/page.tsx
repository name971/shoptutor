'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { haversineDistanceKm } from '@/lib/geo'
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

type ShopInfo = {
  id: string
  name: string
  prefecture: string
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
}

const FILTERS_STORAGE_KEY = 'shoptutor_home_events_filters'
// 「現在地を使う」を一度押したユーザーは、次回以降は説明カードを出さずに位置情報を取得する
const LOCATION_OPT_IN_KEY = 'shoptutor_location_opt_in'
const LOCATION_SKIPPED_KEY = 'shoptutor_location_skipped'

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
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [radiusKey, setRadiusKey] = useState<RadiusKey>('5')
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [formatFromProfile, setFormatFromProfile] = useState(false)
  const [period, setPeriod] = useState<PeriodKey>('today')
  const [filtersRestored, setFiltersRestored] = useState(false)
  const [shops, setShops] = useState<ShopInfo[] | null>(null)
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
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
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

  useEffect(() => {
    const loadShops = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('shops')
        .select('id, name, prefecture, lat, lng')
        .eq('status', 'active')
      setShops(data ?? [])
    }
    loadShops()
  }, [])

  const radiusKm = RADIUS_OPTIONS.find((r) => r.key === radiusKey)?.km ?? null
  const isRadiusLimited = location !== null && radiusKm !== null

  // 現在地からの距離と、半径内の店舗
  const { shopById, targetShopIds } = useMemo(() => {
    const byId = new Map<string, ShopInfo & { distance: number | null }>()
    const ids: string[] = []
    ;(shops ?? []).forEach((s) => {
      const distance =
        location && s.lat !== null && s.lng !== null
          ? haversineDistanceKm(location.lat, location.lng, s.lat, s.lng)
          : null
      byId.set(s.id, { ...s, distance })
      if (location && radiusKm !== null && (distance === null || distance > radiusKm)) return
      ids.push(s.id)
    })
    return { shopById: byId, targetShopIds: ids }
  }, [shops, location, radiusKm])

  const fetchPage = useCallback(
    async (offset: number) => {
      const supabase = createClient()
      const { from, to } = periodRange(period)
      const today = jstDateKey()

      let query = supabase
        .from('events')
        .select('id, shop_id, title, format, held_at, start_time, shops!inner(status)', { count: 'exact' })
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
    if (!filtersRestored || shops === null) return
    const requestId = ++requestIdRef.current

    const load = async () => {
      setLoading(true)
      if (targetShopIds.length === 0) {
        setEvents([])
        setTotalCount(0)
        setLoading(false)
        return
      }
      const { data, count } = await fetchPage(0)
      if (requestId !== requestIdRef.current) return
      setEvents(data ?? [])
      setTotalCount(count ?? null)
      setLoading(false)
    }
    load()
  }, [filtersRestored, shops, targetShopIds, fetchPage])

  const loadMore = async () => {
    const requestId = requestIdRef.current
    setLoadingMore(true)
    const { data } = await fetchPage(events.length)
    if (requestId === requestIdRef.current) {
      setEvents((prev) => [...prev, ...(data ?? [])])
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

        <div className="max-w-lg mx-auto px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
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
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-3">
        {showLocationPrompt && (
          <div className="surface p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <LocateFixed size={20} />
              </span>
              <div className="font-bold text-sm text-gray-900">近くのイベントから表示します</div>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              現在地は店舗までの距離の計算だけに使い、保存しません。使わない場合は全国のイベントを表示します。
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={skipLocation}
                className="h-11 rounded-xl border border-gray-200 text-sm font-bold text-gray-700"
              >
                全国で見る
              </button>
              <button
                type="button"
                onClick={requestLocation}
                disabled={locationStatus === 'requesting'}
                className="h-11 rounded-xl bg-blue-600 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <LocateFixed size={16} />
                {locationStatus === 'requesting' ? '取得中...' : '現在地を使う'}
              </button>
            </div>
          </div>
        )}

        {locationStatus === 'denied' && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            位置情報を取得できませんでした。全国のイベントを表示しています。端末の設定で位置情報を許可すると、近くのイベントに絞り込めます。
          </p>
        )}

        {formatFromProfile && selectedFormat && (
          <div className="flex items-center gap-2 text-xs bg-green-50 text-green-800 rounded-lg px-3 py-2">
            <span className="flex-1">
              メインフォーマット（{FORMAT_LABELS[selectedFormat]}）で絞り込んでいます
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedFormat(null)
                setFormatFromProfile(false)
              }}
              className="inline-flex items-center gap-0.5 font-medium text-green-900"
            >
              解除
              <X size={14} />
            </button>
          </div>
        )}

        <EventNotice />

        {!loading && totalCount !== null && totalCount > 0 && (
          <div className="text-xs text-gray-600">
            {location && radiusKm !== null ? `現在地から${radiusKm}km以内` : '全国'}のイベント{' '}
            <span className="font-bold text-gray-900 tabular-nums">{totalCount}</span>件（開始時刻順）
          </div>
        )}

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
                  const shop = shopById.get(event.shop_id)
                  return (
                    <EventRow
                      key={event.id}
                      href={`/shops/${event.shop_id}`}
                      startTime={event.start_time}
                      shopName={shop?.name}
                      title={event.title}
                      format={event.format}
                      meta={
                        <>
                          {shop?.prefecture}
                          {shop?.distance !== null && shop?.distance !== undefined && (
                            <span className="tabular-nums"> · {shop.distance.toFixed(1)}km</span>
                          )}
                        </>
                      }
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
