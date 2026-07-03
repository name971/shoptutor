import { NextResponse } from 'next/server'
import { requireShopOwner } from '@/lib/owner-auth'
import { createAdminClient } from '@/lib/supabase-admin'

const MAX_BYTES = 1.5 * 1024 * 1024
const MAX_PHOTOS = 3

export async function POST(request: Request) {
  const result = await requireShopOwner()
  if (!result) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const formData = await request.formData()
  const files = formData.getAll('files').filter((f): f is File => f instanceof File)

  if (files.length === 0) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  const existing = result.shop.cover_photo_urls
  const remaining = MAX_PHOTOS - existing.length
  if (remaining <= 0) {
    return NextResponse.json({ error: `写真は${MAX_PHOTOS}枚まで設定できます` }, { status: 400 })
  }

  const toUpload = files.slice(0, remaining)
  for (const file of toUpload) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'ファイルサイズが大きすぎます' }, { status: 400 })
    }
    if (file.type !== 'image/webp') {
      return NextResponse.json({ error: '対応していない画像形式です' }, { status: 400 })
    }
  }

  const admin = createAdminClient()
  const newUrls: string[] = []

  for (let i = 0; i < toUpload.length; i++) {
    const path = `covers/${result.shop.id}-${Date.now()}-${i}.webp`
    const { error: uploadError } = await admin.storage
      .from('shop-photos')
      .upload(path, toUpload[i], { contentType: 'image/webp' })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = admin.storage.from('shop-photos').getPublicUrl(path)
    newUrls.push(publicUrl)
  }

  const updatedUrls = [...existing, ...newUrls]

  const { error: updateError } = await admin
    .from('shops')
    .update({ cover_photo_urls: updatedUrls })
    .eq('id', result.shop.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ cover_photo_urls: updatedUrls })
}

export async function DELETE(request: Request) {
  const result = await requireShopOwner()
  if (!result) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { url } = await request.json()
  if (typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const updatedUrls = result.shop.cover_photo_urls.filter((u) => u !== url)

  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('shops')
    .update({ cover_photo_urls: updatedUrls })
    .eq('id', result.shop.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // ストレージ側の削除は失敗しても致命的ではないため結果を待たない
  const path = url.split('/shop-photos/')[1]
  if (path) admin.storage.from('shop-photos').remove([path]).then(() => {})

  return NextResponse.json({ cover_photo_urls: updatedUrls })
}
