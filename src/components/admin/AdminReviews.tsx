'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import Chip from '@/components/ui/Chip'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import AdminReviewCard from './AdminReviewCard'
import { useAdminActions } from './useAdminActions'
import type { AdminReview } from './types'

const FILTERS = [
  { key: '', label: 'すべて' },
  { key: 'visible', label: '表示中' },
  { key: 'hidden', label: '非表示中' },
] as const
type FilterKey = (typeof FILTERS)[number]['key']

export default function AdminReviews({ initialFilter }: { initialFilter?: string | null }) {
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<FilterKey>(FILTERS.some((f) => f.key === initialFilter) ? (initialFilter as FilterKey) : '')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestRef = useRef(0)
  const { toggleReviewHidden, deleteReview, confirmDialog } = useAdminActions()

  const load = useCallback(
    async (offset: number) => {
      const params = new URLSearchParams({ offset: String(offset) })
      if (filter) params.set('filter', filter)
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/admin/reviews?${params}`)
      const data = await res.json().catch(() => ({}))
      return { list: (data.reviews ?? []) as AdminReview[], total: (data.total ?? 0) as number }
    },
    [filter, q]
  )

  useEffect(() => {
    const id = ++requestRef.current
    const timer = setTimeout(async () => {
      setLoading(true)
      const { list, total } = await load(0)
      if (id !== requestRef.current) return
      setReviews(list)
      setTotal(total)
      setLoading(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    const { list } = await load(reviews.length)
    setReviews((prev) => [...prev, ...list])
    setLoadingMore(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10 focus-within:ring-2 focus-within:ring-blue-300">
        <Search size={16} className="text-slate-400 flex-shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="本文で検索"
          aria-label="レビュー本文で検索"
          className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="検索語を消す" className="text-slate-400">
            <X size={16} />
          </button>
        )}
      </label>
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Chip key={f.key} selected={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </Chip>
        ))}
      </div>
      <div className="text-xs text-slate-500">
        {loading ? '　' : <>該当 <span className="font-bold text-slate-900 tabular-nums">{total}</span>件（新しい順）</>}
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-32" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">該当するレビューはありません</p>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-2 items-start">
            {reviews.map((r) => (
              <AdminReviewCard
                key={r.id}
                review={r}
                onToggleHide={async (review) => {
                  if (await toggleReviewHidden(review)) {
                    setReviews((prev) => prev.map((x) => (x.id === review.id ? { ...x, is_hidden: !review.is_hidden } : x)))
                  }
                }}
                onDelete={async (review) => {
                  if (await deleteReview(review)) {
                    setReviews((prev) => prev.filter((x) => x.id !== review.id))
                    setTotal((t) => t - 1)
                  }
                }}
              />
            ))}
          </div>
          {reviews.length < total && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full h-11 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loadingMore ? '読み込み中…' : `もっと見る（残り${total - reviews.length}件）`}
            </button>
          )}
        </>
      )}
      {confirmDialog}
    </div>
  )
}
