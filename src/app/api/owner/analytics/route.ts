import { NextResponse } from 'next/server'
import { requireShopOwner } from '@/lib/owner-auth'
import { createAdminClient } from '@/lib/supabase-admin'

const DAYS = 30

// view_dateは 'YYYY-MM-DD'（JSTの暦日）で保存されているため、getUTCDay()で
// サーバーのタイムゾーンに影響されず曜日を求める（new Date('YYYY-MM-DD')はUTC 0時扱いになるため）
function dowOf(dateStr: string): number {
  return new Date(dateStr).getUTCDay()
}

function getOrCreate<K, V>(map: Map<K, V>, key: K, make: () => V): V {
  let v = map.get(key)
  if (!v) {
    v = make()
    map.set(key, v)
  }
  return v
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

  // フォーマット別・メイン/サブ別・時間帯/曜日別のユニーク訪問者数を1パスで集計する
  // （viewer_idは集計にのみ使い、レスポンスには含めない）。
  const viewersByFormat = new Map<string, Set<string>>()
  const mainViewersByFormat = new Map<string, Set<string>>()
  const hourBuckets = new Map<string, { main: Set<string>[]; sub: Set<string>[] }>()
  const dowBuckets = new Map<string, { main: Set<string>[]; sub: Set<string>[] }>()

  for (const row of formats ?? []) {
    getOrCreate(viewersByFormat, row.format, () => new Set()).add(row.viewer_id)
    if (row.is_main) {
      getOrCreate(mainViewersByFormat, row.format, () => new Set()).add(row.viewer_id)
    }

    const hb = getOrCreate(hourBuckets, row.format, () => ({
      main: Array.from({ length: 24 }, () => new Set<string>()),
      sub: Array.from({ length: 24 }, () => new Set<string>()),
    }))
    ;(row.is_main ? hb.main : hb.sub)[row.view_hour].add(row.viewer_id)

    const db = getOrCreate(dowBuckets, row.format, () => ({
      main: Array.from({ length: 7 }, () => new Set<string>()),
      sub: Array.from({ length: 7 }, () => new Set<string>()),
    }))
    ;(row.is_main ? db.main : db.sub)[dowOf(row.view_date)].add(row.viewer_id)
  }

  const formatCounts = Array.from(viewersByFormat.entries())
    .map(([format, viewers]) => ({
      format,
      count: viewers.size,
      main_count: mainViewersByFormat.get(format)?.size ?? 0,
    }))
    .sort((a, b) => b.main_count - a.main_count || b.count - a.count)

  const formatHourlyMain: Record<string, { hour: number; count: number }[]> = {}
  const formatHourlySub: Record<string, { hour: number; count: number }[]> = {}
  const formatDowMain: Record<string, { dow: number; count: number }[]> = {}
  const formatDowSub: Record<string, { dow: number; count: number }[]> = {}
  for (const { format } of formatCounts) {
    const hb = hourBuckets.get(format)!
    formatHourlyMain[format] = hb.main.map((s, hour) => ({ hour, count: s.size }))
    formatHourlySub[format] = hb.sub.map((s, hour) => ({ hour, count: s.size }))

    const db = dowBuckets.get(format)!
    formatDowMain[format] = db.main.map((s, dow) => ({ dow, count: s.size }))
    formatDowSub[format] = db.sub.map((s, dow) => ({ dow, count: s.size }))
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
