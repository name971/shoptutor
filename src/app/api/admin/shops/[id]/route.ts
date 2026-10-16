import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { listAuthUsers } from '@/lib/admin-users'

const EDITABLE_FIELDS = [
  'name',
  'address',
  'prefecture',
  'lat',
  'lng',
  'status',
  'is_wpn_premium',
  'is_teaching_meister',
  'is_premium',
] as const

// メールアドレスからauthユーザーを検索する（オーナー割り当て用）
async function resolveUserIdByEmail(email: string): Promise<string | null> {
  const users = await listAuthUsers()
  for (const [id, u] of users) if (u.email?.toLowerCase() === email.toLowerCase()) return id
  return null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()

  const payload: Record<string, unknown> = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in body) payload[field] = body[field]
  }

  // owner_email: 空文字でオーナー解除、メール指定でそのユーザーをオーナーに
  if ('owner_email' in body) {
    const email = String(body.owner_email ?? '').trim()
    if (email === '') {
      payload.owner_user_id = null
    } else {
      const ownerId = await resolveUserIdByEmail(email)
      if (!ownerId) {
        return NextResponse.json({ error: 'そのメールアドレスのユーザーが見つかりません' }, { status: 400 })
      }
      payload.owner_user_id = ownerId
    }
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('shops').update(payload).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shop: data })
}
