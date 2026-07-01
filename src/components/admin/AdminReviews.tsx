'use client'

import { useEffect, useState } from 'react'

type Review = {
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

export default function AdminReviews() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/reviews')
    const data = await res.json()
    setReviews(data.reviews ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const toggleHide = async (review: Review) => {
    const res = await fetch(`/api/admin/reviews/${review.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: !review.is_hidden }),
    })
    if (res.ok) {
      setReviews((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, is_hidden: !review.is_hidden } : r))
      )
    }
  }

  const handleDelete = async (reviewId: string) => {
    if (!window.confirm('このレビューを完全に削除しますか？この操作は取り消せません。')) return

    const res = await fetch(`/api/admin/reviews/${reviewId}`, { method: 'DELETE' })
    if (res.ok) {
      setReviews((prev) => prev.filter((r) => r.id !== reviewId))
    }
  }

  if (loading) return <div className="text-center text-gray-400 text-sm py-8">読み込み中...</div>

  return (
    <div className="flex flex-col gap-2">
      {reviews.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-8">レビューがありません</div>
      ) : (
        reviews.map((review) => (
          <div
            key={review.id}
            className={`bg-white rounded-xl border p-3 ${review.is_hidden ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-medium truncate">{review.shops?.name}</div>
              <div className="text-xs text-gray-400 whitespace-nowrap">
                {new Date(review.created_at).toLocaleDateString('ja-JP')}
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-1">投稿者: {review.profiles?.name ?? '匿名'}</div>
            {review.body && <div className="text-xs text-gray-600 mb-2">{review.body}</div>}
            <div className="flex items-center justify-between text-xs">
              <span className={review.is_hidden ? 'text-red-500' : 'text-green-600'}>
                {review.is_hidden ? '非表示中' : '表示中'}
              </span>
              <div className="flex gap-3">
                <button onClick={() => toggleHide(review)} className="text-blue-600 hover:underline">
                  {review.is_hidden ? '復元' : '非表示にする'}
                </button>
                <button onClick={() => handleDelete(review.id)} className="text-red-500 hover:underline">
                  削除
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
