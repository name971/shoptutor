import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { sanitizeSearch } from '@/lib/admin-users'

const PAGE_SIZE = 50

// 店舗一覧。q＝店名・住所、status＝active/inactive、premium=1、nocoords=1（座標なし＝地図に出ない）、prefecture、offset
export async function GET(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const q = sanitizeSearch(searchParams.get('q'))
  const status = searchParams.get('status')
  const prefecture = searchParams.get('prefecture')
  const offset = Math.max(0, Number(searchParams.get('offset') ?? 0) || 0)

  const admin = createAdminClient()
  let query = admin
    .from('shops')
    .select(
      'id, name, prefecture, status, is_wpn_premium, is_teaching_meister, is_premium, pr_enabled, owner_user_id, address, lat, lng, weekly_event_count, review_count, last_seen_at',
      { count: 'exact' }
    )
    .order('prefecture', { ascending: true })
    .order('name', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1)

  if (q) query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%`)
  if (status === 'active') query = query.eq('status', 'active')
  if (status === 'inactive') query = query.neq('status', 'active')
  if (searchParams.get('premium') === '1') query = query.eq('is_premium', true)
  if (searchParams.get('nocoords') === '1') query = query.or('lat.is.null,lng.is.null')
  if (prefecture) query = query.eq('prefecture', prefecture)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // オーナーのメールアドレス（オーナーがいる店だけなので件数は少ない）
  const shops = await Promise.all(
    (data ?? []).map(async (s) => {
      if (!s.owner_user_id) return { ...s, owner_email: null }
      const { data: owner } = await admin.auth.admin.getUserById(s.owner_user_id)
      return { ...s, owner_email: owner?.user?.email ?? null }
    })
  )

  return NextResponse.json({ shops, total: count ?? 0, pageSize: PAGE_SIZE })
}
