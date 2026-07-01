'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ReviewWithLikes } from '@/types'
import StarRating from '@/components/ui/StarRating'
import ReviewList from './ReviewList'

type RatingAverage = {
  key: string
  label: string
  avg: number | null
}

type Props = {
  shopId: string
  avgTotal: number | null
  reviewCount: number
  ratingAverages: RatingAverage[]
  reviews: ReviewWithLikes[]
}

export default function ReviewSection({ shopId, avgTotal, reviewCount, ratingAverages, reviews }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-xl border p-3">
      <div className="font-medium text-sm mb-3">レビュー概要</div>

      {reviewCount === 0 ? (
        <div className="text-xs text-gray-400 mb-3">まだレビューがありません</div>
      ) : (
        <div className="flex gap-3 items-center mb-3">
          <div className="text-center">
            <div className="text-4xl font-medium leading-none">{avgTotal?.toFixed(1)}</div>
            <div className="mt-1">
              <StarRating value={avgTotal} size="md" showNumber={false} />
            </div>
            <div className="text-xs text-gray-400 mt-1">{reviewCount}件</div>
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            {ratingAverages.map((r) => (
              <div key={r.key} className="flex items-center gap-2">
                <div className="text-xs text-gray-500 w-28 flex-shrink-0">{r.label}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-400 rounded-full h-1.5"
                    style={{ width: `${((r.avg ?? 0) / 5) * 100}%` }}
                  />
                </div>
                <div className="text-xs font-medium w-6 text-right">
                  {r.avg?.toFixed(1) ?? '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Link
          href={`/shops/${shopId}/review`}
          className="flex-1 text-center bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          ✏️ レビューする
        </Link>
        {reviews.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex-1 text-center border border-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {expanded ? '閉じる ▲' : `レビューを読む ▼`}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t">
          <ReviewList reviews={reviews} />
        </div>
      )}
    </div>
  )
}
