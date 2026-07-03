import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

export async function GET(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  const admin = createAdminClient()
  let query = admin
    .from('shops')
    .select('id, name, prefecture, status, is_wpn_premium, is_teaching_meister, is_premium, pr_enabled, owner_user_id, address, lat, lng')
    .order('name', { ascending: true })
    .limit(50)

  if (q) {
    query = query.ilike('name', `%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ shops: data })
}
