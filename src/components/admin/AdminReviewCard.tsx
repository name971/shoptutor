'use client'

import Link from 'next/link'
import { Star, EyeOff, Eye, Trash2, ExternalLink } from 'lucide-react'
import { type AdminReview, reviewAverage, formatDate } from './types'

type Props = {
  review: AdminReview
  onToggleHide: (review: AdminReview) => void
  onDelete: (review: AdminReview) => void
}

// 管理画面のレビュー1件（概要とレビュータブで共通）
export default function AdminReviewCard({ review, onToggleHide, onDelete }: Props) {
  const avg = reviewAverage(review)
  return (
    <div className={`surface p-3 flex flex-col gap-2 ${review.is_hidden ? 'bg-slate-50' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {review.shops ? (
            <Link
              href={`/shops/${review.shops.id}`}
              target="_blank"
              className="text-sm font-bold text-slate-900 hover:underline inline-flex items-center gap-1 max-w-full"
            >
              <span className="truncate">{review.shops.name}</span>
              <ExternalLink size={13} className="flex-shrink-0 text-slate-400" />
            </Link>
          ) : (
            <span className="text-sm font-bold text-slate-400">（削除された店舗）</span>
          )}
          <div className="text-xs text-slate-500">
            {review.profiles?.name ?? '匿名'} · {formatDate(review.created_at)}
          </div>
        </div>
        <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-sm font-bold text-slate-900 tabular-nums">
          <Star size={14} className="fill-yellow-400 text-yellow-400" />
          {avg.toFixed(1)}
        </span>
      </div>

      {review.body ? (
        <p className={`text-sm whitespace-pre-wrap break-words ${review.is_hidden ? 'text-slate-400' : 'text-slate-700'}`}>{review.body}</p>
      ) : (
        <p className="text-xs text-slate-400">（星のみ）</p>
      )}

      <div className="flex items-center gap-2">
        {review.is_hidden ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 h-6 rounded-full">
            <EyeOff size={13} />
            非表示中
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2 h-6 rounded-full">
            <Eye size={13} />
            表示中
          </span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onToggleHide(review)}
          className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
        >
          {review.is_hidden ? <Eye size={14} /> : <EyeOff size={14} />}
          {review.is_hidden ? '表示に戻す' : '非表示にする'}
        </button>
        <button
          type="button"
          onClick={() => onDelete(review)}
          aria-label="レビューを削除"
          className="h-9 w-9 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center justify-center"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}
