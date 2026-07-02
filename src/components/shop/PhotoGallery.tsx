'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import PhotoUpload from './PhotoUpload'

type Photo = {
  id: string
  url: string
  user_id: string
  like_count: number
}

type Props = {
  shopId: string
  initialPhotos: Photo[]
}

const PAGE_SIZE = 5

export default function PhotoGallery({ shopId, initialPhotos }: Props) {
  const router = useRouter()
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [pending, setPending] = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return
      setUserId(user.id)

      if (photos.length === 0) return

      const { data: likes } = await supabase
        .from('photo_likes')
        .select('photo_id')
        .eq('user_id', user.id)
        .in('photo_id', photos.map((p) => p.id))

      if (likes) setLikedIds(new Set(likes.map((l) => l.photo_id)))
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sorted = [...photos].sort((a, b) => b.like_count - a.like_count)
  const visible = sorted.slice(0, visibleCount)

  const toggleLike = async (photoId: string) => {
    if (!userId) {
      router.push('/login')
      return
    }
    if (pending.has(photoId)) return

    setPending((prev) => new Set(prev).add(photoId))
    const isLiked = likedIds.has(photoId)
    const supabase = createClient()

    setLikedIds((prev) => {
      const next = new Set(prev)
      if (isLiked) next.delete(photoId)
      else next.add(photoId)
      return next
    })
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId ? { ...p, like_count: p.like_count + (isLiked ? -1 : 1) } : p
      )
    )

    const { error } = isLiked
      ? await supabase.from('photo_likes').delete().eq('photo_id', photoId).eq('user_id', userId)
      : await supabase.from('photo_likes').insert({ photo_id: photoId, user_id: userId })

    if (error) {
      setLikedIds((prev) => {
        const next = new Set(prev)
        if (isLiked) next.add(photoId)
        else next.delete(photoId)
        return next
      })
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId ? { ...p, like_count: p.like_count + (isLiked ? 1 : -1) } : p
        )
      )
    }

    setPending((prev) => {
      const next = new Set(prev)
      next.delete(photoId)
      return next
    })
  }

  const handleDelete = async (photoId: string) => {
    if (!window.confirm('この写真を削除しますか？この操作は取り消せません。')) return

    const supabase = createClient()
    const target = photos.find((p) => p.id === photoId)
    const { error } = await supabase.from('shop_photos').delete().eq('id', photoId)

    if (!error) {
      if (target) {
        const storagePath = target.url.split('/shop-photos/')[1]
        if (storagePath) {
          await supabase.storage.from('shop-photos').remove([storagePath])
        }
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    }
  }

  return (
    <div className="bg-white rounded-xl border p-3">
      <div className="font-medium text-sm mb-3">店舗写真</div>

      {visible.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {visible.map((photo) => (
            <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border">
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
              {userId === photo.user_id && (
                <button
                  onClick={() => handleDelete(photo.id)}
                  className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white/90 text-red-500"
                >
                  削除
                </button>
              )}
              <button
                onClick={() => toggleLike(photo.id)}
                disabled={pending.has(photo.id)}
                className={`absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white/90 flex items-center gap-0.5 disabled:opacity-50 ${
                  likedIds.has(photo.id) ? 'text-red-500' : 'text-gray-500'
                }`}
              >
                {likedIds.has(photo.id) ? '♥' : '♡'} {photo.like_count}
              </button>
            </div>
          ))}
        </div>
      )}

      {sorted.length > visibleCount && (
        <button
          onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
          className="w-full text-center text-xs text-blue-600 hover:underline mb-3"
        >
          もっと見る
        </button>
      )}

      {photos.length === 0 && (
        <p className="text-xs text-gray-400 mb-3">まだ写真がありません</p>
      )}

      <PhotoUpload
        shopId={shopId}
        onUploaded={(newPhotos) => setPhotos((prev) => [...prev, ...newPhotos])}
      />
    </div>
  )
}
