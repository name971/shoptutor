import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const { hidden } = await request.json()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('reviews')
    .update({
      is_hidden: !!hidden,
      hidden_at: hidden ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('shop_id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data?.shop_id) revalidatePath(`/shops/${data.shop_id}`)
  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  await admin.from('review_likes').delete().eq('review_id', id)
  const { data, error } = await admin.from('reviews').delete().eq('id', id).select('shop_id').maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data?.shop_id) revalidatePath(`/shops/${data.shop_id}`)
  return NextResponse.json({ success: true })
}
