import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export type OwnedShop = {
  id: string
  name: string
  pr_enabled: boolean
  business_hours: string | null
  cover_photo_urls: string[]
  parking_available: boolean | null
  parking_note: string | null
  review_count: number
  avg_total: number | null
  avg_stock: number | null
  avg_price: number | null
  avg_playspace: number | null
  avg_staff: number | null
  avg_access: number | null
}

// ログイン中のユーザーがプレミアム店舗のオーナーであれば { user, shop } を返す。
// オーナーでなければ null（admin-auth.ts の requireAdmin と同じ使い方）。
export async function requireShopOwner(): Promise<{ user: User; shop: OwnedShop } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // shops の select は RLS の影響を受けないよう service role で行う
  const admin = createAdminClient()
  const { data: shop } = await admin
    .from('shops')
    .select(
      'id, name, pr_enabled, business_hours, cover_photo_urls, parking_available, parking_note, review_count, avg_total, avg_stock, avg_price, avg_playspace, avg_staff, avg_access'
    )
    .eq('owner_user_id', user.id)
    .eq('is_premium', true)
    .maybeSingle()

  if (!shop) return null

  return { user, shop }
}
