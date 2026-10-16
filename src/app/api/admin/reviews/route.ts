import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { sanitizeSearch } from '@/lib/admin-users'

const PAGE_SIZE = 30

// レビュー一覧（新着順）。filter＝hidden/visible、q＝本文、offset
export async function GET(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter')
  const q = sanitizeSearch(searchParams.get('q'))
  const offset = Math.max(0, Number(searchParams.get('offset') ?? 0) || 0)

  const admin = createAdminClient()
  let query = admin
    .from('reviews')
    .select('*, shops(id, name), profiles(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (filter === 'hidden') query = query.eq('is_hidden', true)
  if (filter === 'visible') query = query.eq('is_hidden', false)
  if (q) query = query.ilike('body', `%${q}%`)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reviews: data, total: count ?? 0, pageSize: PAGE_SIZE })
}
