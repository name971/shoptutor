import { NextResponse } from 'next/server'
import { requireShopOwner } from '@/lib/owner-auth'
import { createAdminClient } from '@/lib/supabase-admin'

const EDITABLE_FIELDS = ['pr_enabled', 'business_hours', 'parking_available', 'parking_note'] as const

export async function PATCH(request: Request) {
  const result = await requireShopOwner()
  if (!result) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json()

  const payload: Record<string, unknown> = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in body) payload[field] = body[field]
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
  }

  // 更新対象はrequireShopOwnerが返した自店舗のみ（bodyのIDは信用しない）
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('shops')
    .update(payload)
    .eq('id', result.shop.id)
    .select('id, name, pr_enabled, business_hours, cover_photo_urls, parking_available, parking_note')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shop: data })
}
