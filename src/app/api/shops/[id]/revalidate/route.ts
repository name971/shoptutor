import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase-server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 店舗詳細ページはキャッシュして配信している（1時間ごとに作り直し）。
// レビュー・写真・いいねを書いた直後は、この店舗のキャッシュだけ捨ててすぐ反映させる。
// 書き込める人＝ログイン中の人だけが呼べる（中身は作り直すだけで、何かを書き換えるわけではない）
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  revalidatePath(`/shops/${id}`)
  return NextResponse.json({ revalidated: true })
}
