import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const userId = user.id

  const { data: ownReviews } = await admin.from('reviews').select('id').eq('user_id', userId)
  const ownReviewIds = (ownReviews ?? []).map((r) => r.id)

  const { data: ownPhotos } = await admin.from('shop_photos').select('id').eq('user_id', userId)
  const ownPhotoIds = (ownPhotos ?? []).map((p) => p.id)

  await admin.from('photo_likes').delete().eq('user_id', userId)
  if (ownPhotoIds.length > 0) {
    await admin.from('photo_likes').delete().in('photo_id', ownPhotoIds)
  }

  await admin.from('review_likes').delete().eq('user_id', userId)
  if (ownReviewIds.length > 0) {
    await admin.from('review_likes').delete().in('review_id', ownReviewIds)
  }

  await admin.from('shop_favorites').delete().eq('user_id', userId)
  await admin.from('shop_photos').delete().eq('user_id', userId)
  await admin.from('reviews').delete().eq('user_id', userId)
  await admin.from('profiles').delete().eq('id', userId)

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
