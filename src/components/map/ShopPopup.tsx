import { ShopListItem } from '@/types'
import ShopBadges from '@/components/ui/ShopBadges'
import StarRating from '@/components/ui/StarRating'

type Props = {
  shop: ShopListItem
}

export default function ShopPopup({ shop }: Props) {
  return (
    <div className="w-48 p-2">
      <div className="font-medium text-sm mb-1">{shop.name}</div>
      <div className="text-xs text-gray-500 mb-2">{shop.prefecture}</div>
      <ShopBadges shop={shop} size="sm" />
      <div className="flex items-center justify-between mt-2">
        <StarRating value={shop.avg_total} size="sm" />
        {/* renderToStringで静的HTML化されるため、next/linkではなくdata属性でSPA遷移をJS側から後付けする */}
        <a
          href={`/shops/${shop.id}`}
          data-shop-detail-link={shop.id}
          className="text-xs text-blue-600 hover:underline"
        >
          詳細 →
        </a>
      </div>
      <div className="text-xs text-gray-400 mt-1">
        週イベント{shop.weekly_event_count}回
      </div>
    </div>
  )
}