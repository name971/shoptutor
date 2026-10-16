'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { X, Trash2, ExternalLink } from 'lucide-react'
import { type AdminPhoto, formatDateTime } from './types'

type Props = {
  photo: AdminPhoto | null
  onClose: () => void
  onDelete: (photo: AdminPhoto) => void
}

// 写真を大きく表示する（確認してから削除できるように）
export default function PhotoViewer({ photo, onClose, onDelete }: Props) {
  useEffect(() => {
    if (!photo) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [photo, onClose])

  if (!photo) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 flex flex-col" role="dialog" aria-modal="true" aria-label="写真の確認">
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <div className="flex-1 min-w-0">
          {photo.shops ? (
            <Link href={`/shops/${photo.shops.id}`} target="_blank" className="text-sm font-bold hover:underline inline-flex items-center gap-1 max-w-full">
              <span className="truncate">{photo.shops.name}</span>
              <ExternalLink size={13} className="flex-shrink-0 opacity-70" />
            </Link>
          ) : (
            <span className="text-sm font-bold opacity-70">（削除された店舗）</span>
          )}
          <div className="text-xs opacity-70">
            {photo.profiles?.name ?? '匿名'} · {formatDateTime(photo.created_at)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(photo)}
          className="h-9 px-3 rounded-lg bg-red-600 text-white text-xs font-bold inline-flex items-center gap-1 hover:bg-red-700"
        >
          <Trash2 size={14} />
          削除
        </button>
        <button type="button" onClick={onClose} aria-label="閉じる" className="p-1.5 rounded-lg hover:bg-white/10">
          <X size={22} />
        </button>
      </div>
      <button type="button" onClick={onClose} aria-label="閉じる" className="flex-1 min-h-0 flex items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- 投稿写真はアップロード時にWebP・1MB以下へ圧縮済みのため、画像最適化は使わない */}
        <img src={photo.url} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
      </button>
      {photo.caption && <p className="px-4 pb-4 text-sm text-white/90">{photo.caption}</p>}
    </div>
  )
}
