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

  const { data: ownPhotos } = await admin.from('shop_photos').select('id, url').eq('user_id', userId)
  const ownPhotoIds = (ownPhotos ?? []).map((p) => p.id)
  // 投稿写真のファイル本体（行だけ消すと公開URLが残り続ける）
  const photoPaths = (ownPhotos ?? [])
    .map((p) => (p.url as string).split('/shop-photos/')[1])
    .filter((path): path is string => !!path)

  await admin.from('photo_likes').delete().eq('user_id', userId)
  if (ownPhotoIds.length > 0) {
    await admin.from('photo_likes').delete().in('photo_id', ownPhotoIds)
  }

  await admin.from('review_likes').delete().eq('user_id', userId)
  if (ownReviewIds.length > 0) {
    await admin.from('review_likes').delete().in('review_id', ownReviewIds)
  }

  const results = await Promise.all([
    admin.from('shop_favorites').delete().eq('user_id', userId),
    admin.from('shop_view_formats').delete().eq('viewer_id', userId),
    // 店舗オーナーだった場合は割り当てを外す（プロフィールを消せるように）
    admin.from('shops').update({ owner_user_id: null }).eq('owner_user_id', userId),
    admin.from('shop_photos').delete().eq('user_id', userId),
    admin.from('reviews').delete().eq('user_id', userId),
  ])
  const failed = results.find((r) => r.error)
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 })
  }
  if (photoPaths.length > 0) {
    await admin.storage.from('shop-photos').remove(photoPaths)
  }

  const { error: profileError } = await admin.from('profiles').delete().eq('id', userId)
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // オンボーディング済みの目印も消す
  const response = NextResponse.json({ success: true })
  response.cookies.delete('st_onboarded')
  return response
}
