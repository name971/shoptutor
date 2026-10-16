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
  formatDayHeading,
  isStartingSoon,
} from '@/lib/eventTime'
import { FORMAT_FILTER_OPTIONS_WITH_OTHER as FORMATS, FORMAT_LABELS, OTHER_FORMAT_KEYS } from '@/types'
import EventRow from '@/components/event/EventRow'
import DateStrip from '@/components/event/DateStrip'
import ReminderList from '@/components/event/ReminderList'
import { SkeletonList } from '@/components/ui/Skeleton'
import { groupByDate } from '@/lib/groupByDate'
import { groupSameShopAndTime } from '@/lib/groupEvents'
import EventNotice from '@/components/shared/EventNotice'
import Chip from '@/components/ui/Chip'
import ChipRow from '@/components/ui/ChipRow'
import AuthStatus from '@/components/auth/AuthStatus'
import EventAreaSheet, { areaLabel, type EventArea } from '@/components/event/EventAreaSheet'
import { LAST_PREFECTURE_KEY } from '@/lib/area'
import { LocateFixed, MapPin, X, Store, ChevronDown } from 'lucide-react'

// 日付の選択：'YYYY-MM-DD'（その日だけ）か 'week'（今日から7日間）
type DayKey = string
const NO_COUNTS = new Map<string, number>()

// Supabaseの1回の取得上限（既定1000件）を超えないよう、ページ単位で取得する
const PAGE_SIZE = 50

// 店舗の都道府県・座標（現在地の距離計算・都道府県ごとの件数・エリア選択の店舗数に使う。必要なときだけ取得する）
type ShopGeo = {
  id: string
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
  // 店名・都道府県はイベントと一緒に取得する（全店舗の一覧を別に取らずに済む）
  shops: { name: string; prefecture: string } | null
}

const FILTERS_STORAGE_KEY = 'shoptutor_home_events_filters_v4'
// 自分で選んだフォーマットは訪問をまたいで覚えておく（{ format: string | null }）
const FORMAT_STORAGE_KEY = 'shoptutor_home_format'
// 「どこで」は訪問をまたいで覚えておく（毎回選び直さなくていいように）
// v1は自動で決めた初期値まで保存していたため、v2で読み直す
const AREA_STORAGE_KEY = 'shoptutor_home_area_v2'
// 「現在地を使う」を一度押したユーザーは、次回以降は説明カードを出さずに位置情報を取得する
const LOCATION_OPT_IN_KEY = 'shoptutor_location_opt_in'
const LOCATION_SKIPPED_KEY = 'shoptutor_location_skipped'

// 現在地はページを再読み込みするまでメモリ上に保持する（保存はしない）
let lastKnownLocation: { lat: number; lng: number } | null = null

type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'skipped' | 'unsupported'

function loadSavedFormat(): { format: string | null } | null {
  try {
    const raw = window.localStorage.getItem(FORMAT_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as { format: string | null }) : null
    if (parsed && (parsed.format === null || FORMATS.some((f) => f.key === parsed.format))) return parsed
  } catch {
    // 読めなければ未設定として扱う
  }
  return null
}

function loadSavedFilters(): {
  day: DayKey
} | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(FILTERS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function loadSavedArea(): EventArea | null {
  try {
    const raw = window.localStorage.getItem(AREA_STORAGE_KEY)
    const area = raw ? (JSON.parse(raw) as EventArea) : null
    if (area?.kind === 'near' && typeof area.km === 'number') return area
    if (area?.kind === 'prefectures' && Array.isArray(area.prefectures) && area.prefectures.length > 0) return area
    if (area?.kind === 'all') return area
  } catch {
    // 読めなければ未設定として扱う
  }
  return null
}

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

// 選択した日の開始日・終了日（JSTの日付キー）
function dayRange(day: DayKey): { from: string; to: string } {
  const today = jstDateKey()
  if (day === 'week') return { from: today, to: addDaysToKey(today, 6) }
  return { from: day, to: day }
}

export default function HomePage() {
  // 同じ訪問中にタブを移動して戻ってきたときは、前回の現在地をそのまま使う（取り直しによる二重取得を防ぐ）
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(() => lastKnownLocation)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>(() => (lastKnownLocation ? 'granted' : 'idle'))
  // どこのイベントを見るか（null＝まだ決めていない。全国を並べる前にエリアを選んでもらう）
  const [area, setArea] = useState<EventArea | null>(null)
  const [areaSheetOpen, setAreaSheetOpen] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [formatFromProfile, setFormatFromProfile] = useState(false)
  const [day, setDay] = useState<DayKey>(() => jstDateKey())
  const [dayCounts, setDayCounts] = useState<Map<string, number>>(new Map())
  const [filtersRestored, setFiltersRestored] = useState(false)
  const [shopGeo, setShopGeo] = useState<ShopGeo[] | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestIdRef = useRef(0)

  // サーバーとクライアントの初回描画を一致させるため、sessionStorageからの復元は
  // マウント後のuseEffectで行う（useStateの遅延初期化だとSSR/CSRでハイドレーション不整合が起きる）
  useEffect(() => {
    const init = async () => {
      const saved = loadSavedFilters()
      const savedFormat = loadSavedFormat()
      if (savedFormat) setSelectedFormat(savedFormat.format)
      if (saved) {
        // 前回の訪問で選んだ日が過ぎていたら今日に戻す
        setDay(saved.day && (saved.day === 'week' || saved.day >= jstDateKey()) ? saved.day : jstDateKey())
      }
      let initialArea = loadSavedArea()
      try {
        // 保存済みの条件がないものだけ、ログイン情報から最初の値を決める
        let userId: string | null = null
        const needsUser = !savedFormat || !initialArea
        const supabase = createClient()
        if (needsUser) {
          const { data } = await supabase.auth.getUser()
          userId = data.user?.id ?? null
        }
        // 自分でフォーマットを選んだことがなければ、メインフォーマットで最初から絞り込む（これは保存しない）
        if (!savedFormat && userId) {
          const { data: profile } = await supabase.from('profiles').select('main_format').eq('id', userId).maybeSingle()
          const mainFormat = profile?.main_format
          if (mainFormat && FORMATS.some((f) => f.key === mainFormat)) {
            setSelectedFormat(mainFormat)
            setFormatFromProfile(true)
          }
        }
        // 最初のエリア（自分で選んだことがないとき）：ログイン中ならお気に入り店舗が一番多い県
        // → 現在地を許可済みなら周辺5km → 店舗タブで最後に見た県
        // （現在地を許可していても、ログイン中はお気に入りの県を優先する。距離は現在地があれば表示される）
        // ここで決めたものは保存しない（お気に入りが変われば次回の初期値も変わるように）
        if (!initialArea) {
          if (userId) {
            const { data: favs } = await supabase.from('shop_favorites').select('shops(prefecture)').eq('user_id', userId)
            const counts = new Map<string, number>()
            for (const f of (favs ?? []) as unknown as { shops: { prefecture: string } | null }[]) {
              const p = f.shops?.prefecture
              if (p) counts.set(p, (counts.get(p) ?? 0) + 1)
            }
            // 一番多い県（同数なら3県まで並べて選ぶ）
            const max = Math.max(0, ...counts.values())
            const top = [...counts.entries()].filter(([, n]) => n === max).map(([p]) => p).slice(0, 3)
            if (top.length > 0) initialArea = { kind: 'prefectures', prefectures: top }
          }
          const lastPrefecture = readLocal(LAST_PREFECTURE_KEY)
          if (!initialArea && readLocal(LOCATION_OPT_IN_KEY) === '1') initialArea = { kind: 'near', km: 5 }
          if (!initialArea && lastPrefecture) initialArea = { kind: 'prefectures', prefectures: [lastPrefecture] }
        }
      } catch {
        // 取れなくても選び直せるので無視
      } finally {
        setArea(initialArea)
        setFiltersRestored(true)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!filtersRestored) return
    try {
      window.sessionStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({ day })
      )
    } catch {
      // 保存失敗は無視
    }
  }, [filtersRestored, day])

  // 自分で選んだフォーマットは端末に保存する（次回もそのまま使う）
  const chooseFormat = (format: string | null) => {
    setSelectedFormat(format)
    setFormatFromProfile(false)
    try {
      window.localStorage.setItem(FORMAT_STORAGE_KEY, JSON.stringify({ format }))
    } catch {
      // 保存失敗は無視
    }
  }

  // 自分で選んだエリアだけ端末に保存する（次回もそのまま使う）
  const chooseArea = (next: EventArea) => {
    setArea(next)
    try {
      window.localStorage.setItem(AREA_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 保存失敗は無視
    }
  }

  // switchToNear：取れたら「現在地の周辺」に切り替える（ボタンから使ったとき）
  const requestLocation = (switchToNear = false) => {
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
        if (switchToNear) {
          // 自分で選んだエリアとして保存する（下の chooseArea と同じ。effect から呼ばれるため直接書く）
          const near: EventArea = { kind: 'near', km: 5 }
          setArea(near)
          try {
            window.localStorage.setItem(AREA_STORAGE_KEY, JSON.stringify(near))
          } catch {
            // 保存失敗は無視
          }
          setAreaSheetOpen(false)
        }
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

  // 店舗の一覧（都道府県・座標）は、現在地・都道府県で絞るとき・エリアを選ぶときだけ取得する
  const needsShopGeo = location !== null || area?.kind === 'prefectures' || areaSheetOpen
  useEffect(() => {
    if (!needsShopGeo) return
    cached('home:shop-geo', 10 * 60 * 1000, async () => {
      const { data, error } = await createClient()
        .from('shops')
        .select('id, prefecture, lat, lng')
        .eq('status', 'active')
      if (error) throw error
      return (data ?? []) as ShopGeo[]
    })
      .then(setShopGeo)
      .catch(() => setShopGeo([]))
  }, [needsShopGeo])

  const isNear = area?.kind === 'near'
  const radiusKm = area?.kind === 'near' ? area.km : null
  // 「現在地の周辺」を選んでいるのに現在地が使えない（拒否・未対応・取得前に閉じた）
  const nearUnavailable =
    isNear && !location && (locationStatus === 'denied' || locationStatus === 'unsupported' || locationStatus === 'skipped' || locationStatus === 'idle')
  // 一覧を出せる状態か（エリア未選択、または現在地待ちのときは出さない）
  const areaReady = area !== null && (!isNear || (location !== null && shopGeo !== null))

  // 現在地からの距離と、対象の店舗（周辺＝半径内、都道府県＝その県の店舗。日ごとの件数の集計に使う）
  const { distanceById, targetShopIds } = useMemo(() => {
    const distances = new Map<string, number>()
    const ids: string[] = []
    ;(shopGeo ?? []).forEach((s) => {
      if (location && s.lat !== null && s.lng !== null) {
        const distance = haversineDistanceKm(location.lat, location.lng, s.lat, s.lng)
        distances.set(s.id, distance)
        if (radiusKm !== null && distance <= radiusKm) ids.push(s.id)
      }
      if (area?.kind === 'prefectures' && area.prefectures.includes(s.prefecture)) ids.push(s.id)
    })
    return { distanceById: distances, targetShopIds: ids }
  }, [shopGeo, location, radiusKm, area])

  // エリア選択に出す都道府県ごとの店舗数
  const prefectureShopCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of shopGeo ?? []) counts.set(s.prefecture, (counts.get(s.prefecture) ?? 0) + 1)
    return counts
  }, [shopGeo])

  const fetchPage = useCallback(
    async (offset: number) => {
      const supabase = createClient()
      const { from, to } = dayRange(day)
      const today = jstDateKey()

      let query = supabase
        .from('events')
        .select('id, shop_id, title, format, held_at, start_time, shops!inner(name, prefecture, status)', {
          count: 'exact',
        })
        .gte('held_at', from)
        .lte('held_at', to)

      // 周辺は半径内の店舗IDで、都道府県・全国は店舗の都道府県・statusで絞る
      // （都道府県や全国の店舗IDを並べるとURLが長くなりすぎるため）
      if (area?.kind === 'near') {
        query = query.in('shop_id', targetShopIds)
      } else {
        query = query.eq('shops.status', 'active')
        if (area?.kind === 'prefectures') query = query.in('shops.prefecture', area.prefectures)
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
    [day, selectedFormat, targetShopIds, area]
  )

  useEffect(() => {
    // 保存済み条件・メインフォーマットの反映が終わるまでは取得しない（二重取得とチラつき防止）
    // 現在地を使うときは、半径内の店舗を決めるための座標が届くまで待つ
    if (!filtersRestored || !areaReady) return
    const requestId = ++requestIdRef.current

    const load = async () => {
      setLoading(true)
      if (isNear && targetShopIds.length === 0) {
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
  }, [filtersRestored, areaReady, isNear, targetShopIds, fetchPage])

  // カレンダー帯に出す日ごとの件数（フォーマット・半径の絞り込みを反映。7日分を1回で取得）
  useEffect(() => {
    if (!filtersRestored || !area) return
    // 周辺・都道府県は対象の店舗が決まるまで待つ。対象がないときは取得しない（表示側で0件扱いにする）
    if (area.kind !== 'all' && (shopGeo === null || targetShopIds.length === 0)) return
    const today = jstDateKey()
    const formats = selectedFormat === 'other' ? OTHER_FORMAT_KEYS : selectedFormat ? [selectedFormat] : null
    let cancelled = false
    createClient()
      .rpc('event_counts_by_day', {
        p_from: today,
        p_to: addDaysToKey(today, 6),
        p_formats: formats,
        p_shop_ids: area.kind === 'all' ? null : targetShopIds,
      })
      .then(({ data, error }) => {
        if (cancelled || error) return
        const rows = Array.isArray(data) ? (data as { held_at: string; event_count: number }[]) : []
        setDayCounts(new Map(rows.map((r) => [r.held_at, r.event_count])))
      })
    return () => {
      cancelled = true
    }
  }, [filtersRestored, area, shopGeo, targetShopIds, selectedFormat])

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

  // エリアが決まっていない（または周辺を選んだのに現在地が使えない）ときは、一覧の代わりに選んでもらう
  const showAreaPrompt = filtersRestored && (area === null || nearUnavailable)
  const noTargetShops = area !== null && area.kind !== 'all' && shopGeo !== null && targetShopIds.length === 0
  const hasMore = totalCount !== null && events.length < totalCount

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="app-header sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 pt-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-display text-sm text-blue-600 leading-none mb-1">ShopTutor</div>
            <h1 className="font-display text-2xl text-slate-900 leading-tight">どこで遊ぶ？</h1>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            {/* どこのイベントを見るか（押すとエリアを選ぶシート） */}
            <button
              type="button"
              onClick={() => setAreaSheetOpen(true)}
              aria-label={`エリア：${areaLabel(area)}。変更する`}
              className={`min-w-0 inline-flex items-center gap-1 h-8 pl-2.5 pr-2 rounded-full text-xs font-bold ${
                area ? 'border border-gray-200 text-gray-900 bg-white' : 'bg-blue-600 text-white'
              }`}
            >
              {isNear ? <LocateFixed size={14} className="flex-shrink-0 text-blue-600" /> : <MapPin size={14} className={`flex-shrink-0 ${area ? 'text-blue-600' : ''}`} />}
              <span className="truncate max-w-[9rem]">{areaLabel(area)}</span>
              <ChevronDown size={14} className="flex-shrink-0 opacity-60" />
            </button>
            <AuthStatus />
          </div>
        </div>

        <div className="max-w-lg mx-auto px-3 pt-3">
          <DateStrip
            selected={day}
            onSelect={setDay}
            counts={!area || noTargetShops ? NO_COUNTS : dayCounts}
          />
        </div>

        <ChipRow className="max-w-lg mx-auto py-2">
          <Chip
            selected={selectedFormat === null}
            onClick={() => {
              chooseFormat(null)
            }}
          >
            すべて
          </Chip>
          {FORMATS.map((f) => (
            <Chip
              key={f.key}
              selected={selectedFormat === f.key}
              onClick={() => {
                chooseFormat(selectedFormat === f.key ? null : f.key)
              }}
            >
              {f.label}
            </Chip>
          ))}
        </ChipRow>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-3">
        {showAreaPrompt && (
          <div className="surface p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <MapPin size={20} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900">どこのイベントを見ますか？</div>
                <div className="text-xs text-slate-500">
                  {nearUnavailable ? '現在地を使えませんでした。エリアを選んでください' : 'エリアを決めると、行ける範囲のイベントだけが並びます'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => requestLocation(true)}
                disabled={locationStatus === 'requesting' || locationStatus === 'unsupported'}
                className="h-10 rounded-xl border border-gray-200 text-sm font-bold text-gray-800 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <LocateFixed size={16} className="text-blue-600" />
                {locationStatus === 'requesting' ? '取得中…' : '現在地の周辺'}
              </button>
              <button
                type="button"
                onClick={() => setAreaSheetOpen(true)}
                className="h-10 rounded-xl bg-blue-600 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:bg-blue-700"
              >
                <MapPin size={16} />
                都道府県を選ぶ
              </button>
            </div>
            <button type="button" onClick={() => chooseArea({ kind: 'all' })} className="self-center text-xs text-slate-500 underline underline-offset-2">
              全国のイベントを見る
            </button>
          </div>
        )}

        {formatFromProfile && selectedFormat && (
          <button
            type="button"
            onClick={() => {
              chooseFormat(null)
            }}
            className="self-start inline-flex items-center gap-1 h-7 pl-3 pr-2 rounded-full text-xs font-medium bg-green-50 text-green-800"
            aria-label="メインフォーマットでの絞り込みを解除"
          >
            メインの{FORMAT_LABELS[selectedFormat]}で表示中
            <X size={14} />
          </button>
        )}

        <ReminderList />

        <EventNotice />

        {showAreaPrompt ? null : loading || !areaReady ? (
          <SkeletonList kind="event" />
        ) : events.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8 flex flex-col items-center gap-3">
            該当するイベントが見つかりませんでした
            {day !== 'week' && (
              <button type="button" onClick={() => setDay('week')} className="text-blue-600 font-medium">
                7日間で探す
              </button>
            )}
            {area?.kind === 'near' && area.km < 10 && (
              <button type="button" onClick={() => chooseArea({ kind: 'near', km: 10 })} className="text-blue-600 font-medium">
                10km以内に広げる
              </button>
            )}
            <button type="button" onClick={() => setAreaSheetOpen(true)} className="text-blue-600 font-medium">
              エリアを変える
            </button>
          </div>
        ) : (
          <>
            {groups.map((group) => (
              <section key={group.date} className="flex flex-col">
                <h2 className="text-sm font-bold text-slate-900 pt-1 pb-1">{formatDayHeading(group.date)}</h2>
                {groupSameShopAndTime(group.items).map((bundle) => {
                  const event = bundle[0]
                  const distance = distanceById.get(event.shop_id)
                  return (
                    <EventRow
                      key={event.id}
                      href={`/shops/${event.shop_id}`}
                      startTime={event.start_time}
                      soon={isStartingSoon(event.held_at, event.start_time)}
                      shopName={event.shops?.name}
                      meta={distance !== undefined ? `${distance.toFixed(1)}km` : event.shops?.prefecture}
                      items={bundle.map((e) => ({
                        title: e.title,
                        format: e.format,
                        reminder: {
                          shopId: e.shop_id,
                          shopName: e.shops?.name ?? '',
                          title: e.title,
                          format: e.format,
                          heldAt: e.held_at,
                          startTime: e.start_time,
                        },
                      }))}
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

      <EventAreaSheet
        open={areaSheetOpen}
        area={area}
        shopCounts={prefectureShopCounts}
        hasLocation={location !== null}
        locating={locationStatus === 'requesting'}
        onClose={() => setAreaSheetOpen(false)}
        onApply={(next) => {
          chooseArea(next)
          setAreaSheetOpen(false)
        }}
        onUseLocation={() => requestLocation(true)}
      />
    </div>
  )
}
