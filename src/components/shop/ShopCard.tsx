import { ShopListItem, FORMAT_HEX, FORMAT_LABELS, FORMAT_COLORS } from '@/types'
import { isNew } from '@/components/ui/ShopBadges'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { getActiveFormats } from '@/lib/shopFormat'

type Props = {
  shop: ShopListItem
  distance?: number | null
  showPrefecture?: boolean
  isPr?: boolean
  onClick?: () => void
}

// 店舗カード。店舗タブは「どこへ行くか」を選ぶ画面なので、店の特徴（写真・遊ばれているフォーマット・評価）を主役にする。
// 1段目：店名＋評価、2段目：フォーマットの内訳（細い帯）、3段目：場所・週回数・主力フォーマット・バッジ
export default function ShopCard({ shop, distance, showPrefecture = true, isPr = false, onClick }: Props) {
  const activeFormats = getActiveFormats(shop)
  const total = activeFormats.reduce((sum, f) => sum + f.count, 0)
  const mainFormat = activeFormats[0]?.key
  const hasDistance = distance !== null && distance !== undefined
  const shopIsNew = isNew(shop.first_listed_at)
  const hasRating = shop.review_count > 0 && shop.avg_total !== null
  const coverUrl = shop.cover_photo_urls?.[0]
  const tileColors = mainFormat ? FORMAT_COLORS[mainFormat] : FORMAT_COLORS.other

  const content = (
    <div className="surface p-3 flex gap-3 hover:shadow-md transition-all cursor-pointer">
      {/* サムネイル：公式写真があれば写真、なければ主力フォーマットの色に店名の頭文字 */}
      <div className={`w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center ${coverUrl ? 'bg-slate-100' : tileColors.bg}`}>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 投稿写真はアップロード時にWebP・1MB以下へ圧縮済みのため、画像最適化は使わない
          <img src={coverUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <span aria-hidden className={`text-2xl font-bold ${tileColors.text}`}>
            {shop.name.slice(0, 1)}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0 font-bold text-[15px] leading-snug text-slate-900 line-clamp-2">{shop.name}</div>
          {hasRating && (
            <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-sm font-bold text-slate-900 tabular-nums">
              <Star size={14} className="fill-yellow-400 text-yellow-400" />
              {shop.avg_total!.toFixed(1)}
            </span>
          )}
        </div>

        {/* 遊ばれているフォーマットの内訳（色だけに頼らないよう、主力は下の段に名前でも出す） */}
        {total > 0 && (
          <div
            className="flex h-1.5 gap-[2px] rounded-full overflow-hidden"
            role="img"
            aria-label={`フォーマットの内訳：${activeFormats.map((f) => `${FORMAT_LABELS[f.key]}${Math.round((f.count / total) * 100)}%`).join('、')}`}
          >
            {activeFormats.map((f) => (
              <span key={f.key} style={{ width: `${(f.count / total) * 100}%`, background: FORMAT_HEX[f.key] }} />
            ))}
          </div>
        )}

        <div className="flex items-center gap-x-1.5 gap-y-1 flex-wrap text-xs text-slate-500">
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
          {mainFormat && <span className={`font-semibold ${tileColors.text}`}>{FORMAT_LABELS[mainFormat]}中心</span>}
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
