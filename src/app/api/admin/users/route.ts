import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { listAuthUsers, sanitizeSearch } from '@/lib/admin-users'

const PAGE_SIZE = 50

// ユーザー一覧（新しい順）。q＝名前またはメールアドレス、offset
export async function GET(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const q = sanitizeSearch(searchParams.get('q'))
  const offset = Math.max(0, Number(searchParams.get('offset') ?? 0) || 0)

  const admin = createAdminClient()
  const authUsers = await listAuthUsers()

  let query = admin
    .from('profiles')
    .select('id, name, avatar_url, main_format, sub_formats, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (q) {
    const lower = q.toLowerCase()
    const emailMatches = [...authUsers.entries()]
      .filter(([, u]) => u.email?.toLowerCase().includes(lower))
      .map(([id]) => id)
      .slice(0, 200)
    query = emailMatches.length > 0 ? query.or(`name.ilike.%${q}%,id.in.(${emailMatches.join(',')})`) : query.ilike('name', `%${q}%`)
  }

  const { data: profiles, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 投稿数（レビュー・写真）
  const ids = (profiles ?? []).map((p) => p.id)
  const [reviews, photos] = ids.length
    ? await Promise.all([
        admin.from('reviews').select('user_id').in('user_id', ids),
        admin.from('shop_photos').select('user_id').eq('is_deleted', false).in('user_id', ids),
      ])
    : [{ data: [] }, { data: [] }]
  const tally = (rows: { user_id: string }[] | null) => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1)
    return m
  }
  const reviewCounts = tally(reviews.data as { user_id: string }[] | null)
  const photoCounts = tally(photos.data as { user_id: string }[] | null)

  const users = (profiles ?? []).map((p) => ({
    ...p,
    email: authUsers.get(p.id)?.email ?? null,
    banned_until: authUsers.get(p.id)?.banned_until ?? null,
    review_count: reviewCounts.get(p.id) ?? 0,
    photo_count: photoCounts.get(p.id) ?? 0,
  }))

  return NextResponse.json({ users, total: count ?? 0, pageSize: PAGE_SIZE })
}
