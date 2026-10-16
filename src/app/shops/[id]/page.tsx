import { createClient } from '@/lib/supabase'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { ReviewWithLikes } from '@/types'
import ShopBadges from '@/components/ui/ShopBadges'
import ReviewSection from '@/components/shop/ReviewSection'
import FavoriteButton from '@/components/shop/FavoriteButton'
import PhotoGallery from '@/components/shop/PhotoGallery'
import CoverPhotoGrid from '@/components/shop/CoverPhotoGrid'
import OfficialEventsSection from '@/components/shop/OfficialEventsSection'
import BackButton from '@/components/ui/BackButton'
import DetailHeaderTitle from '@/components/shop/DetailHeaderTitle'
import { jstDateKey } from '@/lib/eventTime'
import { parseBusinessHours, summarizeBusinessHours } from '@/lib/businessHours'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin, ExternalLink, Navigation, PenLine, Star, Clock, SquareParking } from 'lucide-react'

type Props = {
  params: Promise<{ id: string }>
}

// 取得結果の型（投稿者は多対1の結合なのでオブジェクト、いいね数は集計結果の配列で返る）
type ReviewRow = Omit<ReviewWithLikes, 'like_count'> & { review_likes: { count: number }[] | null }
type PhotoRow = { id: string; url: string; user_id: string; photo_likes: { count: number }[] | null }

// 店舗の取得。generateMetadata と本体で同じ店舗を2回問い合わせないよう、1回のリクエスト内で結果を共有する
const getShop = cache(async (id: string) => {
  const { data } = await createClient()
    .from('shops')
    .select(
      'id, official_id, name, address, prefecture, lat, lng, is_wpn_premium, is_teaching_meister, first_listed_at, commander_count, standard_count, modern_count, pioneer_count, legacy_count, limited_count, other_count, review_count, avg_stock, avg_price, avg_playspace, avg_staff, avg_access, avg_total, weekly_event_count, cover_photo_urls, business_hours, parking_available, parking_note'
    )
    .eq('id', id)
    .maybeSingle()
  return data
})

// 店舗ごとのタイトル・説明文・共有時のプレビュー（検索結果やSNSで店名が出るように）
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const shop = await getShop(id)

  if (!shop) return { title: '店舗が見つかりません' }

  const rating =
    shop.review_count > 0 && shop.avg_total !== null
      ? `評価${Number(shop.avg_total).toFixed(1)}（${shop.review_count}件）・`
      : ''
  const description = `${shop.prefecture ?? ''}のMTG公認店舗「${shop.name}」の口コミとイベント情報。${rating}週${shop.weekly_event_count}回のイベントを開催。${shop.address ?? ''}`
  const title = `${shop.name}の口コミ・イベント情報`
  const images = shop.cover_photo_urls?.length ? [{ url: shop.cover_photo_urls[0] }] : undefined

  return {
    title,
    description,
    alternates: { canonical: `/shops/${id}` },
    // openGraphは親（layout）の設定と結合されず置き換わるため、サイト名・ロケールもここで指定する
    openGraph: { title, description, url: `/shops/${id}`, siteName: 'ShopTutor', locale: 'ja_JP', type: 'website', ...(images && { images }) },
    twitter: { card: 'summary_large_image', title, description, ...(images && { images }) },
  }
}

export default async function ShopDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = createClient()

  // 店舗・イベント・レビュー・写真はidのみに依存するので並列に取得する（店舗はgenerateMetadataと共有）
  const [shop, { data: events }, { data: reviewsData }, { data: photosData }] =
    await Promise.all([
      getShop(id),
      supabase
        .from('events')
        .select('id, shop_id, title, format, format_raw, held_at, start_time, prefecture')
        .eq('shop_id', id)
        .gte('held_at', jstDateKey())
        .order('held_at', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: false }),
      supabase
        .from('reviews')
        .select(
          'id, shop_id, user_id, stock_rating, price_rating, playspace_rating, staff_rating, access_rating, body, is_edited, created_at, updated_at, profiles!reviews_user_id_fkey(name, avatar_url, main_format, sub_formats), review_likes(count)'
        )
        .eq('shop_id', id)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('shop_photos')
        .select('id, url, user_id, photo_likes(count)')
        .eq('shop_id', id)
        .eq('is_deleted', false),
    ])

  if (!shop) notFound()

  supabase.rpc('increment_shop_view', { shop_id_input: id }).then(() => {})

  // 訪問者分析用の記録（ログイン済みならフォーマットも記録されるため、cookie付きクライアントで呼ぶ）
  createServerSupabase()
    .then((serverClient) => serverClient.rpc('record_shop_view', { shop_id_input: id }))
    .then(() => {})
    .catch(() => {})

  const reviews: ReviewWithLikes[] = ((reviewsData ?? []) as unknown as ReviewRow[]).map((r) => ({
    ...r,
    like_count: r.review_likes?.[0]?.count ?? 0,
  }))

  const photos = ((photosData ?? []) as unknown as PhotoRow[]).map((p) => ({
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

  // 経路案内はGoogleマップに委ねる（座標があれば座標、なければ店名＋住所で検索）
  const mapQuery =
    shop.lat !== null && shop.lng !== null
      ? `${shop.lat},${shop.lng}`
      : `${shop.name} ${shop.address || shop.prefecture}`
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`

  const sectionLinks = [
    { href: '#events', label: 'イベント' },
    { href: '#reviews', label: 'レビュー' },
    ...(shop.business_hours || shop.parking_available !== null ? [{ href: '#info', label: '店舗情報' }] : []),
    { href: '#photos', label: '写真' },
  ]

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* ヘッダー＋セクションへの移動 */}
      <div className="app-header sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-12 flex items-center gap-2">
          <BackButton />
          <DetailHeaderTitle shopName={shop.name} targetId="shop-name" />
        </div>
        <nav className="max-w-lg mx-auto px-2 flex" aria-label="ページ内の移動">
          {sectionLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="flex-1 text-center text-sm font-medium text-gray-600 hover:text-gray-900 py-2.5 border-b-2 border-transparent hover:border-gray-300"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">

        {/* 店舗写真（プレミアム店舗の公式写真・最大3枚） */}
        {shop.cover_photo_urls && shop.cover_photo_urls.length > 0 && (
          <CoverPhotoGrid urls={shop.cover_photo_urls} alt={shop.name} />
        )}

        {/* 基本情報 */}
        <div className="surface p-4 flex flex-col gap-3">
          <ShopBadges shop={shop} />
          <h1 id="shop-name" className="text-xl font-bold text-gray-900 leading-snug">{shop.name}</h1>

          <div className="flex flex-col gap-1.5 text-sm">
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-gray-700 hover:text-blue-700"
            >
              <MapPin size={16} className="mt-0.5 text-gray-400 flex-shrink-0" />
              <span className="underline decoration-gray-300 underline-offset-2">{shop.address || shop.prefecture}</span>
            </a>
            <a
              href={`https://mtg-jp.com/events/shop/${shop.official_id}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:underline"
            >
              <ExternalLink size={16} className="flex-shrink-0" />
              公式ページ（mtg-jp.com）
            </a>
          </div>

          {/* 要点の数字 */}
          <div className="grid grid-cols-3 border rounded-xl divide-x text-center">
            <a href="#reviews" className="py-2 flex flex-col gap-0.5">
              <span className="text-lg font-bold text-gray-900 inline-flex items-center justify-center gap-1 tabular-nums">
                <Star size={16} className="fill-yellow-400 text-yellow-400" />
                {shop.avg_total !== null && shop.review_count > 0 ? shop.avg_total.toFixed(1) : '—'}
              </span>
              <span className="text-[11px] text-gray-500">レビュー{shop.review_count}件</span>
            </a>
            <a href="#events" className="py-2 flex flex-col gap-0.5">
              <span className="text-lg font-bold text-gray-900 tabular-nums">
                {shop.weekly_event_count}<span className="text-xs font-medium">回</span>
              </span>
              <span className="text-[11px] text-gray-500">週のイベント</span>
            </a>
            <a href="#photos" className="py-2 flex flex-col gap-0.5">
              <span className="text-lg font-bold text-gray-900 tabular-nums">
                {photos.length}<span className="text-xs font-medium">枚</span>
              </span>
              <span className="text-[11px] text-gray-500">写真</span>
            </a>
          </div>
        </div>

        {/* 公式イベント情報 */}
        <section id="events" className="scroll-mt-28">
          <OfficialEventsSection
            formatCounts={formatCounts}
            events={events ?? []}
            weeklyEventCount={shop.weekly_event_count}
          />
        </section>

        {/* レビュー概要・一覧 */}
        <section id="reviews" className="scroll-mt-28">
          <ReviewSection
            shopId={shop.id}
            avgTotal={shop.avg_total}
            reviewCount={shop.review_count}
            ratingAverages={RATING_LABELS}
            reviews={reviews}
          />
        </section>

        {/* 営業時間・駐車場（プレミアム店舗のオーナー設定情報） */}
        {(shop.business_hours || shop.parking_available !== null) && (
          <section id="info" className="scroll-mt-28 surface p-4 flex flex-col gap-3">
            <h2 className="font-bold text-base text-gray-900">店舗情報</h2>
            {shop.business_hours && (
              <div className="flex items-start gap-2 text-sm text-gray-700">
                <Clock size={16} className="mt-0.5 text-gray-400 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1">営業時間</div>
                  <div className="flex flex-col gap-0.5">
                    {summarizeBusinessHours(parseBusinessHours(shop.business_hours)).map((g) => (
                      <div key={g.label} className="flex gap-2">
                        <span className="text-gray-500 w-14 flex-shrink-0">{g.label}</span>
                        <span>{g.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {shop.parking_available !== null && (
              <div className="flex items-start gap-2 text-sm text-gray-700">
                <SquareParking size={16} className="mt-0.5 text-gray-400 flex-shrink-0" />
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">駐車場</div>
                  <div>
                    {shop.parking_available ? 'あり' : 'なし'}
                    {shop.parking_available && shop.parking_note && (
                      <span className="text-gray-500">（{shop.parking_note}）</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 店舗写真 */}
        <section id="photos" className="scroll-mt-28">
          <PhotoGallery shopId={shop.id} initialPhotos={photos} />
        </section>
      </div>

      {/* 下部アクションバー（BottomNavの代わりに表示） */}
      <div className="fixed bottom-0 inset-x-0 z-20 bg-white border-t pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-lg mx-auto px-4 py-2.5 flex gap-2">
          <FavoriteButton shopId={shop.id} />
          <Link
            href={`/shops/${shop.id}/review`}
            className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-bold text-gray-800 inline-flex items-center justify-center gap-1.5 hover:bg-gray-50"
          >
            <PenLine size={16} />
            レビューを書く
          </Link>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-11 rounded-xl bg-blue-600 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:bg-blue-700"
          >
            <Navigation size={16} />
            経路
          </a>
        </div>
      </div>
    </div>
  )
}
