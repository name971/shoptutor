export type AdminTab = 'overview' | 'shops' | 'reviews' | 'photos' | 'users'

// 概要から各タブへ移る（filter はそのタブの初期の絞り込み。例：'hidden'・'nocoords'）
export type AdminNavigate = (tab: AdminTab, filter?: string) => void

export type AdminReview = {
  id: string
  body: string | null
  stock_rating: number
  price_rating: number
  playspace_rating: number
  staff_rating: number
  access_rating: number
  is_hidden: boolean
  created_at: string
  shops: { id: string; name: string } | null
  profiles: { name: string } | null
}

export type AdminPhoto = {
  id: string
  url: string
  caption?: string | null
  created_at: string
  shops: { id: string; name: string } | null
  profiles: { name: string } | null
}

export function reviewAverage(r: AdminReview): number {
  return (r.stock_rating + r.price_rating + r.playspace_rating + r.staff_rating + r.access_rating) / 5
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
}
