import { createClient } from '@/lib/supabase'
import { Event, ReviewWithLikes } from '@/types'
import ShopBadges from '@/components/ui/ShopBadges'
import FormatBadge from '@/components/ui/FormatBadge'
import ReviewList from '@/components/shop/ReviewList'
import FavoriteButton from '@/components/shop/FavoriteButton'
import Link from 'next/link'
import { notFound } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }>
}

export default async function ShopDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = createClient()

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('id', id)
    .single()

  if (!shop) notFound()

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('shop_id', id)
    .gte('held_at', new Date().toISOString().split('T')[0])
    .order('held_at', { ascending: true })
    .limit(10)

  const { data: reviewsData } = await supabase
    .from('reviews')
    .select('*, profiles(name, avatar_url, main_formats), review_likes(count)')
    .eq('shop_id', id)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(10)

  const reviews: ReviewWithLikes[] = (reviewsData ?? []).map((r: any) => ({
    ...r,
    like_count: r.review_likes?.[0]?.count ?? 0,
  }))

  const formatCounts = [
    { key: 'commander', label: 'コマンダー', count: shop.commander_count },
    { key: 'standard',  label: 'スタンダード', count: shop.standard_count },
    { key: 'modern',    label: 'モダン', count: shop.modern_count },
    { key: 'pioneer',   label: 'パイオニア', count: shop.pioneer_count },
    { key: 'legacy',    label: 'レガシー', count: shop.legacy_count },
    { key: 'limited',   label: 'リミテッド', count: shop.limited_count },
  ].filter((f) => f.count > 0)

  const RATING_LABELS = [
    { key: 'stock_rating',     label: '品揃え・在庫',         avg: shop.avg_stock },
    { key: 'price_rating',     label: '価格設定・買取査定',   avg: shop.avg_price },
    { key: 'playspace_rating', label: 'デュエルスペースの環境', avg: shop.avg_playspace },
    { key: 'staff_rating',     label: '接客・店員の対応',     avg: shop.avg_staff },
    { key: 'access_rating',    label: 'アクセス・利便性',     avg: shop.avg_access },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-gray-500 hover:text-gray-700">←</Link>
        <div className="font-bold text-sm flex-1 truncate">{shop.name}</div>
        <FavoriteButton shopId={shop.id} />
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">

        {/* バッジ */}
        <ShopBadges shop={shop} />

        {/* 基本情報 */}
        <div className="bg-white rounded-xl border p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span>📍</span>
            <span>{shop.address || shop.prefecture}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>🔗</span>
            <a
              href={`https://mtg-jp.com/events/shop/${shop.official_id}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              公式ページ（mtg-jp.com）
            </a>
          </div>
        </div>

        {/* 公式イベント情報 */}
        <div className="bg-white rounded-xl border p-3">
          <div className="font-medium text-sm mb-3 flex items-center gap-1">
            📅 公式イベント情報
          </div>
          {shop.weekly_event_count === 0 ? (
            <div className="text-xs text-gray-400">今週のイベント情報はありません</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-gray-500">週イベント</div>
                  <div className="text-xl font-medium">
                    {shop.weekly_event_count}<span className="text-xs text-gray-400">回</span>
                  </div>
                </div>
                {formatCounts.map((f) => (
                  <div key={f.key} className="bg-gray-50 rounded-lg p-2">
                    <div className="text-xs text-gray-500">{f.label}</div>
                    <div className="text-xl font-medium">
                      {f.count}<span className="text-xs text-gray-400">回/週</span>
                    </div>
                  </div>
                ))}
              </div>
              {events && events.length > 0 && (
                <div className="flex flex-col gap-1">
                  {events.map((event: Event) => (
                    <div key={event.id} className="flex items-center justify-between text-xs py-1 border-t">
                      <span className="text-gray-700 truncate flex-1">{event.title}</span>
                      <div className="flex items-center gap-2 ml-2">
                        <FormatBadge format={event.format} size="sm" />
                        <span className="text-gray-400 whitespace-nowrap">{event.held_at}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* レビュー概要 */}
        <div className="bg-white rounded-xl border p-3">
          <div className="font-medium text-sm mb-3">レビュー概要</div>
          {shop.review_count === 0 ? (
            <div className="text-xs text-gray-400 mb-3">まだレビューがありません</div>
          ) : (
            <div className="flex gap-3 items-center mb-3">
              <div className="text-center">
                <div className="text-4xl font-medium leading-none">{shop.avg_total?.toFixed(1)}</div>
                <div className="text-yellow-400 text-base mt-1">
                  {'★'.repeat(Math.round(shop.avg_total ?? 0))}
                  {'☆'.repeat(5 - Math.round(shop.avg_total ?? 0))}
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
                        style={{ width: `${((r.avg ?? 0) / 5) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs font-medium w-6 text-right">
                      {r.avg?.toFixed(1) ?? '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Link
            href={`/shops/${shop.id}/review`}
            className="block w-full text-center bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            ✏️ この店舗をレビューする
          </Link>
        </div>

        {/* レビュー一覧 */}
        <ReviewList reviews={reviews} />
      </div>
    </div>
  )
}