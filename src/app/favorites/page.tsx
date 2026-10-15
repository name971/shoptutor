'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Shop, Event, FORMAT_FILTER_OPTIONS_WITH_OTHER as FORMATS, OTHER_FORMAT_KEYS } from '@/types'
import ShopCard from '@/components/shop/ShopCard'
import FormatBadge from '@/components/ui/FormatBadge'
import EventNotice from '@/components/shared/EventNotice'
import { isEventPast, jstDateKey, formatEventWhen } from '@/lib/eventTime'
import Chip from '@/components/ui/Chip'

type FavoriteEvent = Event & { shops: { name: string } | null }

const TABS = [
  { key: 'shops', label: '店舗一覧' },
  { key: 'events', label: '今週のイベント' },
] as const

const FORMAT_FILTER_STORAGE_KEY = 'favorites-event-format-filter'
const PAGE_STATE_STORAGE_KEY = 'favorites-page-state'
const PAGE_SIZE = 10

export default function FavoritesPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('shops')
  const [shops, setShops] = useState<Shop[]>([])
  const [events, setEvents] = useState<FavoriteEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(new Set())
  const [visibleEventCount, setVisibleEventCount] = useState(PAGE_SIZE)
  const [pageStateRestored, setPageStateRestored] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(FORMAT_FILTER_STORAGE_KEY)
    if (saved) {
      setSelectedFormats(new Set(JSON.parse(saved)))
    }

    try {
      const savedState = sessionStorage.getItem(PAGE_STATE_STORAGE_KEY)
      if (savedState) {
        const parsed = JSON.parse(savedState)
        setTab(parsed.tab ?? 'shops')
        setVisibleEventCount(parsed.visibleEventCount ?? PAGE_SIZE)
      }
    } catch {
      // 復元失敗は無視
    }
    setPageStateRestored(true)
  }, [])

  useEffect(() => {
    if (!pageStateRestored) return
    try {
      sessionStorage.setItem(PAGE_STATE_STORAGE_KEY, JSON.stringify({ tab, visibleEventCount }))
    } catch {
      // 保存失敗は無視
    }
  }, [pageStateRestored, tab, visibleEventCount])

  const toggleFormat = (format: string) => {
    setSelectedFormats((prev) => {
      const next = new Set(prev)
      if (next.has(format)) next.delete(format)
      else next.add(format)
      localStorage.setItem(FORMAT_FILTER_STORAGE_KEY, JSON.stringify(Array.from(next)))
      return next
    })
    setVisibleEventCount(PAGE_SIZE)
  }

  const filteredEvents =
    selectedFormats.size === 0
      ? events
      : events.filter((e) =>
          selectedFormats.has(e.format) ||
          (selectedFormats.has('other') && OTHER_FORMAT_KEYS.includes(e.format))
        )
  const visibleEvents = filteredEvents.slice(0, visibleEventCount)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }
      setChecking(false)

      const { data: favs } = await supabase
        .from('shop_favorites')
        .select('shop_id')
        .eq('user_id', user.id)

      const shopIds = (favs ?? []).map((f) => f.shop_id)

      if (shopIds.length === 0) {
        setLoading(false)
        return
      }

      const { data: shopsData } = await supabase
        .from('shops')
        .select('*')
        .in('id', shopIds)
      setShops(shopsData ?? [])

      const today = jstDateKey()
      const nextWeek = jstDateKey(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))

      const { data: eventsData } = await supabase
        .from('events')
        .select('*, shops(name)')
        .in('shop_id', shopIds)
        .gte('held_at', today)
        .lte('held_at', nextWeek)
        .order('held_at', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: false })
      const upcoming = ((eventsData as FavoriteEvent[]) ?? []).filter(
        (e) => !isEventPast(e.held_at, e.start_time)
      )
      setEvents(upcoming)

      setLoading(false)
    }
    load()
  }, [router])

  if (checking) return null

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="app-header px-4 py-3 sticky top-0 z-10">
        <h1 className="font-extrabold text-2xl text-slate-900 tracking-tight mb-3">お気に入り</h1>
        <div className="flex gap-2">
          {TABS.map((t) => (
            <Chip key={t.key} selected={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="text-center text-gray-400 text-sm py-8">読み込み中...</div>
        ) : tab === 'shops' ? (
          shops.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-10 flex flex-col items-center gap-3">
              お気に入り店舗がまだありません
              <span className="text-xs text-gray-400">店舗ページの☆を押すと、ここに追加されます</span>
              <Link href="/" className="h-10 px-4 rounded-xl bg-blue-600 text-white text-sm font-bold inline-flex items-center">
                店舗をさがす
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {shops.map((shop) => (
                <ShopCard key={shop.id} shop={shop} />
              ))}
            </div>
          )
        ) : (
          <>
            <EventNotice />
            <div className="flex flex-wrap gap-2 mb-3">
              {FORMATS.map((f) => (
                <Chip key={f.key} selected={selectedFormats.has(f.key)} onClick={() => toggleFormat(f.key)}>
                  {f.label}
                </Chip>
              ))}
            </div>
            {filteredEvents.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">
                {events.length === 0
                  ? '今週のイベントはありません'
                  : '該当するフォーマットのイベントはありません'}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {visibleEvents.map((event) => (
                    <div key={event.id} className="surface p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium truncate">{event.shops?.name}</div>
                        <FormatBadge format={event.format} size="sm" />
                      </div>
                      <div className="text-xs text-gray-500 flex items-center justify-between gap-2">
                        <span className="truncate flex-1">{event.title}</span>
                        <span className="text-gray-700 font-medium whitespace-nowrap tabular-nums">
                          {formatEventWhen(event.held_at, event.start_time)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {filteredEvents.length > visibleEventCount && (
                  <button
                    onClick={() => setVisibleEventCount((v) => v + PAGE_SIZE)}
                    className="w-full text-center text-xs text-blue-600 hover:underline mt-2"
                  >
                    もっと見る
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
