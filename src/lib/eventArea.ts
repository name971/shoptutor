import { shortPrefectureName } from '@/lib/area'

// イベントタブの「どこで」。現在地の周辺・都道府県（複数可）・全国のどれか
export type EventArea =
  | { kind: 'near'; km: number }
  | { kind: 'prefectures'; prefectures: string[] }
  | { kind: 'all' }

export const NEAR_RADIUS_OPTIONS = [3, 5, 10] as const

export function areaLabel(area: EventArea | null): string {
  if (!area) return 'エリアを選ぶ'
  if (area.kind === 'near') return `現在地 ${area.km}km`
  if (area.kind === 'all') return '全国'
  const [first, ...rest] = area.prefectures
  if (rest.length === 0) return first
  if (rest.length === 1) return `${shortPrefectureName(first)}・${shortPrefectureName(rest[0])}`
  return `${shortPrefectureName(first)} 他${rest.length}県`
}
