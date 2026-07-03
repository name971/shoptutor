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
    .from('profiles')
    .select('id, name, avatar_url, main_format, sub_formats, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (q) {
    query = query.ilike('name', `%${q}%`)
  }

  const { data: profiles, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data: authUser } = await admin.auth.admin.getUserById(p.id)
      return {
        ...p,
        email: authUser?.user?.email ?? null,
        banned_until: authUser?.user?.banned_until ?? null,
      }
    })
  )

  return NextResponse.json({ users })
}
