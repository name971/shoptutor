'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Shop, Event, FORMAT_FILTER_OPTIONS_WITH_OTHER as FORMATS, OTHER_FORMAT_KEYS } from '@/types'
import ShopCard from '@/components/shop/ShopCard'
import EventNotice from '@/components/shared/EventNotice'
import { isEventPast, jstDateKey, addDaysToKey, formatDayHeading, isStartingSoon } from '@/lib/eventTime'
import DateStrip from '@/components/event/DateStrip'
import EventRow from '@/components/event/EventRow'
import { SkeletonList } from '@/components/ui/Skeleton'
import { groupByDate } from '@/lib/groupByDate'
import { groupSameShopAndTime } from '@/lib/groupEvents'
import { Star } from 'lucide-react'
import Chip from '@/components/ui/Chip'

type FavoriteEvent = Event & { shops: { name: string } | null }

// 店舗の情報は店舗タブで見られるので、お気に入りはまず今週のイベントを出す
const TABS = [
  { key: 'events', label: '今週のイベント' },
  { key: 'shops', label: '店舗一覧' },
] as const

const FORMAT_FILTER_STORAGE_KEY = 'favorites-event-format-filter'
const PAGE_STATE_STORAGE_KEY = 'favorites-page-state'
const PAGE_SIZE = 10

export default function FavoritesPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('events')
  const [shops, setShops] = useState<Shop[]>([])
  const [events, setEvents] = useState<FavoriteEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(new Set())
  const [visibleEventCount, setVisibleEventCount] = useState(PAGE_SIZE)
  const [pageStateRestored, setPageStateRestored] = useState(false)
  // 日付の選択：'YYYY-MM-DD'（その日だけ）か 'week'（7日間）。お気に入りは件数が少ないので7日間から始める
  const [day, setDay] = useState<string>('week')

  useEffect(() => {
    const saved = localStorage.getItem(FORMAT_FILTER_STORAGE_KEY)
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ブラウザ保存領域や端末の状態は描画後にしか読めないため（初回描画で読むとSSRと不一致になる）
      setSelectedFormats(new Set(JSON.parse(saved)))
    }

    try {
      const savedState = sessionStorage.getItem(PAGE_STATE_STORAGE_KEY)
      if (savedState) {
        const parsed = JSON.parse(savedState)
        setTab(parsed.tab ?? 'events')
        setVisibleEventCount(parsed.visibleEventCount ?? PAGE_SIZE)
        // 前回選んだ日が過ぎていたら7日間に戻す
        if (typeof parsed.day === 'string' && (parsed.day === 'week' || parsed.day >= jstDateKey())) setDay(parsed.day)
      }
    } catch {
      // 復元失敗は無視
    }
    setPageStateRestored(true)
  }, [])

  useEffect(() => {
    if (!pageStateRestored) return
    try {
      sessionStorage.setItem(PAGE_STATE_STORAGE_KEY, JSON.stringify({ tab, visibleEventCount, day }))
    } catch {
      // 保存失敗は無視
    }
  }, [pageStateRestored, tab, visibleEventCount, day])

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

  const formatEvents =
    selectedFormats.size === 0
      ? events
      : events.filter((e) =>
          selectedFormats.has(e.format) ||
          (selectedFormats.has('other') && OTHER_FORMAT_KEYS.includes(e.format))
        )
  // 日付の帯に出す日ごとの件数（フォーマットの絞り込みを反映）
  const dayCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of formatEvents) counts.set(e.held_at, (counts.get(e.held_at) ?? 0) + 1)
    return counts
  }, [formatEvents])
  const filteredEvents = day === 'week' ? formatEvents : formatEvents.filter((e) => e.held_at === day)
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
      // 日付の帯（今日から7日間）と同じ範囲
      const nextWeek = addDaysToKey(today, 6)

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
      <div className="app-header sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
        <h1 className="font-display text-2xl text-slate-900 mb-3">お気に入り</h1>
        <div className="flex gap-2">
          {TABS.map((t) => (
            <Chip key={t.key} selected={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </Chip>
          ))}
        </div>
        </div>
        {tab === 'events' && (
          <div className="max-w-lg mx-auto px-3 pb-2">
            <DateStrip
              selected={day}
              onSelect={(d) => {
                setDay(d)
                setVisibleEventCount(PAGE_SIZE)
              }}
              counts={dayCounts}
            />
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <SkeletonList kind={tab === 'shops' ? 'shop' : 'event'} />
        ) : tab === 'shops' ? (
          shops.length === 0 ? (
            <div className="surface px-4 py-10 flex flex-col items-center gap-2 text-center">
              <span className="w-12 h-12 rounded-2xl bg-yellow-50 text-yellow-500 flex items-center justify-center">
                <Star size={22} />
              </span>
              <p className="text-sm font-semibold text-slate-700">お気に入り店舗がまだありません</p>
              <p className="text-xs text-slate-500">店舗ページの☆を押すと、ここに追加されます</p>
              <Link href="/shops" className="mt-1 h-9 px-4 rounded-full bg-slate-900 text-white text-xs font-bold inline-flex items-center">
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
            <div className="flex flex-wrap gap-2 mt-2 mb-4">
              {FORMATS.map((f) => (
                <Chip key={f.key} selected={selectedFormats.has(f.key)} onClick={() => toggleFormat(f.key)}>
                  {f.label}
                </Chip>
              ))}
            </div>
            {filteredEvents.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-8">
                {events.length === 0
                  ? '今週のイベントはありません'
                  : formatEvents.length === 0
                    ? '該当するフォーマットのイベントはありません'
                    : 'この日のイベントはありません'}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4">
                  {groupByDate(visibleEvents).map((group) => (
                    <section key={group.date} className="flex flex-col">
                      <h2 className="text-sm font-bold text-slate-900 pb-1">{formatDayHeading(group.date)}</h2>
                      {groupSameShopAndTime(group.items).map((bundle) => (
                        <EventRow
                          key={bundle[0].id}
                          href={`/shops/${bundle[0].shop_id}`}
                          startTime={bundle[0].start_time}
                          soon={isStartingSoon(bundle[0].held_at, bundle[0].start_time)}
                          shopName={bundle[0].shops?.name}
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
                      ))}
                    </section>
                  ))}
                </div>
                {filteredEvents.length > visibleEventCount && (
                  <button
                    onClick={() => setVisibleEventCount((v) => v + PAGE_SIZE)}
                    className="w-full h-11 mt-3 rounded-xl surface text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    もっと見る（残り{filteredEvents.length - visibleEventCount}件）
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
