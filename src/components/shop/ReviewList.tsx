'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { FORMAT_LABELS, ReviewWithLikes } from '@/types'
import FormatBadge from '@/components/ui/FormatBadge'
import StarRating from '@/components/ui/StarRating'

const RATING_AXIS_LABELS = ['品揃え', '価格', 'スペース', '接客', 'アクセス']

type Props = {
  reviews: ReviewWithLikes[]
}

const SORT_OPTIONS = [
  { key: 'newest', label: '最新順' },
  { key: 'likes', label: 'いいね数順' },
]

const BODY_TRUNCATE_LENGTH = 150

export default function ReviewList({ reviews }: Props) {
  const router = useRouter()
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>(
    Object.fromEntries(reviews.map((r) => [r.id, r.like_count]))
  )
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const [formatFilter, setFormatFilter] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('newest')
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [expandedBodyIds, setExpandedBodyIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return
      setUserId(user.id)

      const { data: likes } = await supabase
        .from('review_likes')
        .select('review_id')
        .eq('user_id', user.id)
        .in('review_id', reviews.map((r) => r.id))

      if (likes) {
        setLikedIds(new Set(likes.map((l) => l.review_id)))
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const availableFormats = useMemo(() => {
    const set = new Set<string>()
    reviews.forEach((r) => r.profiles?.main_formats?.forEach((f) => set.add(f)))
    return Object.keys(FORMAT_LABELS).filter((f) => set.has(f))
  }, [reviews])

  const filteredSorted = useMemo(() => {
    let result = [...reviews]

    if (formatFilter) {
      result = result.filter((r) => r.profiles?.main_formats?.includes(formatFilter))
    }

    result.sort((a, b) => {
      if (sortBy === 'likes') {
        return (likeCounts[b.id] ?? 0) - (likeCounts[a.id] ?? 0)
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return result
  }, [reviews, formatFilter, sortBy, likeCounts])

  const toggleLike = async (reviewId: string) => {
    if (!userId) {
      router.push('/login')
      return
    }
    if (pending.has(reviewId)) return

    setPending((prev) => new Set(prev).add(reviewId))
    const isLiked = likedIds.has(reviewId)
    const supabase = createClient()

    setLikedIds((prev) => {
      const next = new Set(prev)
      if (isLiked) next.delete(reviewId)
      else next.add(reviewId)
      return next
    })
    setLikeCounts((prev) => ({ ...prev, [reviewId]: (prev[reviewId] ?? 0) + (isLiked ? -1 : 1) }))

    const { error } = isLiked
      ? await supabase.from('review_likes').delete().eq('review_id', reviewId).eq('user_id', userId)
      : await supabase.from('review_likes').insert({ review_id: reviewId, user_id: userId })

    if (error) {
      // ロールバック
      setLikedIds((prev) => {
        const next = new Set(prev)
        if (isLiked) next.add(reviewId)
        else next.delete(reviewId)
        return next
      })
      setLikeCounts((prev) => ({ ...prev, [reviewId]: (prev[reviewId] ?? 0) + (isLiked ? 1 : -1) }))
    }

    setPending((prev) => {
      const next = new Set(prev)
      next.delete(reviewId)
      return next
    })
  }

  const toggleBodyExpanded = (reviewId: string) => {
    setExpandedBodyIds((prev) => {
      const next = new Set(prev)
      if (next.has(reviewId)) next.delete(reviewId)
      else next.add(reviewId)
      return next
    })
  }

  if (reviews.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-sm">レビュー一覧</div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      {availableFormats.length > 0 && (
        <div className="flex gap-2 overflow-x-auto mb-3 pb-1">
          {availableFormats.map((f) => (
            <button
              key={f}
              onClick={() => setFormatFilter(formatFilter === f ? null : f)}
              className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition-colors ${
                formatFilter === f
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              {FORMAT_LABELS[f]}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filteredSorted.map((review) => (
          <div key={review.id} className="bg-white rounded-xl border p-3">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
                  {review.profiles?.name?.[0] ?? '?'}
                </div>
                <div>
                  <div className="text-sm font-medium">{review.profiles?.name ?? '匿名'}</div>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {review.profiles?.main_formats?.map((f) => (
                      <FormatBadge key={f} format={f} size="sm" />
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">
                  {new Date(review.created_at).toLocaleDateString('ja-JP')}
                  {review.is_edited && ' · 編集済み'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 bg-gray-50 rounded-lg mb-2 px-2.5 py-1.5 text-xs">
              <span className="flex items-center gap-1 whitespace-nowrap pr-1 mr-1 border-r border-gray-200">
                <StarRating
                  value={
                    (review.stock_rating + review.price_rating + review.playspace_rating +
                      review.staff_rating + review.access_rating) / 5
                  }
                  size="sm"
                />
              </span>
              {RATING_AXIS_LABELS.map((label, i) => (
                <span key={label} className="whitespace-nowrap">
                  <span className="text-gray-400">{label}</span>{' '}
                  <span className="font-medium text-gray-700">
                    {[
                      review.stock_rating,
                      review.price_rating,
                      review.playspace_rating,
                      review.staff_rating,
                      review.access_rating,
                    ][i]}
                  </span>
                </span>
              ))}
            </div>

            {review.body && (
              <div>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                  {review.body.length > BODY_TRUNCATE_LENGTH && !expandedBodyIds.has(review.id)
                    ? `${review.body.slice(0, BODY_TRUNCATE_LENGTH)}…`
                    : review.body}
                </div>
                {review.body.length > BODY_TRUNCATE_LENGTH && (
                  <button
                    onClick={() => toggleBodyExpanded(review.id)}
                    className="text-xs text-blue-600 hover:underline mt-1"
                  >
                    {expandedBodyIds.has(review.id) ? '閉じる' : '続きを読む'}
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => toggleLike(review.id)}
                disabled={pending.has(review.id)}
                className={`text-xs flex items-center gap-1 transition-colors disabled:opacity-50 ${
                  likedIds.has(review.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
                }`}
              >
                {likedIds.has(review.id) ? '♥' : '♡'} いいね{likeCounts[review.id] > 0 && ` ${likeCounts[review.id]}`}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
