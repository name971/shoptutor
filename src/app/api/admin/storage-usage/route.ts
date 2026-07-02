import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

const BUCKET = 'shop-photos'
const LIMIT_BYTES = 1024 * 1024 * 1024 // Supabase無料プランのファイルストレージ上限（1GB）

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: topLevel, error } = await admin.storage.from(BUCKET).list('', { limit: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let usedBytes = 0
  let fileCount = 0

  for (const entry of topLevel ?? []) {
    if (entry.id === null) {
      // フォルダ（店舗ID単位）なので中身を再帰的に取得
      const { data: files } = await admin.storage.from(BUCKET).list(entry.name, { limit: 1000 })
      for (const f of files ?? []) {
        usedBytes += f.metadata?.size ?? 0
        fileCount += 1
      }
    } else {
      usedBytes += entry.metadata?.size ?? 0
      fileCount += 1
    }
  }

  return NextResponse.json({ usedBytes, limitBytes: LIMIT_BYTES, fileCount })
}
