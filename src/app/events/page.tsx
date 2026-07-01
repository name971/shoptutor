'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { haversineDistanceKm } from '@/lib/geo'
import { FORMAT_LABELS } from '@/types'
import FormatBadge from '@/components/ui/FormatBadge'
import EventNotice from '@/components/shared/EventNotice'
import BackButton from '@/components/ui/BackButton'

const FORMATS = [
  { key: 'commander', label: 'コマンダー' },
  { key: 'standard',  label: 'スタンダード' },
  { key: 'modern',    label: 'モダン' },
  { key: 'pioneer',   label: 'パイオニア' },
  { key: 'legacy',    label: 'レガシー' },
  { key: 'limited',   label: 'リミテッド' },
]

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
  shop: ShopInfo | null
}

function dateKey(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function EventsPage() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState('')
  const [radiusKey, setRadiusKey] = useState<(typeof RADIUS_OPTIONS)[number]['key']>('5')
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() + i)
      return {
        key: dateKey(d),
        label: i === 0 ? '今日' : i === 1 ? '明日' : `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`,
      }
    })
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('この端末では位置情報を利用できません')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationError('位置情報を取得できませんでした。全国のイベントを表示します。')
    )
  }, [])

  useEffect(() => {
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

      if (selectedFormat) {
        query = query.eq('format', selectedFormat)
      }

      const { data: eventsData } = await query

      const merged: EventItem[] = (eventsData ?? []).map((e) => ({
        ...e,
        shop: shopInfoMap.get(e.shop_id) ?? null,
      }))

      merged.sort((a, b) => (a.shop?.distance ?? Infinity) - (b.shop?.distance ?? Infinity))

      setEvents(merged)
      setLoading(false)
    }
    load()
  }, [location, radiusKey, selectedFormat, selectedDay, days])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <BackButton />
          <div className="font-bold text-sm">イベント</div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r.key}
              onClick={() => setRadiusKey(r.key)}
              disabled={!location}
              className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition-colors disabled:opacity-40 ${
                radiusKey === r.key
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
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
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedDay(null)}
            className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition-colors ${
              selectedDay === null
                ? 'bg-blue-50 border-blue-400 text-blue-700'
                : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            全期間
          </button>
          {days.map((d) => (
            <button
              key={d.key}
              onClick={() => setSelectedDay(selectedDay === d.key ? null : d.key)}
              className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition-colors ${
                selectedDay === d.key
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        <EventNotice />

        {locationError && (
          <p className="text-xs text-amber-600 mb-3">{locationError}</p>
        )}

        {loading ? (
          <div className="text-center text-gray-400 text-sm py-8">読み込み中...</div>
        ) : events.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            該当するイベントが見つかりませんでした
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((event) => (
              <Link
                key={event.id}
                href={event.shop ? `/shops/${event.shop.id}` : '#'}
                className="bg-white rounded-xl border p-3 block hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <div className="text-sm font-medium truncate">{event.shop?.name}</div>
                  <FormatBadge format={event.format} size="sm" />
                </div>
                <div className="text-xs text-gray-500 mb-1 truncate">{event.title}</div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>
                    {event.shop?.prefecture}
                    {event.shop?.distance !== null && event.shop?.distance !== undefined && (
                      <span className="ml-1">· {event.shop.distance.toFixed(1)}km</span>
                    )}
                  </span>
                  <span>{event.held_at}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
