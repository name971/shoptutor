'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import StarRatingInput from '@/components/ui/StarRatingInput'

const RATING_FIELDS = [
  { key: 'stock_rating', label: '品揃え・在庫' },
  { key: 'price_rating', label: '価格設定・買取査定' },
  { key: 'playspace_rating', label: 'デュエルスペースの環境' },
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
      ? await supabase.from('reviews').update({ ...payload, is_edited: true }).eq('id', reviewId)
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
    if (!reviewId) return
    if (!window.confirm('このレビューを削除しますか？この操作は取り消せません。')) return

    setDeleting(true)
    const supabase = createClient()
    const { error: deleteError } = await supabase.from('reviews').delete().eq('id', reviewId)

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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href={`/shops/${shopId}`} className="text-gray-500 hover:text-gray-700">←</Link>
        <div className="font-bold text-sm flex-1 truncate">
          {reviewId ? 'レビューを編集' : 'レビューを投稿'}{shopName && ` · ${shopName}`}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
        <div className="bg-white rounded-xl border p-3 flex flex-col gap-3">
          {RATING_FIELDS.map((f) => (
            <StarRatingInput
              key={f.key}
              label={f.label}
              value={ratings[f.key]}
              onChange={(v) => setRatings((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))}
        </div>

        <div className="bg-white rounded-xl border p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">コメント（任意）</span>
            <span className="text-xs text-gray-400">{body.trim().length}字</span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder={`入力する場合は${MIN_BODY_LENGTH}字以上でお願いします`}
            className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:border-blue-400"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={saving || deleting}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? '保存中...' : reviewId ? '更新する' : '投稿する'}
        </button>

        {reviewId && (
          <button
            onClick={handleDelete}
            disabled={saving || deleting}
            className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {deleting ? '削除中...' : 'レビューを削除'}
          </button>
        )}
      </div>
    </div>
  )
}
