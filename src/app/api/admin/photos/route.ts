import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

const PAGE_SIZE = 30

export async function GET(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const offset = Math.max(0, Number(searchParams.get('offset') ?? 0) || 0)

  const admin = createAdminClient()
  const { data, error, count } = await admin
    .from('shop_photos')
    .select('id, url, caption, created_at, is_deleted, shops(id, name), profiles(name)', { count: 'exact' })
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photos: data, total: count ?? 0, pageSize: PAGE_SIZE })
}
