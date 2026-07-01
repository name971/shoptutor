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
}

export type Event = {
  id: string
  shop_id: string
  title: string
  format: string
  format_raw: string
  held_at: string
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
    main_formats: string[]
  }
}

export type ReviewWithLikes = Review & {
  like_count: number
}

export type Profile = {
  id: string
  name: string
  avatar_url: string
  main_formats: string[]
  name_changed_at: string | null
}

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