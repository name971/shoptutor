'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { FORMAT_LABELS, SUB_FORMAT_MAX, ReviewWithLikes } from '@/types'
import FormatBadge from '@/components/ui/FormatBadge'
import FormatOptionButton from '@/components/ui/FormatOptionButton'
import StarRating from '@/components/ui/StarRating'
import BottomSheet from '@/components/ui/BottomSheet'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { SkeletonBlock, ShopCardSkeleton } from '@/components/ui/Skeleton'
import {
  Pencil,
  Trash2,
  Heart,
  MessageSquareText,
  Image as ImageIcon,
  FileText,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Store,
} from 'lucide-react'

const NAME_CHANGE_INTERVAL_DAYS = 30
const PAGE_SIZE = 3

type MyReview = ReviewWithLikes & { shops: { id: string; name: string } | null }

// 写真1件の取得結果（店舗は多対1の結合なのでオブジェクト、いいね数は集計結果の配列で返る）
type MyPhotoRow = {
  id: string
  url: string
  shops: { id: string; name: string } | null
  photo_likes: { count: number }[] | null
}

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
  const [mainFormat, setMainFormat] = useState<string | null>(null)
  const [subFormats, setSubFormats] = useState<string[]>([])
  const [reviews, setReviews] = useState<MyReview[]>([])
  const [photos, setPhotos] = useState<MyPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  // 名前変更の制限判定に使う現在時刻（描画のたびに変わらないよう、表示開始時に1回だけ取る）
  const [now] = useState(() => Date.now())
  const { confirm, confirmDialog } = useConfirm()
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
        .select('name, avatar_url, main_format, sub_formats, name_changed_at')
        .eq('id', user.id)
        .single()

      if (profile) {
        setOriginalName(profile.name ?? '')
        setName(profile.name ?? '')
        setMainFormat(profile.main_format ?? null)
        setSubFormats(profile.sub_formats ?? [])
        setNameChangedAt(profile.name_changed_at)
        setAvatarUrl(profile.avatar_url ?? null)
      }

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*, shops(id, name), review_likes(count)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const withLikes: MyReview[] = (reviewsData ?? []).map((r) => ({
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

      const photosWithLikes: MyPhoto[] = ((photosData ?? []) as unknown as MyPhotoRow[]).map((p) => ({
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
    name.trim() !== originalName && !!nameChangeAvailableAt && nameChangeAvailableAt.getTime() > now

  const selectMain = (format: string) => {
    setMainFormat(format)
    setSubFormats((prev) => prev.filter((f) => f !== format))
  }

  const toggleSub = (format: string) => {
    if (format === mainFormat) return
    setSubFormats((prev) => {
      if (prev.includes(format)) return prev.filter((f) => f !== format)
      if (prev.length >= SUB_FORMAT_MAX) return prev
      return [...prev, format]
    })
  }

  const handleSave = async () => {
    setError('')
    setMessage('')

    if (!mainFormat) {
      setError('メインフォーマットを1つ選択してください')
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

    const payload: Record<string, unknown> = { main_format: mainFormat, sub_formats: subFormats }
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
    setMessage('プロフィールを保存しました')
    setSaving(false)
    setEditOpen(false)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleDeletePhoto = async (photoId: string) => {
    if (!userId) return
    if (!(await confirm({ title: 'この写真を削除しますか？', message: 'この操作は取り消せません。', confirmLabel: '削除する', danger: true }))) return

    setActionError('')
    const supabase = createClient()
    const target = photos.find((p) => p.id === photoId)

    const { error: deleteError } = await supabase
      .from('shop_photos')
      .delete()
      .eq('id', photoId)
      .eq('user_id', userId)

    if (deleteError) {
      setActionError(`削除に失敗しました: ${deleteError.message}`)
      return
    }

    if (target) {
      const storagePath = target.url.split('/shop-photos/')[1]
      if (storagePath) {
        await supabase.storage.from('shop-photos').remove([storagePath])
      }
    }

    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
  }

  const handleDeleteReview = async (reviewId: string) => {
    if (!userId) return
    if (!(await confirm({ title: 'このレビューを削除しますか？', message: 'この操作は取り消せません。', confirmLabel: '削除する', danger: true }))) return

    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)
      .eq('user_id', userId)

    if (deleteError) {
      setActionError('レビューの削除に失敗しました。もう一度お試しください。')
      return
    }
    setReviews((prev) => prev.filter((r) => r.id !== reviewId))
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const handleDeleteAccount = async () => {
    const ok = await confirm({
      title: 'アカウントを削除しますか？',
      message: 'レビュー・お気に入り・写真など、すべてのデータが完全に削除され、元に戻せません。',
      confirmLabel: 'アカウントを削除',
      danger: true,
      requireText: '削除',
    })
    if (!ok) return

    setDeleting(true)
    const res = await fetch('/api/account/delete', { method: 'POST' })

    if (!res.ok) {
      setActionError('アカウント削除に失敗しました。もう一度お試しください。')
      setDeleting(false)
      return
    }

    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (checking) return null

  const displayName = originalName || 'プレイヤー'
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="app-header sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <h1 className="font-display text-2xl text-slate-900">マイページ</h1>
        </div>
      </div>

      {loading ? (
        <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4" role="status" aria-label="読み込み中">
          <div className="surface overflow-hidden">
            <SkeletonBlock className="h-16 rounded-none" />
            <div className="p-5 flex flex-col gap-3">
              <SkeletonBlock className="h-6 w-1/3" />
              <SkeletonBlock className="h-4 w-1/2" />
              <SkeletonBlock className="h-16 w-full rounded-2xl" />
            </div>
          </div>
          <ShopCardSkeleton />
          <ShopCardSkeleton />
        </div>
      ) : (
        <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-6">
          {/* プロフィール */}
          <section className="surface overflow-hidden">
            <div className="h-16 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500" />
            <div className="px-5 pb-5 -mt-8 flex flex-col gap-4">
              <div className="flex items-end justify-between gap-3">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="w-16 h-16 rounded-full object-cover ring-4 ring-white bg-slate-100"
                  />
                ) : (
                  <span className="w-16 h-16 rounded-full ring-4 ring-white bg-slate-900 text-white text-2xl font-bold flex items-center justify-center">
                    {displayName.slice(0, 1)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setError('')
                    setEditOpen(true)
                  }}
                  className="h-9 px-3.5 rounded-full text-sm font-semibold text-slate-800 bg-white ring-1 ring-inset ring-slate-200 hover:bg-slate-50 inline-flex items-center gap-1.5"
                >
                  <Pencil size={14} />
                  編集
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-xl font-extrabold text-slate-900 tracking-tight break-all">{displayName}</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {mainFormat && (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-[11px] font-bold text-slate-500">メイン</span>
                      <FormatBadge format={mainFormat} />
                    </span>
                  )}
                  {subFormats.length > 0 && (
                    <span className="inline-flex items-center gap-1 ml-1">
                      <span className="text-[11px] font-bold text-slate-500">サブ</span>
                      {subFormats.map((f) => (
                        <FormatBadge key={f} format={f} />
                      ))}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 rounded-2xl bg-slate-50 divide-x divide-slate-200/70">
                {[
                  { label: 'レビュー', value: reviews.length, Icon: MessageSquareText },
                  { label: '写真', value: photos.length, Icon: ImageIcon },
                  { label: 'もらったいいね', value: totalLikes, Icon: Heart },
                ].map(({ label, value, Icon }) => (
                  <div key={label} className="py-3 flex flex-col items-center gap-0.5">
                    <span className="text-xl font-extrabold text-slate-900 tabular-nums">{value}</span>
                    <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                      <Icon size={12} />
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {message && (
                <p className="text-sm font-medium text-green-700 bg-green-50 rounded-xl px-3 py-2">{message}</p>
              )}
            </div>
          </section>

          {actionError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{actionError}</p>
          )}

          {/* 投稿したレビュー */}
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-slate-900">
              投稿したレビュー <span className="text-slate-400 font-semibold tabular-nums">{reviews.length}</span>
            </h2>
            {reviews.length === 0 ? (
              <EmptyState
                Icon={MessageSquareText}
                text="まだレビューを投稿していません"
                sub="行ったことのあるお店の感想を書いてみましょう"
              />
            ) : (
              <>
                {reviews.slice(0, visibleReviewCount).map((review) => {
                  const avg =
                    (review.stock_rating +
                      review.price_rating +
                      review.playspace_rating +
                      review.staff_rating +
                      review.access_rating) /
                    5
                  return (
                    <article key={review.id} className="surface p-4 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        {review.shops ? (
                          <Link
                            href={`/shops/${review.shops.id}`}
                            className="font-bold text-[15px] text-slate-900 leading-snug hover:underline"
                          >
                            {review.shops.name}
                          </Link>
                        ) : (
                          <span className="font-bold text-[15px] text-slate-900">削除された店舗</span>
                        )}
                        <span className="text-xs text-slate-400 whitespace-nowrap tabular-nums">
                          {new Date(review.created_at).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                      <StarRating value={avg} size="sm" />
                      {review.body && (
                        <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{review.body}</p>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Heart size={14} className="text-rose-500" />
                          <span className="tabular-nums">{review.like_count}</span>
                        </span>
                        <div className="flex items-center gap-1">
                          {review.shops && (
                            <Link
                              href={`/shops/${review.shops.id}/review`}
                              className="h-8 px-3 rounded-full text-xs font-semibold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1"
                            >
                              <Pencil size={13} />
                              編集
                            </Link>
                          )}
                          <button
                            onClick={() => handleDeleteReview(review.id)}
                            className="h-8 px-3 rounded-full text-xs font-semibold text-red-600 hover:bg-red-50 inline-flex items-center gap-1"
                          >
                            <Trash2 size={13} />
                            削除
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
                {reviews.length > visibleReviewCount && (
                  <button
                    onClick={() => setVisibleReviewCount((v) => v + PAGE_SIZE)}
                    className="h-11 rounded-xl surface text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    もっと見る（残り{reviews.length - visibleReviewCount}件）
                  </button>
                )}
              </>
            )}
          </section>

          {/* 投稿した写真 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-slate-900">
              投稿した写真 <span className="text-slate-400 font-semibold tabular-nums">{photos.length}</span>
            </h2>
            {photos.length === 0 ? (
              <EmptyState Icon={ImageIcon} text="まだ写真を投稿していません" sub="店舗ページから、お店の雰囲気がわかる写真を投稿できます" />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {photos.slice(0, visiblePhotoCount).map((photo) => (
                    <div key={photo.id} className="flex flex-col gap-1 min-w-0">
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                        <Link href={photo.shops ? `/shops/${photo.shops.id}` : '#'}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                        </Link>
                        <button
                          onClick={() => handleDeletePhoto(photo.id)}
                          aria-label="この写真を削除"
                          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm hover:bg-black/70"
                        >
                          <Trash2 size={13} />
                        </button>
                        <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/50 text-white text-[11px] px-1.5 py-0.5 backdrop-blur-sm">
                          <Heart size={11} />
                          {photo.like_count}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 truncate">{photo.shops?.name}</span>
                    </div>
                  ))}
                </div>
                {photos.length > visiblePhotoCount && (
                  <button
                    onClick={() => setVisiblePhotoCount((v) => v + PAGE_SIZE)}
                    className="h-11 rounded-xl surface text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    もっと見る（残り{photos.length - visiblePhotoCount}枚）
                  </button>
                )}
              </>
            )}
          </section>

          {/* 設定・その他 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-slate-900">その他</h2>
            <div className="surface divide-y divide-slate-100 overflow-hidden">
              <SettingsLink href="/terms" Icon={FileText} label="利用規約" />
              <SettingsLink href="/privacy" Icon={ShieldCheck} label="プライバシーポリシー" />
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full h-14 px-4 flex items-center gap-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                <LogOut size={18} className="text-slate-400" />
                ログアウト
              </button>
            </div>
            <div className="surface overflow-hidden">
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="w-full px-4 py-3.5 flex items-start gap-3 text-left hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-red-600">
                    {deleting ? '削除中...' : 'アカウントを削除する'}
                  </span>
                  <span className="text-xs text-slate-500 leading-relaxed">
                    レビュー・お気に入り・写真など、すべてのデータが完全に削除されます。この操作は取り消せません。
                  </span>
                </span>
              </button>
            </div>
          </section>
        </div>
      )}

      {confirmDialog}

      <BottomSheet
        open={editOpen}
        title="プロフィールを編集"
        onClose={() => setEditOpen(false)}
        footer={
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中...' : '保存する'}
          </button>
        }
      >
        <section className="flex flex-col gap-2">
          <label htmlFor="profile-name" className="text-xs font-bold text-slate-500">
            名前
          </label>
          <input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-12 text-base text-slate-900 bg-slate-50 rounded-xl px-4 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className={`text-xs ${nameChangeLocked ? 'text-amber-700' : 'text-slate-500'}`}>
            {nameChangeLocked && nameChangeAvailableAt
              ? `次回変更可能日: ${nameChangeAvailableAt.toLocaleDateString('ja-JP')}`
              : `名前の変更は${NAME_CHANGE_INTERVAL_DAYS}日に1回までです`}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-slate-500">メインフォーマット（1つ）</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(FORMAT_LABELS).map((format) => (
              <FormatOptionButton
                key={format}
                format={format}
                selected={mainFormat === format}
                onClick={() => selectMain(format)}
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-slate-500">
            サブフォーマット（最大{SUB_FORMAT_MAX}つ・任意）
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(FORMAT_LABELS)
              .filter((f) => f !== mainFormat)
              .map((format) => {
                const isSelected = subFormats.includes(format)
                return (
                  <FormatOptionButton
                    key={format}
                    format={format}
                    selected={isSelected}
                    disabled={!isSelected && subFormats.length >= SUB_FORMAT_MAX}
                    onClick={() => toggleSub(format)}
                  />
                )
              })}
          </div>
        </section>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
      </BottomSheet>
    </div>
  )
}

function EmptyState({ Icon, text, sub }: { Icon: typeof Store; text: string; sub: string }) {
  return (
    <div className="surface px-4 py-8 flex flex-col items-center gap-2 text-center">
      <span className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
        <Icon size={22} />
      </span>
      <p className="text-sm font-semibold text-slate-700">{text}</p>
      <p className="text-xs text-slate-500">{sub}</p>
      <Link
        href="/shops"
        className="mt-1 h-9 px-4 rounded-full bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-1.5"
      >
        <Store size={14} />
        店舗をさがす
      </Link>
    </div>
  )
}

function SettingsLink({ href, Icon, label }: { href: string; Icon: typeof Store; label: string }) {
  return (
    <Link href={href} className="h-14 px-4 flex items-center gap-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
      <Icon size={18} className="text-slate-400" />
      <span className="flex-1">{label}</span>
      <ChevronRight size={16} className="text-slate-300" />
    </Link>
  )
}
