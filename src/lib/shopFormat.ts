import { ShopListItem } from '@/types'

export const FORMAT_COUNT_FIELDS = [
  { key: 'commander', field: 'commander_count' },
  { key: 'standard', field: 'standard_count' },
  { key: 'modern', field: 'modern_count' },
  { key: 'pioneer', field: 'pioneer_count' },
  { key: 'legacy', field: 'legacy_count' },
  { key: 'limited', field: 'limited_count' },
] as const

type FormatCountSource = Pick<ShopListItem, (typeof FORMAT_COUNT_FIELDS)[number]['field']>

// 開催回数の多い順のフォーマット一覧（0回は除く）
export function getActiveFormats(shop: FormatCountSource): { key: string; count: number }[] {
  return FORMAT_COUNT_FIELDS.map((f) => ({ key: f.key as string, count: shop[f.field] }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count)
}

// その店の主力フォーマット（最も開催回数が多いもの）。イベントがなければnull
export function getMainFormat(shop: FormatCountSource): string | null {
  return getActiveFormats(shop)[0]?.key ?? null
}

// 指定フォーマットの週あたり開催回数
export function getFormatCount(shop: FormatCountSource, format: string): number {
  const field = FORMAT_COUNT_FIELDS.find((f) => f.key === format)?.field
  return field ? shop[field] : 0
}
