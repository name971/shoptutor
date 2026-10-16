import { ShopListItem, FORMAT_HEX } from '@/types'
import { isNew } from '@/components/ui/ShopBadges'
import FormatBadge from '@/components/ui/FormatBadge'
import Link from 'next/link'
import { Star, CalendarDays } from 'lucide-react'
import { getActiveFormats } from '@/lib/shopFormat'
import { formatEventWhen } from '@/lib/eventTime'
import type { NextEvent } from '@/lib/nextEvents'

type Props = {
  shop: ShopListItem
  // 次のイベント（ビュー shop_next_events）。なければ表示しない
  nextEvent?: NextEvent | null
  distance?: number | null
  showPrefecture?: boolean
  isPr?: boolean
  onClick?: () => void
}

const MAX_FORMAT_BADGES = 3

export default function ShopCard({ shop, nextEvent, distance, showPrefecture = true, isPr = false, onClick }: Props) {
  // 開催回数の多い順に並べ、先頭（その店の主力フォーマット）の色をカード左端の帯に使う
  const activeFormats = getActiveFormats(shop)
  const mainFormat = activeFormats[0]?.key
  const hiddenFormatCount = activeFormats.length - MAX_FORMAT_BADGES
  const hasDistance = distance !== null && distance !== undefined
  const shopIsNew = isNew(shop.first_listed_at)

  const content = (
    <div
      className="relative surface py-3 pr-3 pl-4 overflow-hidden hover:shadow-md transition-all cursor-pointer flex flex-col gap-1.5"
    >
      <span
        aria-hidden
        className="absolute left-0 inset-y-0 w-1"
        style={{ background: mainFormat ? FORMAT_HEX[mainFormat] : '#e5e7eb' }}
      />
      {(isPr || shopIsNew || shop.is_wpn_premium || shop.is_teaching_meister) && (
        <div className="flex items-center gap-1 flex-wrap">
          {shop.is_wpn_premium && (
            <span className="text-[11px] font-bold bg-yellow-100 text-yellow-800 px-1.5 py-px rounded">WPNプレミアム</span>
          )}
          {shop.is_teaching_meister && (
            <span className="text-[11px] font-bold bg-orange-100 text-orange-800 px-1.5 py-px rounded">マイスター</span>
          )}
          {shopIsNew && (
            <span className="text-[11px] font-bold bg-indigo-100 text-indigo-800 px-1.5 py-px rounded">NEW</span>
          )}
          {isPr && <span className="ml-auto text-[11px] text-gray-400">PR</span>}
        </div>
      )}
      <div className="font-bold text-[15px] leading-snug text-gray-900">{shop.name}</div>
      {nextEvent && (
        <div className="flex items-center gap-1.5 text-xs bg-slate-50 rounded-lg px-2 py-1.5 min-w-0">
          <span
            aria-hidden
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: FORMAT_HEX[nextEvent.format ?? 'other'] ?? FORMAT_HEX.other }}
          />
          <span className="font-bold text-slate-900 whitespace-nowrap tabular-nums">
            次回 {formatEventWhen(nextEvent.held_at, nextEvent.start_time)}
          </span>
          {nextEvent.title && <span className="text-slate-600 truncate">{nextEvent.title}</span>}
        </div>
      )}
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-gray-600">
        {shop.review_count > 0 && shop.avg_total !== null ? (
          <span className="inline-flex items-center gap-1">
            <Star size={14} className="fill-yellow-400 text-yellow-400" />
            <span className="font-bold text-gray-900 tabular-nums">{shop.avg_total.toFixed(1)}</span>
            <span className="text-gray-500 tabular-nums">({shop.review_count})</span>
          </span>
        ) : (
          <span className="text-gray-400">レビューなし</span>
        )}
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={14} className="text-gray-400" />
          週<span className="font-bold text-gray-900 tabular-nums">{shop.weekly_event_count}</span>回
        </span>
        {(showPrefecture || hasDistance) && (
          <span className="text-gray-500">
            {showPrefecture && shop.prefecture}
            {showPrefecture && hasDistance && ' · '}
            {hasDistance && <span className="tabular-nums">{distance.toFixed(1)}km</span>}
          </span>
        )}
      </div>
      {activeFormats.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {activeFormats.slice(0, MAX_FORMAT_BADGES).map((f) => (
            <FormatBadge key={f.key} format={f.key} size="sm" count={f.count} />
          ))}
          {hiddenFormatCount > 0 && <span className="text-[11px] text-gray-500">+{hiddenFormatCount}</span>}
        </div>
      )}
    </div>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        {content}
      </button>
    )
  }

  return <Link href={`/shops/${shop.id}`}>{content}</Link>
}
