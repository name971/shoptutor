import type { ReviewWithLikes } from '@/types'

// 店舗詳細のレビュー一覧：最初の表示（サーバー）と「もっと見る」（端末）で同じ取得内容を使う
export const REVIEW_PAGE_SIZE = 10

// 投稿者は外部キー名を付けて埋め込む（いいねテーブル経由の関係と区別するため）
export const REVIEW_SELECT =
  'id, shop_id, user_id, stock_rating, price_rating, playspace_rating, staff_rating, access_rating, body, is_edited, created_at, updated_at, profiles!reviews_user_id_fkey(name, avatar_url, main_format, sub_formats), review_likes(count)'

// 取得結果の型（投稿者は多対1の結合なのでオブジェクト、いいね数は集計結果の配列で返る）
export type ReviewRow = Omit<ReviewWithLikes, 'like_count'> & { review_likes: { count: number }[] | null }

export function toReviewsWithLikes(rows: unknown): ReviewWithLikes[] {
  return ((rows ?? []) as ReviewRow[]).map((r) => ({ ...r, like_count: r.review_likes?.[0]?.count ?? 0 }))
}
