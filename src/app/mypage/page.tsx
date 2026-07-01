'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { FORMAT_LABELS, FORMAT_COLORS, ReviewWithLikes } from '@/types'
import BackButton from '@/components/ui/BackButton'

const NAME_CHANGE_INTERVAL_DAYS = 30
const PAGE_SIZE = 3

type MyReview = ReviewWithLikes & { shops: { id: string; name: string } | null }

type MyPhoto = {
  id: string
  url: string
  like_count: number
  shops: { id: string; name: string } | null
}

export default function MyPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [originalName, setOriginalName] = useState('')
  const [name, setName] = useState('')
  const [nameChangedAt, setNameChangedAt] = useState<string | null>(null)
  const [formats, setFormats] = useState<string[]>([])
  const [reviews, setReviews] = useState<MyReview[]>([])
  const [photos, setPhotos] = useState<MyPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [visibleReviewCount, setVisibleReviewCount] = useState(PAGE_SIZE)
  const [visiblePhotoCount, setVisiblePhotoCount] = useState(PAGE_SIZE)

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
      setChecking(false)

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, main_formats, name_changed_at')
        .eq('id', user.id)
        .single()

      if (profile) {
        setOriginalName(profile.name ?? '')
        setName(profile.name ?? '')
        setFormats(profile.main_formats ?? [])
        setNameChangedAt(profile.name_changed_at)
      }

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*, shops(id, name), review_likes(count)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const withLikes: MyReview[] = (reviewsData ?? []).map((r: any) => ({
        ...r,
        like_count: r.review_likes?.[0]?.count ?? 0,
      }))
      setReviews(withLikes)

      const { data: photosData } = await supabase
        .from('shop_photos')
        .select('id, url, shops(id, name), photo_likes(count)')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })

      const photosWithLikes: MyPhoto[] = (photosData ?? []).map((p: any) => ({
        id: p.id,
        url: p.url,
        shops: p.shops,
        like_count: p.photo_likes?.[0]?.count ?? 0,
      }))
      setPhotos(photosWithLikes)

      setLoading(false)
    }
    load()
  }, [router])

  const totalLikes = useMemo(
    () => reviews.reduce((sum, r) => sum + r.like_count, 0),
    [reviews]
  )

  const nameChangeAvailableAt = useMemo(() => {
    if (!nameChangedAt) return null
    const next = new Date(nameChangedAt)
    next.setDate(next.getDate() + NAME_CHANGE_INTERVAL_DAYS)
    return next
  }, [nameChangedAt])

  const nameChangeLocked =
    name.trim() !== originalName && !!nameChangeAvailableAt && nameChangeAvailableAt.getTime() > Date.now()

  const toggleFormat = (format: string) => {
    setFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
    )
  }

  const handleSave = async () => {
    setError('')
    setMessage('')

    if (formats.length === 0) {
      setError('フォーマットは1つ以上選択してください')
      return
    }
    if (name.trim().length === 0) {
      setError('名前を入力してください')
      return
    }
    if (nameChangeLocked && nameChangeAvailableAt) {
      setError(
        `名前の変更は${NAME_CHANGE_INTERVAL_DAYS}日に1回までです。次回変更可能日: ${nameChangeAvailableAt.toLocaleDateString('ja-JP')}`
      )
      return
    }

    setSaving(true)
    const supabase = createClient()
    const nameChanged = name.trim() !== originalName

    const payload: Record<string, unknown> = { main_formats: formats }
    if (nameChanged) {
      payload.name = name.trim()
      payload.name_changed_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)

    if (updateError) {
      setError('保存に失敗しました。もう一度お試しください。')
      setSaving(false)
      return
    }

    if (nameChanged) {
      setOriginalName(name.trim())
      setNameChangedAt(new Date().toISOString())
    }
    setMessage('保存しました')
    setSaving(false)
  }

  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm('この写真を削除しますか？この操作は取り消せません。')) return

    setError('')
    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('shop_photos')
      .delete()
      .eq('id', photoId)

    if (deleteError) {
      setError(`削除に失敗しました: ${deleteError.message}`)
      return
    }

    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
  }

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('このレビューを削除しますか？この操作は取り消せません。')) return

    const supabase = createClient()
    const { error: deleteError } = await supabase.from('reviews').delete().eq('id', reviewId)

    if (!deleteError) {
      setReviews((prev) => prev.filter((r) => r.id !== reviewId))
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm('アカウントを削除すると、レビュー・お気に入り・写真などすべてのデータが完全に削除され、元に戻せません。本当に削除しますか？')) {
      return
    }
    if (!window.confirm('最終確認です。本当にアカウントを削除しますか？')) {
      return
    }

    setDeleting(true)
    const res = await fetch('/api/account/delete', { method: 'POST' })

    if (!res.ok) {
      setError('アカウント削除に失敗しました。もう一度お試しください。')
      setDeleting(false)
      return
    }

    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (checking) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <BackButton />
        <div className="font-bold text-sm flex-1">マイページ</div>
        <button onClick={handleSignOut} className="text-xs font-medium text-gray-500">
          ログアウト
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 text-sm py-8">読み込み中...</div>
      ) : (
        <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
          {/* プロフィール編集 */}
          <div className="bg-white rounded-xl border p-3 flex flex-col gap-3">
            <div className="font-medium text-sm">プロフィール</div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">名前</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              />
              {nameChangeLocked && nameChangeAvailableAt && (
                <p className="text-xs text-amber-600 mt-1">
                  次回変更可能日: {nameChangeAvailableAt.toLocaleDateString('ja-JP')}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">よく遊ぶフォーマット</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(FORMAT_LABELS).map((format) => {
                  const isSelected = formats.includes(format)
                  const colors = FORMAT_COLORS[format]
                  return (
                    <button
                      key={format}
                      onClick={() => toggleFormat(format)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        isSelected
                          ? `${colors.bg} ${colors.text} border-current`
                          : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      {FORMAT_LABELS[format]}
                    </button>
                  )
                })}
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {message && <p className="text-sm text-green-600">{message}</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>

          {/* 獲得いいね数 */}
          <div className="bg-white rounded-xl border p-3 flex items-center justify-between">
            <div className="text-sm text-gray-700">獲得いいね数</div>
            <div className="text-2xl font-medium">{totalLikes}</div>
          </div>

          {/* 投稿レビュー一覧 */}
          <div>
            <div className="font-medium text-sm mb-2">投稿したレビュー</div>
            {reviews.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8 bg-white rounded-xl border">
                まだレビューを投稿していません
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {reviews.slice(0, visibleReviewCount).map((review) => (
                    <div key={review.id} className="bg-white rounded-xl border p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium truncate">{review.shops?.name}</div>
                        <div className="text-yellow-400 text-xs whitespace-nowrap ml-2">
                          {'★'.repeat(Math.round(
                            (review.stock_rating + review.price_rating + review.playspace_rating +
                              review.staff_rating + review.access_rating) / 5
                          ))}
                        </div>
                      </div>
                      {review.body && (
                        <div className="text-xs text-gray-600 line-clamp-2 mb-2">{review.body}</div>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>♥ {review.like_count}</span>
                        <div className="flex items-center gap-3">
                          {review.shops && (
                            <Link
                              href={`/shops/${review.shops.id}/review`}
                              className="text-blue-600 hover:underline"
                            >
                              編集
                            </Link>
                          )}
                          <button
                            onClick={() => handleDeleteReview(review.id)}
                            className="text-red-500 hover:underline"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {reviews.length > visibleReviewCount && (
                  <button
                    onClick={() => setVisibleReviewCount((v) => v + PAGE_SIZE)}
                    className="w-full text-center text-xs text-blue-600 hover:underline mt-2"
                  >
                    もっと見る
                  </button>
                )}
              </>
            )}
          </div>

          {/* 投稿した写真 */}
          <div>
            <div className="font-medium text-sm mb-2">投稿した写真</div>
            {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
            {photos.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8 bg-white rounded-xl border">
                まだ写真を投稿していません
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {photos.slice(0, visiblePhotoCount).map((photo) => (
                    <div key={photo.id} className="bg-white rounded-xl border overflow-hidden">
                      <Link href={photo.shops ? `/shops/${photo.shops.id}` : '#'}>
                        <div className="aspect-square">
                          <img src={photo.url} alt="" className="w-full h-full object-cover" />
                        </div>
                      </Link>
                      <div className="p-1.5 flex items-center justify-between text-[10px] text-gray-500">
                        <span className="truncate flex-1">{photo.shops?.name}</span>
                        <button
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="text-red-500 hover:underline ml-1 flex-shrink-0"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {photos.length > visiblePhotoCount && (
                  <button
                    onClick={() => setVisiblePhotoCount((v) => v + PAGE_SIZE)}
                    className="w-full text-center text-xs text-blue-600 hover:underline mt-2"
                  >
                    もっと見る
                  </button>
                )}
              </>
            )}
          </div>

          {/* アカウント削除 */}
          <div className="bg-white rounded-xl border border-red-200 p-3">
            <div className="font-medium text-sm text-red-600 mb-1">アカウント削除</div>
            <p className="text-xs text-gray-500 mb-3">
              レビュー・お気に入り・写真など、すべてのデータが完全に削除されます。この操作は取り消せません。
            </p>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="w-full rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {deleting ? '削除中...' : 'アカウントを削除する'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
