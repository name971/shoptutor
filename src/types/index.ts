export type Shop = {
  id: string
  official_id: string
  name: string
  address: string
  prefecture: string
  lat: number | null
  lng: number | null
  is_wpn_premium: boolean
  is_teaching_meister: boolean
  status: string
  first_listed_at: string
  weekly_event_count: number
  commander_count: number
  standard_count: number
  modern_count: number
  pioneer_count: number
  legacy_count: number
  limited_count: number
  other_count: number
  review_count: number
  avg_stock: number | null
  avg_price: number | null
  avg_playspace: number | null
  avg_staff: number | null
  avg_access: number | null
  avg_total: number | null
  view_count: number
  owner_user_id: string | null
  is_premium: boolean
  pr_enabled: boolean
  business_hours: string | null
  cover_photo_urls: string[]
  parking_available: boolean | null
  parking_note: string | null
}

// 一覧・地図表示で使うカラムのみに絞った型（店舗詳細ページ専用の5軸平均・other_count等は含まない）
// is_premiumはPR枠の判定に使うため一覧側にも残す
export type ShopListItem = Omit<
  Shop,
  | 'official_id'
  | 'status'
  | 'other_count'
  | 'avg_stock'
  | 'avg_price'
  | 'avg_playspace'
  | 'avg_staff'
  | 'avg_access'
  | 'owner_user_id'
  | 'business_hours'
  | 'cover_photo_urls'
  | 'parking_available'
  | 'parking_note'
>

export type Event = {
  id: string
  shop_id: string
  title: string
  format: string
  format_raw: string
  held_at: string
  start_time: string | null
  prefecture: string
}

export type Review = {
  id: string
  shop_id: string
  user_id: string
  stock_rating: number
  price_rating: number
  playspace_rating: number
  staff_rating: number
  access_rating: number
  body: string | null
  is_edited: boolean
  created_at: string
  updated_at: string
  profiles?: {
    name: string
    avatar_url: string
    main_format: string | null
    sub_formats: string[]
  }
}

export type ReviewWithLikes = Review & {
  like_count: number
}

export type Profile = {
  id: string
  name: string
  avatar_url: string
  main_format: string | null
  sub_formats: string[]
  name_changed_at: string | null
}

export const SUB_FORMAT_MAX = 2

export const FORMAT_LABELS: Record<string, string> = {
  commander: 'コマンダー',
  standard: 'スタンダード',
  modern: 'モダン',
  pioneer: 'パイオニア',
  legacy: 'レガシー',
  limited: 'リミテッド',
  vintage: 'ヴィンテージ',
  other: 'その他',
}

export const FORMAT_COLORS: Record<string, { bg: string; text: string }> = {
  commander: { bg: 'bg-purple-100', text: 'text-purple-800' },
  standard:  { bg: 'bg-blue-100',   text: 'text-blue-800' },
  modern:    { bg: 'bg-green-100',  text: 'text-green-800' },
  pioneer:   { bg: 'bg-teal-100',   text: 'text-teal-800' },
  legacy:    { bg: 'bg-red-100',    text: 'text-red-800' },
  limited:   { bg: 'bg-amber-100',  text: 'text-amber-800' },
  vintage:   { bg: 'bg-pink-100',   text: 'text-pink-800' },
  other:     { bg: 'bg-gray-100',   text: 'text-gray-700' },
}

// 店舗・イベントのフォーマット絞り込みチップ（ヴィンテージは対象外）
export const FORMAT_FILTER_OPTIONS = [
  { key: 'commander', label: 'コマンダー' },
  { key: 'standard',  label: 'スタンダード' },
  { key: 'modern',    label: 'モダン' },
  { key: 'pioneer',   label: 'パイオニア' },
  { key: 'legacy',    label: 'レガシー' },
  { key: 'limited',   label: 'リミテッド' },
] as const

export const FORMAT_FILTER_OPTIONS_WITH_OTHER = [
  ...FORMAT_FILTER_OPTIONS,
  { key: 'other', label: 'その他' },
] as const

// shops.other_countは other/vintage/unknown をまとめた集計値なので、
// 「その他」で絞り込む際もこの3つをまとめて対象にする
export const OTHER_FORMAT_KEYS = ['other', 'vintage', 'unknown']

export const RECOMMEND_SORT_OPTIONS = [
  { key: 'recommended', label: 'おすすめ順' },
  { key: 'rating',       label: '評価順' },
  { key: 'event',        label: 'イベント数順' },
] as const