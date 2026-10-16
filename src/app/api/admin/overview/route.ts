import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { jstDateKey, addDaysToKey } from '@/lib/eventTime'

// 管理画面の「概要」：主な件数・自動取り込みの状態・新着のレビューと写真
export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const today = jstDateKey()
  const weekEnd = addDaysToKey(today, 6)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const count = { count: 'exact' as const, head: true }

  const [
    activeShops,
    inactiveShops,
    noCoordShops,
    weekEvents,
    todayEvents,
    lastScrape,
    reviewsWeek,
    hiddenReviews,
    photosWeek,
    usersWeek,
    usersTotal,
    recentReviews,
    recentPhotos,
  ] = await Promise.all([
    admin.from('shops').select('id', count).eq('status', 'active'),
    admin.from('shops').select('id', count).neq('status', 'active'),
    admin.from('shops').select('id', count).eq('status', 'active').or('lat.is.null,lng.is.null'),
    admin.from('events').select('id', count).gte('held_at', today).lte('held_at', weekEnd),
    admin.from('events').select('id', count).eq('held_at', today),
    admin.from('events').select('scraped_at').order('scraped_at', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
    admin.from('reviews').select('id', count).gte('created_at', weekAgo),
    admin.from('reviews').select('id', count).eq('is_hidden', true),
    admin.from('shop_photos').select('id', count).eq('is_deleted', false).gte('created_at', weekAgo),
    admin.from('profiles').select('id', count).gte('created_at', weekAgo),
    admin.from('profiles').select('id', count),
    admin
      .from('reviews')
      .select('id, body, is_hidden, created_at, stock_rating, price_rating, playspace_rating, staff_rating, access_rating, shops(id, name), profiles(name)')
      .order('created_at', { ascending: false })
      .limit(5),
    admin
      .from('shop_photos')
      .select('id, url, created_at, shops(id, name), profiles(name)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  return NextResponse.json({
    shops: { active: activeShops.count ?? 0, inactive: inactiveShops.count ?? 0, noCoords: noCoordShops.count ?? 0 },
    events: {
      week: weekEvents.count ?? 0,
      today: todayEvents.count ?? 0,
      lastScrapedAt: lastScrape.data?.scraped_at ?? null,
      hoursSinceScrape: lastScrape.data?.scraped_at ? (Date.now() - new Date(lastScrape.data.scraped_at).getTime()) / 3600000 : null,
    },
    reviews: { week: reviewsWeek.count ?? 0, hidden: hiddenReviews.count ?? 0 },
    photos: { week: photosWeek.count ?? 0 },
    users: { week: usersWeek.count ?? 0, total: usersTotal.count ?? 0 },
    recentReviews: recentReviews.data ?? [],
    recentPhotos: recentPhotos.data ?? [],
  })
}
