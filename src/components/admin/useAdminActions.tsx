'use client'

import { useConfirm } from '@/components/ui/ConfirmDialog'
import type { AdminReview, AdminPhoto } from './types'

// レビュー・写真の非表示／削除（確認ダイアログつき）。概要とレビュー・写真タブで共通
export function useAdminActions() {
  const { confirm, confirmDialog } = useConfirm()

  const toggleReviewHidden = async (review: AdminReview): Promise<boolean> => {
    const res = await fetch(`/api/admin/reviews/${review.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: !review.is_hidden }),
    })
    return res.ok
  }

  const deleteReview = async (review: AdminReview): Promise<boolean> => {
    const ok = await confirm({
      title: 'このレビューを削除しますか？',
      message: `${review.shops?.name ?? ''}へのレビュー（${review.profiles?.name ?? '匿名'}）を完全に削除します。元に戻せません。迷う場合は「非表示」にしてください。`,
      confirmLabel: '削除する',
      danger: true,
    })
    if (!ok) return false
    const res = await fetch(`/api/admin/reviews/${review.id}`, { method: 'DELETE' })
    return res.ok
  }

  const deletePhoto = async (photo: AdminPhoto): Promise<boolean> => {
    const ok = await confirm({
      title: 'この写真を削除しますか？',
      message: `${photo.shops?.name ?? ''}の写真（${photo.profiles?.name ?? '匿名'}）を削除します。元に戻せません。`,
      confirmLabel: '削除する',
      danger: true,
    })
    if (!ok) return false
    const res = await fetch(`/api/admin/photos/${photo.id}`, { method: 'DELETE' })
    return res.ok
  }

  return { toggleReviewHidden, deleteReview, deletePhoto, confirm, confirmDialog }
}
