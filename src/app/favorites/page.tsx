'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Shop, Event } from '@/types'
import ShopCard from '@/components/shop/ShopCard'
import FormatBadge from '@/components/ui/FormatBadge'
import EventNotice from '@/components/shared/EventNotice'

type FavoriteEvent = Event & { shops: { name: string } | null }

const TABS = [
  { key: 'shops', label: '店舗一覧' },
  { key: 'events', label: '今週のイベント' },
] as const

const FORMATS = [
  { key: 'commander', label: 'コマンダー' },
  { key: 'standard',  label: 'スタンダード' },
  { key: 'modern',    label: 'モダン' },
  { key: 'pioneer',   label: 'パイオニア' },
  { key: 'legacy',    label: 'レガシー' },
  { key: 'limited',   label: 'リミテッド' },
  { key: 'other',     label: 'その他' },
]

const FORMAT_FILTER_STORAGE_KEY = 'favorites-event-format-filter'
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

  useEffect(() => {
    const saved = localStorage.getItem(FORMAT_FILTER_STORAGE_KEY)
    if (saved) {
      setSelectedFormats(new Set(JSON.parse(saved)))
    }
  }, [])

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
    selectedFormats.size === 0 ? events : events.filter((e) => selectedFormats.has(e.format))
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

      const today = new Date().toISOString().split('T')[0]
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]

      const { data: eventsData } = await supabase
        .from('events')
        .select('*, shops(name)')
        .in('shop_id', shopIds)
        .gte('held_at', today)
        .lte('held_at', nextWeek)
        .order('held_at', { ascending: true })
      setEvents((eventsData as FavoriteEvent[]) ?? [])

      setLoading(false)
    }
    load()
  }, [router])

  if (checking) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <div className="font-bold text-sm mb-2">お気に入り</div>
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="text-center text-gray-400 text-sm py-8">読み込み中...</div>
        ) : tab === 'shops' ? (
          shops.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8">
              お気に入り店舗がまだありません
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
                <button
                  key={f.key}
                  onClick={() => toggleFormat(f.key)}
                  className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition-colors ${
                    selectedFormats.has(f.key)
                      ? 'bg-blue-50 border-blue-400 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {f.label}
                </button>
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
                    <div key={event.id} className="bg-white rounded-xl border p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium truncate">{event.shops?.name}</div>
                        <FormatBadge format={event.format} size="sm" />
                      </div>
                      <div className="text-xs text-gray-500 flex items-center justify-between gap-2">
                        <span className="truncate flex-1">{event.title}</span>
                        <span className="text-gray-400 whitespace-nowrap">
                          {event.held_at}
                          {event.start_time && ` ${event.start_time}〜`}
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
