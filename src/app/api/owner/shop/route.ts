import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireShopOwner } from '@/lib/owner-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { DAY_ORDER } from '@/lib/businessHours'

const EDITABLE_FIELDS = ['pr_enabled', 'business_hours', 'parking_available', 'parking_note'] as const

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const PARKING_NOTE_MAX = 100

function validateOwnerPayload(payload: Record<string, unknown>): string | null {
  if ('pr_enabled' in payload && typeof payload.pr_enabled !== 'boolean') return 'pr_enabled must be boolean'
  if ('parking_available' in payload && payload.parking_available !== null && typeof payload.parking_available !== 'boolean') {
    return 'parking_available must be boolean or null'
  }
  if ('parking_note' in payload && payload.parking_note !== null) {
    if (typeof payload.parking_note !== 'string' || payload.parking_note.length > PARKING_NOTE_MAX) {
      return `parking_note must be a string up to ${PARKING_NOTE_MAX} characters`
    }
  }
  if ('business_hours' in payload && payload.business_hours !== null) {
    if (typeof payload.business_hours !== 'string') return 'business_hours must be a JSON string or null'
    try {
      const hours = JSON.parse(payload.business_hours) as Record<string, { closed?: unknown; open?: unknown; close?: unknown }>
      for (const day of DAY_ORDER) {
        const d = hours?.[day]
        if (!d || typeof d.closed !== 'boolean' || typeof d.open !== 'string' || typeof d.close !== 'string') {
          return 'business_hours is malformed'
        }
        if (!TIME_PATTERN.test(d.open) || !TIME_PATTERN.test(d.close)) return 'business_hours has an invalid time'
      }
    } catch {
      return 'business_hours is not valid JSON'
    }
  }
  return null
}

export async function PATCH(request: Request) {
  const result = await requireShopOwner()
  if (!result) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const payload: Record<string, unknown> = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in body) payload[field] = body[field]
  }

  // 店舗ページにそのまま表示される値なので、型・長さ・形式をサーバー側でも確かめる
  const invalid = validateOwnerPayload(payload)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

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
  revalidatePath(`/shops/${result.shop.id}`)
  return NextResponse.json({ shop: data })
}
