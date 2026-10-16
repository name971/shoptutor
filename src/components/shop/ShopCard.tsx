import { ShopListItem, FORMAT_HEX } from '@/types'
import { isNew } from '@/components/ui/ShopBadges'
import Link from 'next/link'
import { Star } from 'lucide-react'
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

export default function ShopCard({ shop, nextEvent, distance, showPrefecture = true, isPr = false, onClick }: Props) {
  // 開催回数の多い順に並べ、先頭（その店の主力フォーマット）の色をカード左端の帯に使う
  const activeFormats = getActiveFormats(shop)
  const mainFormat = activeFormats[0]?.key
  const hasDistance = distance !== null && distance !== undefined
  const shopIsNew = isNew(shop.first_listed_at)
  const hasRating = shop.review_count > 0 && shop.avg_total !== null

  // 1段目：店名＋評価、2段目：次のイベント、3段目：場所・週の回数・バッジ（情報を3段に絞る）
  const content = (
    <div className="relative surface py-3 pr-3 pl-4 overflow-hidden hover:shadow-md transition-all cursor-pointer flex flex-col gap-1">
      <span
        aria-hidden
        className="absolute left-0 inset-y-0 w-1"
        style={{ background: mainFormat ? FORMAT_HEX[mainFormat] : '#e5e7eb' }}
      />
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 font-bold text-[15px] leading-snug text-slate-900">{shop.name}</div>
        {hasRating && (
          <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-sm font-bold text-slate-900 tabular-nums">
            <Star size={14} className="fill-yellow-400 text-yellow-400" />
            {shop.avg_total!.toFixed(1)}
          </span>
        )}
      </div>
      {nextEvent && (
        <div className="flex items-center gap-1.5 text-[13px] min-w-0">
          <span
            aria-hidden
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: FORMAT_HEX[nextEvent.format ?? 'other'] ?? FORMAT_HEX.other }}
          />
          <span className="font-bold text-slate-900 whitespace-nowrap tabular-nums">
            {formatEventWhen(nextEvent.held_at, nextEvent.start_time)}
          </span>
          {nextEvent.title && <span className="text-slate-500 truncate">{nextEvent.title}</span>}
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500">
        {(showPrefecture || hasDistance) && (
          <span>
            {showPrefecture && shop.prefecture}
            {showPrefecture && hasDistance && ' · '}
            {hasDistance && <span className="tabular-nums">{distance.toFixed(1)}km</span>}
          </span>
        )}
        <span>
          週<span className="tabular-nums">{shop.weekly_event_count}</span>回
        </span>
        {shop.is_wpn_premium && (
          <span className="text-[11px] font-bold bg-yellow-100 text-yellow-800 px-1.5 rounded">WPNプレミアム</span>
        )}
        {shop.is_teaching_meister && (
          <span className="text-[11px] font-bold bg-orange-100 text-orange-800 px-1.5 rounded">マイスター</span>
        )}
        {shopIsNew && <span className="text-[11px] font-bold bg-indigo-100 text-indigo-800 px-1.5 rounded">NEW</span>}
        {isPr && <span className="ml-auto text-[11px] text-slate-400">PR</span>}
      </div>
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
