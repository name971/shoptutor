import type { OwnedShop } from '@/lib/owner-auth'
import StarRating from '@/components/ui/StarRating'

type Props = {
  shop: OwnedShop
}

const RATING_LABELS = [
  { key: 'avg_stock', label: '品揃え・在庫' },
  { key: 'avg_price', label: '価格設定・買取査定' },
  { key: 'avg_playspace', label: '対戦スペースの環境' },
  { key: 'avg_staff', label: '接客・店員の対応' },
  { key: 'avg_access', label: 'アクセス・利便性' },
] as const

export default function OwnerReviewSummary({ shop }: Props) {
  return (
    <div className="bg-white rounded-xl border p-3">
      <div className="font-medium text-sm mb-3">レビュー概要</div>

      {shop.review_count === 0 ? (
        <div className="text-xs text-gray-400">まだレビューがありません</div>
      ) : (
        <div className="flex gap-3 items-center">
          <div className="text-center">
            <div className="text-4xl font-medium leading-none">{shop.avg_total?.toFixed(1)}</div>
            <div className="mt-1">
              <StarRating value={shop.avg_total} size="md" showNumber={false} />
            </div>
            <div className="text-xs text-gray-400 mt-1">{shop.review_count}件</div>
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            {RATING_LABELS.map((r) => (
              <div key={r.key} className="flex items-center gap-2">
                <div className="text-xs text-gray-500 w-28 flex-shrink-0">{r.label}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-400 rounded-full h-1.5"
                    style={{ width: `${((shop[r.key] ?? 0) / 5) * 100}%` }}
                  />
                </div>
                <div className="text-xs font-medium w-6 text-right">
                  {shop[r.key]?.toFixed(1) ?? '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
