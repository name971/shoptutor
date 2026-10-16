'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import AdminReviewCard from './AdminReviewCard'
import PhotoViewer from './PhotoViewer'
import StorageUsageCard from './StorageUsageCard'
import { useAdminActions } from './useAdminActions'
import { type AdminNavigate, type AdminReview, type AdminPhoto, formatDateTime } from './types'

type Overview = {
  shops: { active: number; inactive: number; noCoords: number }
  events: { week: number; today: number; lastScrapedAt: string | null; hoursSinceScrape: number | null }
  reviews: { week: number; hidden: number }
  photos: { week: number }
  users: { week: number; total: number }
  recentReviews: AdminReview[]
  recentPhotos: AdminPhoto[]
}

// 自動取り込みは1日1回（12:00 JST）。これより時間が空いたら止まっている可能性がある
const SCRAPE_STALE_HOURS = 30

export default function AdminOverview({ onNavigate }: { onNavigate: AdminNavigate }) {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState(false)
  const [viewing, setViewing] = useState<AdminPhoto | null>(null)
  const { toggleReviewHidden, deleteReview, deletePhoto, confirmDialog } = useAdminActions()

  useEffect(() => {
    fetch('/api/admin/overview')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true))
  }, [])

  if (error) return <p className="text-sm text-red-600">概要を取得できませんでした。再読み込みしてください。</p>
  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonBlock className="h-20 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-20" />
          ))}
        </div>
      </div>
    )
  }

  const hoursSinceScrape = data.events.hoursSinceScrape
  const scrapeProblems = [
    hoursSinceScrape === null ? 'イベントがまだ取り込まれていません' : null,
    hoursSinceScrape !== null && hoursSinceScrape > SCRAPE_STALE_HOURS
      ? `最後の取り込みから${Math.floor(hoursSinceScrape)}時間たっています（毎日12:00に動く予定）`
      : null,
    data.events.today === 0 ? '今日のイベントが0件です' : null,
  ].filter((x): x is string => x !== null)

  const tiles: { label: string; value: number; sub?: string; warn?: boolean; onClick?: () => void }[] = [
    { label: '公開中の店舗', value: data.shops.active, sub: `非公開 ${data.shops.inactive}`, onClick: () => onNavigate('shops') },
    {
      label: '地図に出ない店舗',
      value: data.shops.noCoords,
      sub: '座標なし（公開中）',
      warn: data.shops.noCoords > 0,
      onClick: () => onNavigate('shops', 'nocoords'),
    },
    { label: '今週のイベント', value: data.events.week, sub: `今日 ${data.events.today}` },
    { label: 'レビュー（7日）', value: data.reviews.week, onClick: () => onNavigate('reviews') },
    {
      label: '非表示中のレビュー',
      value: data.reviews.hidden,
      onClick: () => onNavigate('reviews', 'hidden'),
    },
    { label: '写真（7日）', value: data.photos.week, onClick: () => onNavigate('photos') },
    { label: '新規ユーザー（7日）', value: data.users.week, sub: `全体 ${data.users.total}`, onClick: () => onNavigate('users') },
  ]

  const updateReview = (id: string, patch: Partial<AdminReview> | null) =>
    setData((d) =>
      d && {
        ...d,
        recentReviews: patch === null ? d.recentReviews.filter((r) => r.id !== id) : d.recentReviews.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }
    )

  return (
    <div className="flex flex-col gap-5">
      {/* 自動取り込みの状態 */}
      <section
        className={`surface p-4 flex items-start gap-3 ${scrapeProblems.length > 0 ? 'ring-2 ring-red-200' : ''}`}
        aria-label="イベントの自動取り込み"
      >
        {scrapeProblems.length > 0 ? (
          <AlertTriangle size={22} className="text-red-600 flex-shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 size={22} className="text-green-600 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-900">
            イベントの自動取り込み：{scrapeProblems.length > 0 ? <span className="text-red-700">要確認</span> : <span className="text-green-700">正常</span>}
          </div>
          <div className="text-xs text-slate-500 inline-flex items-center gap-1">
            <RefreshCw size={12} />
            最後の取り込み {data.events.lastScrapedAt ? formatDateTime(data.events.lastScrapedAt) : '—'}
          </div>
          {scrapeProblems.length > 0 && (
            <ul className="mt-1.5 text-xs text-red-700 list-disc pl-4">
              {scrapeProblems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 主な数字 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="主な数字">
        {tiles.map((t) => {
          const body = (
            <>
              <span className="text-xs text-slate-500">{t.label}</span>
              <span className={`text-2xl font-bold tabular-nums leading-tight ${t.warn ? 'text-red-700' : 'text-slate-900'}`}>
                {t.value.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 min-h-4 inline-flex items-center gap-0.5">
                {t.warn && <AlertTriangle size={12} className="text-red-600" />}
                {t.sub}
              </span>
            </>
          )
          return t.onClick ? (
            <button
              key={t.label}
              type="button"
              onClick={t.onClick}
              className="surface p-3 flex flex-col items-start gap-0.5 text-left hover:shadow-md transition-shadow"
            >
              {body}
            </button>
          ) : (
            <div key={t.label} className="surface p-3 flex flex-col items-start gap-0.5">
              {body}
            </div>
          )
        })}
      </section>

      <StorageUsageCard />

      <div className="grid md:grid-cols-2 gap-5">
        {/* 新着レビュー */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">新着レビュー</h2>
            <button type="button" onClick={() => onNavigate('reviews')} className="text-xs font-bold text-blue-600 inline-flex items-center">
              すべて見る
              <ChevronRight size={14} />
            </button>
          </div>
          {data.recentReviews.length === 0 ? (
            <p className="text-sm text-slate-500">まだレビューはありません</p>
          ) : (
            data.recentReviews.map((r) => (
              <AdminReviewCard
                key={r.id}
                review={r}
                onToggleHide={async (review) => {
                  if (await toggleReviewHidden(review)) updateReview(review.id, { is_hidden: !review.is_hidden })
                }}
                onDelete={async (review) => {
                  if (await deleteReview(review)) updateReview(review.id, null)
                }}
              />
            ))
          )}
        </section>

        {/* 新着写真 */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">新着の写真</h2>
            <button type="button" onClick={() => onNavigate('photos')} className="text-xs font-bold text-blue-600 inline-flex items-center">
              すべて見る
              <ChevronRight size={14} />
            </button>
          </div>
          {data.recentPhotos.length === 0 ? (
            <p className="text-sm text-slate-500">まだ写真はありません</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {data.recentPhotos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setViewing(p)}
                  aria-label={`${p.shops?.name ?? ''}の写真を大きく見る`}
                  className="aspect-square rounded-xl overflow-hidden bg-slate-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 投稿写真はアップロード時にWebP・1MB以下へ圧縮済みのため、画像最適化は使わない */}
                  <img src={p.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <PhotoViewer
        photo={viewing}
        onClose={() => setViewing(null)}
        onDelete={async (photo) => {
          if (await deletePhoto(photo)) {
            setViewing(null)
            setData((d) => d && { ...d, recentPhotos: d.recentPhotos.filter((x) => x.id !== photo.id) })
          }
        }}
      />
      {confirmDialog}
    </div>
  )
}
