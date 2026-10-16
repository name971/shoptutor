'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import StarRatingInput from '@/components/ui/StarRatingInput'
import BackButton from '@/components/ui/BackButton'
import { useConfirm } from '@/components/ui/ConfirmDialog'

const RATING_FIELDS = [
  { key: 'stock_rating', label: '品揃え・在庫' },
  { key: 'price_rating', label: '価格設定・買取査定' },
  { key: 'playspace_rating', label: '対戦スペースの環境' },
  { key: 'staff_rating', label: '接客・店員の対応' },
  { key: 'access_rating', label: 'アクセス・利便性' },
] as const

const MIN_BODY_LENGTH = 30

export default function ReviewFormPage() {
  const params = useParams<{ id: string }>()
  const shopId = params.id
  const router = useRouter()

  const [checking, setChecking] = useState(true)
  const [shopName, setShopName] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [ratings, setRatings] = useState<Record<string, number>>({
    stock_rating: 0,
    price_rating: 0,
    playspace_rating: 0,
    staff_rating: 0,
    access_rating: 0,
  })
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { confirm, confirmDialog } = useConfirm()
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }
      setUserId(user.id)

      const { data: shop } = await supabase
        .from('shops')
        .select('name')
        .eq('id', shopId)
        .single()
      setShopName(shop?.name ?? '')

      const { data: existing } = await supabase
        .from('reviews')
        .select('*')
        .eq('shop_id', shopId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existing) {
        setReviewId(existing.id)
        setRatings({
          stock_rating: existing.stock_rating,
          price_rating: existing.price_rating,
          playspace_rating: existing.playspace_rating,
          staff_rating: existing.staff_rating,
          access_rating: existing.access_rating,
        })
        setBody(existing.body ?? '')
      }

      setChecking(false)
    }
    load()
  }, [shopId, router])

  const handleSubmit = async () => {
    setError('')

    if (Object.values(ratings).some((v) => v === 0)) {
      setError('すべての項目を評価してください')
      return
    }

    const trimmedBody = body.trim()
    if (trimmedBody.length > 0 && trimmedBody.length < MIN_BODY_LENGTH) {
      setError(`コメントを入力する場合は${MIN_BODY_LENGTH}字以上で入力してください`)
      return
    }

    setSaving(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.replace('/login')
      return
    }

    const payload = {
      ...ratings,
      body: trimmedBody.length > 0 ? trimmedBody : null,
    }

    const { error: saveError } = reviewId
      ? await supabase.from('reviews').update({ ...payload, is_edited: true }).eq('id', reviewId).eq('user_id', user.id)
      : await supabase.from('reviews').insert({ ...payload, shop_id: shopId, user_id: user.id })

    if (saveError) {
      setError('保存に失敗しました。もう一度お試しください。')
      setSaving(false)
      return
    }

    router.push(`/shops/${shopId}`)
    router.refresh()
  }

  const handleDelete = async () => {
    if (!reviewId || !userId) return
    if (!(await confirm({ title: 'このレビューを削除しますか？', message: 'この操作は取り消せません。', confirmLabel: '削除する', danger: true }))) return

    setDeleting(true)
    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)
      .eq('user_id', userId)

    if (deleteError) {
      setError('削除に失敗しました。もう一度お試しください。')
      setDeleting(false)
      return
    }

    router.push(`/shops/${shopId}`)
    router.refresh()
  }

  if (checking) return null

  return (
    <div className="min-h-screen bg-background">
      {confirmDialog}
      <div className="app-header sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-2">
          <BackButton />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-slate-500">{reviewId ? 'レビューを編集' : 'レビューを投稿'}</div>
            <div className="font-bold text-sm text-slate-900 truncate">{shopName}</div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
        <div className="surface p-4 flex flex-col gap-4">
          <h2 className="font-bold text-base text-slate-900">5項目で評価</h2>
          {RATING_FIELDS.map((f) => (
            <StarRatingInput
              key={f.key}
              label={f.label}
              value={ratings[f.key]}
              onChange={(v) => setRatings((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))}
        </div>

        <div className="surface p-4">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="review-body" className="font-bold text-base text-slate-900">コメント（任意）</label>
            <span
              className={`text-xs tabular-nums ${
                body.trim().length > 0 && body.trim().length < MIN_BODY_LENGTH ? 'text-amber-600 font-bold' : 'text-slate-400'
              }`}
            >
              {body.trim().length}／{MIN_BODY_LENGTH}字以上
            </span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            id="review-body"
            rows={6}
            placeholder={`入力する場合は${MIN_BODY_LENGTH}字以上でお願いします`}
            className="w-full text-base bg-slate-50 rounded-xl p-3 resize-none ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={saving || deleting}
          className="w-full h-12 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? '保存中...' : reviewId ? '更新する' : '投稿する'}
        </button>

        {reviewId && (
          <button
            onClick={handleDelete}
            disabled={saving || deleting}
            className="w-full h-12 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {deleting ? '削除中...' : 'レビューを削除'}
          </button>
        )}
      </div>
    </div>
  )
}
