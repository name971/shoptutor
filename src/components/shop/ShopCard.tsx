import { Shop } from '@/types'
import ShopBadges from '@/components/ui/ShopBadges'
import StarRating from '@/components/ui/StarRating'
import FormatBadge from '@/components/ui/FormatBadge'
import Link from 'next/link'

type Props = {
  shop: Shop
  distance?: number | null
}

const FORMAT_COUNT_FIELDS = [
  { key: 'commander', field: 'commander_count' },
  { key: 'standard', field: 'standard_count' },
  { key: 'modern', field: 'modern_count' },
  { key: 'pioneer', field: 'pioneer_count' },
  { key: 'legacy', field: 'legacy_count' },
  { key: 'limited', field: 'limited_count' },
] as const

export default function ShopCard({ shop, distance }: Props) {
  const activeFormats = FORMAT_COUNT_FIELDS.filter((f) => shop[f.field] > 0)

  return (
    <Link href={`/shops/${shop.id}`}>
      <div className="bg-white border border-gray-200 rounded-xl p-3 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex justify-between items-start mb-1">
          <div className="font-medium text-sm">{shop.name}</div>
          <div className="flex gap-1 flex-shrink-0 ml-2">
            {shop.is_wpn_premium && (
              <span className="text-[9px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full font-medium">
                WPN
              </span>
            )}
            {shop.is_teaching_meister && (
              <span className="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-full font-medium">
                マイスター
              </span>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500 mb-2">
          {shop.prefecture}
          {distance !== null && distance !== undefined && (
            <span className="ml-1">· {distance.toFixed(1)}km</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <ShopBadges shop={shop} size="sm" showWpn={false} showMeister={false} />
          {activeFormats.map((f) => (
            <FormatBadge key={f.key} format={f.key} size="sm" />
          ))}
        </div>
        <div className="flex justify-between items-center mt-2">
          <StarRating value={shop.avg_total} size="sm" />
          <span className="text-xs text-gray-400">
            週イベント{shop.weekly_event_count}回
          </span>
        </div>
      </div>
    </Link>
  )
}