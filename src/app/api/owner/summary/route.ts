import { NextResponse } from 'next/server'
import { requireShopOwner } from '@/lib/owner-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { jstDateKey, addDaysToKey } from '@/lib/eventTime'

const DAYS = 30

// オーナー画面の「概要」：閲覧数（直近30日と前の30日・日ごとの推移）、お気に入り数、
// 最近のレビュー、今週のイベントと最後に取り込んだ日時
export async function GET() {
  const result = await requireShopOwner()
  if (!result) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const shopId = result.shop.id
  const today = jstDateKey()
  const from = addDaysToKey(today, -(DAYS * 2 - 1))
  const currentFrom = addDaysToKey(today, -(DAYS - 1))

  const [stats, favorites, reviews, events, lastScrape] = await Promise.all([
    admin
      .from('shop_view_stats')
      .select('view_date, anon_views, member_fav_views, member_nonfav_views')
      .eq('shop_id', shopId)
      .gte('view_date', from),
    admin.from('shop_favorites').select('user_id', { count: 'exact', head: true }).eq('shop_id', shopId),
    admin
      .from('reviews')
      .select('id, body, is_hidden, created_at, updated_at, is_edited, stock_rating, price_rating, playspace_rating, staff_rating, access_rating, profiles(name)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('events')
      .select('id, shop_id, title, format, held_at, start_time')
      .eq('shop_id', shopId)
      .gte('held_at', today)
      .lte('held_at', addDaysToKey(today, 6))
      .order('held_at', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: false }),
    admin
      .from('events')
      .select('scraped_at')
      .eq('shop_id', shopId)
      .order('scraped_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (stats.error) return NextResponse.json({ error: stats.error.message }, { status: 500 })

  // 日ごとの閲覧数（直近30日。閲覧がなかった日も0で埋める）
  const byDate = new Map<string, number>()
  for (const r of stats.data ?? []) {
    byDate.set(r.view_date, (byDate.get(r.view_date) ?? 0) + r.anon_views + r.member_fav_views + r.member_nonfav_views)
  }
  const daily = Array.from({ length: DAYS }, (_, i) => {
    const date = addDaysToKey(currentFrom, i)
    return { date, views: byDate.get(date) ?? 0 }
  })
  const currentViews = daily.reduce((sum, d) => sum + d.views, 0)
  let previousViews = 0
  for (const [date, n] of byDate) if (date < currentFrom) previousViews += n

  return NextResponse.json({
    days: DAYS,
    views: { current: currentViews, previous: previousViews, daily },
    favoriteCount: favorites.count ?? 0,
    reviews: reviews.data ?? [],
    events: events.data ?? [],
    lastScrapedAt: lastScrape.data?.scraped_at ?? null,
  })
}
