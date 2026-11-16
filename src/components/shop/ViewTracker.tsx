'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'

// 店舗ページの閲覧を記録する。ページ本体はキャッシュして配信するので、記録は表示した端末から送る
// （record_shop_view はログイン中ならフォーマットも記録する。ログイン状態はブラウザのセッションで伝わる）
export default function ViewTracker({ shopId }: { shopId: string }) {
  useEffect(() => {
    const supabase = createClient()
    supabase.rpc('increment_shop_view', { shop_id_input: shopId }).then(() => {})
    supabase.rpc('record_shop_view', { shop_id_input: shopId }).then(() => {})
  }, [shopId])
  return null
}
