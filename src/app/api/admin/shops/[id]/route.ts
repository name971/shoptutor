import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

const EDITABLE_FIELDS = [
  'name',
  'address',
  'prefecture',
  'lat',
  'lng',
  'status',
  'is_wpn_premium',
  'is_teaching_meister',
] as const

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()

  const payload: Record<string, unknown> = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in body) payload[field] = body[field]
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('shops').update(payload).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shop: data })
}
