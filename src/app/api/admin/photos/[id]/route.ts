import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  await admin.from('photo_likes').delete().eq('photo_id', id)
  const { data, error } = await admin
    .from('shop_photos')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('shop_id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data?.shop_id) revalidatePath(`/shops/${data.shop_id}`)
  return NextResponse.json({ success: true })
}
