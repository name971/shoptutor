'use client'

import { useEffect, useState } from 'react'
import { Star, Eye, Heart, CalendarDays, TrendingUp, TrendingDown, RefreshCw, EyeOff } from 'lucide-react'
import type { OwnedShop } from '@/lib/owner-auth'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import EventRow from '@/components/event/EventRow'
import { groupByDate } from '@/lib/groupByDate'
import { groupSameShopAndTime } from '@/lib/groupEvents'
import { formatDayHeading, isEventPast, isStartingSoon } from '@/lib/eventTime'
import OwnerReviewSummary from './OwnerReviewSummary'
import ViewsTrendChart from './ViewsTrendChart'

type OwnerReview = {
  id: string
  body: string | null
  is_hidden: boolean
  created_at: string
  is_edited: boolean
  stock_rating: number
  price_rating: number
  playspace_rating: number
  staff_rating: number
  access_rating: number
  profiles: { name: string } | null
}

type OwnerEvent = { id: string; shop_id: string; title: string; format: string; held_at: string; start_time: string | null }

type Summary = {
  days: number
  views: { current: number; previous: number; daily: { date: string; views: number }[] }
  favoriteCount: number
  reviews: OwnerReview[]
  events: OwnerEvent[]
  lastScrapedAt: string | null
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function reviewAverage(r: OwnerReview) {
  return (r.stock_rating + r.price_rating + r.playspace_rating + r.staff_rating + r.access_rating) / 5
}

export default function OwnerOverview({ shop }: { shop: OwnedShop }) {
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/owner/summary')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true))
  }, [])

  if (error) return <p className="text-sm text-red-600">情報を取得できませんでした。再読み込みしてください。</p>
  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-24" />
          ))}
        </div>
        <SkeletonBlock className="h-48" />
      </div>
    )
  }

  const { current, previous } = data.views
  const diff = current - previous
  const diffPct = previous > 0 ? Math.round((diff / previous) * 100) : null
  const upcoming = data.events.filter((e) => !isEventPast(e.held_at, e.start_time))

  return (
    <div className="flex flex-col gap-5">
      {/* 主な数字 */}
      <section className="grid grid-cols-2 gap-3" aria-label="主な数字">
        <Tile Icon={Eye} label={`閲覧数（${data.days}日）`} value={current}>
          {previous === 0 && current === 0 ? (
            <span className="text-slate-400">まだ閲覧はありません</span>
          ) : diffPct === null ? (
            <span className="text-slate-500">前の{data.days}日 0件</span>
          ) : (
            <span className={`inline-flex items-center gap-0.5 font-bold ${diff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {diff >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              前の{data.days}日より{diff >= 0 ? '+' : ''}
              {diffPct}%
            </span>
          )}
        </Tile>
        <Tile Icon={Heart} label="お気に入り" value={data.favoriteCount}>
          <span className="text-slate-500">人が登録中</span>
        </Tile>
        <Tile Icon={Star} label="レビュー" value={shop.review_count}>
          <span className="text-slate-500">{shop.avg_total !== null ? `平均 ★${Number(shop.avg_total).toFixed(1)}` : 'まだありません'}</span>
        </Tile>
        <Tile Icon={CalendarDays} label="今週のイベント" value={upcoming.length}>
          <span className="text-slate-500">今日から7日間</span>
        </Tile>
      </section>

      {/* 閲覧数の推移 */}
      <section className="surface p-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-slate-900">店舗ページの閲覧数（日ごと）</h2>
          <span className="text-xs text-slate-500">直近{data.days}日</span>
        </div>
        <ViewsTrendChart daily={data.views.daily} />
      </section>

      <OwnerReviewSummary shop={shop} />

      {/* 最近のレビュー */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-slate-900">最近のレビュー</h2>
        {data.reviews.length === 0 ? (
          <p className="surface p-4 text-sm text-slate-500">まだレビューはありません</p>
        ) : (
          data.reviews.map((r) => (
            <article key={r.id} className={`surface p-4 flex flex-col gap-1.5 ${r.is_hidden ? 'bg-slate-50' : ''}`}>
              <div className="flex items-center gap-2">
                <span className="flex-1 min-w-0 text-sm font-bold text-slate-900 truncate">{r.profiles?.name ?? '匿名'}</span>
                <span className="inline-flex items-center gap-0.5 text-sm font-bold text-slate-900 tabular-nums">
                  <Star size={14} className="fill-yellow-400 text-yellow-400" />
                  {reviewAverage(r).toFixed(1)}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {new Date(r.created_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                {r.is_edited && '（編集済み）'}
              </div>
              {r.body ? (
                <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{r.body}</p>
              ) : (
                <p className="text-xs text-slate-400">（星のみ）</p>
              )}
              {r.is_hidden && (
                <span className="self-start inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 h-6 rounded-full">
                  <EyeOff size={13} />
                  運営により非表示中
                </span>
              )}
            </article>
          ))
        )}
      </section>

      {/* 今週のイベント */}
      <section className="surface p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-bold text-slate-900">今週のイベント（利用者に表示中）</h2>
          <span className="text-xs text-slate-500 inline-flex items-center gap-1">
            <RefreshCw size={12} />
            最後の取り込み {data.lastScrapedAt ? formatDateTime(data.lastScrapedAt) : '—'}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          イベントはmtg-jp.comの公認店舗ページから毎日12:00ごろに自動で取り込んでいます。載っていない・内容が違う場合は、まず公式の店舗ページの登録内容をご確認ください。
        </p>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">今日から7日間のイベントは見つかりませんでした</p>
        ) : (
          <div className="flex flex-col gap-3">
            {groupByDate(upcoming).map((group) => (
              <div key={group.date} className="flex flex-col">
                <h3 className="text-sm font-bold text-slate-900 pb-1">{formatDayHeading(group.date)}</h3>
                {groupSameShopAndTime(group.items).map((bundle) => (
                  <EventRow
                    key={bundle[0].id}
                    startTime={bundle[0].start_time}
                    soon={isStartingSoon(bundle[0].held_at, bundle[0].start_time)}
                    items={bundle.map((e) => ({ title: e.title, format: e.format }))}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Tile({ Icon, label, value, children }: { Icon: typeof Eye; label: string; value: number; children: React.ReactNode }) {
  return (
    <div className="surface p-3 flex flex-col gap-0.5">
      <span className="text-xs text-slate-500 inline-flex items-center gap-1">
        <Icon size={13} />
        {label}
      </span>
      <span className="text-2xl font-bold text-slate-900 tabular-nums leading-tight">{value.toLocaleString()}</span>
      <span className="text-xs">{children}</span>
    </div>
  )
}
