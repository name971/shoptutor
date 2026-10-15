'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Star } from 'lucide-react'

type Props = {
  shopId: string
  // bar: 店舗詳細の下部アクションバー用の四角いボタン
  variant?: 'default' | 'bar'
}

export default function FavoriteButton({ shopId, variant = 'default' }: Props) {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [favorited, setFavorited] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }
      setUserId(user.id)

      const { data, error } = await supabase
        .from('shop_favorites')
        .select('shop_id')
        .eq('shop_id', shopId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error('お気に入り状態の取得に失敗しました', error)
      }
      setFavorited(!!data)
      setLoading(false)
    }
    load()
  }, [shopId])

  const toggle = async () => {
    if (!userId) {
      router.push('/login')
      return
    }
    if (pending) return

    setPending(true)
    const next = !favorited
    setFavorited(next)

    const supabase = createClient()
    const { error } = next
      ? await supabase.from('shop_favorites').insert({ shop_id: shopId, user_id: userId })
      : await supabase.from('shop_favorites').delete().eq('shop_id', shopId).eq('user_id', userId)

    if (error) {
      setFavorited(!next)
    }
    setPending(false)
  }

  if (variant === 'bar') {
    return (
      <button
        onClick={toggle}
        disabled={pending || loading}
        aria-pressed={favorited}
        aria-label={favorited ? 'お気に入りから外す' : 'お気に入りに追加'}
        className={`h-11 w-11 flex-shrink-0 rounded-xl border flex items-center justify-center transition-colors disabled:opacity-50 ${
          favorited ? 'border-yellow-300 bg-yellow-50 text-yellow-500' : 'border-gray-200 text-gray-400 hover:text-yellow-500'
        }`}
      >
        <Star size={22} className={favorited ? 'fill-yellow-400' : ''} />
      </button>
    )
  }

  if (loading) return null

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors disabled:opacity-50 flex-shrink-0 ${
        favorited ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'
      }`}
      aria-label="お気に入り"
    >
      <span className="text-2xl leading-none">{favorited ? '★' : '☆'}</span>
      <span>{favorited ? 'お気に入り済み' : 'お気に入り'}</span>
    </button>
  )
}
