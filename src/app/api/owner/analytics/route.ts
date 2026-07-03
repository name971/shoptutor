import { NextResponse } from 'next/server'
import { requireShopOwner } from '@/lib/owner-auth'
import { createAdminClient } from '@/lib/supabase-admin'

const DAYS = 30

export async function GET() {
  const result = await requireShopOwner()
  if (!result) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ data: stats, error: statsError }, { data: formats, error: formatsError }] =
    await Promise.all([
      admin
        .from('shop_view_stats')
        .select('view_hour, anon_views, member_fav_views, member_nonfav_views')
        .eq('shop_id', result.shop.id)
        .gte('view_date', since),
      admin
        .from('shop_view_formats')
        .select('viewer_id, format')
        .eq('shop_id', result.shop.id)
        .gte('view_date', since),
    ])

  if (statsError || formatsError) {
    return NextResponse.json(
      { error: statsError?.message ?? formatsError?.message },
      { status: 500 }
    )
  }

  const anonViews = (stats ?? []).reduce((sum, r) => sum + r.anon_views, 0)
  const memberFavViews = (stats ?? []).reduce((sum, r) => sum + r.member_fav_views, 0)
  const memberNonfavViews = (stats ?? []).reduce((sum, r) => sum + r.member_nonfav_views, 0)
  const totalViews = anonViews + memberFavViews + memberNonfavViews

  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))
  for (const row of stats ?? []) {
    hourly[row.view_hour].count += row.anon_views + row.member_fav_views + row.member_nonfav_views
  }

  // フォーマットごとのユニーク訪問者数（viewer_idは集計にのみ使い、レスポンスには含めない）
  const viewersByFormat = new Map<string, Set<string>>()
  for (const row of formats ?? []) {
    if (!viewersByFormat.has(row.format)) viewersByFormat.set(row.format, new Set())
    viewersByFormat.get(row.format)!.add(row.viewer_id)
  }
  const formatCounts = Array.from(viewersByFormat.entries())
    .map(([format, viewers]) => ({ format, count: viewers.size }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({
    days: DAYS,
    total_views: totalViews,
    anon_views: anonViews,
    member_fav_views: memberFavViews,
    member_nonfav_views: memberNonfavViews,
    hourly,
    format_counts: formatCounts,
  })
}
