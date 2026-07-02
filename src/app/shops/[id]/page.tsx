import { createClient } from '@/lib/supabase'
import { ReviewWithLikes } from '@/types'
import ShopBadges from '@/components/ui/ShopBadges'
import ReviewSection from '@/components/shop/ReviewSection'
import FavoriteButton from '@/components/shop/FavoriteButton'
import PhotoGallery from '@/components/shop/PhotoGallery'
import OfficialEventsSection from '@/components/shop/OfficialEventsSection'
import BackButton from '@/components/ui/BackButton'
import { jstDateKey } from '@/lib/eventTime'
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

  supabase.rpc('increment_shop_view', { shop_id_input: id }).then(() => {})

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('shop_id', id)
    .gte('held_at', jstDateKey())
    .order('held_at', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false })

  const { data: reviewsData } = await supabase
    .from('reviews')
    .select('*, profiles!reviews_user_id_fkey(name, avatar_url, main_formats), review_likes(count)')
    .eq('shop_id', id)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(10)

  const reviews: ReviewWithLikes[] = (reviewsData ?? []).map((r: any) => ({
    ...r,
    like_count: r.review_likes?.[0]?.count ?? 0,
  }))

  const { data: photosData } = await supabase
    .from('shop_photos')
    .select('id, url, user_id, photo_likes(count)')
    .eq('shop_id', id)
    .eq('is_deleted', false)

  const photos = (photosData ?? []).map((p: any) => ({
    id: p.id,
    url: p.url,
    user_id: p.user_id,
    like_count: p.photo_likes?.[0]?.count ?? 0,
  }))

  const formatCounts = [
    { key: 'commander', label: 'コマンダー', count: shop.commander_count },
    { key: 'standard',  label: 'スタンダード', count: shop.standard_count },
    { key: 'modern',    label: 'モダン', count: shop.modern_count },
    { key: 'pioneer',   label: 'パイオニア', count: shop.pioneer_count },
    { key: 'legacy',    label: 'レガシー', count: shop.legacy_count },
    { key: 'limited',   label: 'リミテッド', count: shop.limited_count },
    { key: 'other',     label: 'その他', count: shop.other_count },
  ].filter((f) => f.count > 0)

  const RATING_LABELS = [
    { key: 'stock_rating',     label: '品揃え・在庫',         avg: shop.avg_stock },
    { key: 'price_rating',     label: '価格設定・買取査定',   avg: shop.avg_price },
    { key: 'playspace_rating', label: '対戦スペースの環境', avg: shop.avg_playspace },
    { key: 'staff_rating',     label: '接客・店員の対応',     avg: shop.avg_staff },
    { key: 'access_rating',    label: 'アクセス・利便性',     avg: shop.avg_access },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <BackButton />
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">

        {/* バッジ */}
        <ShopBadges shop={shop} />

        {/* 基本情報 */}
        <div className="bg-white rounded-xl border p-3 flex items-start justify-between gap-2">
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-snug">{shop.name}</h1>
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
          <FavoriteButton shopId={shop.id} />
        </div>

        {/* レビュー概要・一覧 */}
        <ReviewSection
          shopId={shop.id}
          avgTotal={shop.avg_total}
          reviewCount={shop.review_count}
          ratingAverages={RATING_LABELS}
          reviews={reviews}
        />

        {/* 公式イベント情報 */}
        <OfficialEventsSection
          formatCounts={formatCounts}
          events={events ?? []}
        />

        {/* 店舗写真 */}
        <PhotoGallery shopId={shop.id} initialPhotos={photos} />
      </div>
    </div>
  )
}