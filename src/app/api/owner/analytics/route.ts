import { NextResponse } from 'next/server'
import { requireShopOwner } from '@/lib/owner-auth'
import { createAdminClient } from '@/lib/supabase-admin'

const DAYS = 30

// view_dateは 'YYYY-MM-DD'（JSTの暦日）で保存されているため、getUTCDay()で
// サーバーのタイムゾーンに影響されず曜日を求める（new Date('YYYY-MM-DD')はUTC 0時扱いになるため）
function dowOf(dateStr: string): number {
  return new Date(dateStr).getUTCDay()
}

function bucketBy<T extends { view_hour: number; view_date: string }>(
  rows: T[],
  bucketSize: number,
  pickBucket: (row: T) => number,
  pickViewerId: (row: T) => string
): Set<string>[] {
  const buckets: Set<string>[] = Array.from({ length: bucketSize }, () => new Set())
  for (const row of rows) {
    buckets[pickBucket(row)].add(pickViewerId(row))
  }
  return buckets
}

export async function GET() {
  const result = await requireShopOwner()
  if (!result) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ data: stats, error: statsError }, { data: formats, error: formatsError }] =
    await Promise.all([
      admin
        .from('shop_view_stats')
        .select('view_hour, view_date, anon_views, member_fav_views, member_nonfav_views')
        .eq('shop_id', result.shop.id)
        .gte('view_date', since),
      admin
        .from('shop_view_formats')
        .select('viewer_id, format, is_main, view_hour, view_date')
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
  const dowTotal = Array.from({ length: 7 }, (_, dow) => ({ dow, count: 0 }))
  for (const row of stats ?? []) {
    const n = row.anon_views + row.member_fav_views + row.member_nonfav_views
    hourly[row.view_hour].count += n
    dowTotal[dowOf(row.view_date)].count += n
  }

  // フォーマットごとのユニーク訪問者数（viewer_idは集計にのみ使い、レスポンスには含めない）
  // mainCountは「そのフォーマットをメインに選んでいる人」の内数（精度の高いシグナル）
  const viewersByFormat = new Map<string, Set<string>>()
  const mainViewersByFormat = new Map<string, Set<string>>()
  for (const row of formats ?? []) {
    if (!viewersByFormat.has(row.format)) viewersByFormat.set(row.format, new Set())
    viewersByFormat.get(row.format)!.add(row.viewer_id)
    if (row.is_main) {
      if (!mainViewersByFormat.has(row.format)) mainViewersByFormat.set(row.format, new Set())
      mainViewersByFormat.get(row.format)!.add(row.viewer_id)
    }
  }
  const formatCounts = Array.from(viewersByFormat.entries())
    .map(([format, viewers]) => ({
      format,
      count: viewers.size,
      main_count: mainViewersByFormat.get(format)?.size ?? 0,
    }))
    .sort((a, b) => b.main_count - a.main_count || b.count - a.count)

  // フォーマット×時間帯／フォーマット×曜日のユニーク訪問者数。メイン基準・サブ基準を別々に
  // 集計することで、同じ訪問者が両方の枠に二重計上されるのを避ける。
  const formatHourlyMain: Record<string, { hour: number; count: number }[]> = {}
  const formatHourlySub: Record<string, { hour: number; count: number }[]> = {}
  const formatDowMain: Record<string, { dow: number; count: number }[]> = {}
  const formatDowSub: Record<string, { dow: number; count: number }[]> = {}
  for (const { format } of formatCounts) {
    const rowsForFormat = (formats ?? []).filter((r) => r.format === format)
    const mainRows = rowsForFormat.filter((r) => r.is_main)
    const subRows = rowsForFormat.filter((r) => !r.is_main)

    const mainByHour = bucketBy(mainRows, 24, (r) => r.view_hour, (r) => r.viewer_id)
    const subByHour = bucketBy(subRows, 24, (r) => r.view_hour, (r) => r.viewer_id)
    formatHourlyMain[format] = mainByHour.map((s, hour) => ({ hour, count: s.size }))
    formatHourlySub[format] = subByHour.map((s, hour) => ({ hour, count: s.size }))

    const mainByDow = bucketBy(mainRows, 7, (r) => dowOf(r.view_date), (r) => r.viewer_id)
    const subByDow = bucketBy(subRows, 7, (r) => dowOf(r.view_date), (r) => r.viewer_id)
    formatDowMain[format] = mainByDow.map((s, dow) => ({ dow, count: s.size }))
    formatDowSub[format] = subByDow.map((s, dow) => ({ dow, count: s.size }))
  }

  return NextResponse.json({
    days: DAYS,
    total_views: totalViews,
    anon_views: anonViews,
    member_fav_views: memberFavViews,
    member_nonfav_views: memberNonfavViews,
    hourly,
    dow_total: dowTotal,
    format_counts: formatCounts,
    format_hourly_main: formatHourlyMain,
    format_hourly_sub: formatHourlySub,
    format_dow_main: formatDowMain,
    format_dow_sub: formatDowSub,
  })
}
