import { NextResponse } from 'next/server'
import { requireShopOwner } from '@/lib/owner-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { haversineDistanceKm } from '@/lib/geo'
import { cityOf, REGIONS } from '@/lib/area'
import { jstDateKey, addDaysToKey } from '@/lib/eventTime'
import { FORMAT_COUNT_FIELDS } from '@/lib/shopFormat'

const VIEW_DAYS = 30
const NEAR_KM_OPTIONS = [3, 5, 10, 20]
// 自動の範囲：近い順に10店（1km以内は全部入れる）、ただし30kmまで。
// 30km以内に比べられる店が4店以下なら同じ都道府県、それも4店以下なら地方（東北・九州など）に広げる
// （本番の店舗配置で、10店目までの距離は中央値約25km・都市部の上位1割は2.5km以内、30km以内に5店未満の店が約4分の1）
const AUTO_TARGET = 10
const AUTO_ALWAYS_KM = 1
const AUTO_MAX_KM = 30
const AUTO_MIN_OTHERS = 5
const FORMAT_FIELDS = [...FORMAT_COUNT_FIELDS, { key: 'other', field: 'other_count' }] as const

type ShopRow = {
  id: string
  name: string
  address: string
  prefecture: string
  lat: number | null
  lng: number | null
  weekly_event_count: number
  review_count: number
  avg_total: number | null
} & Record<(typeof FORMAT_FIELDS)[number]['field'], number>

// 地域（同じ都道府県 or 周辺◯km）の店舗との比較。
// 他店の閲覧数は各店の非公開情報なので、地域の平均と自店の順位だけを返し、店ごとの値は返さない。
// 店ごとに返すのは、サイト上で誰でも見られる情報（イベント数・フォーマット・レビュー・お気に入り数）だけ
export async function GET(request: Request) {
  const result = await requireShopOwner()
  if (!result) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const scopeParam = searchParams.get('scope')
  const scope = scopeParam === 'near' ? 'near' : scopeParam === 'prefecture' ? 'prefecture' : 'auto'
  const km = NEAR_KM_OPTIONS.includes(Number(searchParams.get('km'))) ? Number(searchParams.get('km')) : 5

  const admin = createAdminClient()
  const columns = `id, name, address, prefecture, lat, lng, weekly_event_count, review_count, avg_total, ${FORMAT_FIELDS.map((f) => f.field).join(', ')}`
  const { data: me } = await admin.from('shops').select(columns).eq('id', result.shop.id).single<ShopRow>()
  if (!me) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { data: rows, error } = await admin.from('shops').select(columns).eq('status', 'active').returns<ShopRow[]>()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const hasPoint = me.lat !== null && me.lng !== null
  const withDistance = (rows ?? []).map((s) => ({
    ...s,
    distance: hasPoint && s.lat !== null && s.lng !== null ? haversineDistanceKm(me.lat!, me.lng!, s.lat, s.lng) : null,
  }))
  const others = withDistance.filter((s) => s.id !== me.id)
  const samePrefecture = others.filter((s) => s.prefecture === me.prefecture)
  const myRegion = REGIONS.find((r) => r.prefectures.includes(me.prefecture))
  const sameRegion = others.filter((s) => myRegion?.prefectures.includes(s.prefecture))

  // 実際に比べた範囲（画面に「どこと比べたか」を出すため）
  let basis: { kind: 'nearest' | 'near' | 'prefecture' | 'region'; radiusKm?: number; region?: string; fallback?: boolean }
  let picked: typeof others
  if (scope === 'near') {
    picked = others.filter((s) => s.distance !== null && s.distance <= km)
    basis = { kind: 'near', radiusKm: km }
  } else if (scope === 'prefecture') {
    picked = samePrefecture
    basis = { kind: 'prefecture' }
  } else {
    const byDistance = others.filter((s) => s.distance !== null && s.distance <= AUTO_MAX_KM).sort((a, b) => a.distance! - b.distance!)
    const nearest = byDistance.filter((s, idx) => idx < AUTO_TARGET || s.distance! <= AUTO_ALWAYS_KM)
    if (hasPoint && nearest.length >= AUTO_MIN_OTHERS) {
      picked = nearest
      basis = { kind: 'nearest', radiusKm: Math.max(...nearest.map((s) => s.distance!)) }
    } else if (samePrefecture.length >= AUTO_MIN_OTHERS) {
      picked = samePrefecture
      basis = { kind: 'prefecture', fallback: true }
    } else {
      picked = sameRegion
      basis = { kind: 'region', region: myRegion?.name, fallback: true }
    }
  }
  const area = [...picked, { ...me, distance: hasPoint ? 0 : null }]
  const ids = area.map((s) => s.id)

  // お気に入り数（件数だけ）と、直近30日の閲覧数
  const since = addDaysToKey(jstDateKey(), -(VIEW_DAYS - 1))
  const [favRes, viewRes] = await Promise.all([
    admin.from('shop_favorite_counts').select('shop_id, favorite_count').in('shop_id', ids),
    admin.from('shop_view_stats').select('shop_id, anon_views, member_fav_views, member_nonfav_views').in('shop_id', ids).gte('view_date', since),
  ])
  const favorites = new Map<string, number>((favRes.data ?? []).map((r) => [r.shop_id as string, r.favorite_count as number]))
  const views = new Map<string, number>()
  for (const r of viewRes.data ?? []) {
    views.set(r.shop_id, (views.get(r.shop_id) ?? 0) + r.anon_views + r.member_fav_views + r.member_nonfav_views)
  }

  // 指標ごとの 自店・地域平均・順位（大きいほど上位）
  const metric = (value: (s: (typeof area)[number]) => number | null) => {
    const values = area.map((s) => ({ id: s.id, v: value(s) })).filter((x): x is { id: string; v: number } => x.v !== null)
    const mine = values.find((x) => x.id === me.id)?.v ?? null
    const avg = values.length ? values.reduce((sum, x) => sum + x.v, 0) / values.length : null
    const rank = mine === null ? null : values.filter((x) => x.v > mine).length + 1
    return { mine, average: avg, rank, of: values.length }
  }

  // フォーマットの割合（週の開催回数の合計に占める割合）
  const formatTotals = (list: ShopRow[]) => {
    const totals = FORMAT_FIELDS.map((f) => ({ key: f.key, count: list.reduce((sum, s) => sum + (s[f.field] ?? 0), 0) }))
    const all = totals.reduce((sum, t) => sum + t.count, 0) || 1
    return totals.map((t) => ({ ...t, share: t.count / all }))
  }

  const competitors = area
    .map((s) => {
      const formats = FORMAT_FIELDS.map((f) => ({ key: f.key, count: s[f.field] ?? 0 })).sort((a, b) => b.count - a.count)
      return {
        id: s.id,
        name: s.name,
        city: cityOf(s.address),
        distance: s.distance,
        weekly_event_count: s.weekly_event_count,
        review_count: s.review_count,
        avg_total: s.avg_total,
        favorite_count: favorites.get(s.id) ?? 0,
        main_format: formats[0]?.count ? formats[0].key : null,
        is_me: s.id === me.id,
      }
    })
    .sort((a, b) => b.weekly_event_count - a.weekly_event_count || b.favorite_count - a.favorite_count)

  return NextResponse.json({
    scope,
    km,
    basis,
    prefecture: me.prefecture,
    hasLocation: hasPoint,
    shopCount: area.length,
    metrics: {
      weekly_events: metric((s) => s.weekly_event_count),
      rating: metric((s) => (s.review_count > 0 && s.avg_total !== null ? Number(s.avg_total) : null)),
      reviews: metric((s) => s.review_count),
      favorites: metric((s) => favorites.get(s.id) ?? 0),
      views: metric((s) => views.get(s.id) ?? 0),
    },
    formats: { mine: formatTotals([me]), area: formatTotals(area) },
    competitors,
  })
}
