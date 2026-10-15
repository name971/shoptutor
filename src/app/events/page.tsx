'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { haversineDistanceKm } from '@/lib/geo'
import { isEventPast, jstDateKey, formatEventDate } from '@/lib/eventTime'
import { FORMAT_FILTER_OPTIONS_WITH_OTHER as FORMATS, FORMAT_LABELS, OTHER_FORMAT_KEYS } from '@/types'
import FormatBadge from '@/components/ui/FormatBadge'
import EventNotice from '@/components/shared/EventNotice'
import Chip from '@/components/ui/Chip'
import { LocateFixed, MapPin, X } from 'lucide-react'

const RADIUS_OPTIONS = [
  { key: '3', label: '3km', km: 3 },
  { key: '5', label: '5km', km: 5 },
  { key: '10', label: '10km', km: 10 },
  { key: 'all', label: '制限なし', km: null },
] as const

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

type ShopInfo = {
  id: string
  name: string
  prefecture: string
  distance: number | null
}

type EventItem = {
  id: string
  shop_id: string
  title: string
  format: string
  held_at: string
  start_time: string | null
  shop: ShopInfo | null
}

const FILTERS_STORAGE_KEY = 'shoptutor_events_filters'
// 「現在地を使う」を一度押したユーザーは、次回以降は説明カードを出さずに位置情報を取得する
const LOCATION_OPT_IN_KEY = 'shoptutor_location_opt_in'
const LOCATION_SKIPPED_KEY = 'shoptutor_location_skipped'

type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'skipped' | 'unsupported'

function loadSavedFilters(): {
  radiusKey: (typeof RADIUS_OPTIONS)[number]['key']
  selectedFormat: string | null
  selectedDay: string | null
} | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(FILTERS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function EventsPage() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [formatFromProfile, setFormatFromProfile] = useState(false)
  const [radiusKey, setRadiusKey] = useState<(typeof RADIUS_OPTIONS)[number]['key']>('5')
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [filtersRestored, setFiltersRestored] = useState(false)
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)

  // サーバーとクライアントの初回描画を一致させるため、sessionStorageからの復元は
  // マウント後のuseEffectで行う（useStateの遅延初期化だとSSR/CSRでハイドレーション不整合が起きる）
  useEffect(() => {
    const saved = loadSavedFilters()
    if (saved) {
      setRadiusKey(saved.radiusKey ?? '5')
      setSelectedFormat(saved.selectedFormat ?? null)
      setSelectedDay(saved.selectedDay ?? null)
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
        JSON.stringify({ radiusKey, selectedFormat, selectedDay })
      )
    } catch {
      // 保存失敗は無視
    }
  }, [filtersRestored, radiusKey, selectedFormat, selectedDay])

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() + i)
      return {
        key: jstDateKey(d),
        label: i === 0 ? '今日' : i === 1 ? '明日' : `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`,
      }
    })
  }, [])

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
    // 保存済み条件・メインフォーマットの反映が終わるまでは取得しない（二重取得とチラつき防止）
    if (!filtersRestored) return
    const load = async () => {
      setLoading(true)
      const supabase = createClient()

      const { data: shops } = await supabase
        .from('shops')
        .select('id, name, prefecture, lat, lng')
        .eq('status', 'active')

      const radiusOption = RADIUS_OPTIONS.find((r) => r.key === radiusKey)
      const radiusKm = radiusOption?.km ?? null

      const shopInfoMap = new Map<string, ShopInfo>()
      ;(shops ?? []).forEach((s) => {
        const distance =
          location && s.lat !== null && s.lng !== null
            ? haversineDistanceKm(location.lat, location.lng, s.lat, s.lng)
            : null

        if (location && radiusKm !== null && (distance === null || distance > radiusKm)) {
          return
        }

        shopInfoMap.set(s.id, {
          id: s.id,
          name: s.name,
          prefecture: s.prefecture,
          distance,
        })
      })

      const shopIds = Array.from(shopInfoMap.keys())
      if (shopIds.length === 0) {
        setEvents([])
        setLoading(false)
        return
      }

      const startDate = days[0].key
      const endDate = days[days.length - 1].key

      let query = supabase
        .from('events')
        .select('*')
        .in('shop_id', shopIds)
        .gte('held_at', selectedDay ?? startDate)
        .lte('held_at', selectedDay ?? endDate)
        .order('held_at', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: false })

      if (selectedFormat === 'other') {
        query = query.in('format', OTHER_FORMAT_KEYS)
      } else if (selectedFormat) {
        query = query.eq('format', selectedFormat)
      }

      const { data: eventsData } = await query

      const merged: EventItem[] = (eventsData ?? [])
        .filter((e) => !isEventPast(e.held_at, e.start_time))
        .map((e) => ({
          ...e,
          shop: shopInfoMap.get(e.shop_id) ?? null,
        }))

      merged.sort((a, b) => (a.shop?.distance ?? Infinity) - (b.shop?.distance ?? Infinity))

      setEvents(merged)
      setLoading(false)
    }
    load()
  }, [filtersRestored, location, radiusKey, selectedFormat, selectedDay, days])

  const showLocationPrompt = !location && (locationStatus === 'idle' || locationStatus === 'requesting')

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 pt-3 flex items-center justify-between gap-2">
          <h1 className="font-bold text-base text-gray-900">イベント</h1>
          {location ? (
            <label className="inline-flex items-center gap-1 h-8 pl-2.5 pr-1 rounded-full border border-gray-200 text-xs text-gray-700">
              <MapPin size={14} className="text-blue-600" />
              現在地から
              <select
                value={radiusKey}
                onChange={(e) => setRadiusKey(e.target.value as (typeof RADIUS_OPTIONS)[number]['key'])}
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
        </div>

        <div className="max-w-lg mx-auto px-4 pt-2 flex gap-2 overflow-x-auto no-scrollbar">
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

        <div className="max-w-lg mx-auto px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
          <Chip selected={selectedDay === null} onClick={() => setSelectedDay(null)}>
            7日間
          </Chip>
          {days.map((d) => (
            <Chip key={d.key} selected={selectedDay === d.key} onClick={() => setSelectedDay(selectedDay === d.key ? null : d.key)}>
              {d.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-3">
        {showLocationPrompt && (
          <div className="bg-white border rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <LocateFixed size={20} />
              </span>
              <div className="font-bold text-sm text-gray-900">近くのイベントから表示します</div>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              現在地は店舗までの距離の計算だけに使い、保存しません。使わない場合は全国のイベントを日付順に表示します。
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
            位置情報を取得できませんでした。全国のイベントを表示しています。端末の設定で位置情報を許可すると、近い順に表示できます。
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

        {!location && !loading && events.length > 0 && (
          <div className="text-xs text-gray-500">
            全国のイベント {events.length}件（日付順）
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-400 text-sm py-8">読み込み中...</div>
        ) : events.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            該当するイベントが見つかりませんでした
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((event) => (
              <Link
                key={event.id}
                href={event.shop ? `/shops/${event.shop.id}` : '#'}
                className="bg-white rounded-xl border p-3 flex gap-3 hover:border-blue-300 transition-colors"
              >
                <div className="w-16 flex-shrink-0 flex flex-col items-center justify-center border-r border-gray-100 pr-3 text-center">
                  <div className="text-[11px] text-gray-500 whitespace-nowrap">{formatEventDate(event.held_at)}</div>
                  <div className="text-base font-bold text-gray-900 tabular-nums leading-tight">
                    {event.start_time ?? '—'}
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="text-sm font-bold text-gray-900 truncate">{event.shop?.name}</div>
                  <div className="text-xs text-gray-600 truncate">{event.title}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <FormatBadge format={event.format} size="sm" />
                    <span className="truncate">
                      {event.shop?.prefecture}
                      {event.shop?.distance !== null && event.shop?.distance !== undefined && (
                        <span className="tabular-nums"> · {event.shop.distance.toFixed(1)}km</span>
                      )}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
