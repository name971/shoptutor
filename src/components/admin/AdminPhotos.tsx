'use client'

import { useEffect, useState } from 'react'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import StorageUsageCard from './StorageUsageCard'
import PhotoViewer from './PhotoViewer'
import { useAdminActions } from './useAdminActions'
import { type AdminPhoto, formatDate } from './types'

async function fetchPhotos(offset: number) {
  const res = await fetch(`/api/admin/photos?offset=${offset}`)
  const data = await res.json().catch(() => ({}))
  return { list: (data.photos ?? []) as AdminPhoto[], total: (data.total ?? 0) as number }
}

export default function AdminPhotos() {
  const [photos, setPhotos] = useState<AdminPhoto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [viewing, setViewing] = useState<AdminPhoto | null>(null)
  const { deletePhoto, confirmDialog } = useAdminActions()

  useEffect(() => {
    fetchPhotos(0).then(({ list, total }) => {
      setPhotos(list)
      setTotal(total)
      setLoading(false)
    })
  }, [])

  const loadMore = async () => {
    setLoadingMore(true)
    const { list } = await fetchPhotos(photos.length)
    setPhotos((prev) => [...prev, ...list])
    setLoadingMore(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <StorageUsageCard />

      <div className="text-xs text-slate-500">
        {loading ? '　' : <>投稿された写真 <span className="font-bold text-slate-900 tabular-nums">{total}</span>枚（新しい順・タップで拡大）</>}
      </div>

      {loading ? (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonBlock key={i} className="aspect-square" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">写真はありません</p>
      ) : (
        <>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setViewing(photo)}
                className="surface overflow-hidden text-left hover:shadow-md transition-shadow"
                aria-label={`${photo.shops?.name ?? ''}の写真を大きく見る`}
              >
                <div className="aspect-square bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 投稿写真はアップロード時にWebP・1MB以下へ圧縮済みのため、画像最適化は使わない */}
                  <img src={photo.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="p-1.5 text-[11px] leading-tight">
                  <div className="truncate font-bold text-slate-800">{photo.shops?.name}</div>
                  <div className="truncate text-slate-500">
                    {photo.profiles?.name ?? '匿名'} · {formatDate(photo.created_at)}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {photos.length < total && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full h-11 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loadingMore ? '読み込み中…' : `もっと見る（残り${total - photos.length}枚）`}
            </button>
          )}
        </>
      )}

      <PhotoViewer
        photo={viewing}
        onClose={() => setViewing(null)}
        onDelete={async (photo) => {
          if (await deletePhoto(photo)) {
            setViewing(null)
            setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
            setTotal((t) => t - 1)
          }
        }}
      />
      {confirmDialog}
    </div>
  )
}
